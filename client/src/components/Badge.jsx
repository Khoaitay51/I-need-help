import React from "react";
import "../styles/components/Badge.css";

/**
 * Badge Component
 * Small label or tag for displaying status or category
 */
const Badge = ({
  children,
  variant = "primary",
  icon: Icon,
  className = "",
}) => {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      {Icon && <Icon className="badge-icon" />}
      {children}
    </span>
  );
};

export default Badge;
