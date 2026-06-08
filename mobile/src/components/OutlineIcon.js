import React from "react";
import Svg, {
  Circle,
  Line,
  Path,
  Polyline,
  Rect,
} from "react-native-svg";

const common = {
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const OutlineIcon = ({ name, size = 20, color = "#0f1419", strokeWidth = 2 }) => {
  const props = {
    ...common,
    stroke: color,
    strokeWidth,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderIcon(name, props)}
    </Svg>
  );
};

const renderIcon = (name, props) => {
  switch (name) {
    case "menu":
      return (
        <>
          <Line x1="4" y1="6" x2="20" y2="6" {...props} />
          <Line x1="4" y1="12" x2="20" y2="12" {...props} />
          <Line x1="4" y1="18" x2="20" y2="18" {...props} />
        </>
      );
    case "user":
      return (
        <>
          <Path d="M20 21a8 8 0 0 0-16 0" {...props} />
          <Circle cx="12" cy="7" r="4" {...props} />
        </>
      );
    case "log-out":
      return (
        <>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...props} />
          <Polyline points="16 17 21 12 16 7" {...props} />
          <Line x1="21" y1="12" x2="9" y2="12" {...props} />
        </>
      );
    case "message-square":
      return (
        <Path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" {...props} />
      );
    case "message-circle":
      return (
        <Path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" {...props} />
      );
    case "plus":
      return (
        <>
          <Line x1="12" y1="5" x2="12" y2="19" {...props} />
          <Line x1="5" y1="12" x2="19" y2="12" {...props} />
        </>
      );
    case "x":
      return (
        <>
          <Line x1="18" y1="6" x2="6" y2="18" {...props} />
          <Line x1="6" y1="6" x2="18" y2="18" {...props} />
        </>
      );
    case "paperclip":
      return (
        <Path d="M21.4 11.6 12 21a6 6 0 0 1-8.5-8.5l9.4-9.4a4 4 0 0 1 5.7 5.7L9.2 18.2a2 2 0 1 1-2.8-2.8l8.8-8.8" {...props} />
      );
    case "send":
      return (
        <>
          <Path d="M22 2 11 13" {...props} />
          <Path d="m22 2-7 20-4-9-9-4 20-7z" {...props} />
        </>
      );
    case "edit-3":
      return (
        <>
          <Path d="M12 20h9" {...props} />
          <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" {...props} />
        </>
      );
    case "trash-2":
      return (
        <>
          <Polyline points="3 6 5 6 21 6" {...props} />
          <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...props} />
          <Line x1="10" y1="11" x2="10" y2="17" {...props} />
          <Line x1="14" y1="11" x2="14" y2="17" {...props} />
        </>
      );
    case "upload-cloud":
      return (
        <>
          <Path d="M16 16 12 12 8 16" {...props} />
          <Line x1="12" y1="12" x2="12" y2="21" {...props} />
          <Path d="M20.4 18.4A5 5 0 0 0 18 9h-1.3A7 7 0 1 0 5 15.5" {...props} />
        </>
      );
    case "check":
      return <Polyline points="20 6 9 17 4 12" {...props} />;
    case "cpu":
      return (
        <>
          <Rect x="7" y="7" width="10" height="10" rx="2" {...props} />
          <Rect x="10" y="10" width="4" height="4" {...props} />
          <Line x1="4" y1="9" x2="7" y2="9" {...props} />
          <Line x1="4" y1="15" x2="7" y2="15" {...props} />
          <Line x1="17" y1="9" x2="20" y2="9" {...props} />
          <Line x1="17" y1="15" x2="20" y2="15" {...props} />
          <Line x1="9" y1="4" x2="9" y2="7" {...props} />
          <Line x1="15" y1="4" x2="15" y2="7" {...props} />
          <Line x1="9" y1="17" x2="9" y2="20" {...props} />
          <Line x1="15" y1="17" x2="15" y2="20" {...props} />
        </>
      );
    case "hash":
      return (
        <>
          <Line x1="4" y1="9" x2="20" y2="9" {...props} />
          <Line x1="4" y1="15" x2="20" y2="15" {...props} />
          <Line x1="10" y1="3" x2="8" y2="21" {...props} />
          <Line x1="16" y1="3" x2="14" y2="21" {...props} />
        </>
      );
    case "book-open":
      return (
        <>
          <Path d="M2 4h7a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" {...props} />
          <Path d="M22 4h-7a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h8z" {...props} />
        </>
      );
    case "award":
      return (
        <>
          <Circle cx="12" cy="8" r="5" {...props} />
          <Path d="m8.5 12.2-1.4 8 4.9-2.9 4.9 2.9-1.4-8" {...props} />
        </>
      );
    case "lock":
      return (
        <>
          <Rect x="4" y="11" width="16" height="10" rx="2" {...props} />
          <Path d="M8 11V7a4 4 0 0 1 8 0v4" {...props} />
        </>
      );
    default:
      return <Circle cx="12" cy="12" r="9" {...props} />;
  }
};

export default OutlineIcon;
