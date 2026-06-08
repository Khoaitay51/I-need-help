import logging
import json
import os
import re
import sys
import asyncio
from datetime import datetime
from typing import Any, List, Dict

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, status, Header, Depends
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage, AIMessage

# Add the parent directory to sys.path to import our agent
print(os.path.abspath(__file__))
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from ...agent.supervisor_agent import ReActGraph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize agent once
agent = ReActGraph()
agent.create_graph()
agent.print_mermaid()

from ..db.mongodb import MongoDB, mongodb
from ..models.chat import (
    ConversationCreate,
    ConversationResponse,
    ConversationUpdate,
    MessageCreate,
    MessageResponse, QuickMessageResponse, MessageQuickChat
)
from ..models.user import UserResponse
from ..models.responses import BaseResponse
from ..auth.dependencies import require_auth
from .rate_limit import check_rate_limit
from ..services.department_filter import DepartmentFilterService
from ..services.attachment_rag_service import get_attachment_rag_service

router = APIRouter()

# Agent already initialized above, no need to recreate

STUDENT_CODE_PATTERN = re.compile(r"\b[ACDMT]T\d{6}\b", re.IGNORECASE)
PRIVATE_SCORE_KEYWORDS = [
    "điểm của", "điểm em", "điểm tôi", "điểm mình", "điểm sinh viên",
    "xem điểm", "tra điểm", "kiểm tra điểm", "kết quả học tập",
    "gpa", "điểm trung bình", "điểm tích lũy", "điểm học kỳ",
]
PRIVATE_INFO_KEYWORDS = [
    "thông tin của", "thông tin em", "thông tin tôi", "thông tin mình",
    "thông tin sinh viên", "lớp của", "lớp em", "lớp tôi", "lớp mình",
    "họ tên", "tên của", "mã sinh viên",
]
OWN_STUDENT_PERMISSION_MESSAGE = "Bạn chỉ được xem điểm và thông tin của mình."
MISSING_STUDENT_CODE_MESSAGE = "Tài khoản của bạn chưa có mã sinh viên. Vui lòng cập nhật mã sinh viên để xem điểm hoặc thông tin cá nhân."
VALID_CHAT_MODES = {"document", "student", "auto"}

# Helper function to check if ObjectId is valid
def validate_object_id(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail=f"Invalid ID format: {id}")
    return ObjectId(id)


def normalize_message_content(content: Any) -> str:
    """Convert legacy/LLM message payloads to plain text for API responses."""
    if content is None:
        normalized = ""
    elif isinstance(content, str):
        normalized = content
    elif isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text") or item.get("content")
                parts.append(str(text) if text is not None else json.dumps(item, ensure_ascii=False))
            else:
                parts.append(str(item))
        normalized = "\n".join(part for part in parts if part)
    elif isinstance(content, dict):
        text = content.get("text") or content.get("content")
        normalized = str(text) if text is not None else json.dumps(content, ensure_ascii=False)
    else:
        normalized = str(content)

    return strip_response_reasoning(strip_thinking_content(normalized))


def strip_thinking_content(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"<think(?:ing)?>[\s\S]*?(?:</think(?:ing)?>|$)", "", str(text), flags=re.IGNORECASE).lstrip()


def strip_response_reasoning(text: str) -> str:
    text = str(text or "").strip()
    if not text:
        return ""

    for pattern in [
        r"Source included\?\s*Yes\.\s*",
        r"Nguồn included\?\s*Yes\.\s*",
        r"Draft:\s*",
    ]:
        matches = list(re.finditer(pattern, text, flags=re.IGNORECASE))
        if matches:
            text = text[matches[-1].end():].strip()
            break

    if re.search(r"(?im)^\s*(User Question|Role:|Constraints:|Professional,\s*Markdown\?|Concise\?|No greetings\?)", text):
        source_match = re.search(r"(?im)^\s*(?:\*\*)?Nguồn\s*:", text)
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


def extract_document_context_sources(text: str) -> List[str]:
    if "[DOCUMENT CONTEXT]" not in (text or ""):
        return []

    context = text.split("[DOCUMENT CONTEXT]", 1)[1]
    sources = []
    current = {}

    for line in context.splitlines():
        stripped = line.strip()
        if stripped.startswith("[Source "):
            if current:
                sources.append(current)
            current = {"source": stripped.strip("[]")}
        elif current and stripped.startswith("File:"):
            current["file"] = stripped.split(":", 1)[1].strip()
        elif current and stripped.startswith("Chunk:"):
            current["chunk"] = stripped.split(":", 1)[1].strip()

    if current:
        sources.append(current)

    formatted = []
    seen = set()
    for source in sources:
        file_name = source.get("file") or "Không rõ file"
        chunk = source.get("chunk")
        key = (file_name, chunk)
        if key in seen:
            continue
        seen.add(key)

        suffix = f", chunk {chunk}" if chunk not in (None, "") else ""
        formatted.append(f"- {file_name}{suffix}")

    return formatted[:5]


def ensure_uploaded_document_source_footer(answer: str, augmented_query: str) -> str:
    answer = normalize_message_content(answer)
    if "[DOCUMENT CONTEXT]" not in (augmented_query or ""):
        return answer
    if re.search(r"(?im)^\s*(\*\*)?nguồn\b", answer):
        return answer

    sources = extract_document_context_sources(augmented_query)
    if not sources:
        sources = ["- Không rõ nguồn cụ thể trong context"]

    return f"{answer}\n\n**Nguồn:**\n" + "\n".join(sources)


def normalize_student_code(student_code: Any) -> str:
    if not student_code:
        return ""
    return str(student_code).strip().upper()


def get_current_student_code(current_user: Any) -> str:
    if isinstance(current_user, dict):
        return normalize_student_code(current_user.get("student_code") or current_user.get("studentCode"))
    return normalize_student_code(
        getattr(current_user, "student_code", None) or getattr(current_user, "studentCode", None)
    )


def extract_student_codes(text: str) -> List[str]:
    return sorted({match.group(0).upper() for match in STUDENT_CODE_PATTERN.finditer(text or "")})


def is_private_student_query(text: str) -> bool:
    query_lower = (text or "").lower()
    has_private_keyword = any(keyword in query_lower for keyword in PRIVATE_SCORE_KEYWORDS + PRIVATE_INFO_KEYWORDS)
    has_personal_pronoun = any(word in query_lower for word in ["tôi", "mình", "em", "của tôi", "của mình", "của em"])
    has_student_code = bool(extract_student_codes(text))
    if has_student_code and any(word in query_lower for word in ["điểm", "gpa", "thông tin", "lớp", "họ tên"]):
        return True
    return has_private_keyword and (has_personal_pronoun or has_student_code or "sinh viên" in query_lower)


def authorize_and_augment_student_query(user_query: str, current_user: Any) -> str:
    """
    Enforce per-user student data access before the agent can call score/info tools.
    The client-provided student_code header is intentionally ignored.
    """
    own_student_code = get_current_student_code(current_user)
    requested_codes = extract_student_codes(user_query)

    if requested_codes and any(code != own_student_code for code in requested_codes):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=OWN_STUDENT_PERMISSION_MESSAGE,
        )

    if is_private_student_query(user_query):
        if not own_student_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=MISSING_STUDENT_CODE_MESSAGE,
            )
        return (
            f"My authenticated student code is {own_student_code}. "
            "Only use this student code for any score or student information tool call. "
            "Never use any other student code.\n\n"
            "If the user asks for the current semester but no exact semester code is provided, "
            "call get_student_scores without the semester filter and summarize the latest semester available in the returned data.\n\n"
            f"{user_query}"
        )

    return user_query


def normalize_chat_mode(chat_mode: Any) -> str:
    mode = str(chat_mode or "document").strip().lower()
    if mode not in VALID_CHAT_MODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="chat_mode phải là 'document' hoặc 'student'.",
        )
    return mode


def build_student_mode_query(user_query: str, current_user: Any) -> str:
    own_student_code = get_current_student_code(current_user)
    requested_codes = extract_student_codes(user_query)

    if not own_student_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=MISSING_STUDENT_CODE_MESSAGE,
        )

    if requested_codes and any(code != own_student_code for code in requested_codes):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=OWN_STUDENT_PERMISSION_MESSAGE,
        )

    return (
        f"My authenticated student code is {own_student_code}. "
        "Only use this student code for any score or student information tool call. "
        "Never use any other student code.\n\n"
        "The user explicitly selected the student score/info mode. "
        "Handle the request as a student data lookup. If the user asks generally, show the available score summary. "
        "If the user asks for the current semester but no exact semester code is provided, "
        "call get_student_scores without the semester filter and summarize the latest semester available in the returned data.\n\n"
        f"{user_query}"
    )


def sse_event(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def chunk_text(text: str, chunk_size: int = 180) -> List[str]:
    if not text:
        return []
    chunks = []
    current = ""
    for word in text.split(" "):
        next_part = word if not current else f"{current} {word}"
        if len(next_part) > chunk_size and current:
            chunks.append(current + " ")
            current = word
        else:
            current = next_part
    if current:
        chunks.append(current)
    return chunks


# Helper function to estimate token count for rate limiting
def estimate_token_count(prompt_text: str, response_text: str) -> int:
    """
    Ước tính số token được sử dụng trong một cuộc hội thoại
    
    Args:
        prompt_text: Nội dung tin nhắn của người dùng
        response_text: Nội dung phản hồi của AI
        
    Returns:
        Ước tính tổng số token
    """
    # Một cách ước tính đơn giản: ~4 ký tự = 1 token (thực tế phụ thuộc vào tokenizer)
    prompt_text = normalize_message_content(prompt_text)
    response_text = normalize_message_content(response_text)

    prompt_tokens = len(prompt_text) // 4
    response_tokens = len(response_text) // 4
    
    # Thêm một overhead cho các token đặc biệt và context
    overhead = 100
    
    return prompt_tokens + response_tokens + overhead


@router.get("/conversations/all", response_model=BaseResponse[List[ConversationResponse]])
async def get_all_conversations(
        skip: int = Query(0, ge=0),
        limit: int = Query(20, ge=1, le=100),
        current_user = Depends(require_auth)
):
    cursor = mongodb.db.conversations.find(
        {}
    ).sort("updated_at", -1).skip(skip).limit(limit)

    conversations = []
    async for conv in cursor:
        # Count messages for this conversation
        response_data = ConversationResponse(
            _id=str(conv["_id"]),
            user_id=str(conv["user_id"]),
            title=conv["title"],
            created_at=conv["created_at"],
            updated_at=conv["updated_at"],
        )
        conversations.append(response_data)

    return BaseResponse(
        statusCode=status.HTTP_200_OK,
        message="Conversations retrieved successfully",
        data=conversations
    )

@router.get("/conversations", response_model=BaseResponse[List[ConversationResponse]])
async def get_conversations_of_user(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user = Depends(require_auth)
):
    """Get all conversations for a user"""
    # Kiểm tra nếu current_user là dict hoặc UserResponse
    if isinstance(current_user, dict):
        user_id = current_user.get("_id") or current_user.get("user_id")
    else:
        user_id = current_user._id
        
    user_id_obj = validate_object_id(user_id)

    conversations = []

    if user_id_obj is None:
        return BaseResponse(
            statusCode=status.HTTP_200_OK,
            message="Conversations retrieved successfully",
            data=conversations
        )
    
    cursor = mongodb.db.conversations.find(
        {"user_id": user_id_obj}
    ).sort("updated_at", -1).skip(skip).limit(limit)

    async for conv in cursor:
        # Count messages for this conversation
        # Fetch first user message as preview
        first_message = await mongodb.db.messages.find_one(
            {"conversation_id": conv["_id"], "is_user": True},
            sort=[("created_at", 1)]
        )
        
        preview = ""
        if first_message:
            # Get full first user message (no truncation)
            preview = normalize_message_content(first_message.get("content", ""))
        
        response_data = ConversationResponse(
            _id = str(conv["_id"]),
            user_id = str(conv["user_id"]),
            title = conv["title"],
            created_at = conv["created_at"],
            updated_at = conv["updated_at"],
            preview = preview  # Include preview
        )
        conversations.append(response_data)
    
    return BaseResponse(
        statusCode=status.HTTP_200_OK,
        message="Conversations retrieved successfully",
        data=conversations
    )

@router.post("/conversations", response_model=BaseResponse[ConversationResponse])
async def create_conversation(
    conversation: ConversationCreate,
    current_user = Depends(require_auth)
):
    logger.info(f"Creating conversation: {conversation.title}")
    """Create a new conversation"""
    user_id_obj = validate_object_id(conversation.user_id)
    
    now = datetime.utcnow()
    new_conversation = {
        "user_id": user_id_obj,
        "title": conversation.title,
        "created_at": now,
        "updated_at": now
    }

    collection = mongodb.db.conversations
    if collection is None:
        logger.info("Error: Collection object is None!")
    else:
        logger.info(f"Collection object: {collection}")

    result = await mongodb.db.conversations.insert_one(new_conversation)
    logger.info("conv id: ", result)

    conversation_id = result.inserted_id
    
    created_conversation = await mongodb.db.conversations.find_one({"_id": conversation_id})

    logger.info("Created conv")
    logger.info(created_conversation)

    response_data = ConversationResponse(
        _id=str(created_conversation["_id"]),
        user_id=str(created_conversation["user_id"]),
        title= created_conversation["title"],
        created_at = created_conversation["created_at"],
        updated_at = created_conversation["updated_at"],
    )
    
    return BaseResponse(
        statusCode=status.HTTP_201_CREATED,
        message="Conversation created successfully",
        data=response_data
    )

@router.put("/conversations/{conversation_id}", response_model=BaseResponse[ConversationResponse])
async def update_conversation(
    conversation_id: str,
    conversation: ConversationUpdate,
    current_user = Depends(require_auth)
):
    """Update a conversation's title"""
    conv_id = validate_object_id(conversation_id)

    result = await mongodb.db.conversations.update_one(
        {"_id": conv_id},
        {"$set": {"title": conversation.title, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    updated_conversation = await mongodb.db.conversations.find_one({"_id": conv_id})

    response_data = ConversationResponse(
        _id=str(updated_conversation["_id"]),
        user_id=str(updated_conversation["user_id"]),
        title=updated_conversation["title"],
        created_at=updated_conversation["created_at"],
        updated_at=updated_conversation["updated_at"],
    )
    
    return BaseResponse(
        statusCode=status.HTTP_200_OK,
        message="Conversation updated successfully",
        data=response_data
    )

@router.delete("/conversations/{conversation_id}", response_model=BaseResponse)
async def delete_conversation(
    conversation_id: str,
    current_user = Depends(require_auth)
):
    """Delete a conversation and all its messages"""
    conv_id = validate_object_id(conversation_id)

    # First check if conversation exists
    conversation = await mongodb.db.conversations.find_one(
        {"_id": conv_id}
    )
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Delete all messages in the conversation
    await mongodb.db.messages.delete_many({"conversation_id": conv_id})
    
    # Delete the conversation
    await mongodb.db.conversations.delete_one({"_id": conv_id})
    
    return BaseResponse(
        statusCode=status.HTTP_200_OK,
        message="Conversation deleted successfully",
        data=None
    )

@router.get("/messages/{conversation_id}", response_model=BaseResponse[List[MessageResponse]])
async def get_messages_of_conversation(
    conversation_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get messages for a specific conversation"""
    conv_id = validate_object_id(conversation_id)

    # Check if conversation exists and belongs to the user
    conversation = await mongodb.db.conversations.find_one(
        {"_id": conv_id}
    )

    print("Conv:")
    print(conversation)
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    cursor = mongodb.db.messages.find(
        {"conversation_id": conv_id}
    ).sort("created_at", 1).skip(skip).limit(limit)
    
    messages = []
    async for msg in cursor:
        response_msg = MessageResponse(
            _id = str(msg["_id"]),
            content = normalize_message_content(msg.get("content")),
            is_user = msg["is_user"],
            created_at = msg["created_at"],
            attachments = msg.get("attachments", [])
        )
        messages.append(response_msg)

    return BaseResponse(
        statusCode=status.HTTP_200_OK,
        message="Messages retrieved successfully",
        data=messages
    )


@router.post("/{conversation_id}/messages", response_model=BaseResponse[MessageResponse])
async def query_ai(
    conversation_id: str,
    message: MessageCreate,
    student_code: str = Header(None),
    current_user = Depends(require_auth)
):
    """Add a new message to a conversation and get AI response using memory-aware chat"""
    conv_id = validate_object_id(conversation_id)

    # Check if conversation exists and belongs to the user
    conversation = await mongodb.db.conversations.find_one(
        {"_id": conv_id}
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Lấy user_id của người dùng hiện tại để kiểm tra rate limit
    user_id = str(current_user.get("_id"))
    if not user_id:
        logger.error("User ID not found in current_user object")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found")
    
    chat_mode = normalize_chat_mode(message.chat_mode)

    if chat_mode == "student" and message.attachments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chế độ hỏi điểm không hỗ trợ đính kèm tài liệu. Vui lòng chuyển sang Hỏi tài liệu.",
        )

    # Get selected folder from message
    selected_folder = message.department

    if chat_mode != "student":
        # Detect query metadata department using existing logic
        from rag.retriever import analyze_query_for_metadata_filter
        query_metadata = analyze_query_for_metadata_filter(message.content)
        query_metadata_department = query_metadata.get('department') if query_metadata else None
        
        # Validate query scope based on folder selection
        is_allowed, reason = DepartmentFilterService.validate_query_scope(
            message.content, selected_folder, query_metadata_department
        )
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail=reason
            )
    
    # Kiểm tra rate limit trước khi xử lý tin nhắn - không tính request ở đây
    # vì mỗi cặp câu hỏi và câu trả lời chỉ tính là 1 request
    allowed, error_message = await check_rate_limit(user_id, 0, count_as_request=False)  
    if not allowed:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=error_message)
    
    now = datetime.utcnow()

    if student_code:
        logger.info("Ignoring client-provided student_code header; using authenticated user profile")

    content = message.content
    if chat_mode == "student":
        augmented_private_content = build_student_mode_query(content, current_user)
    elif chat_mode == "auto":
        augmented_private_content = authorize_and_augment_student_query(content, current_user)
    else:
        augmented_private_content = content

    logger.info(f"DEBUG QUERY_AI START - message.attachments received from frontend: type={type(message.attachments)}, value={message.attachments}")

    # ==================== NEW: Handle Attachments ====================
    attachment_objects = []
    augmented_content = augmented_private_content
    
    if message.attachments:
        # Get attachment RAG service
        attachment_rag_service = get_attachment_rag_service()
        
        # Build context from attachments
        attachment_context = await attachment_rag_service.build_context_from_attachments(
            query=augmented_private_content,
            file_ids=message.attachments,
            max_context_length=12000
        )
        
        # Augment content with attachment context
        if attachment_context:
            augmented_content = f"{augmented_private_content}\n\n[DOCUMENT CONTEXT]\n{attachment_context}"
        
        # Prepare attachment objects for DB storage
        for file_id in message.attachments:
            try:
                from ..services.file_service import FileManagementService
                file_service = FileManagementService(mongodb.db)
                file_metadata = await file_service.get_file_metadata(file_id)
                
                att_obj = {
                    "file_id": file_id,
                    "filename": file_metadata.get("original_filename", file_metadata.get("filename", "Unknown")),
                    "size": file_metadata.get("size", 0),
                    "mime_type": file_metadata.get("mime_type", "application/octet-stream"),
                    "status": "ready"
                }
                attachment_objects.append(att_obj)
            except KeyError as e:
                logger.error(f"KeyError fetching metadata field for {file_id}: {str(e)}", exc_info=True)
                # Fallback: save with minimal info
                attachment_objects.append({
                    "file_id": file_id,
                    "filename": "Unknown",
                    "size": 0,
                    "mime_type": "application/octet-stream",
                    "status": "failed"
                })
            except Exception as e:
                logger.error(f"❌ Could not load attachment metadata for {file_id}, error: {str(e)}", exc_info=True)
                # Fallback: save with minimal info
                attachment_objects.append({
                    "file_id": file_id,
                    "filename": "Unknown",
                    "size": 0,
                    "mime_type": "application/octet-stream",
                    "status": "failed"
                })
        
        logger.info(f"DEBUG - Final attachment_objects list to save: {attachment_objects}")
    # ================================================================

    # Create the user message
    new_message = {
        "conversation_id": conv_id,
        "content": content,
        "is_user": message.is_user,
        "created_at": now,
        "attachments": attachment_objects  # NEW: Store attachments
    }

    logger.info(f"DEBUG - new_message being saved to DB: {new_message}")

    await mongodb.db.messages.insert_one(new_message)

    # Update the conversation's updated_at timestamp
    await mongodb.db.conversations.update_one(
        {"_id": conv_id},
        {"$set": {"updated_at": now}}
    )

    # Get all previous messages from this conversation
    cursor = mongodb.db.messages.find(
        {"conversation_id": conv_id}
    ).sort("created_at", 1)
    
    # Convert DB messages to langchain message format
    conversation_history = []
    async for msg in cursor:
        msg_content = normalize_message_content(msg.get("content"))
        if msg["is_user"]:
            conversation_history.append(HumanMessage(content=msg_content))
        else:
            conversation_history.append(AIMessage(content=msg_content))

    # Use the chat_with_memory method to get a response with context
    logger.info(f"Processing query with memory: {augmented_content[:100]}..., department: {selected_folder}")
    updated_history = await agent.chat_with_memory(
        conversation_history[:-1],
        augmented_content,
        department=selected_folder,
        chat_mode=chat_mode,
    )
    
    # The last message in the updated history is the AI's response
    ai_response = ensure_uploaded_document_source_footer(
        updated_history[-1].content,
        augmented_content
    )
        
    logger.info(f"Agent response: {ai_response[:100]}...")

    now = datetime.utcnow()

    # Create the bot message in the database
    new_ai_message = {
        "conversation_id": conv_id,
        "content": ai_response,
        "is_user": False,
        "created_at": now,
        "attachments": []  # Bot responses don't have attachments
    }

    result = await mongodb.db.messages.insert_one(new_ai_message)

    # Update the conversation's updated_at timestamp
    await mongodb.db.conversations.update_one(
        {"_id": conv_id},
        {"$set": {"updated_at": now}}
    )

    created_message = await mongodb.db.messages.find_one({"_id": result.inserted_id})

    response_data = MessageResponse(
        _id=str(created_message["_id"]),
        content=normalize_message_content(created_message.get("content")),
        is_user=created_message["is_user"],
        created_at=created_message["created_at"],
        attachments=created_message.get("attachments", [])  # NEW: Include attachments
    )
    
    # Tính toán số token đã sử dụng và cập nhật rate limit
    estimated_tokens = estimate_token_count(augmented_content, ai_response)
    logger.info(f"Estimated token usage: {estimated_tokens}")
    logger.info(f"Updating rate limit for user ID: {user_id}")
    
    # Tính là một request khi hoàn thành cả cặp câu hỏi-trả lời
    token_result, token_error = await check_rate_limit(user_id, estimated_tokens, count_as_request=True)
    if not token_result:
        logger.warning(f"Token limit reached but continuing as request already processed: {token_error}")
    
    logger.info(f"Rate limit updated successfully")

    # Log conversation statistics to dashboard
    try:
        # Get message count for this conversation
        message_count = await mongodb.db.messages.count_documents({"conversation_id": conv_id})
        
        # Get username from current_user
        username = current_user.get("username", "unknown")
        conversation_title = conversation.get("title", "Untitled Conversation")
        
        # Create statistics log
        stat_data = {
            "conversation_id": str(conv_id),
            "user_id": user_id,
            "username": username,
            "title": conversation_title,
            "message_count": message_count,
            "tokens_used": estimated_tokens,
            "status": "Thành công",
            "created_at": now,
            "updated_at": now
        }
        
        # Insert into conversation_stats collection
        await mongodb.db.conversation_stats.insert_one(stat_data)
        logger.info(f"Logged conversation stat: user={username}, tokens={estimated_tokens}, messages={message_count}")
    except Exception as e:
        logger.error(f"Failed to log conversation statistics: {e}")
        # Don't fail the response if logging fails

    return BaseResponse(
        statusCode=status.HTTP_201_CREATED,
        message="Message created successfully",
        data=response_data
    )


@router.post("/{conversation_id}/messages/stream")
async def query_ai_stream(
    conversation_id: str,
    message: MessageCreate,
    student_code: str = Header(None),
    current_user = Depends(require_auth)
):
    """Stream an AI response over SSE while preserving the existing persistence flow."""

    async def event_generator():
        try:
            yield sse_event("status", {"message": "Đã nhận câu hỏi, đang xử lý..."})
            task = asyncio.create_task(query_ai(
                conversation_id=conversation_id,
                message=message,
                student_code=student_code,
                current_user=current_user,
            ))

            status_messages = [
                "Đang tìm kiếm thông tin phù hợp...",
                "Đang đọc tài liệu và tổng hợp câu trả lời...",
                "Đang hoàn thiện phản hồi...",
            ]
            status_index = 0
            while not task.done():
                await asyncio.sleep(1.5)
                yield sse_event("status", {
                    "message": status_messages[status_index % len(status_messages)]
                })
                status_index += 1

            response = await task

            response_data = response.data
            content = normalize_message_content(response_data.content)
            attachments = [
                attachment.model_dump() if hasattr(attachment, "model_dump") else attachment
                for attachment in (response_data.attachments or [])
            ]

            yield sse_event("message_start", {
                "_id": response_data.id,
                "created_at": response_data.created_at.isoformat(),
                "attachments": attachments,
            })

            for chunk in chunk_text(content):
                yield sse_event("delta", {"content": chunk})
                await asyncio.sleep(0.04)

            yield sse_event("done", {
                "_id": response_data.id,
                "content": content,
                "is_user": response_data.is_user,
                "created_at": response_data.created_at.isoformat(),
                "attachments": attachments,
            })
        except HTTPException as exc:
            yield sse_event("error", {
                "status": exc.status_code,
                "message": exc.detail,
            })
        except Exception as exc:
            logger.error(f"Streaming chat failed: {exc}", exc_info=True)
            yield sse_event("error", {
                "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "message": "Có lỗi xảy ra khi xử lý phản hồi streaming.",
            })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/department-query", response_model=BaseResponse[QuickMessageResponse])
async def department_specific_query(
    message: MessageQuickChat,
    department: str = Query(..., description="Department to query from"),
    student_code: str = Header(None),
    current_user = Depends(require_auth)
):
    """Query specific department using the new dual-signal GraphRAG system"""
    
    user_id = str(current_user.get("_id"))
    if not user_id:
        logger.error("User ID not found in current_user object")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found")
    
    # Rate limit check
    allowed, error_message = await check_rate_limit(user_id, 0, count_as_request=False)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=error_message)
    
    try:
        # Import the agent
        sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from agent.supervisor_agent import ReActGraph
        
        # Initialize agent
        agent = ReActGraph()
        agent.create_graph()
        
        # Use authenticated user's student code only; never trust client-provided header
        if student_code:
            logger.info("Ignoring client-provided student_code header; using authenticated user profile")
        chat_mode = normalize_chat_mode(message.chat_mode)
        content = (
            build_student_mode_query(message.content, current_user)
            if chat_mode == "student"
            else message.content
        )
        
        logger.info(f"Department query - Department: {department}")
        logger.info(f"Query: {content}")
        
        # Use agent to process the query with department parameter
        import asyncio
        result = await agent.chat_with_memory([], content, department=department, chat_mode=chat_mode)
        
        # Get the final response from agent
        if result and len(result) > 0:
            response_text = normalize_message_content(result[-1].content)
        else:
            response_text = "Không thể xử lý câu hỏi của bạn. Vui lòng thử lại."
        
        now = datetime.utcnow()
        response_data = QuickMessageResponse(
            content=response_text,
            created_at=now,
        )
        
        # Update rate limit
        estimated_tokens = estimate_token_count(content, response_text)
        token_result, token_error = await check_rate_limit(user_id, estimated_tokens, count_as_request=True)
        if not token_result:
            logger.warning(f"Token limit reached: {token_error}")
        
        return BaseResponse(
            statusCode=status.HTTP_200_OK,
            message="Department query completed successfully",
            data=response_data
        )
        
    except Exception as e:
        logger.error(f"Error in department query: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Department query failed: {str(e)}"
        )


@router.post("/quick-messages", response_model=BaseResponse[QuickMessageResponse])
async def quick_chat(
    message: MessageQuickChat,
    student_code: str = Header(None),
    current_user = Depends(require_auth)
):
    """Get a quick response without saving conversation history"""
    
    # Lấy user_id của người dùng hiện tại để kiểm tra rate limit
    user_id = str(current_user.get("_id"))
    if not user_id:
        logger.error("User ID not found in current_user object")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User ID not found")
    
    chat_mode = normalize_chat_mode(message.chat_mode)

    # Get selected folder from message
    selected_folder = message.department
    
    if chat_mode != "student":
        # Detect query metadata department using existing logic
        from rag.retriever import analyze_query_for_metadata_filter
        query_metadata = analyze_query_for_metadata_filter(message.content)
        query_metadata_department = query_metadata.get('department') if query_metadata else None
        
        # Validate query scope based on folder selection
        is_allowed, reason = DepartmentFilterService.validate_query_scope(
            message.content, selected_folder, query_metadata_department
        )
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail=reason
            )
    
    # Kiểm tra rate limit trước khi xử lý tin nhắn - không tính request ở đây
    # vì mỗi cặp câu hỏi và câu trả lời chỉ tính là 1 request
    allowed, error_message = await check_rate_limit(user_id, 0, count_as_request=False)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=error_message)
    
    # Create a single message for this quick chat
    conversation_history = [HumanMessage(content=message.content)]
    
    # Use the chat_with_memory method consistently with other endpoint
    logger.info(f"Processing quick query: {message.content}")
    if student_code:
        logger.info("Ignoring client-provided student_code header; using authenticated user profile")

    if chat_mode == "student":
        content = build_student_mode_query(message.content, current_user)
    elif chat_mode == "auto":
        content = authorize_and_augment_student_query(message.content, current_user)
    else:
        content = message.content

    response = await agent.chat_with_memory([], content, department=selected_folder, chat_mode=chat_mode)
    
    # The last message in the response is the AI's answer
    ai_response = normalize_message_content(response[-1].content)
    logger.info(f"Agent quick response: {ai_response}")
    
    now = datetime.utcnow()
    
    response_data = QuickMessageResponse(
        content=ai_response,
        created_at=now,
    )
    
    # Tính toán số token đã sử dụng và cập nhật rate limit
    estimated_tokens = estimate_token_count(content, ai_response)
    logger.info(f"Estimated token usage: {estimated_tokens}")
    logger.info(f"Updating rate limit for user ID: {user_id}")
    
    # Tính là một request khi hoàn thành cả cặp câu hỏi-trả lời
    token_result, token_error = await check_rate_limit(user_id, estimated_tokens, count_as_request=True)
    if not token_result:
        logger.warning(f"Token limit reached but continuing as request already processed: {token_error}")
    
    logger.info(f"Rate limit updated successfully")
    
    return BaseResponse(
        statusCode=status.HTTP_200_OK,
        message="Quick chat response generated successfully",
        data=response_data
    )


@router.post("/test-rag", response_model=BaseResponse[dict])
async def test_rag_endpoint(message: MessageQuickChat):
    """Test RAG functionality without authentication - FOR TESTING ONLY"""
    
    try:
        logger.info(f"Testing RAG with message: {message.content}")
        
        # Use the existing agent instance and chat_with_memory method
        result = await agent.chat_with_memory([], message.content)
        
        response_message = normalize_message_content(result[-1].content) if result else "No response generated"
        
        return BaseResponse(
            statusCode=status.HTTP_200_OK,
            message="Test RAG completed",
            data={
                "response": response_message,
                "input": message.content
            }
        )
        
    except Exception as e:
        logger.error(f"Error in test RAG: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Test failed: {str(e)}"
        )


@router.get("/list-folders")
async def list_folders():
    """
    Get list of available folders/departments for chat scope selection
    This scans the actual data directory recursively to get all folders including nested ones
    
    Returns:
        List of folder names (strings only), including nested paths like "phongdaotao/daihoc"
    """
    try:
        # Get the data directory path - go up from src/backend/api to chatbot_agent root
        current_file = os.path.abspath(__file__)
        # From chat.py -> api -> backend -> src -> chatbot_agent
        chatbot_agent_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(current_file))))
        data_dir = os.path.join(chatbot_agent_root, 'data')
        
        logger.info(f"Scanning data directory: {data_dir}")
        logger.info(f"Data directory exists: {os.path.exists(data_dir)}")
        
        folders = []  # Start with empty list
        
        # Recursive function to scan all subfolders
        def scan_folders(directory, parent_path=""):
            folder_list = []
            if not os.path.exists(directory):
                logger.warning(f"Directory does not exist: {directory}")
                return folder_list
            
            try:
                items = os.listdir(directory)
                logger.info(f"Items in {directory}: {items}")
            except Exception as e:
                logger.error(f"Error listing directory {directory}: {e}")
                return folder_list
                
            for item in items:
                item_path = os.path.join(directory, item)
                # Only include directories, exclude files and hidden folders
                if os.path.isdir(item_path) and not item.startswith('.') and item != "__pycache__":
                    folder_name = item
                    if parent_path:
                        folder_name = f"{parent_path}/{item}"
                    logger.info(f"Found folder: {folder_name}")
                    folder_list.append(folder_name)
                    # Recursively scan subfolders
                    folder_list.extend(scan_folders(item_path, folder_name))
            return folder_list
        
        # Get all folders including subfolders
        folders.extend(scan_folders(data_dir))
        
        # Always include "default" at the beginning if not already present
        if "default" not in folders:
            folders.insert(0, "default")
        else:
            # Move "default" to the beginning if it exists
            folders.remove("default")
            folders.insert(0, "default")
        
        # Sort folders alphabetically
        folders.sort()
        
        logger.info(f"Found {len(folders)} folders in data directory: {folders}")
        
        return {
            "success": True,
            "folders": folders,  # This includes nested paths like "phongdaotao/daihoc"
            "count": len(folders)
        }
    except Exception as e:
        logger.error(f"Error getting folders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get folders: {str(e)}"
        )
