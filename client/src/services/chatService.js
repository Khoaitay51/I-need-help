import constants from "../utils/constants";
import httpClient from "../utils/httpClient";
import { normalizeTextContent } from "../utils/textUtils";
import * as jwtHelper from "../utils/jwtHelper";

const { API_BASE_URL, API_ENDPOINTS } = constants;

const parseSSEPayload = (rawPayload) => {
  const event = rawPayload.match(/^event:\s*(.+)$/m)?.[1]?.trim() || "message";
  const dataLines = rawPayload
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());
  const data = dataLines.length > 0 ? JSON.parse(dataLines.join("\n")) : {};
  return { event, data };
};

const chatService = {
  // Department-specific query
  queryDepartment: async (query, department, chatMode = "document") => {
    try {
      const headers = {
        "Content-Type": "application/json",
      };

      const response = await httpClient.post(
        `${API_ENDPOINTS.DEPARTMENT_QUERY}?department=${encodeURIComponent(department)}`,
        {
          content: query,
          chat_mode: chatMode,
        },
        { headers },
      );

      if (response.statusCode === 200 && response.data) {
        return {
          success: true,
          message: {
            id: `dept_${Date.now()}`, // Generate unique ID for department response
            content: normalizeTextContent(response.data.content),
            isUser: false, // This is a bot response
            createdAt: response.data.created_at,
          },
          department: department,
        };
      } else {
        throw new Error(response.message || "Failed to query department");
      }
    } catch (error) {
      console.error("Error in department query:", error);
      return {
        success: false,
        error: error.message || "Failed to query department",
      };
    }
  },

  // Upload file for chat
  uploadFile: async (formData) => {
    try {
      const response = await httpClient.upload(
        API_ENDPOINTS.UPLOAD_FILE,
        formData,
      );

      return {
        success: true,
        fileInfo: response.fileInfo,
      };
    } catch (error) {
      console.error("Error uploading file:", error);
      return {
        success: false,
        error: error.message || "Failed to upload file",
      };
    }
  },

  // Query uploaded file
  queryFile: async (fileId, query) => {
    try {
      const response = await httpClient.post(API_ENDPOINTS.QUERY_FILE, {
        file_id: fileId,
        query: query,
      });

      return {
        success: true,
        answer: normalizeTextContent(response.answer),
        sources: response.sources,
        file: response.file,
        timestamp: response.timestamp,
      };
    } catch (error) {
      console.error("Error querying file:", error);
      return {
        success: false,
        error: error.message || "Failed to query file",
      };
    }
  },

  // Query uploaded file with multiple questions
  multiQueryFile: async (fileId, queries) => {
    try {
      const response = await httpClient.post(API_ENDPOINTS.MULTI_QUERY_FILE, {
        file_id: fileId,
        queries: queries,
      });

      return {
        success: true,
        results: response.results,
        file: response.file,
        timestamp: response.timestamp,
      };
    } catch (error) {
      console.error("Error multi-querying file:", error);
      return {
        success: false,
        error: error.message || "Failed to process multiple queries",
      };
    }
  },

  // Get information about an uploaded file
  getFileInfo: async (fileId) => {
    try {
      const response = await httpClient.get(
        `${API_ENDPOINTS.FILE_INFO}/${fileId}`,
      );

      return {
        success: true,
        fileInfo: response.fileInfo,
      };
    } catch (error) {
      console.error("Error getting file info:", error);
      return {
        success: false,
        error: error.message || "Failed to get file information",
      };
    }
  },

  // List all uploaded files
  listFiles: async () => {
    try {
      const response = await httpClient.get(API_ENDPOINTS.LIST_FILES);

      return {
        success: true,
        files: response.files,
        count: response.count,
      };
    } catch (error) {
      console.error("Error listing files:", error);
      return {
        success: false,
        error: error.message || "Failed to list files",
      };
    }
  },

  // Delete an uploaded file
  deleteFile: async (fileId) => {
    try {
      const response = await httpClient.delete(
        `${API_ENDPOINTS.DELETE_FILE}/${fileId}`,
      );

      return {
        success: true,
        message: response.message,
      };
    } catch (error) {
      console.error("Error deleting file:", error);
      return {
        success: false,
        error: error.message || "Failed to delete file",
      };
    }
  },

  // Get list of folders (departments)
  getFolders: async () => {
    try {
      const response = await httpClient.get(API_ENDPOINTS.LIST_FOLDERS);

      return {
        success: true,
        folders: response.folders || [],
        count: response.count || 0,
      };
    } catch (error) {
      console.error("Error getting folders:", error);
      return {
        success: false,
        folders: [],
        error: error.message || "Failed to get folders",
      };
    }
  },

  // Quick chat without saving conversation
  sendQuickMessage: async (message, department = null, chatMode = "document") => {
    try {
      const headers = {
        "Content-Type": "application/json",
      };

      const response = await httpClient.post(
        API_ENDPOINTS.QUICK_CHAT,
        {
          content: message,
          department: department,
          chat_mode: chatMode,
        },
        { headers },
      );

      if (response.statusCode === 200 && response.data) {
        return {
          success: true,
          message: {
            id: response.data._id || `quick_${Date.now()}`, // Thêm ID mặc định nếu API không cung cấp
            content: normalizeTextContent(response.data.content),
            isUser: response.data.is_user || false,
            createdAt: response.data.created_at,
          },
          metadata: response.metadata || null,
        };
      } else {
        throw new Error(response.message || "Failed to send message");
      }
    } catch (error) {
      console.error("Error sending quick message:", error);
      return {
        success: false,
        message: {
          id: `error_${Date.now()}`,
          content:
            "Xin lỗi, hiện tại hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
          isUser: false,
          createdAt: new Date().toISOString(),
        },
        error: error.message,
      };
    }
  },

  // Create new conversation
  createConversation: async (userId, title = "Cuộc trò chuyện mới") => {
    try {
      const response = await httpClient.post(API_ENDPOINTS.CONVERSATIONS, {
        user_id: userId,
        title: title,
      });

      if (response.statusCode === 201 && response.data) {
        return {
          success: true,
          conversation: {
            id: response.data._id,
            userId: response.data.user_id,
            title: response.data.title,
            createdAt: response.data.created_at,
            updatedAt: response.data.updated_at,
          },
        };
      } else {
        throw new Error(response.message || "Failed to create conversation");
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Get user conversations
  getConversations: async (userId, skip = 0, limit = 20) => {
    try {
      const response = await httpClient.get(
        `${API_ENDPOINTS.CONVERSATIONS}?user_id=${userId}&skip=${skip}&limit=${limit}`,
      );

      if (response.statusCode === 200 && response.data) {
        return {
          success: true,
          conversations: response.data.map((conv) => ({
            id: conv._id,
            userId: conv.user_id,
            title: conv.title,
            createdAt: conv.created_at,
            updatedAt: conv.updated_at,
            preview: normalizeTextContent(conv.preview), // Include preview text
          })),
        };
      } else {
        throw new Error(response.message || "Failed to get conversations");
      }
    } catch (error) {
      console.error("Error getting conversations:", error);
      return {
        success: false,
        conversations: [],
        error: error.message,
      };
    }
  },

  // Get messages from a conversation
  getMessages: async (conversationId, skip = 0, limit = 50) => {
    try {
      const response = await httpClient.get(
        `${API_ENDPOINTS.MESSAGES}/${conversationId}?skip=${skip}&limit=${limit}`,
      );

      if (response.statusCode === 200 && response.data) {
        return {
          success: true,
          messages: response.data.map((msg) => ({
            id: msg._id,
            content: normalizeTextContent(msg.content),
            isUser: msg.is_user,
            createdAt: msg.created_at,
            attachments: msg.attachments || [],
          })),
        };
      } else {
        throw new Error(response.message || "Failed to get messages");
      }
    } catch (error) {
      console.error("Error getting messages:", error);
      return {
        success: false,
        messages: [],
        error: error.message,
      };
    }
  },

  // Send message to a conversation and get AI response
  sendMessage: async (
    conversationId,
    message,
    department = null,
    attachments = null,
    chatMode = "document",
  ) => {
    try {
      console.log(conversationId, message, department, attachments);

      // If specific department is selected, use department-specific query
      if (department && department !== "default") {
        console.log("Using department-specific query for:", department);
        return await chatService.queryDepartment(
          message,
          department,
          chatMode,
        );
      }

      // Otherwise use regular conversation messaging
      const headers = {
        "Content-Type": "application/json",
      };

      const requestBody = {
        content: message,
        is_user: true,
        chat_mode: chatMode,
      };

      // Add department if provided
      if (department) {
        requestBody.department = department;
      }

      // Add attachments if provided
      if (attachments && attachments.length > 0) {
        requestBody.attachments = attachments;
      }

      const response = await httpClient.post(
        `/api/chat/${conversationId}/messages`,
        requestBody,
        { headers },
      );

      if (response.statusCode === 201 && response.data) {
        return {
          success: true,
          message: {
            id: response.data._id,
            content: normalizeTextContent(response.data.content),
            isUser: response.data.is_user,
            createdAt: response.data.created_at,
            attachments: response.data.attachments,
          },
        };
      } else {
        throw new Error(response.message || "Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);

      // Kiểm tra nếu là lỗi rate limit (HTTP 429)
      if (error.response && error.response.status === 429) {
        return {
          success: false,
          statusCode: 429,
          message:
            error.response.data?.message ||
            "Bạn đã vượt quá giới hạn gửi tin nhắn. Vui lòng thử lại sau.",
          error: error.response.data?.message || error.message,
          isRateLimit: true,
        };
      }

      return {
        success: false,
        error: error.message,
      };
    }
  },

  sendMessageStream: async (
    conversationId,
    message,
    department = null,
    attachments = null,
    chatMode = "document",
    handlers = {},
  ) => {
    const requestBody = {
      content: message,
      is_user: true,
      chat_mode: chatMode,
    };

    if (department) {
      requestBody.department = department;
    }

    if (attachments && attachments.length > 0) {
      requestBody.attachments = attachments;
    }

    const accessToken = jwtHelper.getAccessToken();
    const response = await fetch(
      `${API_BASE_URL}/api/chat/${conversationId}/messages/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok || !response.body) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText };
      }
      const error = new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      error.response = {
        status: response.status,
        statusText: response.statusText,
        data: errorData,
      };
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalMessage = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const rawEvent of events) {
        if (!rawEvent.trim()) continue;
        const { event, data } = parseSSEPayload(rawEvent);

        if (event === "status") {
          handlers.onStatus?.(data.message || "");
        } else if (event === "message_start") {
          handlers.onStart?.(data);
        } else if (event === "delta") {
          handlers.onDelta?.(data.content || "");
        } else if (event === "done") {
          finalMessage = {
            id: data._id,
            content: normalizeTextContent(data.content),
            isUser: data.is_user,
            createdAt: data.created_at,
            attachments: data.attachments || [],
          };
          handlers.onDone?.(finalMessage);
        } else if (event === "error") {
          const error = new Error(data.message || "Streaming failed");
          error.response = {
            status: data.status || 500,
            data,
          };
          handlers.onError?.(error);
          throw error;
        }
      }
    }

    return {
      success: true,
      message: finalMessage,
    };
  },

  // Update conversation title
  updateConversation: async (conversationId, title) => {
    try {
      const response = await httpClient.put(
        `/api/chat/conversations/${conversationId}`,
        { title },
      );

      if (response.statusCode === 200 && response.data) {
        return {
          success: true,
          conversation: {
            id: response.data._id,
            userId: response.data.user_id,
            title: response.data.title,
            createdAt: response.data.created_at,
            updatedAt: response.data.updated_at,
          },
        };
      } else {
        throw new Error(response.message || "Failed to update conversation");
      }
    } catch (error) {
      console.error("Error updating conversation:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Delete conversation
  deleteConversation: async (conversationId) => {
    try {
      const response = await httpClient.delete(
        `/api/chat/conversations/${conversationId}`,
      );

      if (response.statusCode === 200) {
        return {
          success: true,
          message: response.message,
        };
      } else {
        throw new Error(response.message || "Failed to delete conversation");
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  // Get chatbot status
  getStatus: async () => {
    try {
      const response = await httpClient.get(API_ENDPOINTS.HEALTH);
      return {
        success: true,
        status: response.status || "online",
        data: response,
      };
    } catch (error) {
      console.error("Error getting chatbot status:", error);
      return {
        success: false,
        status: "offline",
        error: error.message,
      };
    }
  },

  // Legacy method for backward compatibility
  sendMessageLegacy: async (message, conversationId = null) => {
    if (conversationId) {
      return await chatService.sendMessage(conversationId, message);
    } else {
      return await chatService.sendQuickMessage(message);
    }
  },

  // Get chat history (legacy method for backward compatibility)
  getChatHistory: async (conversationId) => {
    if (conversationId) {
      return await chatService.getMessages(conversationId);
    } else {
      return {
        success: false,
        messages: [],
        error: "No conversation ID provided",
      };
    }
  },

  // Feedback on response
  sendFeedback: async (messageId, rating, comment) => {
    try {
      const response = await httpClient.post(API_ENDPOINTS.FEEDBACK, {
        message_id: messageId,
        rating: rating,
        comment: comment,
        timestamp: new Date().toISOString(),
      });
      return {
        success: true,
        data: response,
      };
    } catch (error) {
      console.error("Error sending feedback:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

export default chatService;
