"""
This is a "standalone" RAG, not connected to MCP or Cline.
It works well, but needs to be somehow connected to Cline. 
"""
import os
from langchain import hub
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.graph import START, StateGraph
from typing_extensions import List, TypedDict
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import SQLiteVec
from langchain_ollama import OllamaEmbeddings

from dotenv import load_dotenv


############################### Configuration ################################# 
# - Set to True: Load/update documents in vector database (first run or when adding new docs)
# - Set to False: Skip document loading and use existing vector database (for testing)
<<<<<<< HEAD
REBUILD_VECTOR_DB = True  # Skip rebuilding to test improved prompts and questions
=======
REBUILD_VECTOR_DB = False  # Skip rebuilding to test improved prompts and questions
>>>>>>> dev

EMBEDDING_MODEL = "ollama" # "ollama" or "gemini"
###############################################################################

# Load environment variables from .env file in the rag directory
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(env_path)


# TODO it's good to do this to help trace what's going on inside the agent:

""" 
import getpass
import os

os.environ["LANGSMITH_TRACING"] = "true"
os.environ["LANGSMITH_API_KEY"] = getpass.getpass()

... or in the command line:

export LANGSMITH_TRACING="true"
export LANGSMITH_API_KEY="..."
"""

if not os.environ.get("GOOGLE_API_KEY"):
  raise ValueError('no GOOGLE_API_KEY!')

from langchain.chat_models import init_chat_model

llm = init_chat_model("gemini-2.5-flash", model_provider="google_genai")

from langchain_google_genai import GoogleGenerativeAIEmbeddings

# Path
script_dir = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.dirname(os.path.dirname(script_dir))

# Create separate vector stores for Werner-Modlin and Friedland
if EMBEDDING_MODEL == "gemini":
    embedding_function = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
    db_filename = "gemini_vector.db"
elif EMBEDDING_MODEL == "ollama":
    embedding_function = OllamaEmbeddings(
    model="nomic-embed-text:latest",base_url="http://127.0.0.1:11434"
)
    db_filename = "ollama_vector.db"
else:
    raise ValueError(f"Unsupported EMBEDDING_MODEL option: {EMBEDDING_MODEL}")

vector_store_mode = "sqlite"
db_file = os.path.join(script_dir, db_filename)

connection = SQLiteVec.create_connection(db_file=db_file)

friedland_store = SQLiteVec(table="friedland_paper", db_file=db_file, embedding=embedding_function, connection=connection)
werner_modlin_store = SQLiteVec(table="werner_modlin_paper", db_file=db_file, embedding=embedding_function, connection=connection)


if REBUILD_VECTOR_DB:
    # Load and process documents into separate tables
    assets_dir = os.path.join(repo_root, "assets", "actuarial")
    pdf_configs = [
        {
            "path": os.path.join(assets_dir, "5_Friedland_stripped_EX_appendices.pdf"),
            "store": friedland_store,
            "name": "Friedland",
            "table": "friedland_paper"
        },
        {
            "path": os.path.join(assets_dir, "5_Werner_Modlin_stripped_EX_appendices.pdf"), 
            "store": werner_modlin_store,
            "name": "Werner-Modlin",
            "table": "werner_modlin_paper"
        }
    ]

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

    for config in pdf_configs:
        pdf_path = config["path"]
        vector_store = config["store"]
        doc_name = config["name"]
        
        if os.path.exists(pdf_path):
            # Check if this table already has documents
            try:
                test_search = vector_store.similarity_search("test", k=1)
                if not test_search:
                    print(f"Loading {doc_name} paper...")
                    loader = PyPDFLoader(pdf_path)
                    docs = loader.load()
                    
                    # Add metadata
                    for doc in docs:
                        doc.metadata['source_file'] = os.path.basename(pdf_path)
                        doc.metadata['paper_type'] = doc_name
                    
                    # Chunk and add to vector store
                    chunks = text_splitter.split_documents(docs)
                    vector_store.add_documents(documents=chunks)
                    print(f"Added {len(chunks)} chunks from {doc_name} paper to {config['table']} table")
                else:
                    print(f"{doc_name} paper already loaded in {config['table']} table")
            except Exception:
                print(f"Loading {doc_name} paper...")
                loader = PyPDFLoader(pdf_path)
                docs = loader.load()
                
                # Add metadata
                for doc in docs:
                    doc.metadata['source_file'] = os.path.basename(pdf_path)
                    doc.metadata['paper_type'] = doc_name
                
                # Chunk and add to vector store
                chunks = text_splitter.split_documents(docs)
                vector_store.add_documents(documents=chunks)
                print(f"Added {len(chunks)} chunks from {doc_name} paper to {config['table']} table")
        else:
            print(f"Warning: {pdf_path} not found")
else:
    print("Skipping vector database rebuild (using existing data)\n")

# Define prompt for question-answering
# N.B. for non-US LangSmith endpoints, you may need to specify
# api_url="https://api.smith.langchain.com" in hub.pull.
# Use a custom prompt that's more encouraging

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


# Define state for application
class State(TypedDict):
    question: str
    context: List[Document]
    answer: str
    search_scope: str  # "both", "friedland", "werner-modlin"


# Define application steps
def retrieve(state: State):
    question = state["question"]
    search_scope = state.get("search_scope", "both")
    
    retrieved_docs = []
    
    if search_scope in ["both", "friedland"]:
        friedland_docs = friedland_store.similarity_search(question, k=5)  
        retrieved_docs.extend(friedland_docs)
    
    if search_scope in ["both", "werner-modlin"]:
        werner_modlin_docs = werner_modlin_store.similarity_search(question, k=5)  
        retrieved_docs.extend(werner_modlin_docs)
    
    return {"context": retrieved_docs}


def generate(state: State):
    docs_content = "\n\n".join(doc.page_content for doc in state["context"])
    messages = prompt.invoke({"question": state["question"], "context": docs_content})
    response = llm.invoke(messages)
    return {"answer": response.content}


def search_friedland(question: str) -> str:
    """Search only the Friedland paper"""
    state = {"question": question, "search_scope": "friedland"}
    result = graph.invoke(state)
    return result["answer"]

def search_werner_modlin(question: str) -> str:
    """Search only the Werner-Modlin paper"""
    state = {"question": question, "search_scope": "werner-modlin"}
    result = graph.invoke(state)
    return result["answer"]

def search_both_papers(question: str) -> str:
    """Search both papers"""
    state = {"question": question, "search_scope": "both"}
    result = graph.invoke(state)
    return result["answer"]

def debug_search(question: str, search_scope: str = "both"):
    """Debug function to show what chunks are being retrieved"""
    print(f"=== DEBUG: Searching for '{question}' in {search_scope} ===")
    
    retrieved_docs = []
    if search_scope in ["both", "friedland"]:
        friedland_docs = friedland_store.similarity_search(question, k=3)
        retrieved_docs.extend(friedland_docs)
        print(f"Found {len(friedland_docs)} chunks from Friedland paper")
    
    if search_scope in ["both", "werner-modlin"]:
        werner_modlin_docs = werner_modlin_store.similarity_search(question, k=3)
        retrieved_docs.extend(werner_modlin_docs)
        print(f"Found {len(werner_modlin_docs)} chunks from Werner-Modlin paper")
    
    for i, doc in enumerate(retrieved_docs[:3]): 
        print(f"\nChunk {i+1} (from {doc.metadata.get('paper_type', 'unknown')}):")
        print(f"  Page: {doc.metadata.get('page_label', 'unknown')}")
        print(f"  Content: {doc.page_content[:300]}...")
    print("=" * 50)


# Compile application and test
graph_builder = StateGraph(State).add_sequence([retrieve, generate])
graph_builder.add_edge(START, "retrieve")
graph = graph_builder.compile()

if __name__ == "__main__":
    print(f"REBUILD_VECTOR_DB = {REBUILD_VECTOR_DB}")
    print(f"Database location: {db_file}")
    print(f"Assets directory: {os.path.join(repo_root, 'assets', 'actuarial')}")
    print("(Change REBUILD_VECTOR_DB to False at top of file to skip document loading)\n")
    
    # Test 1: Debug what chunks are retrieved for better understanding
    debug_search("What is the Bornhuetter-Ferguson technique and how does it work?", "friedland")
    
    # Test searching both papers
    print("1. Searching both papers:")
    response = search_both_papers("What is the difference between the Friedland and Werner-Modlin papers?")
    print(f"Answer: {response}\n")
    
    # Test searching only Friedland paper with more specific question
    print("2. Searching only Friedland paper:")
    friedland_response = search_friedland("What is the Bornhuetter-Ferguson technique and how does it work?")
    print(f"Answer: {friedland_response}\n")
    
    # Test searching only Werner-Modlin paper with more specific question
    print("3. Searching only Werner-Modlin paper:")
    werner_response = search_werner_modlin("What is a loss ratio and how is it calculated?")
    print(f"Answer: {werner_response}\n")
    
    # Test with very specific actuarial question
    print("4. Testing specific technique:")
    technique_response = search_friedland("Explain the expected claims method in actuarial analysis")
    print(f"Answer: {technique_response}\n")