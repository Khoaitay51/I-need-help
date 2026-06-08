import React, { useState, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ChatHeader from "./components/ChatHeader";
import ChatMessages from "./components/ChatMessages";
import ChatInput from "./components/ChatInput";
import WelcomeScreen from "./components/WelcomeScreen";
import Login from "./components/Login";
import FileChat from "./components/FileChat";
import UsageStats from "./components/UsageStats";
import chatService from "./services/chatService";
import authService from "./services/authService";
import AdminDashboard from "./components/admin/AdminDashboard";
import { v4 as uuidv4 } from "uuid";
import "./App.css";

const { API_BASE_URL } = require("./utils/constants");

function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState("chat");
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [folders, setFolders] = useState([]);
  const [currentModel, setCurrentModel] = useState("Gemini 2.0");
  const [currentDepartment, setCurrentDepartment] = useState("Default");
  const messagesEndRef = useRef(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser();
        if (currentUser && currentUser.id) {
          setUser(currentUser);
          setError(null);
        } else {
          console.error("Invalid user ID");
          setError("Authentication failed. Please login again.");
        }
      }
    };
    checkAuth();
  }, []);

  // Initialize conversations
  useEffect(() => {
    const init = async () => {
      if (user && user.id) {
        try {
          const convResponse = await chatService.getConversations(user.id);
          if (convResponse.success) {
            setConversations(convResponse.conversations);
            if (convResponse.conversations.length > 0) {
              setConversationId(convResponse.conversations[0].id);
            }
          } else {
            setError("Failed to load conversations");
          }

          // Load folders
          const foldersResponse = await chatService.getFolders();
          if (foldersResponse.success) {
            setFolders(foldersResponse.folders);
          }
        } catch (error) {
          console.error("Error initializing:", error);
        }
      }
    };
    init();
  }, [user]);

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      if (conversationId) {
        try {
          setIsLoading(true);
          const result = await chatService.getMessages(conversationId);
          if (result.success) {
            const formattedMessages = result.messages.map((msg) => ({
              id: msg.id || uuidv4(),
              content: msg.content,
              role: msg.role,
              timestamp: msg.timestamp,
              attachments: msg.attachments || [], // Include attachments
            }));
            setMessages(formattedMessages);
          }
        } catch (error) {
          console.error("Error loading messages:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadMessages();
  }, [conversationId]);

  // Handle send message
  const handleSendMessage = async (message) => {
    if (!conversationId || !user) return;

    const userMessage = {
      id: uuidv4(),
      content: message,
      role: "user",
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await chatService.sendMessage(conversationId, message, {
        user_id: user.id,
        student_code: user.studentCode,
        department: selectedFolder,
      });

      if (response.success) {
        const botMessage = {
          id: uuidv4(),
          content: response.reply,
          role: "assistant",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        setError("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Error sending message");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle new chat
  const handleNewChat = async () => {
    try {
      const newConv = await chatService.createConversation(user.id, "New Chat");
      if (newConv.success) {
        setConversations((prev) => [newConv.conversation, ...prev]);
        setConversationId(newConv.conversation.id);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
  };

  // Handle select conversation
  const handleSelectConversation = (convId) => {
    setConversationId(convId);
  };

  // Handle delete conversation
  const handleDeleteConversation = async (convId) => {
    try {
      await chatService.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (conversationId === convId) {
        setConversationId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  // Handle logout
  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setMessages([]);
    setConversations([]);
  };

  if (!user) {
    return <Login />;
  }

  // Main layout - LibreChat style
  return (
    <div className="app-container-librechat">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onLogout={handleLogout}
        user={user}
      />

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <ChatHeader
          currentModel={currentModel}
          department={currentDepartment}
        />

        {/* Chat Area */}
        <div className="chat-area">
          {messages.length === 0 && !conversationId ? (
            <WelcomeScreen />
          ) : (
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              messagesEndRef={messagesEndRef}
            />
          )}
        </div>

        {/* Input */}
        <ChatInput
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          onFileUpload={() => {}}
          disabled={!conversationId}
        />
      </div>

      {/* Stats Panel */}
      {showStatsPanel && (
        <UsageStats onClose={() => setShowStatsPanel(false)} />
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChatApp />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
