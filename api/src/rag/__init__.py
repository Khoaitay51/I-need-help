"""
KMA Regulations Assistant - A chatbot for answering questions about 
regulations at the Academy of Cryptographic Techniques (KMA).
"""

# Lazy imports - avoid circular imports when imported as api.src.rag
def __getattr__(name):
    if name == "create_rag_tool":
        from .tool import create_rag_tool
        return create_rag_tool
    elif name == "search_kma_regulations":
        from .tool import search_kma_regulations
        return search_kma_regulations
    elif name == "process_kma_query":
        from .rag_graph import process_kma_query
        return process_kma_query
    elif name == "process_kma_query_sync":
        from .rag_graph import process_kma_query_sync
        return process_kma_query_sync
    elif name == "get_retriever":
        from .rag_graph import get_retriever
        return get_retriever
    elif name == "clear_retriever_cache":
        from .rag_graph import clear_retriever_cache
        return clear_retriever_cache
    elif name == "load_documents_from_folder":
        from .table_aware_chunking import load_documents_from_folder
        return load_documents_from_folder
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

__version__ = "0.2.1"  # GraphRAG with caching
__all__ = [
    "create_rag_tool",
    "search_kma_regulations",
    "process_kma_query",
    "process_kma_query_sync",
    "get_retriever",
    "clear_retriever_cache",
    "load_documents_from_folder"
]
