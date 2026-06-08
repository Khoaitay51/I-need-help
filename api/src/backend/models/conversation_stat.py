from datetime import datetime
from typing import Optional
from bson import ObjectId
from pydantic import BaseModel, Field
from enum import Enum


class ConversationStatus(str, Enum):
    SUCCESS = "Thành công"
    ERROR = "Lỗi"
    PENDING = "Đang chờ"


class ConversationStatistic(BaseModel):
    """Model for storing conversation statistics"""
    id: Optional[str] = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    conversation_id: str  # Reference to conversation
    user_id: str
    username: str
    title: str
    message_count: int = 0
    tokens_used: int = 0
    status: ConversationStatus = ConversationStatus.SUCCESS
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    model_config = {
        "populate_by_name": True,
        "use_enum_values": True,
    }


class DailyUsageStatistic(BaseModel):
    """Model for storing daily usage statistics"""
    id: Optional[str] = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    user_id: str
    username: str
    date: datetime  # Only date part matters
    request_count: int = 0
    tokens_used: int = 0
    
    model_config = {
        "populate_by_name": True,
    }


class MonthlyUsageStatistic(BaseModel):
    """Model for storing monthly usage statistics"""
    id: Optional[str] = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    user_id: str
    username: str
    year: int
    month: int
    tokens_used: int = 0
    request_count: int = 0
    
    model_config = {
        "populate_by_name": True,
    }


# Response models
class ConversationStatResponse(BaseModel):
    id: str = Field(alias="_id")
    conversation_id: str
    user_id: str
    username: str
    title: str
    message_count: int
    tokens_used: int
    status: str
    created_at: datetime
    updated_at: datetime
    
    model_config = {
        "populate_by_name": True
    }


class DashboardStats(BaseModel):
    """Dashboard statistics response"""
    total_requests_today: int = 0
    tokens_used_today: int = 0
    tokens_used_month: int = 0
    total_users: int = 0
    request_change_percent: float = 0.0
    tokens_change_percent: float = 0.0
    user_change_percent: float = 0.0
    top_users_today: list = []
    top_users_month: list = []


class TopUserResponse(BaseModel):
    username: str
    requests: int
    tokens: int
