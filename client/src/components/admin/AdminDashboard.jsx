import React, { useState, useEffect } from "react";
import {
  FiUsers,
  FiBarChart2,
  FiClock,
  FiDatabase,
  FiAlertCircle,
  FiLogOut,
  FiMenu,
  FiX,
  FiUserCheck,
  FiBook,
  FiFileText,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import Login from "../Login";
import Dashboard from "./Dashboard";
import UsageStatistics from "./UsageStatistics";
import ConversationLogs from "./ConversationLogs";
import UserManagement from "./UserManagement";
import RateLimiting from "./RateLimiting";
import FileUploadLimits from "./FileUploadLimits";
import ModelManagement from "./ModelManagement";
import RagManagement from "./RagManagement";
import authService from "../../services/authService";

// Admin Dashboard Views
const VIEWS = {
  STATS: "statistics",
  USERS: "users",
  LOGS: "logs",
  RATE_LIMITS: "rate-limits",
  FILE_UPLOAD_LIMITS: "file-upload-limits",
  MODEL_MANAGEMENT: "models",
  RAG_MANAGEMENT: "rag",
};

const AdminDashboard = () => {
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState(VIEWS.STATS);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if the user is logged in and has admin role
    const checkAuth = async () => {
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser();
        if (currentUser && currentUser.role === "admin") {
          setUser(currentUser);
        }
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    // Chuyển hướng về trang chủ
    navigate("/");
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Render content based on active view
  const renderContent = () => {
    switch (activeView) {
      case VIEWS.STATS:
        return <Dashboard />;
      case VIEWS.USERS:
        return <UserManagement />;
      case VIEWS.LOGS:
        return <ConversationLogs />;
      case VIEWS.RATE_LIMITS:
        return <RateLimiting />;
      case VIEWS.FILE_UPLOAD_LIMITS:
        return <FileUploadLimits />;
      case VIEWS.MODEL_MANAGEMENT:
        return <ModelManagement />;
      case VIEWS.RAG_MANAGEMENT:
        return <RagManagement />;
      default:
        return <UsageStatistics />;
    }
  };

  // If not logged in or not an admin, show login screen
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="admin-dashboard">
      {/* Mobile menu toggle */}
      <button className="mobile-menu-toggle" onClick={toggleMobileMenu}>
        {isMobileMenuOpen ? <FiX /> : <FiMenu />}
      </button>

      {/* Sidebar */}
      <aside
        className={`admin-sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}
      >
        <div className="admin-sidebar-header">
          <img
            src="/img/kma.png"
            alt="KMA Logo"
            className="admin-logo"
            onError={(e) => {
              e.currentTarget.src = "/assets/kma-logo-outline.svg";
            }}
          />
          <h2>ACTVN-AGENT</h2>
        </div>

        <nav className="admin-nav">
          <ul>
            {/* Primary stats button */}
            <li>
              <button
                className={`admin-nav-stats-btn ${activeView === VIEWS.STATS ? "active" : ""}`}
                onClick={() => {
                  setActiveView(VIEWS.STATS);
                  setIsMobileMenuOpen(false);
                }}
              >
                <FiBarChart2 />
                <span>Thống kê sử dụng</span>
              </button>
            </li>

            {/* Other menu items */}
            <li>
              <button
                className={activeView === VIEWS.USERS ? "active" : ""}
                onClick={() => {
                  setActiveView(VIEWS.USERS);
                  setIsMobileMenuOpen(false);
                }}
              >
                <FiUsers />
                <span>Quản lý người dùng</span>
              </button>
            </li>
            <li>
              <button
                className={activeView === VIEWS.LOGS ? "active" : ""}
                onClick={() => {
                  setActiveView(VIEWS.LOGS);
                  setIsMobileMenuOpen(false);
                }}
              >
                <FiClock />
                <span>Lịch sử hội thoại</span>
              </button>
            </li>
            <li>
              <button
                className={activeView === VIEWS.RATE_LIMITS ? "active" : ""}
                onClick={() => {
                  setActiveView(VIEWS.RATE_LIMITS);
                  setIsMobileMenuOpen(false);
                }}
              >
                <FiAlertCircle />
                <span>Giới hạn tốc độ</span>
              </button>
            </li>
            <li>
              <button
                className={
                  activeView === VIEWS.MODEL_MANAGEMENT ? "active" : ""
                }
                onClick={() => {
                  setActiveView(VIEWS.MODEL_MANAGEMENT);
                  setIsMobileMenuOpen(false);
                }}
              >
                <FiDatabase />
                <span>Quản lý mô hình LLM</span>
              </button>
            </li>
            <li>
              <button
                className={
                  activeView === VIEWS.FILE_UPLOAD_LIMITS ? "active" : ""
                }
                onClick={() => {
                  setActiveView(VIEWS.FILE_UPLOAD_LIMITS);
                  setIsMobileMenuOpen(false);
                }}
              >
                <FiFileText />
                <span>Giới hạn tải file</span>
              </button>
            </li>
            <li>
              <button
                className={activeView === VIEWS.RAG_MANAGEMENT ? "active" : ""}
                onClick={() => {
                  setActiveView(VIEWS.RAG_MANAGEMENT);
                  setIsMobileMenuOpen(false);
                }}
              >
                <FiBook />
                <span>Quản lý dữ liệu RAG</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <FiUserCheck />
            <div>
              <p className="admin-user-name">{user.name || user.username}</p>
              <p className="admin-user-role">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-content">
        <header className="admin-content-header">
          <div className="admin-header-container">
            <div className="admin-header-left">
              <img
                src="/img/kma.png"
                alt="KMA"
                className="admin-header-logo"
                onError={(e) => {
                  e.currentTarget.src = "/assets/kma-logo-outline.svg";
                }}
              />
            </div>
            <div className="admin-header-right">
              <div className="admin-header-user">
                <span className="admin-header-username">
                  {user.name || user.username}
                </span>
                <button
                  className="admin-header-logout-btn"
                  onClick={handleLogout}
                >
                  <FiLogOut />
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="admin-content-body">{renderContent()}</div>
      </main>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          className="mobile-menu-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
