from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import logging

from ..auth.dependencies import require_auth
from ..models.responses import BaseResponse
from ..models.file_upload_limit import (
    FileUploadLimitConfig,
    FileUploadLimit,
    RoleFileUploadLimits,
    UserFileUploadException,
    UserFileUploadStat,
)
from ..db.mongodb import mongodb

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/file-upload-limits", tags=["file-upload-limits"])


@router.get("", response_model=BaseResponse[FileUploadLimitConfig])
async def get_file_upload_limit_config(current_user=Depends(require_auth)):
    """
    Lấy cấu hình giới hạn tải file
    """
    # Kiểm tra quyền admin
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ admin mới có quyền xem cấu hình giới hạn tải file",
        )

    # Tìm cấu hình trong database
    config = await mongodb.db.settings.find_one({"type": "file_upload_limit"})

    if not config:
        # Cấu hình mặc định
        default_config = FileUploadLimitConfig(
            enabled=True,
            defaultLimits=FileUploadLimit(
                maxFilesPerConversation=10,
                maxFilesPerDay=50,
                maxFilesTotal=1000,
                maxTotalUploadSizePerDay=500,
                maxIndividualFileSize=50,
            ),
            roleLimits=RoleFileUploadLimits(
                admin=FileUploadLimit(
                    maxFilesPerConversation=100,
                    maxFilesPerDay=500,
                    maxFilesTotal=100000,
                    maxTotalUploadSizePerDay=5000,
                    maxIndividualFileSize=500,
                ),
                user=FileUploadLimit(
                    maxFilesPerConversation=10,
                    maxFilesPerDay=50,
                    maxFilesTotal=1000,
                    maxTotalUploadSizePerDay=500,
                    maxIndividualFileSize=50,
                ),
            ),
            userExceptions=[],
        )
        return BaseResponse(
            statusCode=status.HTTP_200_OK,
            message="Cấu hình giới hạn tải file mặc định",
            data=default_config,
        )

    return BaseResponse(
        statusCode=status.HTTP_200_OK,
        message="Cấu hình giới hạn tải file",
        data=config["settings"],
    )


@router.post("", response_model=BaseResponse)
@router.put("", response_model=BaseResponse)
async def update_file_upload_limit_config(
    config: FileUploadLimitConfig, current_user=Depends(require_auth)
):
    """
    Cập nhật cấu hình giới hạn tải file
    """
    # Kiểm tra quyền admin
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ admin mới có quyền cập nhật cấu hình giới hạn tải file",
        )

    # Cập nhật cấu hình
    await mongodb.db.settings.update_one(
        {"type": "file_upload_limit"},
        {"$set": {"settings": config.dict(), "updated_at": datetime.utcnow()}},
        upsert=True,
    )

    logger.info(f"Updated file upload limit config by admin: {current_user.get('username')}")

    return BaseResponse(
        statusCode=status.HTTP_200_OK,
        message="Cập nhật cấu hình giới hạn tải file thành công",
    )


@router.get("/user/{user_id}/stats", response_model=BaseResponse[UserFileUploadStat])
async def get_user_file_upload_stats(
    user_id: str, current_user=Depends(require_auth)
):
    """
    Lấy thống kê tải file của một người dùng
    """
    # Kiểm tra quyền admin hoặc là chính người dùng đó
    if current_user.get("role") != "admin" and str(current_user.get("_id")) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem thống kê tải file này",
        )

    # Tìm thống kê của người dùng
    stats = await mongodb.db.file_upload_stats.find_one({"user_id": user_id})

    if not stats:
        # Tạo thống kê mới
        user = await mongodb.db.users.find_one({"_id": user_id})
        username = user.get("username", "unknown") if user else "unknown"

        stats_data = UserFileUploadStat(
            user_id=user_id, username=username
        ).dict()
        await mongodb.db.file_upload_stats.insert_one(stats_data)
        return BaseResponse(
            statusCode=status.HTTP_200_OK,
            message="Thống kê tải file",
            data=stats_data,
        )

    # Reset daily stats nếu vượt quá 1 ngày
    now = datetime.utcnow()
    if stats.get("lastResetDaily"):
        last_reset = stats["lastResetDaily"]
        if isinstance(last_reset, str):
            last_reset = datetime.fromisoformat(last_reset)
        if (now - last_reset).days >= 1:
            stats["filesUploadedToday"] = 0
            stats["uploadedSizeToday"] = 0
            stats["lastResetDaily"] = now
            await mongodb.db.file_upload_stats.update_one(
                {"user_id": user_id}, {"$set": stats}
            )

    # Reset monthly stats nếu vượt quá 1 tháng
    if stats.get("lastResetMonthly"):
        last_reset = stats["lastResetMonthly"]
        if isinstance(last_reset, str):
            last_reset = datetime.fromisoformat(last_reset)
        if (now - last_reset).days >= 30:
            stats["filesUploadedThisMonth"] = 0
            stats["uploadedSizeThisMonth"] = 0
            stats["lastResetMonthly"] = now
            await mongodb.db.file_upload_stats.update_one(
                {"user_id": user_id}, {"$set": stats}
            )

    return BaseResponse(
        statusCode=status.HTTP_200_OK,
        message="Thống kê tải file",
        data=stats,
    )


@router.get("/users", response_model=BaseResponse[List[Dict]])
async def get_all_user_file_upload_stats(current_user=Depends(require_auth)):
    """
    Lấy thống kê tải file của tất cả người dùng (chỉ admin)
    """
    # Kiểm tra quyền admin
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ admin mới có quyền xem thống kê tải file của tất cả người dùng",
        )

    # Lấy thống kê từ database
    stats_list = await mongodb.db.file_upload_stats.find().to_list(length=1000)

    return BaseResponse(
        statusCode=status.HTTP_200_OK,
        message="Thống kê tải file của tất cả người dùng",
        data=stats_list if stats_list else [],
    )


# Hàm helper để kiểm tra giới hạn tải file
async def check_file_upload_limit(
    user_id: str, username: str, file_size_mb: int, conversation_id: str = None
) -> tuple[bool, str]:
    """
    Kiểm tra xem người dùng có được phép tải file không

    Args:
        user_id: ID của người dùng
        username: Tên người dùng
        file_size_mb: Kích thước file tính bằng MB
        conversation_id: ID của hội thoại (optional)

    Returns:
        Tuple (allowed: bool, message: str)
    """
    # Lấy cấu hình giới hạn
    config_doc = await mongodb.db.settings.find_one({"type": "file_upload_limit"})

    if not config_doc or not config_doc.get("settings", {}).get("enabled", True):
        # Nếu chưa cấu hình hoặc bị tắt, cho phép tải
        return True, "File upload limits not configured"

    settings = config_doc["settings"]

    # Xác định limits dựa trên role và exception
    limits = None

    # Kiểm tra user exception
    for exception in settings.get("userExceptions", []):
        if exception.get("username") == username:
            limits = {
                "maxFilesPerConversation": exception.get("maxFilesPerConversation"),
                "maxFilesPerDay": exception.get("maxFilesPerDay"),
                "maxFilesTotal": exception.get("maxFilesTotal"),
                "maxTotalUploadSizePerDay": exception.get("maxTotalUploadSizePerDay"),
                "maxIndividualFileSize": exception.get("maxIndividualFileSize"),
            }
            break

    # Nếu không có exception, dùng role limit
    if limits is None:
        user = await mongodb.db.users.find_one({"_id": user_id})
        role = user.get("role", "user") if user else "user"
        role_limits = settings.get("roleLimits", {}).get(role)

        if role_limits:
            limits = {
                "maxFilesPerConversation": role_limits.get("maxFilesPerConversation"),
                "maxFilesPerDay": role_limits.get("maxFilesPerDay"),
                "maxFilesTotal": role_limits.get("maxFilesTotal"),
                "maxTotalUploadSizePerDay": role_limits.get("maxTotalUploadSizePerDay"),
                "maxIndividualFileSize": role_limits.get("maxIndividualFileSize"),
            }
        else:
            # Fallback to default limits
            default_limits = settings.get("defaultLimits", {})
            limits = {
                "maxFilesPerConversation": default_limits.get("maxFilesPerConversation", 10),
                "maxFilesPerDay": default_limits.get("maxFilesPerDay", 50),
                "maxFilesTotal": default_limits.get("maxFilesTotal", 1000),
                "maxTotalUploadSizePerDay": default_limits.get("maxTotalUploadSizePerDay", 500),
                "maxIndividualFileSize": default_limits.get("maxIndividualFileSize", 50),
            }

    # Kiểm tra kích thước file tối đa
    if file_size_mb > limits.get("maxIndividualFileSize", 50):
        return (
            False,
            f"File vượt quá kích thước tối đa {limits.get('maxIndividualFileSize')} MB",
        )

    # Lấy thống kê tải file của người dùng
    now = datetime.utcnow()
    stats = await mongodb.db.file_upload_stats.find_one({"user_id": user_id})

    if stats:
        # Reset daily stats nếu cần
        if stats.get("lastResetDaily"):
            last_reset = stats["lastResetDaily"]
            if isinstance(last_reset, str):
                last_reset = datetime.fromisoformat(last_reset)
            if (now - last_reset).days >= 1:
                stats["filesUploadedToday"] = 0
                stats["uploadedSizeToday"] = 0

        # Kiểm tra tổng số file trong hệ thống
        total_files = stats.get("totalFilesInSystem", 0)
        if (total_files + 1) > limits.get("maxFilesTotal", 1000):
            return (
                False,
                f"Vượt quá số file tối đa trong hệ thống ({limits.get('maxFilesTotal')} files). Hiện có: {total_files} files",
            )

        # Kiểm tra số file mỗi ngày
        if (stats.get("filesUploadedToday", 0) + 1) > limits.get("maxFilesPerDay", 50):
            return (
                False,
                f"Vượt quá số file tối đa mỗi ngày ({limits.get('maxFilesPerDay')} files)",
            )

        # Kiểm tra tổng dung lượng mỗi ngày
        if (stats.get("uploadedSizeToday", 0) + file_size_mb) > limits.get(
            "maxTotalUploadSizePerDay", 500
        ):
            remaining = (
                limits.get("maxTotalUploadSizePerDay", 500)
                - stats.get("uploadedSizeToday", 0)
            )
            return (
                False,
                f"Không đủ dung lượng. Còn lại hôm nay: {remaining} MB",
            )
    else:
        # Tạo thống kê mới
        stats_data = {
            "user_id": user_id,
            "username": username,
            "filesUploadedToday": 0,
            "uploadedSizeToday": 0,
            "filesUploadedThisMonth": 0,
            "uploadedSizeThisMonth": 0,
            "lastResetDaily": now,
            "lastResetMonthly": now,
            "lastUpdated": now,
        }
        await mongodb.db.file_upload_stats.insert_one(stats_data)

    # Kiểm tra số file mỗi hội thoại (nếu conversation_id được cung cấp)
    if conversation_id:
        files_in_conv = await mongodb.db.files_metadata.count_documents(
            {"conversation_id": conversation_id}
        )
        if (files_in_conv + 1) > limits.get("maxFilesPerConversation", 10):
            return (
                False,
                f"Vượt quá số file tối đa mỗi hội thoại ({limits.get('maxFilesPerConversation')} files)",
            )

    return True, "File upload allowed"


# Hàm helper để cập nhật thống kê tải file
async def update_file_upload_stats(
    user_id: str, file_size_mb: int
) -> None:
    """
    Cập nhật thống kê tải file của người dùng sau khi tải thành công

    Args:
        user_id: ID của người dùng
        file_size_mb: Kích thước file tính bằng MB
    """
    now = datetime.utcnow()

    # Cập nhật hoặc tạo mới thống kê
    await mongodb.db.file_upload_stats.update_one(
        {"user_id": user_id},
        {
            "$inc": {"filesUploadedToday": 1, "uploadedSizeToday": file_size_mb,
                    "filesUploadedThisMonth": 1, "uploadedSizeThisMonth": file_size_mb,
                    "totalFilesInSystem": 1},
            "$set": {"lastUpdated": now},
        },
        upsert=True,
    )

    logger.info(
        f"Updated file upload stats for user {user_id}: +{file_size_mb}MB"
    )
