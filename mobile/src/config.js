import Constants from "expo-constants";

const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
const fromExpo = Constants.expoConfig?.extra?.apiBaseUrl;

export const API_BASE_URL = (fromEnv || fromExpo || "http://192.168.0.102:8000").replace(/\/$/, "");

export const ENDPOINTS = {
  register: "/api/users/",
  login: "/api/auth/login",
  me: "/api/auth/me",
  updateProfile: "/api/users/me/profile",
  changePassword: "/api/users/me/password",
  conversations: "/api/chat/conversations",
  messages: "/api/chat/messages",
  sendMessage: (conversationId) => `/api/chat/${conversationId}/messages`,
  deleteConversation: (conversationId) => `/api/chat/conversations/${conversationId}`,
  renameConversation: (conversationId) => `/api/chat/conversations/${conversationId}`,
  // File endpoints
  uploadFile: "/api/files/upload",
  listFiles: "/api/files/",
  deleteFile: (fileId) => `/api/files/${fileId}`,
  fileContent: (fileId) => `/api/files/${fileId}/content`,
  activeModel: "/api/models/active",
  currentModel: "/api/admin/models/current",
  // Folders
  listFolders: "/api/chat/list-folders",
};
