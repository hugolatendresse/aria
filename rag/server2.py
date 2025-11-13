"""
server.py had unexplicable conflicts in #38.
The two versions are now in server1.py and server2.py. We need to choose one!
"""


# TODO switch to technologies I have in rag.py

# server.py
from mcp.server.fastmcp import FastMCP
from langchain.chains import RetrievalQA
from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import CharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_ollama.llms import OllamaLLM
from langchain_ollama import OllamaEmbeddings

# Create an MCP server
mcp = FastMCP("RAG")

embeddings = OllamaEmbeddings(
    model="nomic-embed-text:latest",base_url="http://127.0.0.1:11434"
)
model = OllamaLLM(model="qwen2.5",base_url="http://127.0.0.1:11434")

#RAG 1
loader = TextLoader("/home/hugo/code/aria/assets/actuarial/dummy.txt")
data = loader.load()
#Document Transformer
text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
texts = text_splitter.split_documents(data)
#Vector DB
docsearch = Chroma.from_documents(texts, embeddings)
#Retriever
qa=RetrievalQA.from_chain_type(llm=model,retriever=docsearch.as_retriever())

#RAG 2
loader = TextLoader("/home/hugo/code/aria/assets/actuarial/dummy2.txt")
data = loader.load()
#Document Transformer
text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
texts = text_splitter.split_documents(data)
#Vector DB
docsearch = Chroma.from_documents(texts, embeddings)
#Retriever
qa2=RetrievalQA.from_chain_type(llm=model,retriever=docsearch.as_retriever())


@mcp.tool()
def retrieve_asop12(prompt: str) -> str:
    """get information on ASOP 12"""
    return qa.run(prompt)
    
@mcp.tool()
def retrieve_animal_names(prompt: str) -> str:
    """get information on animal names"""
    return qa2.run(prompt)

if __name__ == "__main__":
    mcp.run()