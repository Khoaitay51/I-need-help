import json
from datetime import datetime
from typing import Any, List, Optional

from bson import ObjectId
from pydantic import BaseModel, Field, GetJsonSchemaHandler, field_validator
from pydantic.json_schema import JsonSchemaValue


class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        """
        Return a schema that validates ObjectId strings
        and converts them to PyObjectId instances
        """
        from pydantic_core import core_schema
        return core_schema.union_schema([
            core_schema.is_instance_schema(ObjectId),
            core_schema.chain_schema([
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(cls.validate),
            ]),
        ])

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)
    
    @classmethod
    def __get_pydantic_json_schema__(
        cls, _core_schema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        """Return a schema dict for the ObjectId type"""
        return {"type": "string"}

class Message(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    content: str
    is_user: bool
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str}
    }

class Conversation(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    user_id: PyObjectId
    title: str
    messages: List[Message] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str}
    }

# Attachment model for files
class AttachmentSchema(BaseModel):
    file_id: str
    filename: str
    size: int
    mime_type: str
    status: str = "ready"  # 'uploaded', 'processing', 'ready', 'failed'

class FileMetadataResponse(BaseModel):
    file_id: str
    filename: str
    original_filename: str
    size: int
    mime_type: str
    user_id: str
    conversation_id: Optional[str] = None
    created_at: datetime
    status: str
    embedding_count: int
    last_indexed: Optional[datetime] = None

# Request and response models for API
class MessageCreate(BaseModel):
    content: str
    is_user: bool = True
    department: Optional[str] = None  # 'phongdaotao', 'phongkhaothi', or None for all
    attachments: Optional[List[str]] = []  # List of file_ids
    chat_mode: Optional[str] = "document"  # 'document' for RAG/docs, 'student' for scores/info

class MessageQuickChat(BaseModel):
    content: str
    department: Optional[str] = None  # 'phongdaotao', 'phongkhaothi', or None for all
    chat_mode: Optional[str] = "document"

class ConversationCreate(BaseModel):
    user_id: str
    title: str = "New Conversation"
    initial_message: Optional[str] = None

class ConversationUpdate(BaseModel):
    title: str


def normalize_content(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text") or item.get("content")
                parts.append(str(text) if text is not None else json.dumps(item, ensure_ascii=False))
            else:
                parts.append(str(item))
        return "\n".join(part for part in parts if part)
    if isinstance(value, dict):
        text = value.get("text") or value.get("content")
        return str(text) if text is not None else json.dumps(value, ensure_ascii=False)
    return str(value)


class MessageResponse(BaseModel):
    id: str = Field(alias="_id")
    content: str
    is_user: bool
    created_at: datetime
    attachments: Optional[List[AttachmentSchema]] = []

    @field_validator("content", mode="before")
    @classmethod
    def validate_content(cls, value: Any) -> str:
        return normalize_content(value)
    
    model_config = {
        "populate_by_name": True
    }

class QuickMessageResponse(BaseModel):
    content: str
    created_at: datetime

    @field_validator("content", mode="before")
    @classmethod
    def validate_content(cls, value: Any) -> str:
        return normalize_content(value)

    model_config = {
        "populate_by_name": True
    }

class ConversationResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    preview: Optional[str] = None  # First user message preview

    @field_validator("preview", mode="before")
    @classmethod
    def validate_preview(cls, value: Any) -> str:
        return normalize_content(value)
    
    model_config = {
        "populate_by_name": True
    } 
