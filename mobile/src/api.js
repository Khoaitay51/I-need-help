import { API_BASE_URL, ENDPOINTS } from "./config";
import { storage } from "./storage";

const parseError = async (response) => {
  try {
    const data = await response.json();
    return data.detail || data.message || `HTTP ${response.status}`;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
};

export const apiRequest = async (path, options = {}) => {
  const { accessToken } = await storage.getTokens();
  const headers = {
    Accept: "application/json",
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return response.text();
  }

  return response.json();
};

export const authApi = {
  async login(username, password) {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);

    const response = await fetch(`${API_BASE_URL}${ENDPOINTS.login}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const result = await response.json();
    const tokens = result.data;
    if (!tokens?.access_token) {
      throw new Error("Phản hồi đăng nhập không có access token");
    }

    await storage.setTokens(tokens.access_token, tokens.refresh_token);
    const me = await apiRequest(ENDPOINTS.me);
    const user = normalizeUser(me.data);

    if (user.role !== "user") {
      await storage.clearSession();
      throw new Error("Ứng dụng mobile chỉ dành cho tài khoản người dùng.");
    }

    await storage.setUser(user);
    return { success: true, user };
  },

  async register(payload) {
    try {
      await apiRequest(ENDPOINTS.register, {
        method: "POST",
        body: JSON.stringify({
          username: payload.username,
          password: payload.password,
          email: payload.email || null,
          student_code: payload.studentCode || null,
          student_name: payload.username,
          student_class: payload.studentClass || null,
          role: "user",
        }),
      });

      return this.login(payload.username, payload.password);
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async updateProfile(data) {
    try {
      const result = await apiRequest(ENDPOINTS.updateProfile, {
        method: "PUT",
        body: JSON.stringify({
          username: data.username,
          email: data.email || null,
          student_name: data.name || data.studentName || null,
          student_code: data.studentCode || null,
          student_class: data.studentClass || null,
        }),
      });
      const user = normalizeUser(result.data);
      await storage.setUser(user);
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async changePassword(data) {
    try {
      await apiRequest(ENDPOINTS.changePassword, {
        method: "PUT",
        body: JSON.stringify({
          current_password: data.currentPassword,
          new_password: data.newPassword,
        }),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getCurrentUserInfo() {
    try {
      const result = await apiRequest(ENDPOINTS.me);
      const user = normalizeUser(result.data);
      await storage.setUser(user);
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

export const chatApi = {
  async createConversation(userId) {
    const result = await apiRequest(ENDPOINTS.conversations, {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        title: `Cuộc trò chuyện ${new Date().toLocaleString("vi-VN")}`,
      }),
    });
    return normalizeConversation(result.data);
  },

  async renameConversation(conversationId, title) {
    try {
      const result = await apiRequest(ENDPOINTS.renameConversation(conversationId), {
        method: "PUT",
        body: JSON.stringify({ title }),
      });
      return { success: true, data: normalizeConversation(result.data) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async uploadFile(file, conversationId) {
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        type: file.type || "application/octet-stream",
        name: file.name,
      });

      const query = conversationId ? `?conversation_id=${conversationId}` : "";
      const result = await apiRequest(`${ENDPOINTS.uploadFile}${query}`, {
        method: "POST",
        body: formData,
      });

      const fileInfo = result.data || result.fileInfo || result;
      return {
        success: true,
        file: {
          ...file,
          file_id: fileInfo.file_id,
          status: fileInfo.status || "ready",
          size: fileInfo.size || file.size,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async listFiles() {
    try {
      const result = await apiRequest(ENDPOINTS.listFiles);
      return {
        success: true,
        data: (result.data || []).map(normalizeFile),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async deleteFile(fileId) {
    try {
      await apiRequest(ENDPOINTS.deleteFile(fileId), {
        method: "DELETE",
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getConversations() {
    try {
      const result = await apiRequest(
        `${ENDPOINTS.conversations}?skip=0&limit=50`,
      );
      return {
        success: true,
        data: (result.data || []).map(normalizeConversation),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getMessages(conversationId) {
    try {
      const result = await apiRequest(
        `${ENDPOINTS.messages}/${conversationId}?skip=0&limit=50`,
      );
      return {
        success: true,
        data: (result.data || []).map((item) => ({
          id: item._id || item.id,
          content: normalizeContent(item.content),
          role: item.is_user ? "user" : "assistant",
          timestamp: item.created_at,
          attachments: item.attachments || [],
        })),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async sendMessage(payload) {
    try {
      const { content, conversation_id, files, user_id, chat_mode } = payload;
      let activeConversationId = conversation_id;

      if (!activeConversationId) {
        const created = await this.createConversation(user_id);
        activeConversationId = created.id;
      }

      const uploadedFiles = [];
      if (files && files.length > 0) {
        for (const file of files) {
          if (file.file_id) {
            uploadedFiles.push(file);
            continue;
          }

          const upload = await this.uploadFile(file, activeConversationId);
          if (!upload.success) {
            throw new Error(upload.error || `Không thể tải lên ${file.name}`);
          }
          uploadedFiles.push(upload.file);
        }
      }

      const result = await apiRequest(ENDPOINTS.sendMessage(activeConversationId), {
        method: "POST",
        body: JSON.stringify({
          content,
          is_user: true,
          chat_mode: chat_mode || "document",
          attachments: uploadedFiles.map((file) => file.file_id).filter(Boolean),
        }),
      });

      return {
        success: true,
        conversation_id: activeConversationId,
        uploadedFiles,
        data: {
          id: result.data._id || result.data.id,
          content: normalizeContent(result.data.content),
          role: "assistant",
          timestamp: result.data.created_at,
          attachments: result.data.attachments || [],
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async deleteConversation(conversationId) {
    try {
      await apiRequest(`${ENDPOINTS.conversations}/${conversationId}`, {
        method: "DELETE",
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

export const modelApi = {
  async getActiveModel() {
    try {
      const currentResult = await apiRequest(ENDPOINTS.currentModel);
      const currentModel = extractActiveModelPayload(currentResult);
      const normalizedCurrent = normalizeModel(currentModel);
      if (hasModelName(currentModel)) {
        return { success: true, data: normalizedCurrent };
      }
    } catch (error) {
      // Fallback to DB active model below. The current model endpoint is the
      // runtime source of truth, but older servers may not expose it.
    }

    try {
      const result = await apiRequest(ENDPOINTS.activeModel);
      const activeModel = extractActiveModelPayload(result);
      return { success: true, data: normalizeModel(activeModel) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

export const extractActiveModelPayload = (response) => {
  const payload = response?.data || response || null;
  if (!payload) return null;
  return payload.current_active || payload.active_model || payload.currentModel || payload;
};

export const hasModelName = (model) =>
  Boolean(
    model?.name ||
      model?.model_name ||
      model?.modelName ||
      model?.model ||
      model?.ollama_model ||
      model?.gemini_model ||
      model?.path,
  );

export const normalizeConversation = (item) => ({
  id: item._id || item.id,
  title: item.title || "Trò chuyện mới",
  preview: normalizeContent(item.preview || ""),
  created_at: item.created_at,
  updated_at: item.updated_at,
});

export const normalizeFile = (file) => ({
  file_id: file.file_id || file.id,
  name: file.original_filename || file.filename || file.name || file.file_id,
  filename: file.original_filename || file.filename || file.name || file.file_id,
  size: file.size || 0,
  status: file.status || "ready",
  created_at: file.created_at,
  embedding_count: file.embedding_count || 0,
});

export const normalizeUser = (user) => ({
  id: user._id || user.user_id || user.id,
  username: user.username,
  name: user.student_name || user.username,
  email: user.email,
  role: user.role || "user",
  studentCode: user.student_code,
  studentClass: user.student_class,
  createdAt: user.created_at,
});

export const normalizeModel = (model) => {
  if (!model) return null;
  const name =
    model.name ||
    model.model_name ||
    model.modelName ||
    model.model ||
    model.ollama_model ||
    model.gemini_model ||
    model.path ||
    "Không xác định";

  return {
    id: model._id || model.id,
    name,
    type: model.modelType || model.model_type || model.type || "model",
    provider: model.provider,
    path: model.path,
    isActive: model.isActive ?? model.is_active,
    updatedAt: model.updated_at || model.updatedAt,
  };
};

export const normalizeContent = (content) => {
  if (content === null || content === undefined) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.text || item?.content || JSON.stringify(item);
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof content === "object") {
    return content.text || content.content || JSON.stringify(content);
  }
  return String(content);
};
