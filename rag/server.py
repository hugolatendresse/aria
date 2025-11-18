### RAG tool that is not connected to the rest of cline

# RAG Structure
# Large chunks stored in a docstore (LocalFileStore - file-system based storage)
# Small chunks stored in sqlite_vec
# Semantic search done on small chunks
# Small chunks point to big chunks, which are passed to context
# Need to wrap LocalFileStore with create_kv_docstore to handle Document objects


############################### Configuration #################################
EMBEDDING_MODEL = "ollama"  # "ollama" to run locally or "gemini" to run with api key

# Options: "recursive" or "unstructured"
CHUNKING_STRATEGY = "recursive"  # works well 

# SQLite table name (all PDFs will be stored in this single table)
SQLITE_TABLE_NAME_PREFIX = "actuarial_docs"  # Choose a descriptive name for your collection
SQLITE_TABLE_NAME = SQLITE_TABLE_NAME_PREFIX + "_" + CHUNKING_STRATEGY


###############################################################################


import logging
import os
import sys
from dotenv import load_dotenv
from typing import List
from core.get_root_path import get_root_path
from core.create_thread_safe_connection import create_thread_safe_connection
from core.prompt import PROMPT
from core.search import get_rag_chain, search
from mcp.server.fastmcp import FastMCP
from langchain.chat_models import init_chat_model
from langchain_classic.retrievers import ParentDocumentRetriever
from langchain_community.vectorstores import SQLiteVec
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_ollama import OllamaEmbeddings


# Set up logging to stderr to avoid interfering with JSON-RPC over stdout
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Create an MCP server
mcp = FastMCP("Actuarial-RAG")

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(env_path)

if not os.environ.get("GOOGLE_API_KEY"):
    if EMBEDDING_MODEL == "gemini":
        raise ValueError('no GOOGLE_API_KEY!')
    else:
        print("Warning: GOOGLE_API_KEY not set. Gemini models will fail.")

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

db_file = os.path.join(script_dir, db_filename)


# When not rebuilding, use existing database with thread-safe connection
vectorstore = create_thread_safe_connection(db_file)
vectorstore = SQLiteVec(
    table=SQLITE_TABLE_NAME,
    embedding=embedding_function,
    db_file=db_file,
    connection=vectorstore,
)

# Initialize the retriever with existing stores
retriever = ParentDocumentRetriever(
    vectorstore=vectorstore,
    docstore=store,
    child_splitter=child_splitter,
    parent_splitter=parent_splitter,
)



rag_chain = get_rag_chain(retriever, PROMPT, llm)



def generate_answer(question: str, context_docs: List[Document]) -> str:
    """Generate answer using retrieved context"""
    docs_content = "\n\n".join(doc.page_content for doc in context_docs)
    messages = PROMPT.invoke({"question": question, "context": docs_content})
    response = llm.invoke(messages)
    return response.content


@mcp.tool()
def search_friedland_paper(prompt: str) -> str:
    """Search the Friedland actuarial paper for information"""
    retrieved_docs = friedland_store.similarity_search(prompt, k=5)
    return generate_answer(prompt, retrieved_docs)
    
if __name__ == "__main__":
    mcp.run()