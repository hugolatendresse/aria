from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser


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
