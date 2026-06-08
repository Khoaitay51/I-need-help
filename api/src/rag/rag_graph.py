# import logging
# import os
# import unicodedata
# from pathlib import Path
# from typing import Literal, Dict, Any

# from langchain_core.messages import HumanMessage, AIMessage
# from langgraph.graph import MessagesState
# from langgraph.graph import StateGraph, START, END
# from langsmith import Client
# from pydantic import Field, BaseModel

# from llm import LLMConfig, get_llm
# from rag.retriever import create_hybrid_retriever

# # Set up logging
# logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
# logger = logging.getLogger(__name__)

# # Global cache for GraphRAG components (initialized once)
# _GRAPH_CACHE = None
# _PARTITIONER_CACHE = None
# _RETRIEVER_CACHE = None


# class GradeDocuments(BaseModel):
#     """Grade documents using a binary score for relevance check."""
#     binary_score: str = Field(description="Relevance score: 'yes' if relevant, or 'no' if not relevant")


# # Helper function for score_tool.py to use
# async def process_kma_query(query: str, retriever=None, llm=None) -> Dict[str, Any]:
#     """Process a KMA regulation query and return the answer with sources.
    
#     Args:
#         query: The question to answer
#         retriever: Optional retriever to use (will create one if not provided)
#         llm: Optional LLM to use (will create one if not provided)
        
#     Returns:
#         Dictionary with answer and sources
#     """
#     # Create components if not provided
#     if retriever is None:
#         retriever = get_retriever()

#     if llm is None:
#         llm = LLMConfig.create_rag_llm()

#     # Load prompts
#     prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
#     with open(os.path.join(prompts_dir, "generate.txt"), "r") as f:
#         generate_prompt = f.read().strip()

#     # Retrieve documents
#     docs = retriever.get_relevant_documents(query)

#     # Combine document content
#     context = "\n\n".join([doc.page_content for doc in docs])

#     # Generate answer
#     prompt = generate_prompt.format(question=query, context=context)
#     response = llm.invoke([{"role": "user", "content": prompt}])

#     # Return the answer and sources
#     return {"answer": response.content, "sources": [doc.page_content for doc in docs[:3]]  # Return top 3 sources
#     }


# def get_retriever():
#     """Get the hybrid retriever for KMA regulations"""
#     # Define paths
#     current_dir = Path(__file__).parent.absolute()
#     project_root = current_dir.parent.parent
#     vector_db_path = os.path.join(project_root, "vector_db")
#     data_path = os.path.join(project_root, "data", "regulation.txt")

#     hybrid_retriever, _ = create_hybrid_retriever(vector_db_path=vector_db_path, data_path=data_path)

#     return hybrid_retriever


# class KMAChatAgent:
#     def __init__(self, model_name="qwen3:8b", project_name="KMARegulation"):
#         """Initialize the KMA Chat Agent with a hybrid retriever and model"""
#         # Initialize LangSmith client
#         self.langsmith_client = Client()

#         # Initialize callback manager with LangSmith tracer
#         self.callback_manager = LLMConfig.create_callback_manager(project_name)

#         # Create models using the LLMConfig
#         self.llm = LLMConfig.create_rag_llm(model_name, self.callback_manager)
#         self.grader_model = LLMConfig.create_rag_llm(model_name, self.callback_manager)

#         # Store the retriever directly
#         self.retriever = self.get_retriever()

#         # Load prompts from files
#         self.prompts = self._load_prompts()

#         # Build the workflow
#         self.workflow = StateGraph(MessagesState)
#         self.graph = self._build_workflow()

#     def _load_prompts(self):
#         """Load all prompts from text files"""
#         prompts = {}
#         prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")

#         # Load grade prompts
#         with open(os.path.join(prompts_dir, "grade.txt"), "r") as f:
#             prompts["grade"] = f.read().strip()

#         # Load rewrite prompts
#         with open(os.path.join(prompts_dir, "rewrite.txt"), "r") as f:
#             prompts["rewrite"] = f.read().strip()

#         # Load generate prompts
#         with open(os.path.join(prompts_dir, "generate.txt"), "r") as f:
#             prompts["generate"] = f.read().strip()

#         return prompts

#     def get_retriever(self):
#         """Get the hybrid retriever"""
#         return get_retriever()

#     def _build_workflow(self):
#         """Build the LangGraph workflow"""
#         workflow = self.workflow

#         # Define the nodes
#         workflow.add_node(self.process_user_query)
#         workflow.add_node(self.retrieve_documents)
#         workflow.add_node(self.rewrite_question)
#         workflow.add_node(self.generate_answer)

#         # Set up edges
#         workflow.add_edge(START, "process_user_query")
#         workflow.add_edge("process_user_query", "retrieve_documents")

#         # Conditional edges after retrieval
#         workflow.add_conditional_edges("retrieve_documents", self.grade_documents,
#             {"generate_answer": "generate_answer", "rewrite_question": "rewrite_question"})

#         workflow.add_edge("generate_answer", END)
#         workflow.add_edge("rewrite_question", "process_user_query")

#         # Log the workflow structure
#         logger.info("Workflow structure created with nodes and edges")

#         # Compile the graph
#         try:
#             graph = workflow.compile()
#             logger.info("Workflow graph compiled successfully")
#         except Exception as e:
#             logger.error(f"Error compiling workflow graph: {str(e)}")
#             raise

#         # Generate and log the Mermaid diagram
#         try:
#             mermaid_diagram = graph.get_graph().draw_mermaid()
#             logger.info("Mermaid diagram:")
#             logger.info(mermaid_diagram)

#             logger.info("Saving Mermaid diagram to file")
#             current_dir = Path(__file__).parent.absolute()
#             project_root = current_dir.parent.parent
#             mermaid_dir_path = os.path.join(project_root, "mermaid")
#             mermaid_path = os.path.join(mermaid_dir_path, "rag_mermaid.mmd")

#             # Save the diagram to a file
#             with open(mermaid_path, "w") as f:
#                 f.write(mermaid_diagram)
#                 f.close()

#             logger.info("Mermaid diagram saved successfully")

#         except Exception as e:
#             logger.error(f"Error generating Mermaid diagram: {str(e)}")

#         return graph

#     def process_user_query(self, state: MessagesState):
#         """Process the user query for retrieval"""
#         # Normalize the query for better processing
#         if state["messages"] and len(state["messages"]) > 0:
#             query = state["messages"][0].content
#             normalized_query = unicodedata.normalize('NFC', query)
#             state["messages"][0].content = normalized_query
#         return {"messages": state["messages"]}

#     def retrieve_documents(self, state: MessagesState):
#         """Directly retrieve documents using the retriever"""
#         query = state["messages"][0].content
#         # Get documents from the retriever
#         docs = self.retriever.get_relevant_documents(query)
#         # Combine document content
#         combined_content = "\n\n".join([doc.page_content for doc in docs])
#         # Add the retrieved content as a system message
#         retrieval_message = AIMessage(content=combined_content)
#         # Update the state with the retrieved documents
#         return {"messages": state["messages"] + [retrieval_message]}

#     def grade_documents(self, state: MessagesState) -> Literal["generate_answer", "rewrite_question"]:
#         """Determine whether the retrieved documents are relevant to the question"""
#         question = state["messages"][0].content
#         context = state["messages"][-1].content

#         prompt = self.prompts["grade"].format(question=question, context=context)

#         response = self.grader_model.with_structured_output(GradeDocuments).invoke(
#             [{"role": "user", "content": prompt}])
#         score = response.binary_score

#         if score == "yes":
#             return "generate_answer"
#         else:
#             return "rewrite_question"

#     def rewrite_question(self, state: MessagesState):
#         """Rewrite the original user question"""
#         messages = state["messages"]
#         question = messages[0].content
#         prompt = self.prompts["rewrite"].format(question=question)
#         response = self.llm.invoke([{"role": "user", "content": prompt}])
#         return {"messages": [HumanMessage(content=response.content)]}

#     def generate_answer(self, state: MessagesState):
#         """Generate an answer"""
#         question = state["messages"][0].content
#         context = state["messages"][-1].content
#         prompt = self.prompts["generate"].format(question=question, context=context)
#         response = self.llm.invoke([{"role": "user", "content": prompt}])
#         return {"messages": state["messages"][:-1] + [response]}

#     def chat(self, message):
#         """Process a single chat message and return the response"""
#         query = {"messages": [HumanMessage(content=message)]}
#         response = self.graph.invoke(query)
#         return response["messages"][-1].content

# Toggle comment for deploy to Streamlit or LangGraph UI
# graph = KMAChatAgent()

import logging
import os
import re
import unicodedata
from pathlib import Path
from typing import Literal, Dict, Any, List

from langchain_core.messages import HumanMessage, AIMessage
from langgraph.graph import MessagesState
from langgraph.graph import StateGraph, START, END
from langsmith import Client
from pydantic import Field, BaseModel

# Sử dụng get_llm để respect runtime model selection (Ollama/Gemini)
from ..llm import LLMConfig, get_llm
from .retriever import create_hybrid_retriever
from .semantic_analyzer import analyze_query_semantic_filter

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

DEPARTMENT_LABELS = {
    "phongdaotao": "Phòng Đào tạo",
    "phongkhaothi": "Phòng Khảo thí và Đảm bảo chất lượng",
    "khoa": "Khoa",
    "viennghiencuuvahoptacphattrien": "Viện Nghiên cứu và Hợp tác phát triển",
    "thongtinhvktmm": "Thông tin Học viện Kỹ thuật mật mã",
    "document_graph": "Tài liệu chung",
}


def _clean_source_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\\", "/").strip()


def _extract_clause_refs(text: str) -> str:
    if not text:
        return ""

    patterns = [
        r"\bĐiều\s+\d+[a-zA-Z]?(?:\s*[,.;:()/-]?\s*(?:khoản|điểm)\s+[a-zA-Z0-9đĐ]+)?",
        r"\bKhoản\s+\d+[a-zA-Z]?",
        r"\bĐiểm\s+[a-zA-ZđĐ]\)",
        r"\bChương\s+[IVXLCDM\d]+",
        r"\bMục\s+\d+",
        r"\bPhụ lục\s+[IVXLCDM\d]+",
    ]

    refs = []
    for pattern in patterns:
        refs.extend(re.findall(pattern, text, flags=re.IGNORECASE))

    seen = set()
    unique_refs = []
    for ref in refs:
        normalized = re.sub(r"\s+", " ", ref.strip())
        key = normalized.lower()
        if key not in seen:
            seen.add(key)
            unique_refs.append(normalized)

    return ", ".join(unique_refs[:5])


def _build_source_entries(docs: List[Any]) -> List[Dict[str, str]]:
    entries = []
    seen = set()

    for doc in docs or []:
        metadata = getattr(doc, "metadata", {}) or {}
        content = getattr(doc, "page_content", str(doc))

        source_path = (
            metadata.get("source_path")
            or metadata.get("full_path")
            or metadata.get("source")
            or metadata.get("filename")
            or ""
        )
        filename = (
            metadata.get("filename")
            or metadata.get("source")
            or os.path.basename(_clean_source_value(source_path))
            or "Không rõ file"
        )
        department = (
            metadata.get("department_vn")
            or DEPARTMENT_LABELS.get(metadata.get("query_department"))
            or DEPARTMENT_LABELS.get(metadata.get("department"))
            or metadata.get("query_department")
            or metadata.get("department")
            or "Không rõ ban/phòng"
        )
        clause_refs = _extract_clause_refs(content)

        key = (
            str(filename).lower(),
            str(department).lower(),
            clause_refs.lower(),
            str(metadata.get("chunk_index", "")).lower(),
        )
        if key in seen:
            continue
        seen.add(key)

        entries.append({
            "filename": str(filename),
            "source_path": _clean_source_value(source_path or filename),
            "department": str(department),
            "clause_refs": clause_refs,
            "chunk_index": str(metadata.get("chunk_index", "")),
        })

    return entries


def _format_source_entries(entries: List[Dict[str, str]], max_entries: int = 5) -> str:
    if not entries:
        return ""

    lines = []
    for index, entry in enumerate(entries[:max_entries], start=1):
        detail_parts = [f"file: {entry['filename']}", f"ban/phòng: {entry['department']}"]
        if entry.get("clause_refs"):
            detail_parts.append(f"vị trí: {entry['clause_refs']}")
        if entry.get("source_path") and entry["source_path"] != entry["filename"]:
            detail_parts.append(f"đường dẫn: {entry['source_path']}")
        lines.append(f"{index}. " + "; ".join(detail_parts))

    return "\n".join(lines)


def _ensure_source_footer(answer: str, source_entries: List[Dict[str, str]]) -> str:
    answer = str(answer or "").strip()
    if not source_entries:
        return answer

    if re.search(r"(?im)^\s*(\*\*)?(nguồn|nguá»“n)\b", answer):
        return answer

    return f"{answer}\n\n**Nguồn:**\n{_format_source_entries(source_entries)}"


def _strip_response_reasoning(answer: Any) -> str:
    text = str(answer or "").strip()
    if not text:
        return ""

    text = re.sub(r"<think(?:ing)?>[\s\S]*?(?:</think(?:ing)?>|$)", "", text, flags=re.IGNORECASE).strip()

    marker_patterns = [
        r"Source included\?\s*Yes\.\s*",
        r"Nguồn included\?\s*Yes\.\s*",
        r"Draft:\s*",
    ]
    for pattern in marker_patterns:
        matches = list(re.finditer(pattern, text, flags=re.IGNORECASE))
        if matches:
            text = text[matches[-1].end():].strip()
            break

    if re.search(r"(?im)^\s*(User Question|Role:|Constraints:|Professional,\s*Markdown\?|Concise\?|No greetings\?)", text):
        source_match = re.search(r"(?im)^\s*(?:\*\*)?(?:Nguồn|Nguá»“n)\s*:", text)
        if source_match:
            before_source = text[:source_match.start()].strip()
            paragraphs = [part.strip() for part in re.split(r"\n\s*\n", before_source) if part.strip()]
            if paragraphs:
                text = paragraphs[-1] + "\n\n" + text[source_match.start():].strip()

    text = re.sub(
        r"(?im)^\s*(User Question|Role:|Constraints:|Professional,\s*Markdown\?|Concise\?|No greetings\?|Other sources|Is a watch listed|Does the text explicitly say|However, the rule says|Anything else is only allowed|Additionally, if a watch).*$",
        "",
        text,
    )
    return re.sub(r"\n{3,}", "\n\n", text).strip()

# Global cache for GraphRAG components (initialized once)
_GRAPH_CACHE = None
_PARTITIONER_CACHE = None
_RETRIEVER_CACHE = None


class GradeDocuments(BaseModel):
    """Grade documents using a binary score for relevance check."""
    binary_score: str = Field(description="Relevance score: 'yes' if relevant, or 'no' if not relevant")


# Helper function for score_tool.py to use
async def process_kma_query(query: str, retriever=None, llm=None) -> Dict[str, Any]:
    """Process a KMA regulation query and return the answer with sources.
    
    Args:
        query: The question to answer
        retriever: Optional retriever to use (will create one if not provided)
        llm: Optional LLM to use (will create one if not provided)
        
    Returns:
        Dictionary with answer and sources
    """
    # Create components if not provided
    if retriever is None:
        retriever = get_retriever()

    if llm is None:
        # Sử dụng get_llm() để respect runtime model selection (Ollama/Gemini)
        llm = get_llm() 

    # Load prompts
    prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
    with open(os.path.join(prompts_dir, "generate.txt"), "r", encoding='utf-8') as f:
        generate_prompt = f.read().strip()

    # Use semantic analysis to get appropriate metadata filters
    print(f"🔍 Analyzing query semantically: {query}")
    metadata_filter = analyze_query_semantic_filter(query, confidence_threshold=0.65)
    
    # Retrieve documents using smart retrieval with semantic filtering
    from .retriever import smart_retrieve, MetadataEnhancedHybridRetriever
    
    if isinstance(retriever, MetadataEnhancedHybridRetriever):
        if metadata_filter:
            print(f"🎯 Using semantic metadata filter: {metadata_filter}")
            docs = retriever._get_relevant_documents(query, metadata_filter)
        else:
            print(f"📚 Using full database search (low semantic confidence)")
            docs = smart_retrieve(retriever, query, use_smart_filtering=True)
    else:
        docs = retriever.get_relevant_documents(query)

    source_entries = _build_source_entries(docs)
    source_catalog = _format_source_entries(source_entries, max_entries=10)

    # Combine document content with explicit source headers so the model can cite them.
    context_parts = []
    for index, doc in enumerate(docs, start=1):
        metadata = getattr(doc, "metadata", {}) or {}
        content = getattr(doc, "page_content", str(doc))
        entry = source_entries[index - 1] if index - 1 < len(source_entries) else {}
        source_header = [
            f"[Nguồn {index}]",
            f"File: {entry.get('filename') or metadata.get('filename') or metadata.get('source') or 'Không rõ file'}",
            f"Ban/phòng: {entry.get('department') or metadata.get('department_vn') or metadata.get('department') or 'Không rõ ban/phòng'}",
        ]
        if entry.get("clause_refs"):
            source_header.append(f"Điều/khoản/điểm phát hiện: {entry['clause_refs']}")
        context_parts.append("\n".join(source_header) + "\n" + content)

    context = "\n\n".join(context_parts)

    # Generate answer
    prompt = generate_prompt.format(
        question=query,
        context=context,
        source_catalog=source_catalog or "Không có metadata nguồn rõ ràng."
    )
    response = llm.invoke([{"role": "user", "content": prompt}])
    response_content = response.content
    if isinstance(response_content, list):
        if response_content and isinstance(response_content[0], dict) and "text" in response_content[0]:
            response_content = "".join([part.get("text", "") for part in response_content if isinstance(part, dict)])
        else:
            response_content = " ".join([str(part) for part in response_content])
    elif not isinstance(response_content, str):
        response_content = str(response_content)
    response_content = _ensure_source_footer(_strip_response_reasoning(response_content), source_entries)

    # Return the answer and sources
    return {
        "answer": response_content,
        "sources": [doc.page_content for doc in docs[:3]],
        "source_metadata": source_entries[:5],
    }


def process_kma_query_sync(query: str, retriever=None, llm=None, department_filter=None, user_metadata=None) -> Dict[str, Any]:
    """
    Enhanced Department-based query processing với semantic detection.
    
    Args:
        query: The question to answer
        retriever: Optional DepartmentGraphManager (will create one if not provided)
        llm: Optional LLM to use (will create Gemini if not provided)
        department_filter: Specific department to search (e.g., 'phongkhaothi')
        user_metadata: User metadata for semantic routing {'role': 'student', 'department': 'phongdaotao'}
        
    Returns:
        Dictionary with answer, sources and department decision
    """
    from graph_rag import DepartmentGraphManager
    
    # Create components if not provided
    if retriever is None:
        retriever = get_retriever()

    if llm is None:
        logger.critical(f"🚨 LLM IS NONE - About to call get_llm()")
        # Sử dụng get_llm() để respect runtime model selection (Ollama/Gemini)
        llm = get_llm()
        logger.critical(f"🚨 get_llm() returned: {type(llm).__name__} from {type(llm).__module__}")

    # Load prompts
    prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
    with open(os.path.join(prompts_dir, "generate.txt"), "r", encoding='utf-8') as f:
        generate_prompt = f.read().strip()

    # Enhanced Department-specific retrieval with semantic detection
    if isinstance(retriever, DepartmentGraphManager):
        logger.info(f"🏢 Enhanced department-based query: {query[:100]}...")
        if department_filter:
            logger.info(f"🎯 Department filter: {department_filter}")
        if user_metadata:
            logger.info(f"👤 User metadata: {user_metadata}")
        
        # Use semantic smart query
        if user_metadata or not department_filter:
            logger.info(f"🧠 Using semantic detection for department routing")
            
            # Prepare user metadata
            # Only create metadata from department_filter if no user_metadata at all
            if not user_metadata and department_filter:
                user_metadata = {'role': 'student', 'department': department_filter}
            # Don't override user choice with department_filter
            
            try:
                # Use new query_smart method with semantic detection
                docs, decision = retriever.query_smart(
                    query=query,
                    user_metadata=user_metadata,
                    k=10
                )
                
                # Log decision details
                logger.info(f"🎯 Semantic decision: {decision.chosen_department} (confidence: {decision.confidence:.3f})")
                logger.info(f"📝 Reasoning: {decision.reasoning}")
                
                if decision.conflict_detected:
                    logger.warning("⚠️ Conflict detected and resolved using semantic similarity")
                
                if not decision.permission_granted:
                    return {
                        'answer': "Xin lỗi, bạn không có quyền truy cập thông tin này. Vui lòng liên hệ quản trị viên.",
                        'sources': [],
                        'department_decision': decision,
                        'retrieval_method': 'semantic_permission_denied'
                    }
                
                retrieval_method = f"semantic_{decision.chosen_department}"
                
                # Convert string results to documents if needed
                if docs and isinstance(docs[0], str):
                    from langchain_core.documents import Document
                    docs = [Document(page_content=doc, metadata={'source': 'semantic_retrieval'}) for doc in docs]
                
            except Exception as e:
                logger.error(f"❌ Semantic detection failed: {e}, falling back to legacy mode")
                # Fallback to legacy mode
                docs = []
                decision = None
        
        # Fallback for specific department filter (legacy mode)
        if (not docs or len(docs) == 0) and department_filter:
            logger.info(f"📁 Fallback: Searching in specific department: {department_filter}")
            try:
                # Check if department has graphs loaded
                if hasattr(retriever, 'department_retrievers') and department_filter in retriever.department_retrievers:
                    dept_retriever = retriever.department_retrievers[department_filter]
                    results = dept_retriever.retrieve_context(query, k=10)
                    
                    # Convert to documents
                    from langchain_core.documents import Document
                    docs = [Document(page_content=result, metadata={'source': f'{department_filter}_graph'}) for result in results]
                    retrieval_method = f"legacy_{department_filter}"
                else:
                    logger.warning(f"❌ No graph found for department: {department_filter}")
                    docs = []
                    retrieval_method = "no_graph"
            except Exception as e:
                logger.error(f"❌ Legacy retrieval failed: {e}")
                docs = []
                retrieval_method = "error"
        
        logger.info(f"📊 Retrieved {len(docs)} documents from enhanced department search")
        
        # Log document sources for debugging
        if docs:
            for i, doc in enumerate(docs[:3]):
                if hasattr(doc, 'metadata'):
                    source = os.path.basename(doc.metadata.get('source', 'unknown'))
                    dept = doc.metadata.get('query_department', 'semantic')
                    logger.info(f"   📄 Doc {i+1}: [{dept}] {source}")
                else:
                    logger.info(f"   📄 Doc {i+1}: {doc[:100]}...")
    else:
        # Fallback for other retriever types (shouldn't happen now)
        logger.warning(f"⚠️  Non-DepartmentGraphManager detected: {type(retriever)}")
        docs = retriever.get_relevant_documents(query) if hasattr(retriever, 'get_relevant_documents') else []
        retrieval_method = "fallback"
        decision = None

    source_entries = _build_source_entries(docs)
    source_catalog = _format_source_entries(source_entries, max_entries=10)

    # Combine document content with explicit source headers so the model can cite them.
    context_parts = []
    for index, doc in enumerate(docs, start=1):
        metadata = getattr(doc, "metadata", {}) or {}
        content = getattr(doc, "page_content", str(doc))
        entry = source_entries[index - 1] if index - 1 < len(source_entries) else {}
        source_header = [
            f"[Nguồn {index}]",
            f"File: {entry.get('filename') or metadata.get('filename') or metadata.get('source') or 'Không rõ file'}",
            f"Ban/phòng: {entry.get('department') or metadata.get('department_vn') or metadata.get('department') or 'Không rõ ban/phòng'}",
        ]
        if entry.get("clause_refs"):
            source_header.append(f"Điều/khoản/điểm phát hiện: {entry['clause_refs']}")
        context_parts.append("\n".join(source_header) + "\n" + content)

    context = "\n\n".join(context_parts)
    
    logger.info(f"📝 Context length: {len(context)} chars, {len(docs)} documents")
    
    if not context or len(context.strip()) == 0:
        logger.error("❌ Empty context! No documents were retrieved or documents are empty")
        return {
            "answer": "Xin lỗi, tôi không tìm thấy thông tin phù hợp với câu hỏi của bạn trong phòng ban liên quan.",
            "sources": [],
            "retrieval_method": retrieval_method,
            "department_decision": getattr(locals(), 'decision', None)
        }
    
    logger.info(f"📄 Context preview (first 300 chars): {context[:300]}...")

    # Generate answer
    prompt = generate_prompt.format(
        question=query,
        context=context,
        source_catalog=source_catalog or "Không có metadata nguồn rõ ràng."
    )
    logger.info(f"📋 Prompt length: {len(prompt)} chars")
    
    # Log which LLM model will be used
    try:
        # IMPORTANT: Log the ACTUAL llm instance type, not what model_manager says now
        # (model_manager state might have changed since llm was created)
        llm_type_name = type(llm).__name__
        llm_module = type(llm).__module__
        
        logger.critical(f"🚨 DEBUG: llm is None? {llm is None}")
        logger.critical(f"🚨 DEBUG: llm type: {llm_type_name}")
        logger.critical(f"🚨 DEBUG: llm module: {llm_module}")
        logger.info(f"🤖 [RAG] LLM instance type: {llm_type_name}")
        
        # Determine which model based on actual instance
        if llm_type_name == "ChatOllama":
            logger.info(f"🤖 [RAG] Using actual LLM: Ollama")
        elif llm_type_name == "ChatGoogleGenerativeAI":
            logger.info(f"🤖 [RAG] Using actual LLM: Gemini")
        else:
            logger.info(f"🤖 [RAG] Using actual LLM: {llm_type_name}")
    except Exception as e:
        logger.warning(f"⚠️ [RAG] Could not log LLM info: {e}")
    
    logger.info(f"🤖 Invoking LLM...")
    
    # Call LLM directly with prompt string
    response = llm.invoke(prompt)
    
    # Normalize response.content to string
    response_content = response.content
    if isinstance(response_content, list):
        if len(response_content) > 0 and isinstance(response_content[0], dict) and "text" in response_content[0]:
            response_content = "".join([part.get("text", "") for part in response_content if isinstance(part, dict)])
        else:
            response_content = " ".join([str(p) for p in response_content])
    elif not isinstance(response_content, str):
        response_content = str(response_content)
    
    response_content = _ensure_source_footer(_strip_response_reasoning(response_content), source_entries)

    logger.info(f"✅ LLM response received, length: {len(response_content)} chars")
    logger.info(f"📝 Response preview: {response_content[:200]}...")
    
    if not response_content or len(response_content.strip()) == 0:
        logger.error("❌ Empty response from LLM!")
        return {
            "answer": "Xin lỗi, không thể tạo câu trả lời từ thông tin tìm được.",
            "sources": [doc.page_content for doc in docs[:3]],
            "source_metadata": source_entries[:5],
            "retrieval_method": retrieval_method,
            "department_decision": getattr(locals(), 'decision', None)
        }

    # Return the enhanced answer and metadata
    result = {
        "answer": response_content,
        "sources": [doc.page_content for doc in docs[:3]],
        "source_metadata": source_entries[:5],
        "retrieval_method": retrieval_method
    }
    
    # Add department decision if available
    if 'decision' in locals() and decision:
        result["department_decision"] = decision
        result["chosen_department"] = decision.chosen_department
        result["conflict_detected"] = decision.conflict_detected
        result["permission_granted"] = decision.permission_granted
    
    return result


# Helper function for processing uploaded file queries
async def process_file_query(query: str, retriever, llm=None) -> Dict[str, Any]:
    """Process a query against uploaded file content using in-memory retriever.
    
    Args:
        query: The question to answer
        retriever: In-memory retriever created from uploaded file
        llm: Optional LLM to use (will create one if not provided)
        
    Returns:
        Dictionary with answer and sources
    """
    if llm is None:
        # Sử dụng get_llm() để respect runtime model selection (Ollama/Gemini)
        llm = get_llm()
    
    # Load prompts
    prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
    with open(os.path.join(prompts_dir, "generate.txt"), "r", encoding='utf-8') as f:
        generate_prompt = f.read().strip()
    
    # Retrieve documents from uploaded file using smart retrieval if available
    from .retriever import smart_retrieve, MetadataEnhancedHybridRetriever
    
    if isinstance(retriever, MetadataEnhancedHybridRetriever):
        docs = smart_retrieve(retriever, query, use_smart_filtering=True)
    else:
        docs = retriever.get_relevant_documents(query)
    
    # Combine document content
    context = "\n\n".join([doc.page_content for doc in docs])
    
    # Generate answer with context about uploaded file
    file_prompt = f"""Dựa trên nội dung file đã upload, hãy trả lời câu hỏi sau:

Câu hỏi: {query}

Nội dung liên quan từ file:
{context}

Trả lời:"""
    
    response = llm.invoke([{"role": "user", "content": file_prompt}])
    
    return {
        "answer": response.content, 
        "sources": [doc.page_content for doc in docs[:3]],
        "source_type": "uploaded_file"
    }


def clear_retriever_cache():
    """
    Clear the GraphRAG cache. Call this when you rebuild the graph.
    """
    global _GRAPH_CACHE, _PARTITIONER_CACHE, _RETRIEVER_CACHE
    _GRAPH_CACHE = None
    _PARTITIONER_CACHE = None
    _RETRIEVER_CACHE = None
    logger.info("🗑️  GraphRAG cache cleared")


def get_retriever():
    """
    Get DepartmentGraphManager with cached graphs (DEPARTMENT-SPECIFIC RETRIEVAL)
    
    Returns DepartmentGraphManager that routes queries to appropriate department graphs.
    Department graphs must be built using: python build_department_graphs.py
    
    Performance: First call ~2-3s, subsequent calls ~0.01s (cached)
    """
    global _RETRIEVER_CACHE
    
    # Return cached manager if available
    if _RETRIEVER_CACHE is not None:
        logger.info("⚡ Using cached DepartmentGraphManager (instant)")
        return _RETRIEVER_CACHE
    
    import os
    from pathlib import Path
    from graph_rag import DepartmentGraphManager
    
    # Define paths
    current_dir = Path(__file__).parent.absolute()
    project_root = current_dir.parent.parent
    dept_graphs_dir = os.path.join(project_root, "graphs", "department_graphs")
    
    # Check if department graphs exist
    if not os.path.exists(dept_graphs_dir):
        error_msg = (
            f"❌ Department graphs directory not found: {dept_graphs_dir}\n"
            f"Please build department graphs first using: python build_department_graphs.py"
        )
        logger.error(error_msg)
        raise FileNotFoundError(error_msg)
    
    try:
        # Create department graph manager
        logger.info(f"🔄 Loading department graphs from: {dept_graphs_dir} (first time - caching)")
        dept_manager = DepartmentGraphManager(dept_graphs_dir)
        
        # Load all department graphs
        success = dept_manager.load_existing_graphs()
        
        if not success:
            raise RuntimeError("Failed to load department graphs")
        
        # Get stats
        stats = dept_manager.get_department_stats()
        departments = list(stats.keys())
        total_nodes = sum(stat['nodes'] for stat in stats.values())
        
        logger.info(f"✅ Department graphs loaded: {len(departments)} departments, {total_nodes} total nodes")
        for dept, stat in stats.items():
            logger.info(f"   📁 {dept}: {stat['nodes']} nodes, {stat['communities']} communities")
        
        logger.info("💾 Cached for future queries (subsequent queries will be much faster)")
        _RETRIEVER_CACHE = dept_manager
        
        return dept_manager
        
    except Exception as e:
        logger.error(f"Failed to load DepartmentGraphManager: {e}")
        raise


class KMAChatAgent:
    def __init__(self, model_name: str = None, project_name="KMARegulation", custom_retriever=None):
        """Initialize the KMA Chat Agent with a hybrid retriever and model"""
        # Initialize LangSmith client
        self.langsmith_client = Client()

        # Initialize callback manager with LangSmith tracer
        self.callback_manager = LLMConfig.create_callback_manager(project_name)

        # Sử dụng get_llm() để respect runtime model selection (Ollama/Gemini)
        try:
            self.llm = get_llm()
            # Sử dụng cùng model cho grader
            self.grader_model = get_llm()
            logger.info(f"Initialized LLMs with runtime model selection")
        except Exception as e:
            logger.error(f"Failed to initialize LLM: {e}.")
            raise # Re-raise error to stop initialization if LLM fails

        # Store the retriever - use custom retriever if provided, otherwise default KMA retriever
        self.retriever = custom_retriever if custom_retriever is not None else self.get_retriever()

        # Load prompts from files
        self.prompts = self._load_prompts()

        # Build the workflow
        self.workflow = StateGraph(MessagesState)
        self.graph = self._build_workflow()

    def _load_prompts(self):
        """Load all prompts from text files"""
        prompts = {}
        prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")

        # Load grade prompts
        with open(os.path.join(prompts_dir, "grade.txt"), "r", encoding="utf-8") as f:
            prompts["grade"] = f.read().strip()

        # Load rewrite prompts
        with open(os.path.join(prompts_dir, "rewrite.txt"), "r", encoding="utf-8") as f:
            prompts["rewrite"] = f.read().strip()

        # Load generate prompts
        with open(os.path.join(prompts_dir, "generate.txt"), "r", encoding="utf-8") as f:
            prompts["generate"] = f.read().strip()

        return prompts

    def get_retriever(self):
        """Get the hybrid retriever"""
        return get_retriever()

    def _build_workflow(self):
        """Build the LangGraph workflow"""
        workflow = self.workflow

        # Define the nodes
        workflow.add_node("process_user_query", self.process_user_query) # Thêm tên node rõ ràng
        workflow.add_node("retrieve_documents", self.retrieve_documents)
        workflow.add_node("rewrite_question", self.rewrite_question)
        workflow.add_node("generate_answer", self.generate_answer)

        # Set up edges
        workflow.add_edge(START, "process_user_query")
        workflow.add_edge("process_user_query", "retrieve_documents")

        # Conditional edges after retrieval
        workflow.add_conditional_edges("retrieve_documents", self.grade_documents,
            {"generate_answer": "generate_answer", "rewrite_question": "rewrite_question"})

        workflow.add_edge("generate_answer", END)
        workflow.add_edge("rewrite_question", "process_user_query")

        # Log the workflow structure
        logger.info("Workflow structure created with nodes and edges")

        # Compile the graph với cấu hình recursion limit
        try:
            graph = workflow.compile()
            logger.info("Workflow graph compiled successfully")
        except Exception as e:
            logger.error(f"Error compiling workflow graph: {str(e)}")
            raise

        # Generate and log the Mermaid diagram
        try:
            mermaid_diagram = graph.get_graph().draw_mermaid()
            logger.info("Mermaid diagram:")
            logger.info(mermaid_diagram)

            logger.info("Saving Mermaid diagram to file")
            current_dir = Path(__file__).parent.absolute()
            project_root = current_dir.parent.parent
            mermaid_dir_path = os.path.join(project_root, "mermaid")
            os.makedirs(mermaid_dir_path, exist_ok=True) # Đảm bảo thư mục tồn tại
            mermaid_path = os.path.join(mermaid_dir_path, "rag_mermaid.mmd")

            # Save the diagram to a file
            with open(mermaid_path, "w") as f:
                f.write(mermaid_diagram)
                f.close()

            logger.info("Mermaid diagram saved successfully")

        except Exception as e:
            logger.error(f"Error generating Mermaid diagram: {str(e)}")

        return graph

    def process_user_query(self, state: MessagesState):
        """Process the user query for retrieval"""
        # Normalize the query for better processing
        if state["messages"] and len(state["messages"]) > 0:
            query = state["messages"][0].content
            # Loại bỏ các ký tự dấu và chuẩn hóa Unicode để truy vấn hiệu quả hơn
            normalized_query = unicodedata.normalize('NFD', query).encode('ascii', 'ignore').decode('utf-8')
            state["messages"][0] = HumanMessage(content=normalized_query) # Tạo lại HumanMessage để đảm bảo tính nhất quán
        return state # Trả về toàn bộ state đã cập nhật

    def retrieve_documents(self, state: MessagesState):
        """Retrieve documents using DepartmentGraphManager (department-based routing)"""
        query = state["messages"][0].content
        logger.info(f"Retrieving documents for query: {query}")
        
        # Debug: Check retriever type
        logger.info(f"Retriever type: {type(self.retriever).__name__}")
        
        # DepartmentGraphManager uses smart query routing
        from graph_rag import DepartmentGraphManager
        
        if isinstance(self.retriever, DepartmentGraphManager):
            logger.info("🏢 Using Department-based retrieval (smart routing)")
            docs = self.retriever.query_smart(query, k=10)
            logger.info(f"Department-based retrieval returned {len(docs)} documents")
            
            # Log department distribution
            dept_distribution = {}
            for doc in docs:
                dept = doc.metadata.get('query_department', 'unknown')
                dept_distribution[dept] = dept_distribution.get(dept, 0) + 1
            logger.info(f"📊 Department distribution: {dept_distribution}")
            
        else:
            # Fallback for other retriever types
            logger.warning(f"Unknown retriever type: {type(self.retriever).__name__}, using generic retrieval")
            if hasattr(self.retriever, 'get_relevant_documents'):
                docs = self.retriever.get_relevant_documents(query)
            elif hasattr(self.retriever, '_get_relevant_documents'):
                docs = self.retriever._get_relevant_documents(query)
            else:
                logger.error("Retriever has no compatible retrieval method")
                docs = []
            logger.info(f"Generic retrieval returned {len(docs)} documents")
        
        # Debug: Check first few documents
        for i, doc in enumerate(docs[:3]):
            content_preview = doc.page_content[:100].replace('\n', ' ')
            source = os.path.basename(doc.metadata.get('source', 'unknown'))
            dept = doc.metadata.get('query_department', 'unknown')
            logger.info(f"Doc {i+1}: [{dept}] {source} - {content_preview}...")
            
        # Combine document content
        combined_content = "\n\n".join([doc.page_content for doc in docs])
        logger.info(f"Combined content length: {len(combined_content)} characters")
        
        # Add the retrieved content as a system message
        retrieval_message = AIMessage(content=combined_content, name="retrieved_context")
        # Update the state with the retrieved documents
        logger.info(f"Retrieved {len(docs)} documents.")
        return {"messages": state["messages"] + [retrieval_message]}

    def grade_documents(self, state: MessagesState) -> Literal["generate_answer", "rewrite_question"]:
        """Determine whether the retrieved documents are relevant to the question"""
        question = state["messages"][0].content
        # Lấy ngữ cảnh từ tin nhắn AIMessage cuối cùng (có thể đặt tên cho nó)
        context_message = next((msg.content for msg in reversed(state["messages"]) if isinstance(msg, AIMessage) and msg.name == "retrieved_context"), "")
        
        if not context_message:
            logger.warning("No retrieved context found for grading. Assuming irrelevant.")
            return "rewrite_question"

        # Kiểm tra số lần rewrite để tránh vòng lặp vô hạn
        rewrite_count = 0
        for msg in state["messages"]:
            if hasattr(msg, 'additional_kwargs') and msg.additional_kwargs.get('rewrite_count'):
                rewrite_count = msg.additional_kwargs.get('rewrite_count', 0)
                
        # Nếu đã rewrite quá 2 lần, buộc generate answer
        if rewrite_count >= 2:
            logger.info("Maximum rewrite attempts reached. Forcing answer generation.")
            return "generate_answer"

        prompt = self.prompts["grade"].format(question=question, context=context_message)
        logger.info(f"Grading documents with prompt: {prompt[:100]}...") # Log một phần prompt

        try:
            # Gemini thường hỗ trợ structured_output tốt hơn TinyLlama
            response = self.grader_model.with_structured_output(GradeDocuments).invoke(
                [{"role": "user", "content": prompt}])
            score = response.binary_score
        except Exception as e:
            logger.error(f"Error grading documents with structured output: {e}. Defaulting to 'yes'.")
            score = "yes" # Fallback để tránh vòng lặp vô hạn

        logger.info(f"Document grading score: {score}")
        if score == "yes":
            return "generate_answer"
        else:
            return "rewrite_question"

    def rewrite_question(self, state: MessagesState):
        """Rewrite the original user question"""
        messages = state["messages"]
        question = messages[0].content
        
        # Đếm số lần rewrite
        rewrite_count = 0
        for msg in messages:
            if hasattr(msg, 'additional_kwargs') and msg.additional_kwargs.get('rewrite_count'):
                rewrite_count = max(rewrite_count, msg.additional_kwargs.get('rewrite_count', 0))
        
        rewrite_count += 1
        logger.info(f"Rewriting question (attempt {rewrite_count}): {question}")
        
        prompt = self.prompts["rewrite"].format(question=question)
        response = self.llm.invoke([{"role": "user", "content": prompt}])
        rewritten_question = response.content
        logger.info(f"Rewritten question: {rewritten_question}")
        
        # Tạo HumanMessage mới với rewrite count
        new_message = HumanMessage(
            content=rewritten_question,
            additional_kwargs={'rewrite_count': rewrite_count}
        )
        
        return {"messages": [new_message]}

    def generate_answer(self, state: MessagesState):
        """Generate an answer"""
        question = state["messages"][0].content
        # Tìm ngữ cảnh đã lấy được
        context_message = next((msg.content for msg in reversed(state["messages"]) if isinstance(msg, AIMessage) and msg.name == "retrieved_context"), "")

        if not context_message:
            logger.warning("No context found for answer generation. Generating with only question.")
            context_message = "Không có thông tin liên quan được tìm thấy trong cơ sở dữ liệu." # Fallback context

        prompt = self.prompts["generate"].format(question=question, context=context_message)
        logger.info(f"Generating answer with prompt: {prompt[:100]}...") # Log một phần prompt
        response = self.llm.invoke([{"role": "user", "content": prompt}])
        logger.info(f"Generated answer.")
        return {"messages": state["messages"][:-1] + [response]} # Xóa context message trước khi thêm câu trả lời cuối cùng

    def chat(self, message):
        """Process a single chat message and return the response"""
        query = {"messages": [HumanMessage(content=message)]}
        logger.info(f"Starting chat for query: {message}")
        try:
            # Invoke với cấu hình recursion limit cao hơn
            config = {"recursion_limit": 50}
            response = self.graph.invoke(query, config=config)
            final_answer = response["messages"][-1].content
            logger.info(f"Chat completed. Answer: {final_answer[:100]}...")
            return final_answer
        except Exception as e:
            logger.error(f"Error during chat processing: {str(e)}")
            return f"Đã xảy ra lỗi trong quá trình xử lý: {str(e)}"

# Toggle comment for deploy to Streamlit or LangGraph UI
# graph = KMAChatAgent()
