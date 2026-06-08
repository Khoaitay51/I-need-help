import React, { useState, useEffect } from "react";
import "./AppBar.css";
import { FiSettings, FiLogOut } from "react-icons/fi";
import { Link } from "react-router-dom";
import DarkModeToggle from "./DarkModeToggle";

const AppBar = ({
  user,
  onLogout,
  viewMode,
  onSwitchMode,
  handleSummaryClick,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [activeModel, setActiveModel] = useState(null);

  useEffect(() => {
    const fetchActiveModel = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) return;
        const res = await fetch("/api/models/active", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.data) setActiveModel(data.data);
        }
      } catch (e) {
        console.log("Could not fetch active model");
      }
    };
    fetchActiveModel();
  }, []);

  return (
    <div className="app-bar">
      <div className="app-bar-content">
        <div className="logo-section">
          <img src="/img/kma.png" alt="KMA" className="logo" />
          <div className="title-section">
            <h1 className="main-title">ACTVN AI</h1>
          </div>
          <nav className="mode-switcher">
            <button
              className={`mode-btn ${viewMode === "chat" ? "active" : ""}`}
              onClick={() => onSwitchMode("chat")}
            >
              Chat
            </button>
            <button
              className={`mode-btn ${viewMode === "file-chat" ? "active" : ""}`}
              onClick={() => onSwitchMode("file-chat")}
            >
              Tài liệu
            </button>
            <button
              className={`mode-btn ${viewMode === "text-summary" ? "active" : ""}`}
              onClick={() => handleSummaryClick()}
            >
              Tóm tắt
            </button>
          </nav>
        </div>

        <div className="user-section">
          {/* Model info badge */}
          {activeModel && (
            <div className="model-info-badge">
              <span className="model-dot" />
              {activeModel.name || "Model"}
            </div>
          )}

          <div className="app-bar-controls">
            <DarkModeToggle
              isDarkMode={isDarkMode}
              onToggle={onToggleDarkMode}
            />
          </div>

          {user && (
            <div className="user-info">
              {user.role === "admin" && (
                <Link to="/admin" className="admin-link" title="Quản trị">
                  <FiSettings size={18} />
                </Link>
              )}
              <button className="logout-btn" onClick={onLogout} title="Đăng xuất">
                <FiLogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppBar;
