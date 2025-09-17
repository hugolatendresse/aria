import sys
import logging
import os
from mcp.server.fastmcp import FastMCP
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.vectorstores import SQLiteVec
from langchain_ollama import OllamaEmbeddings
from langchain.chat_models import init_chat_model
from dotenv import load_dotenv
from typing import List

# Set up logging to stderr to avoid interfering with JSON-RPC over stdout
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file in the rag directory
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(env_path)

# Create an MCP server
mcp = FastMCP("Actuarial-RAG")

# Hybrid approach: Ollama embeddings + Gemini LLM
if not os.environ.get("GOOGLE_API_KEY"):
    raise ValueError('no GOOGLE_API_KEY!')

embeddings = OllamaEmbeddings(
    model="nomic-embed-text:latest", base_url="http://127.0.0.1:11434"
)
llm = init_chat_model("gemini-2.5-flash", model_provider="google_genai")

# Connect to existing vector database
script_dir = os.path.dirname(os.path.abspath(__file__))
db_file = os.path.join(script_dir, "ollama_vector.db")
connection = SQLiteVec.create_connection(db_file=db_file)

# Connect to existing vector stores (no building, just connecting)
friedland_store = SQLiteVec(table="friedland_paper", db_file=db_file, embedding=embeddings, connection=connection)
werner_modlin_store = SQLiteVec(table="werner_modlin_paper", db_file=db_file, embedding=embeddings, connection=connection)

# Prompt template from rag.py
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

def generate_answer(question: str, context_docs: List[Document]) -> str:
    """Generate answer using retrieved context"""
    docs_content = "\n\n".join(doc.page_content for doc in context_docs)
    messages = prompt.invoke({"question": question, "context": docs_content})
    response = llm.invoke(messages)
    return response.content


@mcp.tool()
def search_friedland_paper(prompt: str) -> str:
    """Search the Friedland actuarial paper for information"""
    retrieved_docs = friedland_store.similarity_search(prompt, k=5)
    return generate_answer(prompt, retrieved_docs)
    
@mcp.tool()
def search_werner_modlin_paper(prompt: str) -> str:
    """Search the Werner-Modlin actuarial paper for information"""
    retrieved_docs = werner_modlin_store.similarity_search(prompt, k=5)
    return generate_answer(prompt, retrieved_docs)

@mcp.tool()
def search_both_papers(prompt: str) -> str:
    """Search both actuarial papers for information"""
    friedland_docs = friedland_store.similarity_search(prompt, k=5)
    werner_modlin_docs = werner_modlin_store.similarity_search(prompt, k=5)
    all_docs = friedland_docs + werner_modlin_docs
    return generate_answer(prompt, all_docs)


if __name__ == "__main__":
    mcp.run()