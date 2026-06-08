import React from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import "../styles/components/DarkModeToggle.css";

/**
 * Dark Mode Toggle Button
 * Switches between light and dark themes
 */
const DarkModeToggle = ({ isDarkMode, onToggle }) => {
  return (
    <button
      className="dark-mode-toggle"
      onClick={onToggle}
      title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
    >
      {isDarkMode ? <FiSun className="icon" /> : <FiMoon className="icon" />}
    </button>
  );
};

export default DarkModeToggle;
