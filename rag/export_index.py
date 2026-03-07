#!/usr/bin/env python3
"""
Export the RAG index to a JSON file for use in the Aria VS Code extension.

This script preserves the parent-child chunk hierarchy from the RAG system:
- Child chunks (small, ~400 chars) are embedded and used for semantic search
- Parent chunks (large, ~2000 chars) contain the actual context returned to the LLM
- Each child chunk has a parent_id linking to its parent chunk

The JSON file can then be bundled with the VS Code extension.

Usage:
    python export_index.py [--rebuild]
    
    --rebuild: Force rebuild of the vector database before exporting
"""

import argparse
import base64
import json
import math
import os
import struct
import sys
import warnings
import sqlite3
from typing import Any

# Add the rag directory to the path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.init_rag import init_rag, GEMINI_EMBEDDING_MODEL
from core.build import build_db_and_get_retriever
from core.search import get_retriever_from_existing_db
from core.get_root_path import get_root_path
from langchain_classic.storage import LocalFileStore, create_kv_docstore


# Suppress PDF parsing warnings
warnings.filterwarnings("ignore", message=".*Ignoring wrong pointing object.*")

# Configuration
CHUNKING_STRATEGY = "recursive"
SQLITE_TABLE_NAME_PREFIX = "actuarial_docs"
SQLITE_TABLE_NAME = SQLITE_TABLE_NAME_PREFIX + "_" + CHUNKING_STRATEGY

PDF_CONFIGS = [
    ("5_Friedland_stripped_EX_appendices.pdf", "Friedland Entire Text"),
    ("5_Werner_Modlin_stripped_EX_appendices.pdf", "Werner Entire Text"),
]


def get_all_parent_documents(docstore_path: str) -> dict[str, Any]:
    """
    Read all parent documents from the docstore.
    
    Returns:
        Dictionary mapping document IDs to their content and metadata
    """
    fs_store = LocalFileStore(root_path=docstore_path)
    store = create_kv_docstore(fs_store)
    
    # Get all document IDs from the filesystem
    doc_ids = []
    for filename in os.listdir(docstore_path):
        # Each file in the docstore is named by its document ID
        if os.path.isfile(os.path.join(docstore_path, filename)):
            doc_ids.append(filename)
    
    print(f"Found {len(doc_ids)} parent documents in docstore")
    
    documents = {}
    for doc_id in doc_ids:
        try:
            doc = store.mget([doc_id])[0]
            if doc is not None:
                documents[doc_id] = {
                    "content": doc.page_content,
                    "metadata": doc.metadata
                }
        except Exception as e:
            print(f"Warning: Could not load document {doc_id}: {e}")
    
    print(f"Successfully loaded {len(documents)} parent documents")
    return documents


def get_child_chunks_from_db(db_file: str, table_name: str) -> list[dict[str, Any]]:
    """
    Extract all child chunks with their metadata (including parent_id) from SQLite.
    
    Returns:
        List of child chunk dictionaries with text, metadata, and embedding
    """
    # Use plain sqlite3 to read the data (sqlite_vec extension not needed for reading)
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    # Get all child chunks with text, metadata, and embedding
    cursor.execute(f"SELECT rowid, text, metadata, text_embedding FROM {table_name}")
    rows = cursor.fetchall()
    
    print(f"Found {len(rows)} child chunks in vector database")
    
    child_chunks = []
    for row in rows:
        rowid, text, metadata_blob, embedding_blob = row
        
        # Parse metadata JSON from blob
        if isinstance(metadata_blob, bytes):
            metadata = json.loads(metadata_blob.decode('utf-8'))
        elif isinstance(metadata_blob, str):
            metadata = json.loads(metadata_blob)
        else:
            metadata = {}
        
        # Extract parent_id from metadata (set by ParentDocumentRetriever)
        parent_id = metadata.get("doc_id")
        
        if not parent_id:
            print(f"Warning: Child chunk {rowid} has no parent doc_id in metadata")
            continue
        
        # Parse embedding from blob
        # sqlite_vec stores embeddings as float32 arrays
        if embedding_blob:
            # Determine number of floats (4 bytes each)
            num_floats = len(embedding_blob) // 4
            embedding = list(struct.unpack(f'{num_floats}f', embedding_blob))
        else:
            embedding = None
        
        if embedding is None:
            print(f"Warning: Child chunk {rowid} has no embedding")
            continue
            
        child_chunks.append({
            "id": str(rowid),
            "text": text,
            "parent_id": parent_id,
            "metadata": {
                "source_name": metadata.get("source_name"),
                "page": metadata.get("page"),
            },
            "embedding": embedding
        })
    
    conn.close()
    print(f"Successfully extracted {len(child_chunks)} child chunks with embeddings")
    return child_chunks


def export_index(output_path: str, rebuild: bool = False):
    """
    Export the RAG index to a JSON file, preserving parent-child hierarchy.
    
    The exported index contains:
    - parent_chunks: Large context chunks (content only, no embeddings)
    - child_chunks: Small search chunks (with embeddings and parent_id references)
    
    At search time: embed query → search child chunks → return parent content
    
    Args:
        output_path: Path to write the JSON index file
        rebuild: Whether to rebuild the vector database first
    """
    print("=" * 60)
    print("Aria RAG Index Export (Parent-Child Hierarchy)")
    print("=" * 60)
    
    # Initialize RAG components
    embedding_function, db_file, docstore_path, parent_splitter, child_splitter = init_rag(
        chunking_strategy=CHUNKING_STRATEGY
    )
    
    print(f"\nEmbedding model: {GEMINI_EMBEDDING_MODEL}")
    print(f"Database file: {db_file}")
    print(f"Docstore path: {docstore_path}")
    print()
    
    # Build or load the retriever
    if rebuild or not os.path.exists(db_file):
        print("Building vector database...")
        retriever = build_db_and_get_retriever(
            pdf_configs=PDF_CONFIGS,
            db_file=db_file,
            table_name=SQLITE_TABLE_NAME,
            embedding_function=embedding_function,
            docstore_path=docstore_path,
            child_splitter=child_splitter,
            parent_splitter=parent_splitter
        )
    else:
        print("Using existing vector database...")
        retriever = get_retriever_from_existing_db(
            db_file=db_file,
            table_name=SQLITE_TABLE_NAME,
            embedding_function=embedding_function,
            docstore_path=docstore_path,
            child_splitter=child_splitter,
            parent_splitter=parent_splitter
        )
    
    # Get all parent documents from docstore
    print("\nExtracting parent documents from docstore...")
    parent_documents = get_all_parent_documents(docstore_path)
    
    # Get all child chunks with embeddings from SQLite
    print("\nExtracting child chunks with embeddings from SQLite...")
    child_chunks = get_child_chunks_from_db(db_file, SQLITE_TABLE_NAME)
    
    # Validate parent-child relationships
    orphan_count = 0
    for child in child_chunks:
        if child["parent_id"] not in parent_documents:
            orphan_count += 1
    if orphan_count > 0:
        print(f"Warning: {orphan_count} child chunks have missing parent documents")
    
    # Build the export index with parent-child hierarchy
    print("\nBuilding export index with parent-child hierarchy...")
    index = {
        "version": 2,  # Version 2 = parent-child hierarchy
        "embedding_model": GEMINI_EMBEDDING_MODEL,
        "chunking_strategy": CHUNKING_STRATEGY,
        "parent_chunks": [],
        "child_chunks": []
    }
    
    # Add parent chunks (content only, no embeddings)
    for doc_id, doc_data in parent_documents.items():
        index["parent_chunks"].append({
            "id": doc_id,
            "content": doc_data["content"],
            "metadata": doc_data["metadata"]
        })
    
    # Add child chunks (with embeddings and parent_id)
    for child in child_chunks:
        index["child_chunks"].append({
            "id": child["id"],
            "text": child["text"],
            "parent_id": child["parent_id"],
            "metadata": child["metadata"],
            "embedding": child["embedding"]
        })
    
    print(f"Index contains {len(index['parent_chunks'])} parent chunks")
    print(f"Index contains {len(index['child_chunks'])} child chunks")
    
    # Write to JSON file
    print(f"\nWriting index to {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)
    
    # Get file size
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Index file size: {file_size_mb:.2f} MB")
    
    print("\n" + "=" * 60)
    print("Export complete!")
    print("=" * 60)


def quantize_index(input_path: str, output_path: str):
    """
    Quantize an existing v2 index to v3 with scalar quantization (float32 → uint8).

    Uses global min/max across all embedding values to map to [0, 255].
    Embeddings are stored as base64-encoded uint8 arrays.
    """
    print("=" * 60)
    print("Aria RAG Index Quantization (float32 → uint8)")
    print("=" * 60)

    print(f"\nReading index from {input_path}...")
    with open(input_path, "r", encoding="utf-8") as f:
        index = json.load(f)

    if index.get("version") == 3:
        print("Index is already quantized (version 3). Nothing to do.")
        return

    if index.get("version") != 2:
        print(f"Error: Expected version 2 index, got version {index.get('version')}")
        return

    child_chunks = index["child_chunks"]
    print(f"Found {len(child_chunks)} child chunks to quantize")

    # Compute global min/max across all embedding values
    global_min = math.inf
    global_max = -math.inf
    for chunk in child_chunks:
        emb = chunk["embedding"]
        chunk_min = min(emb)
        chunk_max = max(emb)
        if chunk_min < global_min:
            global_min = chunk_min
        if chunk_max > global_max:
            global_max = chunk_max

    scale = (global_max - global_min) / 255.0
    print(f"Global min: {global_min:.6f}, max: {global_max:.6f}, scale: {scale:.6f}")

    # Quantize each embedding to uint8 and base64-encode
    for chunk in child_chunks:
        emb = chunk["embedding"]
        quantized = bytes(
            min(255, max(0, round((v - global_min) / scale)))
            for v in emb
        )
        chunk["embedding"] = base64.b64encode(quantized).decode("ascii")

    # Update index metadata
    index["version"] = 3
    index["quantization"] = {
        "min": global_min,
        "scale": scale,
    }

    # Write quantized index
    print(f"\nWriting quantized index to {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)

    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    input_size_mb = os.path.getsize(input_path) / (1024 * 1024)
    print(f"Original size: {input_size_mb:.2f} MB")
    print(f"Quantized size: {file_size_mb:.2f} MB")
    print(f"Reduction: {(1 - file_size_mb / input_size_mb) * 100:.1f}%")

    print("\n" + "=" * 60)
    print("Quantization complete!")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Export the RAG index to a JSON file for the Aria VS Code extension"
    )
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Force rebuild of the vector database before exporting"
    )
    parser.add_argument(
        "--quantize",
        action="store_true",
        help="Quantize embeddings from float32 to uint8 (can run on existing index)"
    )
    parser.add_argument(
        "--input",
        type=str,
        default=None,
        help="Input path for quantization (default: dist/actuarial-index.json)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output path for the JSON index file (default: dist/actuarial-index.json)"
    )

    args = parser.parse_args()

    repo_root = get_root_path()
    default_path = os.path.join(repo_root, "dist", "actuarial-index.json")

    if args.quantize and not args.rebuild:
        # Quantize-only mode: read existing index, quantize, write output
        input_path = args.input or default_path
        output_path = args.output or default_path
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        quantize_index(input_path, output_path)
    else:
        # Export mode (optionally with rebuild)
        output_path = args.output or default_path
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        export_index(output_path, rebuild=args.rebuild)

        # If --quantize flag is also set, quantize the just-exported index
        if args.quantize:
            quantize_index(output_path, output_path)


if __name__ == "__main__":
    main()
