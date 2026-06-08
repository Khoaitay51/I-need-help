// API Base URL
export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`;
export const WEBUI_URL =
  process.env.REACT_APP_WEBUI_URL || "http://localhost:8080";
// API endpoints
export const API_ENDPOINTS = {
  // User endpoints (theo backend routing)
  CREATE_USER: "/api/users",
  GET_USER: "/api/users",

  // Auth endpoints
  LOGIN: "/api/auth/login",
  REFRESH_TOKEN: "/api/auth/refresh",
  GET_ME: "/api/auth/me",

  // Chat endpoints (theo backend routing)
  QUICK_CHAT: "/api/chat/quick-messages",
  CONVERSATIONS: "/api/chat/conversations",
  MESSAGES: "/api/chat/messages",
  SEND_MESSAGE: "/api/chat", // endpoint để gửi tin nhắn trong conversation
  UPLOAD_FILE: "/api/chat/upload-file", // endpoint để upload file
  QUERY_FILE: "/api/chat/query-file", // endpoint để query file đã upload
  MULTI_QUERY_FILE: "/api/chat/multi-query-file", // endpoint để query nhiều câu hỏi vào file
  FILE_INFO: "/api/chat/file-info", // endpoint để lấy thông tin file
  LIST_FILES: "/api/chat/list-files", // endpoint để liệt kê tất cả files
  DELETE_FILE: "/api/chat/delete-file", // endpoint để xóa file
  LIST_FOLDERS: "/api/chat/list-folders", // endpoint để lấy danh sách folders
  DEPARTMENT_QUERY: "/api/chat/department-query", // endpoint để query specific department

  // Admin endpoints
  ADMIN_GET_USERS: "/api/users/admin/all",
  ADMIN_UPDATE_USER: "/api/users/admin",
  ADMIN_DELETE_USER: "/api/users/admin",

  // Models endpoints
  MODELS: {
    GET_ALL: "/api/models",
    GET_ACTIVE: "/api/models/active",
    ACTIVATE: (modelId) => `/api/models/activate/${modelId}`,
    UPDATE_PARAMS: (modelId) => `/api/models/params/${modelId}`,
    UPLOAD: "/api/models/upload",
  },

  ADMIN_GET_RATE_LIMITS: "/api/admin/rate-limits",
  ADMIN_UPDATE_RATE_LIMITS: "/api/admin/rate-limits",

  ADMIN_GET_USAGE_STATS: "/api/admin/stats",

  ADMIN_GET_CONVERSATIONS: "/api/admin/conversations",

  // Admin Models endpoints
  ADMIN_GET_MODELS: "/api/admin/models/available",
  ADMIN_GET_CURRENT_MODEL: "/api/admin/models/current",
  ADMIN_SELECT_MODEL: "/api/admin/models/select",
  ADMIN_TEST_MODEL: "/api/admin/models/test",
  ADMIN_RESET_MODEL: "/api/admin/models/reset",

  // Admin RAG Management endpoints
  ADMIN_LIST_TRAINING_FILES: "/api/admin/rag/list-training-files",
  ADMIN_UPLOAD_TRAINING_FILE: "/api/admin/rag/upload-training-file",
  ADMIN_DELETE_TRAINING_FILE: "/api/admin/rag/delete-training-file",
  ADMIN_REBUILD_RAG_INDEX: "/api/admin/rag/rebuild-rag-index",
  ADMIN_REBUILD_DEPARTMENT_RAG_INDEX:
    "/api/admin/rag/rebuild-department-rag-index",
  ADMIN_LIST_DEPARTMENTS: "/api/admin/rag/list-departments",
  ADMIN_CREATE_FOLDER: "/api/admin/rag/create-folder",
  ADMIN_CREATE_SUBFOLDER: "/api/admin/rag/create-subfolder",
  ADMIN_DELETE_FOLDER: "/api/admin/rag/delete-folder",
  ADMIN_LIST_FOLDERS: "/api/admin/rag/list-folders",
  ADMIN_RENAME_FOLDER: "/api/admin/rag/rename-folder",
  ADMIN_EDIT_FILE: "/api/admin/rag/edit-file",
  ADMIN_DOWNLOAD_FILE: "/api/admin/rag/download-file",

  // Admin RAG Mode Management endpoints
  ADMIN_GET_RAG_MODE: "/api/admin/rag/rag-mode",
  ADMIN_SET_RAG_MODE: "/api/admin/rag/rag-mode",
  ADMIN_GET_RAG_STATS: "/api/admin/rag/rag-stats",

  // Settings endpoints
  SETTINGS: "/api/settings",

  // Legacy endpoints
  CHAT: "/api/chat",
  CHAT_HISTORY: "/api/chat/history",
  HEALTH: "/health",
  FEEDBACK: "/feedback",
};

// Message types
export const MESSAGE_TYPES = {
  TEXT: "text",
  IMAGE: "image",
  FILE: "file",
  SYSTEM: "system",
};

// Message senders
export const MESSAGE_SENDERS = {
  USER: "user",
  BOT: "bot",
  SYSTEM: "system",
};

// Chat statuses
export const CHAT_STATUS = {
  IDLE: "idle",
  TYPING: "typing",
  LOADING: "loading",
  ERROR: "error",
};

// Local storage keys
export const STORAGE_KEYS = {
  CHAT_HISTORY: "kma_chatbot_history",
  USER_PREFERENCES: "kma_chatbot_preferences",
  SESSION_ID: "kma_chatbot_session",
  THEME: "kma_chatbot_theme",
};

// Theme options
export const THEMES = {
  LIGHT: "light",
  DARK: "dark",
  AUTO: "auto",
};

// Quick suggestions
export const QUICK_SUGGESTIONS = [
  "Quy định học tập",
  "Điểm số và đánh giá",
  "Lịch thi cuối kỳ",
  "Học phí và chi phí",
  "Thủ tục hành chính",
  "Hoạt động sinh viên",
];

// Sample questions
export const SAMPLE_QUESTIONS = [
  "Điều kiện tốt nghiệp là gì?",
  "Cách tính điểm trung bình tích lũy?",
  "Quy định về đồ án tốt nghiệp",
  "Thủ tục chuyển ngành học",
  "Học bổng dành cho sinh viên",
  "Quy định về thời gian học tập",
  "Cách đăng ký học phần",
  "Thủ tục xin nghỉ học",
];

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR:
    "Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.",
  SERVER_ERROR: "Có lỗi xảy ra từ phía server. Vui lòng thử lại sau.",
  TIMEOUT_ERROR: "Yêu cầu bị timeout. Vui lòng thử lại.",
  GENERAL_ERROR: "Có lỗi xảy ra. Vui lòng thử lại sau.",
  VOICE_NOT_SUPPORTED:
    "Trình duyệt của bạn không hỗ trợ tính năng nhận diện giọng nói",
  MICROPHONE_ERROR:
    "Không thể truy cập microphone. Vui lòng cấp quyền và thử lại.",
};

// Success messages
export const SUCCESS_MESSAGES = {
  MESSAGE_SENT: "Tin nhắn đã được gửi thành công",
  FEEDBACK_SENT: "Cảm ơn bạn đã gửi phản hồi",
  CHAT_CLEARED: "Lịch sử trò chuyện đã được xóa",
  COPIED_TO_CLIPBOARD: "Đã sao chép vào clipboard",
};

// Voice recognition settings
export const VOICE_SETTINGS = {
  LANGUAGE: "vi-VN",
  INTERIM_RESULTS: false,
  MAX_ALTERNATIVES: 1,
  CONTINUOUS: false,
};

// File upload settings
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    "text/plain",
  ],
  ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".gif", ".pdf", ".txt"],
};

// Animation durations (in milliseconds)
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
};

// Breakpoints for responsive design
export const BREAKPOINTS = {
  SM: "640px",
  MD: "768px",
  LG: "1024px",
  XL: "1280px",
  "2XL": "1536px",
};

// Z-index values
export const Z_INDEX = {
  DROPDOWN: 1000,
  STICKY: 1020,
  FIXED: 1030,
  MODAL_BACKDROP: 1040,
  MODAL: 1050,
  POPOVER: 1060,
  TOOLTIP: 1070,
};

// Export all constants as default
const constants = {
  API_BASE_URL,
  WEBUI_URL,
  API_ENDPOINTS,
  MESSAGE_TYPES,
  MESSAGE_SENDERS,
  CHAT_STATUS,
  STORAGE_KEYS,
  THEMES,
  QUICK_SUGGESTIONS,
  SAMPLE_QUESTIONS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VOICE_SETTINGS,
  FILE_UPLOAD,
  ANIMATION_DURATION,
  BREAKPOINTS,
  Z_INDEX,
};

export default constants;
