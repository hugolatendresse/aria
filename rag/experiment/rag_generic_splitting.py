############################### Configuration #################################
# - Set to True: Load/update documents in vector database (first run or when adding new docs)
# - Set to False: Skip document loading and use existing vector database (for testing)
REBUILD_VECTOR_DB = True  # Set to False after first run to test queries

# Embedding model selection
EMBEDDING_MODEL = "ollama"  # "ollama" to run locally or "gemini" to run with api key

# Chunking strategy selection
# Options: "recursive" or "unstructured"
CHUNKING_STRATEGY = "recursive"  # works well 
# CHUNKING_STRATEGY = "unstructured" # doesn't work well

# SQLite table name (all PDFs will be stored in this single table)
SQLITE_TABLE_NAME_PREFIX = "actuarial_docs"  # Choose a descriptive name for your collection
SQLITE_TABLE_NAME = SQLITE_TABLE_NAME_PREFIX + "_" + CHUNKING_STRATEGY

# PDF Configuration
# List all PDFs you want to process. All chunks will be stored in the same table
# for unified vector search across all documents.
# Format: (filename, friendly_name)
PDF_CONFIGS = [
    ("5_Friedland_stripped_EX_appendices.pdf", "Friedland Whole"),
    ("5_Werner_Modlin_stripped_EX_appendices.pdf", "Werner Whole"),
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

import os
import shutil
from langchain.chat_models import init_chat_model
from langchain_classic.storage import LocalFileStore, create_kv_docstore
from langchain_classic.retrievers import ParentDocumentRetriever
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import SQLiteVec
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_ollama import OllamaEmbeddings

from dotenv import load_dotenv

from get_root_path import get_root_path
from chunking_strategies import get_chunking_strategy

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
db_file = os.path.join(script_dir, db_filename)
docstore_path = os.path.join(script_dir, "docstore")

# TODO there might be some extra chunking work here that should not be redone when we don't rebuild

# --- Initialize Chunking Strategy ---
# Select and configure the chunking strategy based on configuration
print(f"Using chunking strategy: {CHUNKING_STRATEGY}")

try:
    if CHUNKING_STRATEGY == "recursive":
        # Recursive text splitter with default settings
        chunking_strategy = get_chunking_strategy(
            "recursive",
            parent_chunk_size=2048,
            child_chunk_size=512,
            chunk_overlap=0
        )
    elif CHUNKING_STRATEGY == "unstructured":
        # Unstructured.io structure-aware chunking
        chunking_strategy = get_chunking_strategy(
            "unstructured",
            parent_max_chars=2000,
            child_max_chars=500,
            combine_under_n_chars=200,
            new_after_n_chars=1500,
            strategy="fast",  # "fast" doesn't require tesseract, "hi_res" does
            infer_table_structure=True
        )
    else:
        raise ValueError(f"Unknown CHUNKING_STRATEGY: {CHUNKING_STRATEGY}")
    
    print(f"Strategy details: {chunking_strategy.get_description()}")
    
except ImportError as e:
    print(f"Error initializing chunking strategy: {e}")
    print("Falling back to recursive text splitter...")
    chunking_strategy = get_chunking_strategy("recursive")

# Get the splitters from the strategy
parent_splitter = chunking_strategy.get_parent_splitter()
child_splitter = chunking_strategy.get_child_splitter()

# --- Initialize Document Store ---
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

# inspect_langchain_text_splitters_results() # TODO decide on some logic to run this?

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
        table=SQLITE_TABLE_NAME,
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
    assets_dir = os.path.join(repo_root, "assets", "actuarial")
    
    # Build the list of PDFs to process from the configuration
    pdf_configs = [
        {
            "path": os.path.join(assets_dir, filename),
            "name": english_name,
        }
        for filename, english_name in PDF_CONFIGS
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
            doc.metadata["pdf_path"] = pdf_path  # Store actual file path for Unstructured
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
else:
    # When not rebuilding, use existing database with thread-safe connection
    connection = create_thread_safe_connection(db_file)
    vectorstore = SQLiteVec(
        table=SQLITE_TABLE_NAME,
        embedding=embedding_function,
        db_file=db_file,
        connection=connection,
    )
    
    # Initialize the retriever with existing stores
    retriever = ParentDocumentRetriever(
        vectorstore=vectorstore,
        docstore=store,
        child_splitter=child_splitter,
        parent_splitter=parent_splitter,
    )
    
    print(f"Using existing vector database: {db_file}\n")

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

def search(question: str, print_retrieved=False):
    """
    Queries the RAG chain with a specific question.
    """
    if print_retrieved:
        print(f"\n--- Searching for: '{question}' ---")
        print("\n ***** Retrieved Context: ********\n", retriever.invoke(question))
        print("\n ***** End of retrieved Context: ********\n")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!! Actual answer: !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    
    return rag_chain.invoke(question)


# --- Test Searching ---

friedland_response2 = search("When is the Bornhuetter-Ferguson technique most useful, and when does it not work well?")
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

werner_response = search("How can CART (Classification and Regression Trees) help actuaries?")
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

no_context_response = search("What is the best recipe for a chocolate cake?")
print(f"Answer: {no_context_response}\n")
"""Expected:
nothing
"""

westminster_response = search("State section 2(1) of the Statute of Westminster")
print(f"Answer: {westminster_response}\n")
"""
Expected:
In Canada, no law and no provision of any law made after the commencement of this Act by the Parliament of a Dominion shall be void or inoperative on the ground that it is repugnant to the Law of England, or to the provisions of any existing or future Act of Parliament of the United Kingdom, or to any order, rule or regulation made under any such Act, and the powers of the Parliament of a Dominion shall include the power to repeal or amend any such Act, order, rule or regulation in so far as the same is part of the law of the Dominion.
"""
