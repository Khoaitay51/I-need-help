import React, { useState, useEffect } from "react";
import {
  FiMessageSquare,
  FiPlus,
  FiTrash2,
  FiEdit3,
  FiLogOut,
  FiSettings,
  FiMoon,
  FiSun,
  FiUser,
  FiX,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import chatService from "../services/chatService";
import userService from "../services/userService";
import "./ConversationList.css";

const ConversationList = ({
  user,
  selectedConversationId,
  onConversationSelect,
  onNewConversation,
  conversations,
  setConversations,
  onLogout,
  isDarkMode,
  onToggleDarkMode,
  onUserUpdate,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({
    username: "",
    email: "",
    student_name: "",
    student_code: "",
    student_class: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [accountError, setAccountError] = useState("");
  const [accountSuccess, setAccountSuccess] = useState("");

  useEffect(() => {
    const loadConversationsOnMount = async () => {
      if (!user || !user.id) return;

      setIsLoading(true);
      try {
        const result = await chatService.getConversations(user.id);
        if (result.success) {
          setConversations(result.conversations);
        } else {
          console.error("Failed to load conversations:", result.error);
        }
      } catch (error) {
        console.error("Error loading conversations:", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (user && user.id) {
      loadConversationsOnMount();
    }
  }, [user, setConversations]);

  const handleNewConversation = async () => {
    if (!user || !user.id) {
      alert("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
      return;
    }

    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    const isExpired =
      !accessToken || window.jwtHelper?.isTokenExpired(accessToken);

    if (isExpired) {
      if (refreshToken) {
        try {
          const authService = await import("../services/authService").then(
            (module) => module.default,
          );
          const refreshResult = await authService.refreshToken();
          if (!refreshResult.success) {
            alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
            localStorage.removeItem("userInfo");
            localStorage.removeItem("isLoggedIn");
            window.location.href = "/login";
            return;
          }
        } catch (error) {
          console.error("Error refreshing token:", error);
          alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
          localStorage.removeItem("userInfo");
          localStorage.removeItem("isLoggedIn");
          window.location.href = "/login";
          return;
        }
      } else {
        alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        localStorage.removeItem("userInfo");
        localStorage.removeItem("isLoggedIn");
        window.location.href = "/login";
        return;
      }
    }

    try {
      setIsLoading(true);
      const result = await chatService.createConversation(
        user.id,
        `Cuộc trò chuyện ${new Date().toLocaleString()}`,
      );

      if (result.success) {
        const newConversation = result.conversation;
        onConversationSelect(newConversation.id);
        if (onNewConversation) {
          onNewConversation(newConversation);
        }
      } else {
        console.error("Failed to create conversation:", result.error);
        alert("Không thể tạo hội thoại mới: " + result.error);
      }
    } catch (error) {
      console.error("Error creating conversation:", error.message);
      alert("Lỗi khi tạo hội thoại mới: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    if (!window.confirm("Bạn có chắc chắn muốn xóa cuộc trò chuyện này?"))
      return;

    try {
      const result = await chatService.deleteConversation(conversationId);
      if (result.success) {
        setConversations((prev) =>
          prev.filter((conv) => conv.id !== conversationId),
        );
        if (selectedConversationId === conversationId) {
          onConversationSelect(null);
        }
      } else {
        alert("Không thể xóa cuộc trò chuyện: " + result.error);
      }
    } catch (error) {
      alert("Có lỗi xảy ra khi xóa cuộc trò chuyện: " + error.message);
    }
  };

  const handleEditTitle = (conversationId, currentTitle, e) => {
    e.stopPropagation();
    setEditingId(conversationId);
    setEditTitle(currentTitle);
  };

  const handleSaveTitle = async (conversationId) => {
    if (!editTitle.trim()) return;
    try {
      const result = await chatService.updateConversation(
        conversationId,
        editTitle.trim(),
      );
      if (result.success) {
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? { ...conv, title: editTitle.trim() }
              : conv,
          ),
        );
        setEditingId(null);
        setEditTitle("");
      } else {
        alert("Không thể cập nhật tiêu đề: " + result.error);
      }
    } catch (error) {
      alert("Có lỗi xảy ra: " + error.message);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const openAccountModal = () => {
    setAccountForm({
      username: user?.username || "",
      email: user?.email || "",
      student_name: user?.name || "",
      student_code: user?.studentCode || user?.student_code || "",
      student_class: user?.studentClass || user?.student_class || "",
    });
    setPasswordForm({
      current_password: "",
      new_password: "",
      confirm_password: "",
    });
    setAccountError("");
    setAccountSuccess("");
    setIsAccountModalOpen(true);
  };

  const handleAccountChange = (event) => {
    const { name, value } = event.target;
    setAccountForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setAccountError("");
    setAccountSuccess("");

    const response = await userService.updateOwnProfile({
      username: accountForm.username,
      email: accountForm.email || null,
      student_name: accountForm.student_name || null,
      student_code: accountForm.student_code || null,
      student_class: accountForm.student_class || null,
    });

    if (!response.success) {
      setAccountError(response.error || "Không thể cập nhật thông tin");
      return;
    }

    const updatedUser = {
      ...user,
      id: response.data._id || user.id,
      username: response.data.username,
      name: response.data.student_name || response.data.username,
      email: response.data.email,
      studentCode: response.data.student_code,
      studentClass: response.data.student_class,
      role: response.data.role || user.role,
    };

    localStorage.setItem("userInfo", JSON.stringify(updatedUser));
    onUserUpdate?.(updatedUser);
    setAccountSuccess("Đã cập nhật thông tin cá nhân");
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setAccountError("");
    setAccountSuccess("");

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setAccountError("Mật khẩu mới không khớp");
      return;
    }

    const response = await userService.changeOwnPassword({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    });

    if (!response.success) {
      setAccountError(response.error || "Không thể đổi mật khẩu");
      return;
    }

    setPasswordForm({
      current_password: "",
      new_password: "",
      confirm_password: "",
    });
    setAccountSuccess("Đã đổi mật khẩu");
  };

  const getUserInitials = () => {
    if (!user?.name) return "U";
    const parts = user.name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return user.name[0].toUpperCase();
  };

  if (!user) {
    return (
      <div className="sidebar-login-msg">
        <p>Đăng nhập để lưu cuộc trò chuyện</p>
      </div>
    );
  }

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">
            <img src="/img/kma.png" alt="ACTVN" />
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">ACTVN-AGENT</div>
            <div className="sidebar-brand-tagline">Học viện Kỹ thuật Mật mã</div>
          </div>
        </div>
        <button
          onClick={handleNewConversation}
          className="new-chat-button"
          disabled={isLoading}
        >
          <FiPlus size={18} />
          <span>Cuộc trò chuyện mới</span>
        </button>
      </div>

      {/* Conversations */}
      <div className="sidebar-conversations">
        {isLoading ? (
          <div className="sidebar-loading">
            <div className="sidebar-spinner" />
            <p>Đang tải...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="sidebar-empty">
            <FiMessageSquare size={28} />
            <p>Chưa có cuộc trò chuyện nào</p>
            <span>Nhấn nút ở trên để bắt đầu</span>
          </div>
        ) : (
          <div className="sidebar-list">
            <div className="sidebar-section-label">Gần đây</div>
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onConversationSelect(conversation.id)}
                className={`sidebar-item ${
                  selectedConversationId === conversation.id ? "active" : ""
                }`}
              >
                <div className="sidebar-item-content">
                  {editingId === conversation.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleSaveTitle(conversation.id)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") handleSaveTitle(conversation.id);
                        else if (e.key === "Escape") handleCancelEdit();
                      }}
                      className="sidebar-edit-input"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <FiMessageSquare
                        size={14}
                        className="sidebar-item-icon"
                      />
                      <div className="sidebar-item-text">
                        <h3 title={conversation.preview || conversation.title}>
                          {conversation.title}
                        </h3>
                        {conversation.preview && (
                          <p className="sidebar-item-preview">
                            {conversation.preview}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="sidebar-item-actions">
                  <button
                    onClick={(e) =>
                      handleEditTitle(conversation.id, conversation.title, e)
                    }
                    className="sidebar-action-btn"
                    title="Đổi tên"
                  >
                    <FiEdit3 size={13} />
                  </button>
                  <button
                    onClick={(e) =>
                      handleDeleteConversation(conversation.id, e)
                    }
                    className="sidebar-action-btn danger"
                    title="Xóa"
                  >
                    <FiTrash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - User Info */}
      <div className="sidebar-footer">
        <div className="sidebar-user-info">
          <div className="sidebar-user-avatar">{getUserInitials()}</div>
          <div className="sidebar-user-text">
            <span
              className="sidebar-user-name"
              title={user.name || user.username || "User"}
            >
              {user.name || user.username || "Người dùng"}
            </span>
            <span className="sidebar-user-meta">
              {user.studentCode ||
                user.student_code ||
                user.username ||
                user.email ||
                "Active"}
            </span>
          </div>
          <div className="sidebar-user-actions">
            <button
              className="sidebar-action-btn"
              onClick={onToggleDarkMode}
              title={isDarkMode ? "Chế độ sáng" : "Chế độ tối"}
            >
              {isDarkMode ? <FiSun size={14} /> : <FiMoon size={14} />}
            </button>
            {user.role === "admin" && (
              <Link to="/admin" className="sidebar-action-btn" title="Quản trị">
                <FiSettings size={14} />
              </Link>
            )}
            {user.role !== "admin" && (
              <button
                className="sidebar-action-btn"
                onClick={openAccountModal}
                title="Tài khoản"
              >
                <FiUser size={14} />
              </button>
            )}
            <button
              className="sidebar-action-btn"
              onClick={onLogout}
              title="Đăng xuất"
            >
              <FiLogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      {isAccountModalOpen && user.role !== "admin" && (
        <div className="account-modal-overlay">
          <div className="account-modal">
            <div className="account-modal-header">
              <h2>Tài khoản</h2>
              <button
                className="account-modal-close"
                onClick={() => setIsAccountModalOpen(false)}
              >
                <FiX />
              </button>
            </div>

            {accountError && (
              <div className="account-alert error">{accountError}</div>
            )}
            {accountSuccess && (
              <div className="account-alert success">{accountSuccess}</div>
            )}

            <form className="account-form" onSubmit={saveProfile}>
              <div className="account-form-grid">
                <label>
                  <span>Username</span>
                  <input
                    name="username"
                    value={accountForm.username}
                    onChange={handleAccountChange}
                    required
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    name="email"
                    value={accountForm.email}
                    onChange={handleAccountChange}
                  />
                </label>
                <label>
                  <span>Họ tên</span>
                  <input
                    name="student_name"
                    value={accountForm.student_name}
                    onChange={handleAccountChange}
                  />
                </label>
                <label>
                  <span>Mã sinh viên</span>
                  <input
                    name="student_code"
                    value={accountForm.student_code}
                    onChange={handleAccountChange}
                  />
                </label>
                <label>
                  <span>Lớp</span>
                  <input
                    name="student_class"
                    value={accountForm.student_class}
                    onChange={handleAccountChange}
                  />
                </label>
              </div>
              <button className="account-primary-btn" type="submit">
                Lưu thông tin
              </button>
            </form>

            <form className="account-form" onSubmit={savePassword}>
              <h3>Đổi mật khẩu</h3>
              <div className="account-form-grid">
                <label>
                  <span>Mật khẩu hiện tại</span>
                  <input
                    type="password"
                    name="current_password"
                    value={passwordForm.current_password}
                    onChange={handlePasswordChange}
                    required
                  />
                </label>
                <label>
                  <span>Mật khẩu mới</span>
                  <input
                    type="password"
                    name="new_password"
                    value={passwordForm.new_password}
                    onChange={handlePasswordChange}
                    minLength={6}
                    required
                  />
                </label>
                <label>
                  <span>Nhập lại mật khẩu mới</span>
                  <input
                    type="password"
                    name="confirm_password"
                    value={passwordForm.confirm_password}
                    onChange={handlePasswordChange}
                    minLength={6}
                    required
                  />
                </label>
              </div>
              <button className="account-primary-btn" type="submit">
                Đổi mật khẩu
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationList;
