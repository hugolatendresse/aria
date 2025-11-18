from core.create_thread_safe_connection import create_thread_safe_connection
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_community.vectorstores import SQLiteVec
from langchain_classic.retrievers import ParentDocumentRetriever


def get_retriever_from_existing_db(db_file, table_name, embedding_function, docstore, child_splitter, parent_splitter):
    print(f"Using existing vector database: {db_file}\n")
    fs_store = LocalFileStore(root_path=docstore_path)
    store: BaseStore[str, Document] = create_kv_docstore(fs_store)


    # When not rebuilding, use existing database with thread-safe connection
    connection = create_thread_safe_connection(db_file)
    vectorstore = SQLiteVec(
        table=table_name,
        embedding=embedding_function,
        db_file=db_file,
        connection=connection,
    )
    
    # Initialize the retriever with existing stores
    retriever = ParentDocumentRetriever(
        vectorstore=vectorstore,
        docstore=docstore,
        child_splitter=child_splitter,
        parent_splitter=parent_splitter,
    )
    
    return retriever


def get_rag_chain(retriever, prompt, llm):
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
    return rag_chain



def search(question: str, rag_chain, print_question=False, print_retrieved=False, retriever=None):
    """
    Queries the RAG chain with a specific question.
    """
    if print_question:
        print(f"\n--- Searching for: '{question}' ---")

    if retriever and print_retrieved:
        print("\n ***** Retrieved Context: ********\n", retriever.invoke(question))
        print("\n ***** End of retrieved Context: ********\n")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!! Actual answer: !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    elif print_retrieved:
        print("WARNING: did not provide a retriever for print in search()")

    return rag_chain.invoke(question)
