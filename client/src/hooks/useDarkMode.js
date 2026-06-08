import { useState, useEffect } from "react";

/**
 * Hook for managing dark mode theme
 * Persists preference to localStorage
 */
export const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage first
    const stored = localStorage.getItem("kma-dark-mode");
    if (stored !== null) {
      return JSON.parse(stored);
    }

    // Check system preference
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    return false;
  });

  useEffect(() => {
    // Update HTML element class
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Persist to localStorage
    localStorage.setItem("kma-dark-mode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  return { isDarkMode, toggleDarkMode };
};

export default useDarkMode;
