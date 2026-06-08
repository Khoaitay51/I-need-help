"""
Graph-Routed RAG Package

This package implements Graph-Routed RAG with learned routing policy.

Main components:
- DocumentGraph: Build document graph with multiple edge types
- SubgraphPartitioner: Partition graph into subgraphs
- GraphRoutedRetriever: Retrieve using graph structure
- DepartmentGraphManager: Manage separate graphs for each department
- LearnedRouter: Neural routing policy
"""

# Lazy imports - avoid circular imports when imported as api.src.graph_rag
def __getattr__(name):
    if name == "DocumentGraph":
        from .graph_builder import DocumentGraph
        return DocumentGraph
    elif name == "SubgraphPartitioner":
        from .subgraph_partitioner import SubgraphPartitioner
        return SubgraphPartitioner
    elif name == "GraphRoutedRetriever":
        from .graph_retriever import GraphRoutedRetriever
        return GraphRoutedRetriever
    elif name == "DepartmentGraphManager":
        from .department_graph_manager import DepartmentGraphManager
        return DepartmentGraphManager
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

__all__ = [
    'DocumentGraph',
    'SubgraphPartitioner',
    'GraphRoutedRetriever',
    'DepartmentGraphManager',
]
