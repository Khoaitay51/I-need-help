import React from 'react';
import './TypingIndicator.css';

const TypingIndicator = () => {
  return (
    <div className="typing-container">
      <div className="typing-wrapper">
        {/* Bot avatar */}
        <div className="typing-avatar">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.07A7 7 0 0 1 14 22h-4a7 7 0 0 1-6.93-3H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM9.5 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
          </svg>
        </div>

        {/* Thinking shimmer */}
        <div className="typing-content">
          <div className="typing-label">ACTVN-AGENT đang suy nghĩ</div>
          <div className="typing-shimmer">
            <div className="typing-shimmer-bar" />
            <div className="typing-shimmer-bar short" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
