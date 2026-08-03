import os


def inspect_langchain_text_splitters_results(store, docstore_path):
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
