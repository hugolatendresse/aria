"""
This is a "standalone" RAG, not connected to MCP or Cline.
It works well, but needs to be somehow connected to Cline. 
"""

import numpy
import getpass
import os
import bs4
from langchain import hub
from langchain_community.document_loaders import WebBaseLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.graph import START, StateGraph
from typing_extensions import List, TypedDict
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_community.embeddings.sentence_transformer import SentenceTransformerEmbeddings
from langchain_community.vectorstores import SQLiteVec

from dotenv import load_dotenv
load_dotenv()


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


if not os.environ.get("GOOGLE_API_KEY"):
  raise ValueError('no GOOGLE_API_KEY!')

from langchain_google_genai import GoogleGenerativeAIEmbeddings

embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")


vector_store_mode = "sqlite"
db_file = "/tmp/vec.db"
table = "asop12"

if vector_store_mode == "inmemory":
    vector_store = InMemoryVectorStore(embeddings)
elif vector_store_mode == "sqlite":
    # embedding_function = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
    embedding_function = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
    connection = SQLiteVec.create_connection(db_file=db_file)
    # db1 = SQLiteVec(
    # table="asop12", embedding=embedding_function, connection=connection
    # )
    vector_store = SQLiteVec(table=table, db_file=db_file, embedding=embedding_function, connection=connection)


# Define prompt for question-answering
# N.B. for non-US LangSmith endpoints, you may need to specify
# api_url="https://api.smith.langchain.com" in hub.pull.
prompt = hub.pull("rlm/rag-prompt")


# Define state for application
class State(TypedDict):
    question: str
    context: List[Document]
    answer: str


# Define application steps
def retrieve(state: State):
    retrieved_docs = vector_store.similarity_search(state["question"])
    return {"context": retrieved_docs}


def generate(state: State):
    docs_content = "\n\n".join(doc.page_content for doc in state["context"])
    messages = prompt.invoke({"question": state["question"], "context": docs_content})
    response = llm.invoke(messages)
    return {"answer": response.content}


# Compile application and test
graph_builder = StateGraph(State).add_sequence([retrieve, generate])
graph_builder.add_edge(START, "retrieve")
graph = graph_builder.compile()

response = graph.invoke({"question": "Give me the exact, word-for-word definition of Adverse Selection in ASOP 12"})
print(response["answer"])
"""
Expected:
Adverse Selection — Actions taken by one party using risk characteristics or other
information known to or suspected by that party that cause a financial disadvantage to the
financial or personal security system (sometimes referred to as antiselection).
"""