
import shutil
from core.create_thread_safe_connection import create_thread_safe_connection
from langchain_classic.storage import LocalFileStore, create_kv_docstore
from langchain_community.vectorstores import SQLiteVec
from langchain_classic.retrievers import ParentDocumentRetriever
import os
from core.get_root_path import get_root_path

from langchain_community.document_loaders import PyPDFLoader


def build_db_and_get_retriever(pdf_configs, db_file, table_name, embedding_function, docstore_path, child_splitter, parent_splitter):
    print(f"Rebuilding vector database: {db_file}")
    print(f"Rebuilding document store: {docstore_path}")

    # --- Clean up old stores ---
    shutil.rmtree(docstore_path, ignore_errors=True)
    if os.path.exists(db_file):
        os.remove(db_file)

    # --- Re-initialize empty stores ---
    # Create a thread-safe connection with sqlite_vec extension
    connection = create_thread_safe_connection(db_file)
    vectorstore = SQLiteVec(
        table=table_name,
        embedding=embedding_function,
        db_file=db_file,
        connection=connection,
    )
    # Recreate the document store wrapper
    fs_store = LocalFileStore(root_path=docstore_path)
    store = create_kv_docstore(fs_store)

    # Initialize the retriever with fresh stores
    retriever = ParentDocumentRetriever(
        vectorstore=vectorstore,
        docstore=store,
        child_splitter=child_splitter,
        parent_splitter=parent_splitter,
    )

    # --- Load and Process Documents ---
    repo_root = get_root_path()
    assets_dir = os.path.join(repo_root, "assets", "actuarial")

    # Build the list of PDFs to process from the configuration
    pdf_configs = [
        {
            "path": os.path.join(assets_dir, filename),
            "name": english_name,
        }
        for filename, english_name in pdf_configs
    ]

    print(f"Processing {len(pdf_configs)} PDF(s):")
    for config in pdf_configs:
        print(f"  - {config['name']}")
    print()

    for config in pdf_configs:
        pdf_path = config["path"]
        if not os.path.exists(pdf_path):
            print(f"Warning: PDF not found at {pdf_path}. Skipping.")
            continue

        print(f"Loading document: {config['name']}...")
        loader = PyPDFLoader(pdf_path)
        docs = loader.load()

        # Add metadata to identify the source
        # Preserve the original file path and add a friendly name
        for doc in docs:
            # Store actual file path for Unstructured
            doc.metadata["pdf_path"] = pdf_path
            doc.metadata["source_name"] = config["name"]  # Store friendly name
            # Keep original 'source' from PyPDFLoader which has the path

        print(f"Adding {len(docs)} pages to the retriever...")
        # This one command does all the work:
        # 1. Splits docs with parent_splitter
        # 2. Stores parent chunks in the FileSystemStore
        # 3. Splits parent chunks with child_splitter
        # 4. Creates embeddings for child chunks
        # 5. Stores child chunks in the SQLiteVec vector store
        # 6. Links parent and child chunks
        retriever.add_documents(docs, ids=None)

    print("\nVector database rebuild complete.\n")

