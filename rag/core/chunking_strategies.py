"""
Chunking strategies for RAG document processing.

This module provides a pluggable architecture for different document chunking methods.
Each strategy defines how documents should be split into parent chunks (large, contextually-rich)
and child chunks (small, semantically-specific for embedding).
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_text_splitters.base import TextSplitter


def get_splitters(strategy):
    print(f"Using chunking strategy: {strategy}")
    try:
        if strategy == "recursive":
            # Recursive text splitter with default settings
            chunking_strategy = get_chunking_strategy(
                "recursive",
                parent_chunk_size=2048,
                child_chunk_size=512,
                chunk_overlap=0
            )
        elif strategy == "unstructured":
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
            raise ValueError(f"Unknown CHUNKING_STRATEGY: {strategy}")
        
        print(f"Strategy details: {chunking_strategy.get_description()}")
        
    except ImportError as e:
        print(f"Error initializing chunking strategy: {e}")
        print("Falling back to recursive text splitter...")
        chunking_strategy = get_chunking_strategy("recursive")

    parent_splitter = chunking_strategy.get_parent_splitter()
    child_splitter = chunking_strategy.get_child_splitter()
    return parent_splitter, child_splitter


class ChunkingStrategy(ABC):
    """
    Abstract base class for document chunking strategies.
    
    All chunking strategies should implement this interface to ensure
    compatibility with the RAG pipeline.
    """
    
    @abstractmethod
    def get_parent_splitter(self):
        """
        Returns the splitter for creating large parent chunks.
        
        Parent chunks provide rich context and are stored in the document store.
        When a child chunk is retrieved, its parent is returned to provide full context.
        
        Returns:
            A splitter object compatible with LangChain's ParentDocumentRetriever
        """
        pass
    
    @abstractmethod
    def get_child_splitter(self):
        """
        Returns the splitter for creating small child chunks.
        
        Child chunks are embedded and stored in the vector database for semantic search.
        These should be small enough for precise matching but large enough to be meaningful.
        
        Returns:
            A splitter object compatible with LangChain's ParentDocumentRetriever
        """
        pass
    
    @abstractmethod
    def get_strategy_name(self) -> str:
        """
        Returns a human-readable name for this chunking strategy.
        
        Returns:
            str: Name of the strategy (e.g., "RecursiveTextSplitter")
        """
        pass
    
    @abstractmethod
    def get_description(self) -> str:
        """
        Returns a description of how this chunking strategy works.
        
        Returns:
            str: Detailed description of the strategy
        """
        pass


class RecursiveTextSplitterStrategy(ChunkingStrategy):
    """
    Chunking strategy using LangChain's RecursiveCharacterTextSplitter.
    
    This strategy splits text recursively by trying different separators
    in order: paragraphs, sentences, then characters. It's good for
    general-purpose text chunking when you don't need to preserve
    document structure.
    
    Args:
        parent_chunk_size: Size of parent chunks (default: 2048 chars)
        child_chunk_size: Size of child chunks (default: 512 chars)
        chunk_overlap: Overlap between chunks to maintain context (default: 0)
    """
    
    def __init__(
        self,
        parent_chunk_size: int = 2048,
        child_chunk_size: int = 512,
        chunk_overlap: int = 0
    ):
        """Initialize the recursive text splitter with specified chunk sizes."""
        self.parent_chunk_size = parent_chunk_size
        self.child_chunk_size = child_chunk_size
        self.chunk_overlap = chunk_overlap
        
        # Create the splitters on initialization
        self._parent_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.parent_chunk_size,
            chunk_overlap=self.chunk_overlap
        )
        self._child_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.child_chunk_size,
            chunk_overlap=self.chunk_overlap
        )
    
    def get_parent_splitter(self):
        """Returns the parent splitter (2048 chars by default)."""
        return self._parent_splitter
    
    def get_child_splitter(self):
        """Returns the child splitter (512 chars by default)."""
        return self._child_splitter
    
    def get_strategy_name(self) -> str:
        """Returns the strategy name."""
        return "RecursiveCharacterTextSplitter"
    
    def get_description(self) -> str:
        """Returns a description of the strategy."""
        return (
            f"Recursive text splitting strategy with parent chunks of {self.parent_chunk_size} "
            f"characters and child chunks of {self.child_chunk_size} characters. "
            f"Splits recursively by paragraphs, sentences, then characters."
        )


class UnstructuredChunkingStrategy(ChunkingStrategy):
    """
    Chunking strategy using Unstructured.io for structure-aware PDF parsing.
    
    This strategy uses Unstructured.io to parse PDFs with structure detection,
    then chunks by titles/sections. This is ideal when you want to preserve
    the document's hierarchical structure (chapters, sections, subsections).
    
    Note: Requires 'unstructured' package to be installed:
        pip install unstructured[pdf]
    
    Args:
        parent_max_chars: Maximum characters for parent chunks (default: 2000)
        child_max_chars: Maximum characters for child chunks (default: 500)
        combine_under_n_chars: Combine small chunks under this size (default: 200)
        new_after_n_chars: Soft limit for starting new chunks (default: 1500)
        strategy: Unstructured parsing strategy - "hi_res" or "fast" (default: "hi_res")
        infer_table_structure: Whether to detect and preserve table structure (default: True)
    """
    
    def __init__(
        self,
        parent_max_chars: int = 2000,
        child_max_chars: int = 500,
        combine_under_n_chars: int = 200,
        new_after_n_chars: int = 1500,
        strategy: str = "hi_res",
        infer_table_structure: bool = True
    ):
        """Initialize the unstructured chunking strategy with specified parameters."""
        self.parent_max_chars = parent_max_chars
        self.child_max_chars = child_max_chars
        self.combine_under_n_chars = combine_under_n_chars
        self.new_after_n_chars = new_after_n_chars
        self.parsing_strategy = strategy
        self.infer_table_structure = infer_table_structure
        
        # Check if unstructured is available
        try:
            from unstructured.partition.pdf import partition_pdf
            from unstructured.chunking.title import chunk_by_title
            self._partition_pdf = partition_pdf
            self._chunk_by_title = chunk_by_title
        except ImportError:
            raise ImportError(
                "Unstructured library not found. Install with: "
                "pip install unstructured[pdf]"
            )
        
        # Create custom splitters that wrap Unstructured functionality
        self._parent_splitter = UnstructuredParentSplitter(
            partition_pdf=self._partition_pdf,
            chunk_by_title=self._chunk_by_title,
            max_chars=self.parent_max_chars,
            combine_under_n_chars=self.combine_under_n_chars,
            new_after_n_chars=self.new_after_n_chars,
            parsing_strategy=self.parsing_strategy,
            infer_table_structure=self.infer_table_structure
        )
        
        self._child_splitter = UnstructuredChildSplitter(
            max_chars=self.child_max_chars,
            combine_under_n_chars=self.combine_under_n_chars // 2  # Smaller for child chunks
        )
    
    def get_parent_splitter(self):
        """Returns the parent splitter using Unstructured chunking."""
        return self._parent_splitter
    
    def get_child_splitter(self):
        """Returns the child splitter using Unstructured chunking."""
        return self._child_splitter
    
    def get_strategy_name(self) -> str:
        """Returns the strategy name."""
        return "UnstructuredChunking"
    
    def get_description(self) -> str:
        """Returns a description of the strategy."""
        return (
            f"Unstructured.io structure-aware chunking with parent chunks up to "
            f"{self.parent_max_chars} characters and child chunks up to {self.child_max_chars} "
            f"characters. Preserves document hierarchy (titles, sections, tables). "
            f"Using '{self.parsing_strategy}' parsing strategy."
        )


class UnstructuredParentSplitter(TextSplitter):
    """
    Custom splitter that wraps Unstructured.io for parent chunk creation.
    
    This class provides a LangChain-compatible interface for Unstructured.io's
    PDF parsing and chunking functionality.
    """
    
    def __init__(
        self,
        partition_pdf,
        chunk_by_title,
        max_chars: int = 2000,
        combine_under_n_chars: int = 200,
        new_after_n_chars: int = 1500,
        parsing_strategy: str = "hi_res",
        infer_table_structure: bool = True
    ):
        """Initialize the parent splitter with Unstructured functions."""
        # Initialize the parent TextSplitter with basic parameters
        super().__init__(chunk_size=max_chars, chunk_overlap=0)
        
        self.partition_pdf = partition_pdf
        self.chunk_by_title = chunk_by_title
        self.max_chars = max_chars
        self.combine_under_n_chars = combine_under_n_chars
        self.new_after_n_chars = new_after_n_chars
        self.parsing_strategy = parsing_strategy
        self.infer_table_structure = infer_table_structure
    
    def split_text(self, text: str) -> List[str]:
        """
        Required by TextSplitter base class but not used for Unstructured.
        We override split_documents instead.
        
        Args:
            text: Text to split
        
        Returns:
            List of text chunks
        """
        # This method is required by TextSplitter but we don't use it
        # since we work directly with Documents in split_documents
        return [text]
    
    def split_documents(self, documents: List[Document]) -> List[Document]:
        """
        Split documents using Unstructured.io's structure-aware chunking.
        
        Args:
            documents: List of LangChain Document objects (typically from PyPDFLoader)
        
        Returns:
            List of chunked Document objects with preserved metadata
        """
        all_chunks = []
        
        for doc in documents:
            # Get the PDF path from metadata
            # Try 'pdf_path' first (explicitly set), then 'source' (from PyPDFLoader)
            pdf_path = doc.metadata.get('pdf_path') or doc.metadata.get('source')
            
            if not pdf_path:
                # If no path in metadata, fall back to text-based chunking
                # This handles pre-loaded text documents
                print(f"Warning: No PDF path found in metadata. Using fallback text chunking.")
                # For fallback, just wrap the content as-is
                all_chunks.append(doc)
                continue
            
            # Verify the file exists
            if not isinstance(pdf_path, str) or not pdf_path.endswith('.pdf'):
                print(f"Warning: Invalid PDF path '{pdf_path}'. Using fallback text chunking.")
                all_chunks.append(doc)
                continue
            
            try:
                # Parse the PDF with structure detection
                elements = self.partition_pdf(
                    filename=pdf_path,
                    strategy=self.parsing_strategy,
                    infer_table_structure=self.infer_table_structure,
                )
                
                # Chunk by title/section while preserving structure
                chunks = self.chunk_by_title(
                    elements,
                    max_characters=self.max_chars,
                    combine_text_under_n_chars=self.combine_under_n_chars,
                    new_after_n_chars=self.new_after_n_chars,
                )
                
                # Convert Unstructured chunks to LangChain Documents
                for chunk in chunks:
                    # Preserve original metadata and add chunk-specific info
                    chunk_metadata = doc.metadata.copy()
                    chunk_metadata.update({
                        'chunk_type': 'unstructured_parent',
                        'category': getattr(chunk, 'category', 'unknown')
                    })
                    
                    # Create a LangChain Document from the chunk
                    all_chunks.append(
                        Document(
                            page_content=str(chunk),
                            metadata=chunk_metadata
                        )
                    )
                    
            except Exception as e:
                print(f"Error processing PDF with Unstructured: {e}")
                print(f"Falling back to original document for: {pdf_path}")
                all_chunks.append(doc)
        
        return all_chunks


class UnstructuredChildSplitter(TextSplitter):
    """
    Custom splitter for creating smaller child chunks from Unstructured parent chunks.
    
    This creates smaller, more granular chunks suitable for embedding and vector search.
    """
    
    def __init__(self, max_chars: int = 500, combine_under_n_chars: int = 100):
        """Initialize the child splitter with smaller chunk sizes."""
        # Initialize the parent TextSplitter
        super().__init__(chunk_size=max_chars, chunk_overlap=50)
        
        self.max_chars = max_chars
        self.combine_under_n_chars = combine_under_n_chars
        
        # Use a simple character-based splitter for child chunks
        # since the parent already has the structure
        from langchain_text_splitters import CharacterTextSplitter
        self._internal_splitter = CharacterTextSplitter(
            chunk_size=self.max_chars,
            chunk_overlap=50,  # Small overlap to maintain context
            separator="\n\n"  # Split on paragraphs first
        )
    
    def split_text(self, text: str) -> List[str]:
        """
        Split text into smaller chunks using the internal splitter.
        
        Args:
            text: Text to split
        
        Returns:
            List of text chunks
        """
        return self._internal_splitter.split_text(text)
    
    def split_documents(self, documents: List[Document]) -> List[Document]:
        """
        Split parent documents into smaller child chunks.
        
        Args:
            documents: List of parent Document objects
        
        Returns:
            List of smaller child Document objects
        """
        # Use the internal splitter to further divide parent chunks
        return self._internal_splitter.split_documents(documents)


# Factory function for easy strategy selection
def get_chunking_strategy(
    strategy_name: str,
    **kwargs
) -> ChunkingStrategy:
    """
    Factory function to get a chunking strategy by name.
    
    Args:
        strategy_name: Name of the strategy ("recursive" or "unstructured")
        **kwargs: Additional arguments to pass to the strategy constructor
    
    Returns:
        ChunkingStrategy: The requested chunking strategy
    
    Raises:
        ValueError: If the strategy name is not recognized
    
    Example:
        >>> strategy = get_chunking_strategy("recursive", parent_chunk_size=2048)
        >>> strategy = get_chunking_strategy("unstructured", parent_max_chars=2000)
    """
    strategies = {
        "recursive": RecursiveTextSplitterStrategy,
        "unstructured": UnstructuredChunkingStrategy,
    }
    
    strategy_class = strategies.get(strategy_name.lower())
    if not strategy_class:
        raise ValueError(
            f"Unknown chunking strategy: {strategy_name}. "
            f"Available strategies: {list(strategies.keys())}"
        )
    
    return strategy_class(**kwargs)

