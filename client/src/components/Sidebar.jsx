import React, { useState } from "react";
import {
  FiPlus,
  FiMessageSquare,
  FiTrash2,
  FiChevronDown,
  FiLogOut,
  FiSettings,
  FiShield,
} from "react-icons/fi";
import "./Sidebar.css";
import FileManagement from "./FileManagement";

const Sidebar = ({
  conversations,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onLogout,
  user,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div className={`sidebar ${isExpanded ? "expanded" : "collapsed"}`}>
      {/* Logo & Header */}
      <div className="sidebar-header">
        <div className="logo-container">
          <img src="/img/kma-logo.png" alt="KMA Logo" className="kma-logo" />
          <span className="app-title">KBot</span>
        </div>
        <button
          className="collapse-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? "Collapse" : "Expand"}
        >
          <FiChevronDown size={20} />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="new-chat-btn-wrapper">
        <button className="new-chat-btn" onClick={onNewChat} title="New Chat">
          <FiPlus size={18} />
          {isExpanded && <span>New Chat</span>}
        </button>
      </div>

      {/* Conversations List */}
      <div className="conversations-list">
        {conversations.length > 0 ? (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className="conversation-item"
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelectConversation(conv.id)}
            >
              <div className="conversation-icon">
                <FiMessageSquare size={16} />
              </div>
              {isExpanded && (
                <>
                  <span className="conversation-title" title={conv.title}>
                    {conv.title || "New Chat"}
                  </span>
                  {hoveredId === conv.id && (
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                    >
                      <FiTrash2 size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))
        ) : (
          <div className="empty-state">
            {isExpanded && <p>No conversations yet</p>}
          </div>
        )}
      </div>

      {/* File Management + Footer Container */}
      <div className="sidebar-bottom-section">
        {/* File Management Section */}
        <FileManagement sidebarExpanded={isExpanded} />

        {/* Footer */}
        <div className="sidebar-footer">
          {isExpanded && user && (
            <div className="user-info">
              <div className="user-avatar">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="user-details">
                <p className="user-name">{user.name || "User"}</p>
                <p className="user-email">{user.email}</p>
              </div>
            </div>
          )}
          <div className="footer-buttons">
            <button className="footer-btn admin-btn" title="Admin">
              <FiShield size={18} />
              {isExpanded && <span>Admin</span>}
            </button>
            <button className="footer-btn" title="Settings">
              <FiSettings size={18} />
              {isExpanded && <span>Settings</span>}
            </button>
            <button
              className="footer-btn logout-btn"
              onClick={onLogout}
              title="Logout"
            >
              <FiLogOut size={18} />
              {isExpanded && <span>Logout</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
