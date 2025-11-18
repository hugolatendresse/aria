import os
from core.chunking_strategies import get_splitters
from langchain_ollama import OllamaEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv
from core.get_root_path import get_root_path

def init_rag(embedding_model, chunking_strategy):
    env_path = os.path.join(get_root_path(), '.env')
    load_dotenv(env_path)

    if not os.environ.get("GOOGLE_API_KEY"):
        if embedding_model == "gemini":
            raise ValueError('no GOOGLE_API_KEY!')
        else:
            print("Warning: GOOGLE_API_KEY not set. Gemini models will fail.")


    # Select embedding model
    if embedding_model == "gemini":
        embedding_function = GoogleGenerativeAIEmbeddings(
            model="models/embedding-001")
        db_filename = "gemini_vector.db"
    elif embedding_model == "ollama":
        embedding_function = OllamaEmbeddings(
            model="nomic-embed-text:latest", base_url="http://127.0.0.1:11434"
        )
        db_filename = "ollama_vector.db"
    else:
        raise ValueError(f"Unsupported EMBEDDING_MODEL option: {embedding_model}")

    script_dir = os.path.dirname(os.path.abspath(__file__))

    db_file = os.path.join(script_dir, db_filename)
    docstore_path = os.path.join(script_dir, "docstore")
    parent_splitter, child_splitter = get_splitters(chunking_strategy)

    return embedding_function, db_file, docstore_path, parent_splitter, child_splitter
