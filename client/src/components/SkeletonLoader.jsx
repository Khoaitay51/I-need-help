import React from "react";
import "../styles/components/SkeletonLoader.css";

/**
 * Skeleton Loader for Content Placeholders
 * Shows a shimmer animation while content loads
 */
const SkeletonLoader = ({
  type = "text",
  count = 1,
  width = "100%",
  height = "16px",
}) => {
  const items = Array.from({ length: count });

  return (
    <div className="skeleton-loader">
      {items.map((_, index) => (
        <div
          key={index}
          className={`skeleton skeleton-${type}`}
          style={{
            width: type === "avatar" ? height : width,
            height: height,
          }}
        />
      ))}
    </div>
  );
};

export default SkeletonLoader;
