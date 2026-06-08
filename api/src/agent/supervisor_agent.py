import logging
import os
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel, Field

from .state import MyAgentState
from ..llm.config import get_llm
from ..llm.model_manager import model_manager, ModelType
from ..rag import create_rag_tool
from ..score import get_student_info
from ..score.models import ScoreFilter
from ..score.student_tool import global_db

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ReAct tools are only for document/regulation retrieval. Student score queries are
# handled before ReAct by LLM structured extraction and direct database access.
rag_tool = create_rag_tool()
tools = [rag_tool]

# Load prompts
prompts_dir = os.path.join(os.path.dirname(__file__), "prompts")
with open(os.path.join(prompts_dir, "system_prompt.txt"), "r", encoding="utf-8") as f:
    system_prompt = f.read().strip()


STUDENT_CODE_RE = re.compile(r"\b[ACDMT]T\d{6}\b", re.IGNORECASE)
GRADE_POINTS: Dict[str, float] = {
    "A+": 4.0,
    "A": 3.8,
    "B+": 3.5,
    "B": 3.0,
    "C+": 2.5,
    "C": 2.0,
    "D+": 1.5,
    "D": 1.0,
    "F": 0.0,
}
CONTEXTUALIZER_HISTORY_MESSAGES = 5
CONTEXTUALIZER_MESSAGE_MAX_CHARS = 1200


@dataclass
class ScoreQueryPlan:
    student_code: str
    semester: Optional[str] = None
    semester_scope: str = "all"  # all | latest | specific
    subject_name: Optional[str] = None
    wants_average: bool = False
    wants_gpa_4: bool = False
    wants_details: bool = True


class ScoreQueryExtraction(BaseModel):
    is_score_query: bool = Field(
        description="True if the user is asking about their grades, transcript, GPA, average score, semester scores, or a subject score."
    )
    semester_scope: str = Field(
        default="all",
        description="One of: all, latest, specific. latest means current/nearest/newest semester."
    )
    semester: Optional[str] = Field(
        default=None,
        description="Semester code normalized to kiN-YYYY-YYYY when explicitly mentioned, otherwise null."
    )
    subject_name: Optional[str] = Field(
        default=None,
        description="Course/subject name exactly as mentioned by the user, without semester/time words."
    )
    wants_average: bool = Field(
        default=False,
        description="True if the user asks to calculate/show average score, GPA, cumulative score, or summary."
    )
    wants_gpa_4: bool = Field(
        default=False,
        description="True if the user asks for GPA/4-point scale/letter grade/grade coefficient."
    )
    wants_details: bool = Field(
        default=True,
        description="False only when the user explicitly asks for only the final average/GPA without the course table."
    )


def _strip_accents(text: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFD", text or "")
        if unicodedata.category(char) != "Mn"
    ).lower()


def _message_content_to_text(content) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text") or item.get("content")
                parts.append(str(text) if text is not None else json.dumps(item, ensure_ascii=False))
            else:
                parts.append(str(item))
        return "\n".join(part for part in parts if part).strip()
    if isinstance(content, dict):
        text = content.get("text") or content.get("content")
        return str(text) if text is not None else json.dumps(content, ensure_ascii=False)
    return str(content)


def _truncate_for_contextualizer(content) -> str:
    text = _message_content_to_text(content).strip()
    if len(text) <= CONTEXTUALIZER_MESSAGE_MAX_CHARS:
        return text
    return text[:CONTEXTUALIZER_MESSAGE_MAX_CHARS].rstrip() + "\n...[truncated]"


def _extract_authenticated_student_code(query: str) -> Optional[str]:
    auth_match = re.search(
        r"My authenticated student code is\s+([A-Z]{2}\d{6})",
        query or "",
        re.IGNORECASE,
    )
    if auth_match:
        return auth_match.group(1).upper()

    codes = STUDENT_CODE_RE.findall(query or "")
    return codes[0].upper() if codes else None


def _looks_like_student_info_query(query: str) -> bool:
    normalized = _strip_accents(query)
    info_keywords = [
        "thong tin cua toi", "thong tin cua minh", "thong tin sinh vien",
        "lop cua toi", "ho ten cua toi", "ma sinh vien cua toi",
    ]
    return any(keyword in normalized for keyword in info_keywords)


def _build_score_query_plan(query: str, student_code: str, force_student: bool = False) -> Optional[ScoreQueryPlan]:
    prompt = f"""
You convert a user's natural-language student score request into a database query plan.

Return only the structured fields requested by the schema.

Rules:
- Understand Vietnamese and English naturally. Do not rely on fixed phrases.
- is_score_query is true for questions about grades/scores, transcript, semester result,
  subject/course score, GPA, cumulative average, grade letter, 4-point scale, or credits.
- If the user selected student mode, treat broad academic-result requests as score queries.
- Normalize explicit academic terms to kiN-YYYY-YYYY.
- If the user refers to the current, nearest, or most recent academic term, set semester_scope="latest"
  and leave semester null.
- If no semester is mentioned, set semester_scope="all".
- Extract subject_name only when a specific course/subject is being asked about.
  Keep only the course/subject name, not surrounding request text.
- wants_gpa_4 is true for GPA/4-point scale/letter grade/grade coefficient requests.
- wants_average is true for average, cumulative, GPA, summary, or ranking requests.
- wants_details is false only when the user asks for just one summary number.

Authenticated student code: {student_code}
Student mode forced: {force_student}
User request:
{query}
"""
    try:
        extraction = get_llm().with_structured_output(ScoreQueryExtraction).invoke(prompt)
        if isinstance(extraction, dict):
            extraction = ScoreQueryExtraction(**extraction)
        if not extraction.is_score_query:
            return None
        semester_scope = extraction.semester_scope if extraction.semester_scope in {"all", "latest", "specific"} else "all"
        semester = extraction.semester or None
        if semester:
            semester = semester.lower().replace("_", "-").replace("/", "-")
            if not re.match(r"^(ki|k)[1-4]-\d{4}-\d{4}$", semester):
                semester = None
            else:
                semester_scope = "specific"
        if semester_scope == "specific" and not semester:
            semester_scope = "all"
        return ScoreQueryPlan(
            student_code=student_code,
            semester=semester,
            semester_scope=semester_scope,
            subject_name=(extraction.subject_name or "").strip() or None,
            wants_average=bool(extraction.wants_average or force_student),
            wants_gpa_4=bool(extraction.wants_gpa_4),
            wants_details=bool(extraction.wants_details),
        )
    except Exception as e:
        logger.warning(f"LLM score query extraction failed; score request will not be guessed locally: {e}")
        if not force_student:
            return None
        return ScoreQueryPlan(student_code=student_code, wants_average=True, wants_gpa_4=True)


def _score_value(score) -> Optional[float]:
    value = getattr(score, "score_over_rall", None)
    return float(value) if value is not None else None


def _credit_value(score) -> int:
    subject = getattr(score, "subject", None)
    credits = getattr(subject, "subject_credits", None) if subject else None
    return int(credits or 0)


def _calculate_gpa(scores) -> Tuple[Optional[float], int]:
    total_credits = 0
    total_weighted = 0.0
    for score in scores:
        score_value = _score_value(score)
        credits = _credit_value(score)
        if score_value is None or credits <= 0:
            continue
        total_credits += credits
        total_weighted += score_value * credits
    if total_credits <= 0:
        return None, 0
    return round(total_weighted / total_credits, 2), total_credits


def _grade_point(score) -> Optional[float]:
    score_text = (getattr(score, "score_text", None) or "").strip().upper()
    if score_text in GRADE_POINTS:
        return GRADE_POINTS[score_text]

    value = _score_value(score)
    if value is None:
        return None
    if value >= 8.5:
        return 4.0
    if value >= 8.0:
        return 3.5
    if value >= 7.0:
        return 3.0
    if value >= 6.5:
        return 2.5
    if value >= 5.5:
        return 2.0
    if value >= 5.0:
        return 1.5
    if value >= 4.0:
        return 1.0
    return 0.0


def _calculate_gpa_4(scores) -> Tuple[Optional[float], int]:
    total_credits = 0
    total_weighted = 0.0
    for score in scores:
        grade_point = _grade_point(score)
        credits = _credit_value(score)
        if grade_point is None or credits <= 0:
            continue
        total_credits += credits
        total_weighted += grade_point * credits
    if total_credits <= 0:
        return None, 0
    return round(total_weighted / total_credits, 2), total_credits


def _semester_sort_key(semester: Optional[str]) -> Tuple[int, int]:
    match = re.search(r"(?:ki|k)([1-4])-(\d{4})-(\d{4})", semester or "", re.IGNORECASE)
    if not match:
        return (0, 0)
    return (int(match.group(3)), int(match.group(1)))


def _latest_semester(scores) -> Optional[str]:
    semesters = {score.semester for score in scores if getattr(score, "semester", None)}
    return max(semesters, key=_semester_sort_key) if semesters else None


def _format_score_number(value: Optional[float]) -> str:
    if value is None:
        return "-"
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _format_scores_answer(scores, plan: ScoreQueryPlan) -> str:
    if plan.semester_scope == "latest" and not plan.semester:
        latest = _latest_semester(scores)
        if latest:
            scores = [score for score in scores if score.semester == latest]
            plan.semester = latest

    if not scores:
        parts = [f"Không tìm thấy điểm của tài khoản `{plan.student_code}`"]
        if plan.semester:
            parts.append(f"trong học kỳ `{plan.semester}`")
        if plan.subject_name:
            parts.append(f"cho môn `{plan.subject_name}`")
        return " ".join(parts) + "."

    scores = sorted(
        scores,
        key=lambda score: (_semester_sort_key(getattr(score, "semester", None)), getattr(getattr(score, "subject", None), "subject_name", "")),
        reverse=True,
    )

    gpa_10, gpa_credits = _calculate_gpa(scores)
    gpa_4, gpa_4_credits = _calculate_gpa_4(scores)
    title = "Điểm của bạn"
    if plan.semester:
        title += f" trong học kỳ `{plan.semester}`"
    elif plan.semester_scope == "all":
        title += " từ đầu đến giờ"
    if plan.subject_name:
        title += f" - môn `{plan.subject_name}`"

    lines = [f"**{title}**", ""]
    if plan.wants_details:
        lines.append("| Học kỳ | Môn học | Tín chỉ | Điểm hệ 10 | Điểm chữ | Hệ 4 |")
        lines.append("|---|---|---:|---:|---:|---:|")
        for score in scores:
            subject = getattr(score, "subject", None)
            subject_label = getattr(subject, "subject_name", "-") if subject else "-"
            lines.append(
                f"| {score.semester or '-'} | {subject_label} | {_credit_value(score)} | "
                f"{_format_score_number(_score_value(score))} | {getattr(score, 'score_text', None) or '-'} | "
                f"{_format_score_number(_grade_point(score))} |"
            )
        lines.append("")

    if gpa_10 is None:
        lines.append("**Điểm trung bình hệ 10:** Chưa đủ dữ liệu tín chỉ/điểm để tính.")
    else:
        label = "Điểm trung bình học kỳ" if plan.semester else "Điểm trung bình tích lũy"
        lines.append(f"**{label}: {gpa_10}** trên {gpa_credits} tín chỉ.")

    if plan.wants_gpa_4 or plan.wants_average:
        if gpa_4 is None:
            lines.append("**GPA hệ 4:** Chưa đủ dữ liệu điểm chữ/hệ số để tính.")
        else:
            gpa_4_label = "GPA học kỳ hệ 4" if plan.semester else "GPA tích lũy hệ 4"
            lines.append(f"**{gpa_4_label}: {gpa_4}** trên {gpa_4_credits} tín chỉ.")

    if not plan.semester and not plan.subject_name and len({score.semester for score in scores}) > 1:
        by_semester = {}
        for score in scores:
            by_semester.setdefault(score.semester or "Không rõ học kỳ", []).append(score)
        lines.append("")
        lines.append("**Theo từng học kỳ:**")
        for semester, semester_scores in sorted(by_semester.items(), key=lambda item: _semester_sort_key(item[0]), reverse=True):
            semester_gpa, semester_credits = _calculate_gpa(semester_scores)
            semester_gpa_4, _ = _calculate_gpa_4(semester_scores)
            if semester_gpa is not None:
                gpa_4_part = f", GPA hệ 4 {semester_gpa_4}" if semester_gpa_4 is not None else ""
                lines.append(f"- `{semester}`: TB hệ 10 {semester_gpa}{gpa_4_part} ({semester_credits} tín chỉ)")

    return "\n".join(lines)


async def _handle_student_query_directly(query: str, force_student: bool = False) -> Optional[AIMessage]:
    student_code = _extract_authenticated_student_code(query)
    if not student_code:
        return None

    wants_student_info = _looks_like_student_info_query(query)
    score_plan = _build_score_query_plan(query, student_code, force_student=force_student)

    if wants_student_info and not score_plan:
        result = await get_student_info.ainvoke({"student_code": student_code})
        try:
            data = json.loads(result)
            student = data.get("student")
        except Exception:
            student = None
        if not student:
            return AIMessage(content=f"Không tìm thấy thông tin sinh viên của tài khoản `{student_code}`.")
        return AIMessage(content=(
            "**Thông tin của bạn**\n\n"
            f"- Mã sinh viên: `{student.get('student_code', student_code)}`\n"
            f"- Họ tên: {student.get('student_name') or '-'}\n"
            f"- Lớp: {student.get('student_class') or '-'}"
        ))

    if not score_plan:
        return None

    score_filter = ScoreFilter(
        student_code=student_code,
        semester=score_plan.semester,
    )

    try:
        scores = await global_db.db.get_scores(score_filter)
    finally:
        await global_db.close()

    if score_plan.subject_name:
        subject_query = _strip_accents(score_plan.subject_name)
        scores = [
            score for score in scores
            if subject_query in _strip_accents(getattr(score.subject, "subject_name", ""))
        ]

    answer = _format_scores_answer(scores, score_plan)
    return AIMessage(content=answer)


def get_tool_descriptions(tools_list: list) -> str:
    descriptions = "\n".join([
        f"- {tool.name}: {tool.description} (args: {tool.args_schema.schema()['properties'].keys() if tool.args_schema else 'None'})"
        for tool in tools_list])
    logger.info(f"--- AGENT: Available tools: {[tool.name for tool in tools_list]} ---")
    return descriptions

# Query contextualization prompt for history-aware RAG retrieval.
query_contextualization_prompt = """
    You are a query contextualizer for a conversational RAG system.
    Given the chat history and the latest user question, rewrite the latest user
    question into a standalone retrieval query that can be understood without
    the chat history.

    Rules:
    - Do NOT answer the question.
    - Return only the standalone query, with no explanation or prefix.
    - If the latest question is already standalone, return it unchanged.
    - Resolve pronouns, ellipsis, and short follow-up questions using the chat history.
    - Preserve the user's original language.
    
    CRITICAL:
    - If user asks in Vietnamese, return Vietnamese.
    - If user asks in English, return English.
    - Never translate the query into another language.
    
    ** History **
    This is the recent chat history. Older turns may be omitted:
    {chat_history}
    
    ** Latest user question **
    This is latest user question:
    {question}
    """


async def contextualize_latest_query(state: MyAgentState) -> MyAgentState:
    """
    Rewrite the latest user query into a standalone retrieval query when
    conversation history exists.
    """
    logger.info("--- AGENT: Contextualizing latest query with chat history ---")
    
    messages = state["messages"]
    
    if len(messages) < 1:
        return state
    
    # Get the latest user query
    latest_query = _message_content_to_text(messages[-1].content)
    
    # CRITICAL: Check if message has file attachment context
    # If it does, SKIP reformulation to preserve the [DOCUMENT CONTEXT] marker
    has_file_context = "[DOCUMENT CONTEXT]" in latest_query
    if has_file_context:
        logger.info("📎 File context detected in query - SKIPPING reformulation to preserve [DOCUMENT CONTEXT] marker")
        return state

    has_auth_context = "My authenticated student code is" in latest_query
    if has_auth_context:
        logger.info("Student auth context detected in query - SKIPPING reformulation to preserve access control context")
        return state
    
    # The contextualizer uses chat history to rewrite follow-up questions into
    # standalone retrieval queries. It also returns standalone questions unchanged.
    llm = get_llm()  # Use factory method to support runtime model switching
    
    # Format only the latest turns for the contextualization prompt.
    chat_history = []
    recent_messages = messages[:-1][-CONTEXTUALIZER_HISTORY_MESSAGES:]
    for msg in recent_messages:  # Exclude the most recent message
        prefix = "[bot]" if isinstance(msg, AIMessage) else "[user]"
        content = _truncate_for_contextualizer(msg.content)
        if content:
            chat_history.append(f"{prefix} {content}")

    logger.info("--- AGENT: Contextualizing latest query ---")
    logger.info(f"Latest query: {latest_query}")
    logger.info(f"Using {len(chat_history)} recent history messages for contextualization")
    logger.info(f"Chat history: {chat_history}")

    chat_history_str = "" + "\n".join(chat_history)

    if len(chat_history_str) == 0:
        return state

    logger.info(f"Chat history str: {chat_history_str}")
    
    # Invoke the rewriting prompt with the formatted chat history
    try:
        standalone_query = llm.invoke(
            query_contextualization_prompt.format(
                chat_history=chat_history_str,
                question=latest_query
            )
        )
        
        # Replace the latest message with the reformulated query
        contextualized_query = _message_content_to_text(getattr(standalone_query, "content", standalone_query)).strip()
        contextual_message = HumanMessage(content=contextualized_query or latest_query)

        logger.info("--- AGENT: Contextualized query ---")
        logger.info(f"Contextualized query: {contextual_message.content}")
        
        # Return new state with all previous messages and the reformulated query
        return {"messages": messages[:-1] + [contextual_message]}
    except Exception as e:
        logger.error(f"Error contextualizing latest query: {e}")
        # If contextualization fails, continue with original messages.
        return state


async def call_model_no_human_loop(state: MyAgentState) -> MyAgentState:
    logger.info("--- AGENT (No Human Loop): Calling LLM ---")
    
    # Log active model at the start for debugging
    try:
        active_model_type = model_manager.get_model_type()
        logger.info(f"🤖 [AGENT START] Active model type: {active_model_type}")
        logger.info(f"🤖 [AGENT START] Model type name: {active_model_type.name}")
        
        # Also log which specific model name will be used
        if active_model_type == ModelType.OLLAMA:
            ollama_info = model_manager.get_ollama_info()
            logger.info(f"🤖 [AGENT START] Using Ollama model: {ollama_info.get('model')}")
        elif active_model_type == ModelType.GEMINI:
            gemini_info = model_manager.get_gemini_info()
            logger.info(f"🤖 [AGENT START] Using Gemini model: {gemini_info.get('model')}")
    except Exception as e:
        logger.warning(f"⚠️ Could not log model info: {e}")

    # Prepare the prompts
    tool_descriptions = get_tool_descriptions(tools)
    logger.info(f"Available tools: {[tool.name for tool in tools]}")
    logger.info(f"Tool descriptions length: {len(tool_descriptions)}")
    
    chat_mode = state.get("chat_mode") or "auto"

    # Student score/info mode is resolved before ReAct. Remaining tool calls are
    # for document/regulation retrieval, except uploaded document context.
    last_message = state["messages"][-1] if state["messages"] else None
    force_rag_tool = False
    
    if last_message and isinstance(last_message, HumanMessage):
        message_text = _message_content_to_text(last_message.content)
        if chat_mode == "student":
            direct_student_response = await _handle_student_query_directly(
                message_text,
                force_student=True,
            )
            if direct_student_response:
                logger.info("Student mode selected; direct score/info handler returned response")
                return {"messages": state["messages"] + [direct_student_response]}

            return {"messages": state["messages"] + [AIMessage(content="Tôi chưa thể lấy dữ liệu sinh viên cho yêu cầu này. Vui lòng kiểm tra mã sinh viên trong hồ sơ và thử lại.")]}

        if chat_mode != "document":
            direct_student_response = await _handle_student_query_directly(message_text)
            if direct_student_response:
                logger.info("Direct student score/info handler returned response; skipping LLM tool calling")
                return {"messages": state["messages"] + [direct_student_response]}

        query_lower = message_text.lower()
        query = message_text
        
        # Check if message already has file attachment context
        has_file_context = "[DOCUMENT CONTEXT]" in query
        logger.info(f"📎 File context in message: {has_file_context}")
        
        if has_file_context:
            logger.info("✅ Message has file attachment context, skipping force RAG tool")
            force_rag_tool = False
        elif chat_mode == "document":
            force_rag_tool = True
            logger.info(f"Document mode selected; forcing search_kma_regulations for: {query[:100]}...")
        else:
            force_rag_tool = True
            logger.info(f"Auto mode non-student query; forcing search_kma_regulations for: {query[:100]}...")
    # If forcing tool call, inject it directly
    if force_rag_tool:
        
        # Extract query (remove document context if present)
        query = _message_content_to_text(last_message.content)
        if "[DOCUMENT CONTEXT]" in query:
            # This shouldn't happen since we check earlier, but just in case
            query = query.split("[DOCUMENT CONTEXT]")[0].strip()
        
        # Use department from state if provided, otherwise detect from keywords in legacy auto mode.
        department = state.get('department')
        if not department and chat_mode != "document":
            # Fallback to keyword detection
            if any(kw in query_lower for kw in ['thi', 'kiểm tra', 'đình chỉ', 'phúc khảo', 'khảo thí']):
                department = 'phongkhaothi'
            elif any(kw in query_lower for kw in ['đào tạo', 'tốt nghiệp', 'học tập', 'tín chỉ']):
                department = 'phongdaotao'
        
        # Call RAG tool directly
        logger.info(f"⚡ FORCING search_kma_regulations: query='{query}', department='{department}'")
        
        try:
            # Import and call tool directly
            from ..rag import search_kma_regulations
            logger.info(f"🔧 Calling search_kma_regulations with query: {query[:100]}...")
            logger.info(f"🔧 Department: {department}")
            
            result = search_kma_regulations.invoke({
                "query": query, 
                "department": department  # None is now valid
            })
            
            logger.info(f"📊 Tool result length: {len(result)}")
            logger.info(f"📝 Tool result preview: {result[:200]}...")
            
            if not result or len(result.strip()) == 0:
                logger.error("❌ Empty result from forced tool call!")
                result = "Xin lỗi, tôi không tìm thấy thông tin phù hợp với câu hỏi của bạn."
            
            # Create response message with result
            response_message = AIMessage(content=result)
            logger.info(f"✅ Forced tool call successful, returning response")
            
            return {"messages": state['messages'] + [response_message]}
            
        except Exception as e:
            import traceback
            logger.error(f"❌ Forced tool call failed: {e}")
            logger.error(traceback.format_exc())
            # Fall through to normal LLM call
    
    # Normal LLM call with few-shot examples
    few_shot_examples = """

### VÍ DỤ MINH HỌA (BẮT BUỘC HỌC THEO)

**Ví dụ 1: Câu hỏi về quy định (NO FILE CONTEXT)**
User: "Những hành vi nào bị đình chỉ thi?"
Assistant: [Phải gọi search_kma_regulations]
Action: search_kma_regulations
Action Input: query="hành vi bị đình chỉ thi", department="phongkhaothi"

**Ví dụ 2: Câu hỏi về điều kiện (NO FILE CONTEXT)**
User: "Điều kiện tốt nghiệp là gì?"
Assistant: [Phải gọi search_kma_regulations]
Action: search_kma_regulations
Action Input: query="điều kiện tốt nghiệp", department="phongdaotao"

**Ví dụ 3: Câu hỏi về tài liệu được upload (HAS FILE CONTEXT)**
User: "Giải thích chi tiết hơn về điều này"
[User has uploaded a document with context, message contains [DOCUMENT CONTEXT] section]
Assistant: [Không cần gọi tool, đã có document context, trả lời trực tiếp dựa trên tài liệu]
Trả lời: "Dựa trên tài liệu bạn đã upload, điểm chính là..."

**Ví dụ 4: Câu hỏi cụ thể về tài liệu (HAS FILE CONTEXT)**
User: "Điểm nào quan trọng nhất trong tài liệu này?"
[User has uploaded a document]
Assistant: [Sử dụng thông tin từ [DOCUMENT CONTEXT], không gọi search_kma_regulations]
Trả lời: "Theo tài liệu bạn vừa chia sẻ, điểm quan trọng nhất là..."

📋 QUY TẮC QUAN TRỌNG:
1. ✅ Nếu message chứa [DOCUMENT CONTEXT]: Trả lời trực tiếp dựa trên tài liệu, KHÔNG gọi search_kma_regulations
2. ✅ Nếu không có [DOCUMENT CONTEXT] và là câu hỏi về quy định: Gọi search_kma_regulations
3. ✅ Nếu là câu hỏi về điểm cá nhân + có student code: đã được xử lý trước bước ReAct bằng LLM structured extraction
4. ⚠️ KHÔNG bao giờ bỏ qua tài liệu được upload - đó là ưu tiên hàng đầu"""
    
    permission_rules = """

### STUDENT DATA PERMISSION RULES
- Personal score questions are handled before this ReAct prompt by a structured LLM query planner and direct database access.
- For any remaining student information response, only use the authenticated student code injected by the backend: "My authenticated student code is ...".
- Never use a different student code from the user's message or chat history.
- If the user tries to view another student's personal information, answer exactly: "Bạn chỉ được xem điểm và thông tin của mình."
"""

    citation_rules = """

### DOCUMENT CITATION RULES
- When answering from KMA regulations, uploaded documents, or any [DOCUMENT CONTEXT], the final answer MUST include a **Nguồn:** section.
- In **Nguồn:**, cite the exact file name, the relevant ban/phòng/department if available, and the Điều/Khoản/Điểm/Phụ lục if present in the provided context.
- If the context has source markers such as [Source 1], "File:", "Chunk:", or department metadata, use them instead of saying a vague phrase like "the uploaded document".
- If a cited document does not expose Điều/Khoản/Điểm, still cite the file name and available source marker/chunk.
- Do not invent sources, file names, or article numbers. If source metadata is missing, write "Không rõ nguồn cụ thể trong context".
- Never show internal reasoning, checklists, drafts, "User Question", "Constraints", "Draft", or answer-quality notes. Return only the final user-facing answer.
"""

    enhanced_prompt = system_prompt.format(tool_descriptions=tool_descriptions) + few_shot_examples + permission_rules + citation_rules
    
    prompt = ChatPromptTemplate.from_messages(
        [("system", enhanced_prompt),
         MessagesPlaceholder(variable_name="messages"), ])

    # Bind tools and structured output - use factory method for runtime model switching
    # Check if message has file context - if so, don't bind tools
    has_file_context = False
    last_msg = state["messages"][-1] if state["messages"] else None
    if last_msg and isinstance(last_msg, HumanMessage):
        has_file_context = "[DOCUMENT CONTEXT]" in last_msg.content
    
    logger.info(f"📎 Has file context in LLM call: {has_file_context}")
    
    # Log active model information for debugging
    try:
        active_model_type = model_manager.get_model_type()
        logger.info(f"🤖 Active model type: {active_model_type}")
        logger.info(f"🤖 Model type name: {active_model_type.name}")
        if active_model_type == ModelType.OLLAMA:
            ollama_info = model_manager.get_ollama_info()
            logger.info(f"🤖 Using Ollama: {ollama_info.get('model')}")
        elif active_model_type == ModelType.GEMINI:
            gemini_info = model_manager.get_gemini_info()
            logger.info(f"🤖 Using Gemini: {gemini_info.get('model')}")
    except Exception as e:
        logger.warning(f"⚠️ Could not get model info: {e}")
    
    # Bind tools only if no file context
    if has_file_context:
        logger.info("⏭️  Skipping tool binding - file context present, direct LLM response")
        model_with_tools = get_llm()  # No tools
    else:
        model_with_tools = get_llm().bind_tools(tools)
    
    chains = prompt | model_with_tools

    try:
        response = chains.invoke({"messages": state["messages"]})
        
        # Log tool calls for debugging
        if hasattr(response, 'tool_calls') and response.tool_calls:
            logger.info(f"--- AGENT: Tool calls detected: {[tool_call.get('name', 'unknown') for tool_call in response.tool_calls]} ---")
            logger.info(f"Response from tool calls: {response.content[:200] if hasattr(response, 'content') else 'N/A'}...")
        else:
            logger.info("--- AGENT: No tool calls detected ---")
            logger.info(f"Response content preview: {response.content[:200]}...")
            logger.info(f"Response model used: {response.__class__.__name__}")
            
        return {"messages": state['messages'] + [response]}

    except Exception as e:
        logger.error(f"Error invoking LLM: {e}")
        error_message = AIMessage(content=f"An error occurred with the LLM: {e}")
        return {"messages": state['messages'] + [error_message]}


def should_continue_no_human_loop(state: MyAgentState):
    print("--- AGENT (No Human Loop): Deciding next step ---")
    last_message = state['messages'][-1] if state['messages'] else None
    if not last_message:  # Trường hợp state messages rỗng
        return END

    if isinstance(last_message, AIMessage) and hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "action"
    print("--- AGENT (No Human Loop): No tool call, ending. ---")
    return END


tool_node = ToolNode(tools)


class ReActGraph:
    def __init__(self):
        self.workflow = None
        self.state = MyAgentState
        self.tools = tools
        self.call_model_no_human_loop = call_model_no_human_loop
        self.tool_node = tool_node
        self.should_continue_no_human_loop = should_continue_no_human_loop
        self.conversation_memory = []

    def create_graph(self):
        # Create the state graph
        logger.info("___Creating workflow graph___")

        workflow = StateGraph(self.state)
        workflow.add_node("contextualize", contextualize_latest_query)
        workflow.add_node("agent", self.call_model_no_human_loop)
        workflow.add_node("action", self.tool_node)
        
        # Set entry point to the query contextualization node
        workflow.set_entry_point("contextualize")
        
        # After contextualization, always go to agent
        workflow.add_edge("contextualize", "agent")
        
        # From agent, conditionally go to action or end
        workflow.add_conditional_edges("agent", self.should_continue_no_human_loop, {"action": "action", END: END})
        
        # From action, always go back to agent
        workflow.add_edge("action", "agent")
        
        self.workflow = workflow.compile()

        logger.info("___Finished creating workflow graph___")
        return self.workflow

    def print_mermaid(self):
        # Generate and log the Mermaid diagram
        try:
            logger.info("___Printing mermaid graph___")
            mermaid_diagram = self.workflow.get_graph().draw_mermaid()
            logger.info("Mermaid diagram:")
            logger.info(mermaid_diagram)


            logger.info("___Saving mermaid graph to file___")
            current_dir = Path(__file__).parent.absolute()
            project_root = current_dir.parent.parent
            mermaid_dir_path = os.path.join(project_root, "mermaid")
            mermaid_path = os.path.join(mermaid_dir_path, "react_mermaid.mmd")

            ## Save the diagram to a file
            with open(mermaid_path, "w") as f:
                f.write(mermaid_diagram)
                f.close()

            logger.info("___Finished printing mermaid graph___")

        except Exception as e:
            print(f"Error generating Mermaid diagram: {str(e)}")

    async def chat(self, init: str):
        """Legacy method for single message processing, maintained for backward compatibility"""
        initial_state = {"messages": [HumanMessage(content=init)]}

        if self.workflow is None:
            self.create_graph()
            self.print_mermaid()

        result = await self.workflow.ainvoke(initial_state)
        current_messages = result['messages']

        return current_messages
        
    async def chat_with_memory(self, conversation_history: List[BaseMessage], query: str, department: str = None, chat_mode: str = "auto") -> List[BaseMessage]:
        """
        Process a query while maintaining conversation history.
        
        Args:
            conversation_history: Previous messages in the conversation
            query: The new user query to process
            department: Optional department to route the query to
            chat_mode: Explicit route mode, usually 'document' or 'student'
            
        Returns:
            Updated conversation history with the agent's response
        """
        # Add the new query to the conversation history
        updated_history = conversation_history.copy() + [HumanMessage(content=query)]
        
        # Prepare the initial state with the full conversation history
        initial_state = {
            "messages": updated_history,
            "department": department,
            "chat_mode": chat_mode,
        }
        
        # Create the workflow if it doesn't exist
        if self.workflow is None:
            self.create_graph()
            self.print_mermaid()
            
        # Execute the workflow
        result = await self.workflow.ainvoke(initial_state)
        
        # Return the updated conversation history
        return result['messages']
