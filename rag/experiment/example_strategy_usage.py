"""
Example usage of different chunking strategies.

This demonstrates how to switch between chunking strategies easily.
"""

from chunking_strategies import get_chunking_strategy

# === Example 1: Recursive Text Splitter (Default) ===
print("=" * 80)
print("Example 1: Recursive Text Splitter")
print("=" * 80)

# Get the recursive strategy with custom parameters
recursive_strategy = get_chunking_strategy(
    "recursive",
    parent_chunk_size=2048,
    child_chunk_size=512,
    chunk_overlap=50  # Add some overlap between chunks
)

print(f"Strategy Name: {recursive_strategy.get_strategy_name()}")
print(f"Description: {recursive_strategy.get_description()}")
print()

# Get the splitters
parent_splitter = recursive_strategy.get_parent_splitter()
child_splitter = recursive_strategy.get_child_splitter()
print(f"Parent splitter: {parent_splitter}")
print(f"Child splitter: {child_splitter}")
print()


# === Example 2: Unstructured.io Chunking ===
print("=" * 80)
print("Example 2: Unstructured.io Structure-Aware Chunking")
print("=" * 80)

try:
    # Get the unstructured strategy
    unstructured_strategy = get_chunking_strategy(
        "unstructured",
        parent_max_chars=2000,
        child_max_chars=500,
        combine_under_n_chars=200,
        new_after_n_chars=1500,
        strategy="hi_res",  # Use high-resolution parsing for better structure detection
        infer_table_structure=True  # Preserve table structure
    )
    
    print(f"Strategy Name: {unstructured_strategy.get_strategy_name()}")
    print(f"Description: {unstructured_strategy.get_description()}")
    print()
    
    # Get the splitters
    parent_splitter = unstructured_strategy.get_parent_splitter()
    child_splitter = unstructured_strategy.get_child_splitter()
    print(f"Parent splitter: {parent_splitter}")
    print(f"Child splitter: {child_splitter}")
    print()
    
except ImportError as e:
    print(f"Unstructured.io not available: {e}")
    print("To use this strategy, install: pip install unstructured[pdf]")
    print()


# === Example 3: Switching Strategies Dynamically ===
print("=" * 80)
print("Example 3: Dynamic Strategy Selection")
print("=" * 80)

def get_strategy_for_document_type(doc_type: str):
    """
    Select appropriate chunking strategy based on document type.
    
    Args:
        doc_type: Type of document ("structured" or "unstructured")
    
    Returns:
        ChunkingStrategy: Appropriate strategy for the document type
    """
    if doc_type == "structured":
        # For documents with clear structure (academic papers, legal docs, etc.)
        try:
            return get_chunking_strategy(
                "unstructured",
                parent_max_chars=2000,
                child_max_chars=500
            )
        except ImportError:
            print("Warning: Unstructured.io not available, falling back to recursive")
            return get_chunking_strategy("recursive")
    else:
        # For general text documents
        return get_chunking_strategy("recursive", parent_chunk_size=2048)


# Example usage
for doc_type in ["structured", "unstructured"]:
    strategy = get_strategy_for_document_type(doc_type)
    print(f"Document type '{doc_type}' uses: {strategy.get_strategy_name()}")

print()
print("=" * 80)
print("All examples completed!")
print("=" * 80)

