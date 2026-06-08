import React from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiInfo,
  FiAlertTriangle,
  FiX,
} from "react-icons/fi";
import "../styles/components/Alert.css";

/**
 * Alert Component
 * Display important messages with different severity levels
 */
const Alert = ({ children, type = "info", onClose, title, className = "" }) => {
  const iconMap = {
    info: FiInfo,
    success: FiCheckCircle,
    warning: FiAlertTriangle,
    error: FiAlertCircle,
  };

  const Icon = iconMap[type] || FiInfo;

  return (
    <div className={`alert alert-${type} ${className}`} role="alert">
      <div className="alert-content">
        <Icon className="alert-icon" />
        <div className="alert-text">
          {title && <div className="alert-title">{title}</div>}
          <div className="alert-message">{children}</div>
        </div>
      </div>
      {onClose && (
        <button
          className="alert-close"
          onClick={onClose}
          aria-label="Close alert"
        >
          <FiX />
        </button>
      )}
    </div>
  );
};

export default Alert;
