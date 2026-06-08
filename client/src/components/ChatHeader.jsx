import React, { useState } from "react";
import { FiSettings, FiChevronDown, FiRobot, FiZap } from "react-icons/fi";
import "./ChatHeader.css";

const ChatHeader = ({ currentModel = "Gemini", department = "Default" }) => {
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  return (
    <div className="chat-header">
      <div className="header-container">
        {/* Left Section - Title & Info */}
        <div className="header-left">
          <h1 className="chat-title">KBot - KMA Assistant</h1>
          <p className="header-subtitle">
            Powered by Advanced RAG & Graph Technology
          </p>
        </div>

        {/* Middle Section - Model Info */}
        <div className="header-middle">
          <div className="model-badge">
            <FiRobot size={16} />
            <span className="model-name">{currentModel}</span>
          </div>
          <div className="department-badge">
            <FiZap size={16} />
            <span className="department-name">{department}</span>
          </div>
        </div>

        {/* Right Section - Actions */}
        <div className="header-right">
          <div className="model-selector">
            <button
              className="dropdown-toggle"
              onClick={() => setShowModelDropdown(!showModelDropdown)}
            >
              <span className="model-text">Model</span>
              <FiChevronDown size={18} />
            </button>

            {showModelDropdown && (
              <div className="dropdown-menu">
                <div className="dropdown-item">Gemini 2.0 Flash</div>
                <div className="dropdown-item">GPT-4</div>
                <div className="dropdown-item">Ollama Local</div>
              </div>
            )}
          </div>

          <button className="header-btn" title="Settings">
            <FiSettings size={20} />
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-indicator online"></div>
        <span className="status-text">Ready to assist</span>
      </div>
    </div>
  );
};

export default ChatHeader;
