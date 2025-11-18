# RAG tool that is not directly connected to the rest of cline
# This script is necessary to create the vector store!
# It can also be used for retrieval

# RAG Structure
# Large chunks stored in a docstore (LocalFileStore - file-system based storage)
# Small chunks stored in sqlite_vec
# Semantic search done on small chunks
# Small chunks point to big chunks, which are passed to context
# Need to wrap LocalFileStore with create_kv_docstore to handle Document objects

############################### Configuration #################################
# - Set to True: Load/update documents in vector database (first run or when adding new docs)
# - Set to False: Skip document loading and use existing vector database (for testing)
from langchain_ollama import OllamaEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_core.stores import BaseStore
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.prompts import ChatPromptTemplate
from langchain.chat_models import init_chat_model
from core.search import get_rag_chain, search, get_retriever_from_existing_db
from core.prompt import PROMPT
from core.chunking_strategies import get_splitters
from core.get_root_path import get_root_path
from core.build import build_db_and_get_retriever
from dotenv import load_dotenv
import warnings
import os
REBUILD_VECTOR_DB = False  # Set to False after first run to test queries

# Embedding model selection
EMBEDDING_MODEL = "ollama"  # "ollama" to run locally or "gemini" to run with api key

# Options: "recursive" or "unstructured"
CHUNKING_STRATEGY = "recursive"  # works well
# CHUNKING_STRATEGY = "unstructured" # doesn't work well

# SQLite table name (all PDFs will be stored in this single table)
# Choose a descriptive name for your collection
SQLITE_TABLE_NAME_PREFIX = "actuarial_docs"
SQLITE_TABLE_NAME = SQLITE_TABLE_NAME_PREFIX + "_" + CHUNKING_STRATEGY

# PDF Configuration
# List all PDFs you want to process. All chunks will be stored in the same table
# for unified vector search across all documents.
# Format: (filename, friendly_name)
PDF_CONFIGS = [
    ("5_Friedland_stripped_EX_appendices.pdf", "Friedland Entire Text"),
    ("5_Werner_Modlin_stripped_EX_appendices.pdf", "Werner Entire Text"),
    # ("Statute of Westminster.pdf", "Statute of Westminster"),
    # ("5_Friedland_two_chapters.pdf", "Friedland Two Chapters"),
]

"""
EXISTING TABLES
friedland_splits -> all of friedland
friedland_two_chapters -> BF and CapeCod chapters only 

CHUNKING STRATEGIES
recursive -> RecursiveCharacterTextSplitter (general-purpose, fast)
unstructured -> Unstructured.io (structure-aware, preserves hierarchy)
"""

###############################################################################


# Common issue when parsing pdfs. Can ignore - most of the content gets parsed correctly.
warnings.filterwarnings("ignore", message=".*Ignoring wrong pointing object.*")


env_path = os.path.join(get_root_path(), '.env')
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


def init_rag(embedding_model, chunking_strategy):
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

    db_file = os.path.join(script_dir, db_filename)
    docstore_path = os.path.join(script_dir, "docstore")
    parent_splitter, child_splitter = get_splitters()

    return embedding_function, db_file, docstore_path, parent_splitter, child_splitter

embedding_function, db_file, docstore_path, parent_splitter, child_splitter = init_rag(embedding_model = EMBEDDING_MODEL, chunking_strategy=CHUNKING_STRATEGY)


if REBUILD_VECTOR_DB:
    retriever = build_db_and_get_retriever(pdf_configs=PDF_CONFIGS, db_file=db_file, table_name=SQLITE_TABLE_NAME, embedding_function=embedding_function,
                                           docstore_path=docstore_path, child_splitter=child_splitter, parent_splitter=parent_splitter)

else:
    retriever = get_retriever_from_existing_db(db_file=db_file, table_name=SQLITE_TABLE_NAME, embedding_function=embedding_function,
                                               docstore_path=docstore_path, child_splitter=child_splitter, parent_splitter=parent_splitter)


if __name__ == "__main__":
    rag_chain = get_rag_chain(retriever, PROMPT, llm)

    # --- Test Searching ---

    friedland_response2 = search(
        "When is the Bornhuetter-Ferguson technique most useful, and when does it not work well?", rag_chain=rag_chain, print_question=True)
    print(f"Answer: {friedland_response2}\n")
    """
    Expected:
    An advantage of the Bornhuetter-Ferguson technique is that random fluctuations early in the life
    of an accident year (or other defined time interval) do not significantly distort the projections. For
    example, if several large and unusual claims are reported for an accident year, then the reported
    claim development technique may produce overly conservative ultimate claims estimates. This
    situation does not, however, seriously distort the Bornhuetter-Ferguson technique.
    Actuaries frequently use the Bornhuetter-Ferguson method for long-tail lines of insurance,
    particularly for the most immature years, due to the highly leveraged nature of claim development
    factors for such lines. Actuaries may also use the Bornhuetter-Ferguson technique if the data is
    extremely thin or volatile or both. For example, when an insurer has recently entered a new line
    of business or a new territory and there is not yet a credible volume of historical claim
    development experience, an actuary may use the Bornhuetter-Ferguson technique. In such
    circumstances, the actuary would likely need to rely on benchmarks, either from similar lines at
    the same insurer or insurance industry experience, for development patterns and expected claim
    ratios (or pure premiums). (See previous comments about the use of industry benchmarks.)
    In a discussion of when to use the Bornhuetter-Ferguson method in the paper “The Actuary and
    IBNR,” the authors state: “It can be argued that the most prudent course is, when in doubt, to use
    expected losses, in as much as it is certainly indicated for volatile lines, and in the case of a stable
    line, the expected loss ratio should be predictable enough so that both techniques produce the
    same result.”56
    The Bornhuetter-Ferguson technique can be a useful method for very short-tail lines as well as
    long-tail lines. For very short-tail lines, the IBNR can be set equal to a multiple of the last few
    months’ earned premium; this is essentially an application of the Bornhuetter-Ferguson
    technique.
    """

    werner_response = search(
        "How can CART (Classification and Regression Trees) help actuaries?", rag_chain=rag_chain, print_question=True)
    print(f"Answer: {werner_response}\n")
    """
    Expected:
    The purpose of CART (Classification and Regression Trees) is to develop tree-building algorithms to
    determine a set of if-then logical conditions that help improve classification.
    In personal automobile insurance, a resulting tree may start with an if-then condition around gender. If
    the risk is male, the tree then continues to another if-then condition around age. If the risk is male and
    youthful, the tree may then continue to an if-then condition involving prior accident experience. The tree
    “branch” for females may involve a different order or in fact, a completely different set of conditions.
    Examination of the tree may help ratemaking actuaries identify:
    - the strongest list of initial variables (i.e., whittle down a long list of potential variables to a more manageable yet meaningful list)
    - determine how to categorize each variable. 
    - CART can also help detect interactions between variables.
    """

    no_context_response = search(
        "What is the best recipe for a chocolate cake?", rag_chain=rag_chain, print_question=True)
    print(f"Answer: {no_context_response}\n")
    """Expected:
    nothing
    """

    westminster_response = search(
        "State section 2(1) of the Statute of Westminster", rag_chain=rag_chain, print_question=True)
    print(f"Answer: {westminster_response}\n")
    """
    Expected:
    In Canada, no law and no provision of any law made after the commencement of this Act by the Parliament of a Dominion shall be void or inoperative on the ground that it is repugnant to the Law of England, or to the provisions of any existing or future Act of Parliament of the United Kingdom, or to any order, rule or regulation made under any such Act, and the powers of the Parliament of a Dominion shall include the power to repeal or amend any such Act, order, rule or regulation in so far as the same is part of the law of the Dominion.
    """
