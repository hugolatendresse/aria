############################### Configuration #################################
# - Set to True: Load/update documents in vector database (first run or when adding new docs)
# - Set to False: Skip document loading and use existing vector database (for testing)
REBUILD_VECTOR_DB = False  # Set to False after first run to test queries

EMBEDDING_MODEL = "ollama"  # "ollama" or "gemini"

SQLITE_TABLE_NAME = "friedland_two_chapters"
PDF_ENGLISH_NAME = "Friedland Two Chapter"

# PDF_FILENAME = "5_Friedland_stripped_EX_appendices.pdf"
PDF_FILENAME = "5_Friedland_two_chapters.pdf"

"""
EXISTING TABLES
friedland_splits -> all of friedland
friedland_two_chapters -> BF and CapeCod chapters only 
"""

###############################################################################

import os
import shutil
from langchain import hub
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing_extensions import List, TypedDict
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import SQLiteVec
from langchain_ollama import OllamaEmbeddings
from langchain.chat_models import init_chat_model
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.storage import LocalFileStore, create_kv_docstore
from langchain.retrievers import ParentDocumentRetriever

from dotenv import load_dotenv

from get_root_path import get_root_path

# Load environment variables from .env file (if it exists)
# Assumes .env is in the same directory as the script
env_path = os.path.join(get_root_path(), '.env')
load_dotenv(env_path)

if not os.environ.get("GOOGLE_API_KEY"):
    print("Warning: GOOGLE_API_KEY not set. Gemini models will fail.")
    # You might want to raise an error if Gemini is selected:
    # if EMBEDDING_MODEL == "gemini":
    #     raise ValueError('no GOOGLE_API_KEY!')


llm = init_chat_model("gemini-2.0-flash-exp", model_provider="google_genai")

# Path
script_dir = os.path.dirname(os.path.abspath(__file__))
# Assuming script is in a 'scripts' dir, one level down from repo root
repo_root = get_root_path()

# Select embedding model
if EMBEDDING_MODEL == "gemini":
    embedding_function = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
    db_filename = "gemini_vector.db"
elif EMBEDDING_MODEL == "ollama":
    embedding_function = OllamaEmbeddings(
        model="nomic-embed-text:latest", base_url="http://127.0.0.1:11434"
    )
    db_filename = "ollama_vector.db"
else:
    raise ValueError(f"Unsupported EMBEDDING_MODEL option: {EMBEDDING_MODEL}")

# Define paths for database and document store
db_path = os.path.join(script_dir, db_filename)
docstore_path = os.path.join(script_dir, "docstore")

# --- Initialize Stores and Splitters ---
# These are needed for both rebuilding and searching

# TODO this should all not be done when we don't rebuild

# Parent splitter: chunks the document into larger, contextually-rich pieces
parent_splitter = RecursiveCharacterTextSplitter(chunk_size=2048)

# Child splitter: splits the parent chunks into smaller, semantically-specific pieces
# These smaller chunks are ideal for embedding and vector search
child_splitter = RecursiveCharacterTextSplitter(chunk_size=512)

# The file system store for the large parent chunks
# Need to wrap LocalFileStore with create_kv_docstore to handle Document objects
fs_store = LocalFileStore(root_path=docstore_path)
store = create_kv_docstore(fs_store)

def inspect_langchain_text_splitters_results():
    """
    Inspect the splits after retriever.add_documents() completes.
    This function needs to be called AFTER the vector DB is rebuilt.
    """
    # First check if stores have content
    if not os.path.exists(docstore_path):
        print("Error: Docstore not found. Set REBUILD_VECTOR_DB=True first.")
        return
    
    # 1. Inspect the docstore (parent chunks)
    print("\n=== DOCSTORE (Parent Chunks) ===")
    # Get all keys from the document store
    all_parent_ids = list(store.yield_keys())
    print(f"Total parent chunks: {len(all_parent_ids)}")
    
    for i, doc_id in enumerate(all_parent_ids[:5]):  # Show first 5
        parent_doc = store.mget([doc_id])[0]
        if parent_doc:
            print(f"\n--- Parent Chunk {i+1} (ID: {doc_id}) ---")
            print(f"Content length: {len(parent_doc.page_content)} chars")
            print(f"Metadata: {parent_doc.metadata}")
            print(f"Content preview:\n{parent_doc.page_content[:300]}...")
            print(f"...{parent_doc.page_content[-150:]}")  # Show end too

    # 2. Inspect split boundaries (most useful!)
    print("\n\n=== DETAILED SPLIT ANALYSIS (First 3 Parents) ===")
    for i, doc_id in enumerate(all_parent_ids[:3]):
        parent_doc = store.mget([doc_id])[0]
        if parent_doc:
            print(f"\n{'='*80}")
            print(f"PARENT {i+1} | ID: {doc_id} | Length: {len(parent_doc.page_content)} chars")
            print(f"Page: {parent_doc.metadata.get('page', 'N/A')} | Source: {parent_doc.metadata.get('source', 'N/A')}")
            print(f"{'='*80}")
            print(parent_doc.page_content[:800])  # Show more content
            if len(parent_doc.page_content) > 800:
                print(f"\n... [{len(parent_doc.page_content) - 1600} chars omitted] ...\n")
                print(parent_doc.page_content[-800:])
            print(f"\n{'-'*80}\n")

    # 3. Show statistics
    print("\n=== STATISTICS ===")
    parent_lengths = []
    page_distribution = {}
    
    for doc_id in all_parent_ids:
        parent_doc = store.mget([doc_id])[0]
        if parent_doc:
            parent_lengths.append(len(parent_doc.page_content))
            page_num = parent_doc.metadata.get('page', 'unknown')
            page_distribution[page_num] = page_distribution.get(page_num, 0) + 1
    
    if parent_lengths:
        print(f"Average parent chunk size: {sum(parent_lengths)/len(parent_lengths):.0f} chars")
        print(f"Min parent chunk size: {min(parent_lengths)} chars")
        print(f"Max parent chunk size: {max(parent_lengths)} chars")
        print(f"\nChunks per page (first 10 pages):")
        for page, count in sorted(page_distribution.items())[:10]:
            print(f"  Page {page}: {count} parent chunks")

inspect_langchain_text_splitters_results()

# Create a thread-safe SQLite connection with sqlite_vec extension
def create_thread_safe_connection(db_file: str):
    import sqlite3
    import sqlite_vec
    
    connection = sqlite3.connect(db_file, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.enable_load_extension(True)
    sqlite_vec.load(connection)
    connection.enable_load_extension(False)
    return connection

if REBUILD_VECTOR_DB:
    print(f"Rebuilding vector database: {db_path}")
    print(f"Rebuilding document store: {docstore_path}")
    
    # --- Clean up old stores ---
    shutil.rmtree(docstore_path, ignore_errors=True)
    if os.path.exists(db_path):
        os.remove(db_path)

    # --- Re-initialize empty stores ---
    # Create a thread-safe connection with sqlite_vec extension
    connection = create_thread_safe_connection(db_path)
    vectorstore = SQLiteVec(
        table=SQLITE_TABLE_NAME,
        embedding=embedding_function,
        db_file=db_path,
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
    assets_dir = os.path.join(repo_root, "assets", "actuarial")
    pdf_configs = [
        {
            "path": os.path.join(assets_dir, PDF_FILENAME),
            "name": "PDF_ENGLISH_NAME",
        },
    ]

    for config in pdf_configs:
        pdf_path = config["path"]
        if not os.path.exists(pdf_path):
            print(f"Warning: PDF not found at {pdf_path}. Skipping.")
            continue
            
        print(f"Loading document: {config['name']}...")
        loader = PyPDFLoader(pdf_path)
        docs = loader.load()
        
        # Add metadata to identify the source
        for doc in docs:
            doc.metadata["source"] = config["name"]
            
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
else:
    # When not rebuilding, use existing database with thread-safe connection
    connection = create_thread_safe_connection(db_path)
    vectorstore = SQLiteVec(
        table=SQLITE_TABLE_NAME,
        embedding=embedding_function,
        db_file=db_path,
        connection=connection,
    )
    
    # Initialize the retriever with existing stores
    retriever = ParentDocumentRetriever(
        vectorstore=vectorstore,
        docstore=store,
        child_splitter=child_splitter,
        parent_splitter=parent_splitter,
    )
    
    print(f"Using existing vector database: {db_path}\n")

# Define prompt for question-answering
prompt = ChatPromptTemplate.from_template("""
You are an expert actuary assistant. Use the following context from actuarial documents to answer the question.

Context from actuarial documents:
{context}

Question: {question}

Instructions:
- Provide a detailed answer based on the actuarial context provided
- If the context contains relevant information, explain it thoroughly
- Include specific details, formulas, or methods mentioned in the context
- Do not ever make inferences, only rely on the context provided
- Say "I don't know" if the context is completely unrelated to the question

Answer:""")


# --- Define the RAG Chain ---
# This chain orchestrates the entire process:
# 1. The `retriever` gets the question and finds relevant child chunks,
#    then automatically merges them into their parent chunks.
# 2. The `prompt` receives the parent chunks (as context) and the question.
# 3. The `llm` generates an answer based on the prompt.
# 4. The `StrOutputParser` cleans up the output.
rag_chain = (
    {"context": retriever, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

def search_friedland(question: str):
    """
    Queries the RAG chain with a specific question.
    """
    print(f"\n--- Searching for: '{question}' ---")
    
    # Uncomment the line below to see the retrieved parent chunks
    # print("\nRetrieved Context:\n", retriever.invoke(question))
    
    return rag_chain.invoke(question)


# --- Test Searching ---

friedland_response = search_friedland("What is the Bornhuetter-Ferguson technique and how does it work?")
print(f"Answer: {friedland_response}\n")
    
technique_response = search_friedland("When is the Bornhuetter-Ferguson technique most useful, and when does it not work well?")
print(f"Answer: {technique_response}\n")

no_context_response = search_friedland("What is the best recipe for a chocolate cake?")
print(f"Answer: {no_context_response}\n")