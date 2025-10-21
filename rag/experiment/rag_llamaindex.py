############################### Configuration ################################# 
# - Set to True: Load/update documents in vector database (first run or when adding new docs)
# - Set to False: Skip document loading and use existing vector database (for testing)
REBUILD_VECTOR_DB = True  # Skip rebuilding to test improved prompts and questions

EMBEDDING_MODEL = "ollama" # "ollama" or "gemini"
###############################################################################

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
from langchain.chat_models import init_chat_model
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from dotenv import load_dotenv


# Load environment variables from .env file in the rag directory
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(env_path)

if not os.environ.get("GOOGLE_API_KEY"):
  raise ValueError('no GOOGLE_API_KEY!')


llm = init_chat_model("gemini-2.5-flash", model_provider="google_genai")

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


if REBUILD_VECTOR_DB:
    assets_dir = os.path.join(repo_root, "assets", "actuarial")
    pdf_configs = [
        {
            "path": os.path.join(assets_dir, "5_Friedland_stripped_EX_appendices.pdf"),
            "name": "Friedland",
        },
    ]

    # TODO

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


# Test searching 

friedland_response = search_friedland("What is the Bornhuetter-Ferguson technique and how does it work?")
print(f"Answer: {friedland_response}\n")
    
technique_response = search_friedland("Explain the expected claims method in actuarial analysis")
print(f"Answer: {technique_response}\n")