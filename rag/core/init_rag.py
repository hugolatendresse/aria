import os
from core.chunking_strategies import get_splitters
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv
from core.get_root_path import get_root_path

# Standardized embedding model for Aria RAG
# Using Gemini's text-embedding-004 for both index building and query embedding
GEMINI_EMBEDDING_MODEL = "models/text-embedding-004"


def init_rag(chunking_strategy: str):
    """
    Initialize RAG components with Gemini embeddings.
    
    Args:
        chunking_strategy: The chunking strategy to use ("recursive" or "unstructured")
    
    Returns:
        Tuple of (embedding_function, db_file, docstore_path, parent_splitter, child_splitter)
    """
    env_path = os.path.join(get_root_path(), '.env')
    load_dotenv(env_path)

    if not os.environ.get("GOOGLE_API_KEY"):
        raise ValueError(
            'GOOGLE_API_KEY environment variable is required. '
            'Get your API key from https://makersuite.google.com/app/apikey'
        )

    # Always use Gemini embeddings for consistency between index building and querying
    embedding_function = GoogleGenerativeAIEmbeddings(model=GEMINI_EMBEDDING_MODEL)
    db_filename = "gemini_vector.db"

    script_dir = os.path.dirname(os.path.abspath(__file__))

    db_file = os.path.join(script_dir, db_filename)
    docstore_path = os.path.join(script_dir, "docstore")
    parent_splitter, child_splitter = get_splitters(chunking_strategy)

    return embedding_function, db_file, docstore_path, parent_splitter, child_splitter
