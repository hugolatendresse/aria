# Modular RAG Chunking Strategies

This document explains how to use the modular chunking architecture in the RAG system.

## Overview

The RAG system has been refactored to support pluggable chunking strategies. You can now easily switch between different document chunking methods without modifying the core RAG logic.

## Architecture

### Core Components

1. **`chunking_strategies.py`** - Contains all chunking strategy implementations
   - `ChunkingStrategy` (Abstract base class)
   - `RecursiveTextSplitterStrategy` (Default strategy)
   - `UnstructuredChunkingStrategy` (Structure-aware strategy)
   - `get_chunking_strategy()` (Factory function)

2. **`rag_generic_splitting.py`** - Main RAG script that uses the strategies
   - Configuration at the top for easy switching
   - Uses the selected strategy to split documents
   - Everything else remains unchanged

3. **`example_strategy_usage.py`** - Examples of how to use different strategies

## Available Chunking Strategies

### 1. Recursive Text Splitter (Default)

**Best for:** General-purpose text documents without specific structure requirements

**How it works:**
- Splits text recursively by trying different separators in order
- First tries paragraphs, then sentences, then characters
- Simple, fast, and reliable

**Configuration:**
```python
CHUNKING_STRATEGY = "recursive"
```

**Parameters:**
- `parent_chunk_size`: Size of parent chunks (default: 2048 characters)
- `child_chunk_size`: Size of child chunks (default: 512 characters)
- `chunk_overlap`: Overlap between chunks to maintain context (default: 0)

**Example:**
```python
strategy = get_chunking_strategy(
    "recursive",
    parent_chunk_size=2048,
    child_chunk_size=512,
    chunk_overlap=50  # Add 50 char overlap between chunks
)
```

### 2. Unstructured.io Chunking (Structure-Aware)

**Best for:** Documents with clear hierarchical structure (academic papers, technical docs, legal documents)

**How it works:**
- Uses Unstructured.io to parse PDFs with structure detection
- Preserves document hierarchy (chapters, sections, subsections)
- Detects and preserves tables
- Chunks by titles/sections rather than arbitrary character counts

**Configuration:**
```python
CHUNKING_STRATEGY = "unstructured"
```

**Requirements:**
```bash
pip install unstructured[pdf]
```

**Parameters:**
- `parent_max_chars`: Maximum characters for parent chunks (default: 2000)
- `child_max_chars`: Maximum characters for child chunks (default: 500)
- `combine_under_n_chars`: Combine small chunks under this size (default: 200)
- `new_after_n_chars`: Soft limit for starting new chunks (default: 1500)
- `strategy`: Unstructured parsing strategy - "hi_res" or "fast" (default: "hi_res")
- `infer_table_structure`: Whether to detect tables (default: True)

**Example:**
```python
strategy = get_chunking_strategy(
    "unstructured",
    parent_max_chars=2000,
    child_max_chars=500,
    combine_under_n_chars=200,
    new_after_n_chars=1500,
    strategy="hi_res",  # High-res parsing for better structure detection
    infer_table_structure=True  # Preserve table structure
)
```

## How to Switch Strategies

### Method 1: Configuration Variable (Easiest)

Edit the configuration at the top of `rag_generic_splitting.py`:

```python
# Change this line
CHUNKING_STRATEGY = "recursive"  # or "unstructured"
```

That's it! The script will automatically use the selected strategy.

### Method 2: Programmatic Selection

```python
from chunking_strategies import get_chunking_strategy

# Get the strategy
strategy = get_chunking_strategy("recursive")  # or "unstructured"

# Get the splitters
parent_splitter = strategy.get_parent_splitter()
child_splitter = strategy.get_child_splitter()

# Use with ParentDocumentRetriever
retriever = ParentDocumentRetriever(
    vectorstore=vectorstore,
    docstore=store,
    child_splitter=child_splitter,
    parent_splitter=parent_splitter,
)
```

### Method 3: Dynamic Selection Based on Document Type

```python
def get_strategy_for_document(doc_type: str):
    """Select strategy based on document characteristics."""
    if doc_type in ["academic", "legal", "technical"]:
        # Use structure-aware chunking for structured documents
        try:
            return get_chunking_strategy("unstructured")
        except ImportError:
            print("Warning: Unstructured not available, using recursive")
            return get_chunking_strategy("recursive")
    else:
        # Use simple recursive chunking for general text
        return get_chunking_strategy("recursive")

# Use it
strategy = get_strategy_for_document("academic")
```

## Creating Your Own Chunking Strategy

To add a new chunking strategy:

1. **Create a new class** in `chunking_strategies.py` that inherits from `ChunkingStrategy`

```python
class MyCustomStrategy(ChunkingStrategy):
    def __init__(self, **kwargs):
        # Initialize your strategy
        pass
    
    def get_parent_splitter(self):
        # Return a splitter for parent chunks
        return my_parent_splitter
    
    def get_child_splitter(self):
        # Return a splitter for child chunks
        return my_child_splitter
    
    def get_strategy_name(self) -> str:
        return "MyCustomStrategy"
    
    def get_description(self) -> str:
        return "Description of how my strategy works"
```

2. **Register it** in the `get_chunking_strategy()` factory function:

```python
strategies = {
    "recursive": RecursiveTextSplitterStrategy,
    "unstructured": UnstructuredChunkingStrategy,
    "custom": MyCustomStrategy,  # Add your strategy
}
```

3. **Use it** by setting `CHUNKING_STRATEGY = "custom"` in the configuration

## Splitter Interface Requirements

Your custom splitters must implement the `split_documents()` method:

```python
def split_documents(self, documents: List[Document]) -> List[Document]:
    """
    Split a list of documents into chunks.
    
    Args:
        documents: List of LangChain Document objects
    
    Returns:
        List of chunked Document objects with preserved metadata
    """
    # Your chunking logic here
    return chunked_documents
```

## Comparison of Strategies

| Feature | Recursive | Unstructured |
|---------|-----------|--------------|
| **Speed** | Fast | Slower (more processing) |
| **Structure Preservation** | No | Yes (chapters, sections) |
| **Table Detection** | No | Yes |
| **Installation** | Built-in | Requires `unstructured[pdf]` |
| **Best For** | General text | Structured documents |
| **Chunk Quality** | Arbitrary splits | Semantic splits |
| **PDF Handling** | Via PyPDFLoader | Native PDF parsing |

## Troubleshooting

### "ModuleNotFoundError: No module named 'unstructured'"

Install the unstructured library:
```bash
pip install unstructured[pdf]
```

If you don't want to install it, the system will automatically fall back to the recursive strategy.

### Chunks are too large/small

Adjust the chunk size parameters in the configuration:

**For RecursiveTextSplitter:**
```python
strategy = get_chunking_strategy(
    "recursive",
    parent_chunk_size=3000,  # Increase for larger chunks
    child_chunk_size=800     # Increase for larger chunks
)
```

**For Unstructured:**
```python
strategy = get_chunking_strategy(
    "unstructured",
    parent_max_chars=3000,   # Increase for larger chunks
    child_max_chars=800      # Increase for larger chunks
)
```

### Strategy not preserving document structure

Make sure you're using the `unstructured` strategy with `hi_res` mode:

```python
CHUNKING_STRATEGY = "unstructured"
```

And in the configuration:
```python
strategy="hi_res",  # Not "fast"
infer_table_structure=True
```

## Performance Considerations

### Recursive Strategy
- **Pros:** Very fast, minimal overhead
- **Cons:** May split in the middle of important concepts
- **Use when:** Speed is priority, structure doesn't matter

### Unstructured Strategy
- **Pros:** Better chunk quality, preserves document structure
- **Cons:** Slower processing, requires additional library
- **Use when:** Quality is priority, working with structured documents

## Example Workflows

### Quick Testing (Fast)
```python
CHUNKING_STRATEGY = "recursive"
REBUILD_VECTOR_DB = True
```

### Production Use (Quality)
```python
CHUNKING_STRATEGY = "unstructured"
REBUILD_VECTOR_DB = True
```

### Querying Existing Database
```python
# Strategy must match the one used to build the database
CHUNKING_STRATEGY = "recursive"  # or "unstructured"
REBUILD_VECTOR_DB = False
```

## Notes

- The chunking strategy must be consistent between building and querying the database
- Parent chunks are stored in the document store (filesystem)
- Child chunks are embedded and stored in the vector database
- When a child chunk is retrieved, its parent is returned for full context
- Different strategies can produce different chunk boundaries, affecting retrieval quality

