############################### Configuration #################################
# - Set to True: Load/update documents in vector database (first run or when adding new docs)
# - Set to False: Skip document loading and use existing vector database (for testing)
REBUILD_VECTOR_DB = True  # Set to False after first run to test queries

EMBEDDING_MODEL = "ollama"  # "ollama" or "gemini"
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
from langchain.storage import LocalFileStore
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


llm = init_chat_model("gemini-1.5-flash", model_provider="google_genai")

# Path
script_dir = os.path.dirname(os.path.abspath(__file__))
# Assuming script is in a 'scripts' dir, one level down from repo root
repo_root = get_root_path()

# Create separate vector stores for Werner-Modlin and Friedland
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

# Parent splitter: chunks the document into larger, contextually-rich pieces
parent_splitter = RecursiveCharacterTextSplitter(chunk_size=2048)

# Child splitter: splits the parent chunks into smaller, semantically-specific pieces
# These smaller chunks are ideal for embedding and vector search
child_splitter = RecursiveCharacterTextSplitter(chunk_size=512)

# The vector store for the small child chunks
connection = SQLiteVec.create_connection(db_file=db_path)
vectorstore = SQLiteVec(
    table="friedland_splits",
    embedding=embedding_function,
    db_file=db_path,
    connection=connection,
)

# The file system store for the large parent chunks
store = LocalFileStore(root_path=docstore_path)

# Initialize the retriever
retriever = ParentDocumentRetriever(
    vectorstore=vectorstore,
    docstore=store,
    child_splitter=child_splitter,
    parent_splitter=parent_splitter,
)

if REBUILD_VECTOR_DB:
    print(f"Rebuilding vector database: {db_path}")
    print(f"Rebuilding document store: {docstore_path}")
    
    # --- Clean up old stores ---
    shutil.rmtree(docstore_path, ignore_errors=True)
    if os.path.exists(db_path):
        os.remove(db_path)

    # --- Re-initialize empty stores ---
    # This is necessary after deleting the files
    vectorstore = SQLiteVec(
        table="friedland_splits",
        embedding=embedding_function,
        db_file=db_path,
        connection=connection,
    )
    store = LocalFileStore(root_path=docstore_path)
    retriever.vectorstore = vectorstore
    retriever.docstore = store

    # --- Load and Process Documents ---
    assets_dir = os.path.join(repo_root, "assets", "actuarial")
    pdf_configs = [
        {
            "path": os.path.join(assets_dir, "5_Friedland_stripped_EX_appendices.pdf"),
            "name": "Friedland",
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
    print(f"Skipping vector database rebuild, using existing data from: {db_path}\n")

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