"""
API endpoints for dashboard statistics
"""
import logging
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, HTTPException, status, Depends

from ..db.mongodb import mongodb
from ..models.conversation_stat import DashboardStats, ConversationStatResponse, TopUserResponse
from ..models.responses import BaseResponse
from ..auth.dependencies import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/dashboard", tags=["dashboard"])


async def get_today_date():
    """Get today's date at 00:00:00 UTC"""
    now = datetime.utcnow()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


async def get_month_start():
    """Get first day of current month at 00:00:00 UTC"""
    now = datetime.utcnow()
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@router.get("/stats", response_model=BaseResponse[DashboardStats])
async def get_dashboard_stats(current_user = Depends(require_auth)):
    """
    Get comprehensive dashboard statistics:
    - Total requests today
    - Tokens used today
    - Tokens used this month
    - Total active users
    - Percentage changes
    """
    try:
        # Check if admin
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )

        today_start = await get_today_date()
        today_end = today_start + timedelta(days=1)
        
        month_start = await get_month_start()
        month_end = month_start + timedelta(days=32)
        month_end = month_end.replace(day=1)  # First day of next month
        
        # Get today's stats
        today_stats = await mongodb.db.conversation_stats.aggregate([
            {
                "$match": {
                    "created_at": {
                        "$gte": today_start,
                        "$lt": today_end
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_requests": {"$sum": 1},
                    "total_tokens": {"$sum": "$tokens_used"}
                }
            }
        ]).to_list(1)
        
        # Get month stats
        month_stats = await mongodb.db.conversation_stats.aggregate([
            {
                "$match": {
                    "created_at": {
                        "$gte": month_start,
                        "$lt": month_end
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_tokens": {"$sum": "$tokens_used"}
                }
            }
        ]).to_list(1)
        
        # Get yesterday stats for comparison
        yesterday_start = today_start - timedelta(days=1)
        yesterday_stats = await mongodb.db.conversation_stats.aggregate([
            {
                "$match": {
                    "created_at": {
                        "$gte": yesterday_start,
                        "$lt": today_start
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_requests": {"$sum": 1}
                }
            }
        ]).to_list(1)
        
        # Get unique users today
        unique_users_today = await mongodb.db.conversation_stats.distinct(
            "user_id",
            {
                "created_at": {
                    "$gte": today_start,
                    "$lt": today_end
                }
            }
        )
        
        # Get unique users yesterday for comparison
        unique_users_yesterday = await mongodb.db.conversation_stats.distinct(
            "user_id",
            {
                "created_at": {
                    "$gte": yesterday_start,
                    "$lt": today_start
                }
            }
        )
        
        # Get total unique users (ever)
        total_unique_users = await mongodb.db.conversation_stats.aggregate([
            {
                "$group": {
                    "_id": "$user_id"
                }
            },
            {
                "$count": "total"
            }
        ]).to_list(1)
        
        # Calculate values
        total_requests_today = today_stats[0]["total_requests"] if today_stats else 0
        tokens_used_today = today_stats[0]["total_tokens"] if today_stats else 0
        tokens_used_month = month_stats[0]["total_tokens"] if month_stats else 0
        requests_yesterday = yesterday_stats[0]["total_requests"] if yesterday_stats else 0
        total_users = total_unique_users[0]["total"] if total_unique_users else 0
        
        # Calculate percentages
        request_change_percent = 0.0
        user_change_percent = 0.0
        tokens_change_percent = 0.0
        
        if requests_yesterday > 0:
            request_change_percent = ((total_requests_today - requests_yesterday) / requests_yesterday) * 100
        
        if len(unique_users_yesterday) > 0:
            user_change_percent = ((len(unique_users_today) - len(unique_users_yesterday)) / len(unique_users_yesterday)) * 100
        
        # Token comparison (month vs last month)
        last_month_start = month_start - timedelta(days=30)
        last_month_stats = await mongodb.db.conversation_stats.aggregate([
            {
                "$match": {
                    "created_at": {
                        "$gte": last_month_start,
                        "$lt": month_start
                    }
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_tokens": {"$sum": "$tokens_used"}
                }
            }
        ]).to_list(1)
        
        tokens_last_month = last_month_stats[0]["total_tokens"] if last_month_stats else 1
        if tokens_last_month > 0:
            tokens_change_percent = ((tokens_used_month - tokens_last_month) / tokens_last_month) * 100
        
        # Get top users today (by requests)
        top_users_today = await mongodb.db.conversation_stats.aggregate([
            {
                "$match": {
                    "created_at": {
                        "$gte": today_start,
                        "$lt": today_end
                    }
                }
            },
            {
                "$group": {
                    "_id": "$username",
                    "requests": {"$sum": 1},
                    "tokens": {"$sum": "$tokens_used"}
                }
            },
            {
                "$sort": {"requests": -1}
            },
            {
                "$limit": 5
            }
        ]).to_list(5)
        
        # Get top users this month (by tokens)
        top_users_month = await mongodb.db.conversation_stats.aggregate([
            {
                "$match": {
                    "created_at": {
                        "$gte": month_start,
                        "$lt": month_end
                    }
                }
            },
            {
                "$group": {
                    "_id": "$username",
                    "tokens": {"$sum": "$tokens_used"},
                    "requests": {"$sum": 1}
                }
            },
            {
                "$sort": {"tokens": -1}
            },
            {
                "$limit": 5
            }
        ]).to_list(5)
        
        # Format response
        stats_data = DashboardStats(
            total_requests_today=total_requests_today,
            tokens_used_today=tokens_used_today,
            tokens_used_month=tokens_used_month,
            total_users=total_users,
            request_change_percent=round(request_change_percent, 1),
            tokens_change_percent=round(tokens_change_percent, 1),
            user_change_percent=round(user_change_percent, 1),
            top_users_today=[
                {
                    "username": user["_id"],
                    "requests": user["requests"],
                    "tokens": user["tokens"]
                }
                for user in top_users_today
            ],
            top_users_month=[
                {
                    "username": user["_id"],
                    "tokens": user["tokens"],
                    "requests": user["requests"]
                }
                for user in top_users_month
            ]
        )
        
        return BaseResponse(
            statusCode=status.HTTP_200_OK,
            message="Dashboard statistics retrieved successfully",
            data=stats_data
        )
        
    except Exception as e:
        logger.error(f"Error retrieving dashboard stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard statistics"
        )


@router.get("/conversations", response_model=BaseResponse[List[ConversationStatResponse]])
async def get_conversation_stats(
    skip: int = 0,
    limit: int = 50,
    current_user = Depends(require_auth)
):
    """
    Get conversation statistics with pagination
    """
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        # Get conversations sorted by created_at descending
        cursor = mongodb.db.conversation_stats.find({}).sort(
            "created_at", -1
        ).skip(skip).limit(limit)
        
        conversations = []
        async for conv in cursor:
            stat = ConversationStatResponse(
                _id=str(conv.get("_id", "")),
                conversation_id=conv.get("conversation_id", ""),
                user_id=conv.get("user_id", ""),
                username=conv.get("username", ""),
                title=conv.get("title", ""),
                message_count=conv.get("message_count", 0),
                tokens_used=conv.get("tokens_used", 0),
                status=conv.get("status", ""),
                created_at=conv.get("created_at", datetime.utcnow()),
                updated_at=conv.get("updated_at", datetime.utcnow())
            )
            conversations.append(stat)
        
        return BaseResponse(
            statusCode=status.HTTP_200_OK,
            message="Conversation statistics retrieved successfully",
            data=conversations
        )
        
    except Exception as e:
        logger.error(f"Error retrieving conversation stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversation statistics"
        )


@router.post("/conversation-stat")
async def log_conversation_stat(
    conversation_id: str,
    user_id: str,
    username: str,
    title: str,
    message_count: int,
    tokens_used: int,
    status: str = "Thành công"
):
    """
    Log a conversation statistic to database
    (Called internally by chat API after conversation ends)
    """
    try:
        stat_doc = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "username": username,
            "title": title,
            "message_count": message_count,
            "tokens_used": tokens_used,
            "status": status,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await mongodb.db.conversation_stats.insert_one(stat_doc)
        
        return BaseResponse(
            statusCode=status.HTTP_201_CREATED,
            message="Conversation statistic logged successfully",
            data={"id": str(result.inserted_id)}
        )
        
    except Exception as e:
        logger.error(f"Error logging conversation stat: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to log conversation statistic"
        )


@router.post("/test-data")
async def insert_test_data(current_user = Depends(require_auth)):
    """
    Insert test data for dashboard testing
    (Admin only - for debugging/testing)
    """
    try:
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        # Clear existing test data
        await mongodb.db.conversation_stats.delete_many({})
        logger.info("ℹ️ Cleared existing conversation_stats")
        
        # Create sample data for today
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        test_docs = [
            # Admin user (current user)
            {
                "conversation_id": "test_conv_1",
                "user_id": current_user.get("_id"),
                "username": current_user.get("username", "ductrong"),
                "title": "Test Conversation 1",
                "message_count": 5,
                "tokens_used": 1200,
                "status": "Thành công",
                "created_at": today_start + timedelta(hours=1),
                "updated_at": today_start + timedelta(hours=1)
            },
            {
                "conversation_id": "test_conv_2",
                "user_id": current_user.get("_id"),
                "username": current_user.get("username", "ductrong"),
                "title": "Test Conversation 2",
                "message_count": 3,
                "tokens_used": 800,
                "status": "Thành công",
                "created_at": today_start + timedelta(hours=2),
                "updated_at": today_start + timedelta(hours=2)
            },
            # Other user
            {
                "conversation_id": "test_conv_3",
                "user_id": "other_user_123",
                "username": "otheruser",
                "title": "Test Conversation 3",
                "message_count": 4,
                "tokens_used": 1500,
                "status": "Thành công",
                "created_at": today_start + timedelta(hours=3),
                "updated_at": today_start + timedelta(hours=3)
            },
            {
                "conversation_id": "test_conv_4",
                "user_id": "other_user_456",
                "username": "student123",
                "title": "Test Conversation 4",
                "message_count": 6,
                "tokens_used": 2000,
                "status": "Thành công",
                "created_at": today_start + timedelta(hours=4),
                "updated_at": today_start + timedelta(hours=4)
            },
        ]
        
        result = await mongodb.db.conversation_stats.insert_many(test_docs)
        logger.info(f"✅ Inserted {len(result.inserted_ids)} test records")
        
        return BaseResponse(
            statusCode=status.HTTP_201_CREATED,
            message="Test data inserted successfully",
            data={
                "inserted_count": len(result.inserted_ids),
                "admin_user": current_user.get("username", "ductrong"),
                "admin_id": current_user.get("_id")
            }
        )
        
    except Exception as e:
        logger.error(f"Error inserting test data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to insert test data: {str(e)}"
        )
