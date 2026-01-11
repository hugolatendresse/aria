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
import json
import os
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

# Configuration - must match rag_standalone.py
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
            import struct
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
        "--output",
        type=str,
        default=None,
        help="Output path for the JSON index file (default: dist/actuarial-index.json)"
    )
    
    args = parser.parse_args()
    
    # Default output path
    if args.output:
        output_path = args.output
    else:
        repo_root = get_root_path()
        output_path = os.path.join(repo_root, "dist", "actuarial-index.json")
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    export_index(output_path, rebuild=args.rebuild)


if __name__ == "__main__":
    main()
