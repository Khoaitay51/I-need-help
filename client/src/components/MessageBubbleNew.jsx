import React from "react";
import { FiCopy, FiThumbsUp, FiThumbsDown } from "react-icons/fi";
import "./MessageBubble.css";

const MessageBubble = ({ message }) => {
  const [copied, setCopied] = React.useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`message-bubble-wrapper ${isUser ? "user" : "assistant"}`}>
      <div className="message-bubble">
        {/* Avatar */}
        <div className="message-avatar">
          {isUser ? (
            <div className="avatar user-avatar">👤</div>
          ) : (
            <div className="avatar assistant-avatar">🤖</div>
          )}
        </div>

        {/* Content */}
        <div className="message-content">
          {/* Header */}
          <div className="message-header">
            <span className="message-author">{isUser ? "You" : "KBot"}</span>
            <span className="message-time">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* Message Text */}
          <div className="message-text">
            {message.content.split("\n").map((line, i) => (
              <p key={i}>{line || "\n"}</p>
            ))}
          </div>

          {/* Actions (only for assistant) */}
          {!isUser && (
            <div className="message-actions">
              <button
                className="action-btn"
                onClick={handleCopy}
                title="Copy message"
              >
                <FiCopy size={16} />
              </button>
              <button className="action-btn" title="Like response">
                <FiThumbsUp size={16} />
              </button>
              <button className="action-btn" title="Dislike response">
                <FiThumbsDown size={16} />
              </button>
              {copied && <span className="copy-feedback">Copied!</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
