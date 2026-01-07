#!/usr/bin/env python3
"""
Export the RAG index to a JSON file for use in the Aria VS Code extension.

This script:
1. Builds/loads the vector database using Gemini embeddings
2. Exports all parent document chunks with their embeddings to a single JSON file
3. The JSON file can then be bundled with the VS Code extension

Usage:
    python export_index.py [--rebuild]
    
    --rebuild: Force rebuild of the vector database before exporting
"""

import argparse
import json
import os
import sys
import warnings
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


def get_embeddings_from_db(db_file: str, table_name: str, embedding_function) -> dict[str, list[float]]:
    """
    Extract embeddings from the SQLite vector database.
    
    Note: We need to re-embed the parent documents since the SQLite DB
    only stores child chunk embeddings.
    """
    from core.create_thread_safe_connection import create_thread_safe_connection
    
    connection = create_thread_safe_connection(db_file)
    cursor = connection.cursor()
    
    # Get all child chunks with their parent IDs
    cursor.execute(f"SELECT rowid, text FROM {table_name}")
    rows = cursor.fetchall()
    
    print(f"Found {len(rows)} child chunks in vector database")
    
    return {}


def embed_parent_documents(documents: dict[str, Any], embedding_function) -> dict[str, list[float]]:
    """
    Generate embeddings for all parent documents.
    
    Args:
        documents: Dictionary mapping doc IDs to document content
        embedding_function: The Gemini embedding function
    
    Returns:
        Dictionary mapping document IDs to their embedding vectors
    """
    print(f"Generating embeddings for {len(documents)} parent documents...")
    
    embeddings = {}
    doc_ids = list(documents.keys())
    contents = [documents[doc_id]["content"] for doc_id in doc_ids]
    
    # Embed in batches to avoid rate limiting
    batch_size = 50
    for i in range(0, len(contents), batch_size):
        batch_contents = contents[i:i + batch_size]
        batch_ids = doc_ids[i:i + batch_size]
        
        print(f"  Embedding batch {i // batch_size + 1}/{(len(contents) + batch_size - 1) // batch_size}...")
        
        batch_embeddings = embedding_function.embed_documents(batch_contents)
        
        for doc_id, embedding in zip(batch_ids, batch_embeddings):
            embeddings[doc_id] = embedding
    
    print(f"Generated {len(embeddings)} embeddings")
    return embeddings


def export_index(output_path: str, rebuild: bool = False):
    """
    Export the RAG index to a JSON file.
    
    Args:
        output_path: Path to write the JSON index file
        rebuild: Whether to rebuild the vector database first
    """
    print("=" * 60)
    print("Aria RAG Index Export")
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
    
    # Get all parent documents
    print("\nExtracting parent documents...")
    documents = get_all_parent_documents(docstore_path)
    
    # Generate embeddings for parent documents
    print("\nGenerating embeddings for parent documents...")
    embeddings = embed_parent_documents(documents, embedding_function)
    
    # Build the export index
    print("\nBuilding export index...")
    index = {
        "version": 1,
        "embedding_model": GEMINI_EMBEDDING_MODEL,
        "chunking_strategy": CHUNKING_STRATEGY,
        "documents": []
    }
    
    for doc_id, doc_data in documents.items():
        if doc_id in embeddings:
            index["documents"].append({
                "id": doc_id,
                "content": doc_data["content"],
                "metadata": doc_data["metadata"],
                "embedding": embeddings[doc_id]
            })
    
    print(f"Index contains {len(index['documents'])} documents")
    
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
