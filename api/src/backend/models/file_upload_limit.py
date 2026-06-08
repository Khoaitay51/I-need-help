from datetime import datetime
from typing import Dict, Any, Optional, List
from pydantic import BaseModel


class FileUploadLimit(BaseModel):
    """
    Model para configuração de limite de upload de arquivo
    """
    maxFilesPerConversation: int
    maxFilesPerDay: int
    maxFilesTotal: int  # Tối đa tổng số file trong hệ thống
    maxTotalUploadSizePerDay: int  # MB
    maxIndividualFileSize: int  # MB


class UserFileUploadException(BaseModel):
    """
    Model para exceção de limite de upload para usuário específico
    """
    username: str
    maxFilesPerConversation: int
    maxFilesPerDay: int
    maxFilesTotal: int  # Tối đa tổng số file trong hệ thống
    maxTotalUploadSizePerDay: int  # MB
    maxIndividualFileSize: int  # MB


class RoleFileUploadLimits(BaseModel):
    """
    Model para limites por papel/role
    """
    admin: FileUploadLimit
    user: FileUploadLimit


class FileUploadLimitConfig(BaseModel):
    """
    Model para configuração completa de limite de upload de arquivo
    """
    enabled: bool = True
    defaultLimits: FileUploadLimit
    roleLimits: RoleFileUploadLimits
    userExceptions: List[UserFileUploadException] = []


class UserFileUploadStat(BaseModel):
    """
    Model para estatísticas de upload de arquivo de um usuário
    """
    user_id: str
    username: str
    filesUploadedToday: int = 0
    uploadedSizeToday: int = 0  # MB
    filesUploadedThisMonth: int = 0
    uploadedSizeThisMonth: int = 0  # MB
    totalFilesInSystem: int = 0  # Tổng số file trong toàn bộ hệ thống
    lastResetDaily: datetime = None
    lastResetMonthly: datetime = None
    lastUpdated: datetime = datetime.utcnow()
