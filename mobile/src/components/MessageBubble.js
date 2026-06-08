import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import OutlineIcon from "./OutlineIcon";
import Markdown from "react-native-markdown-display";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../theme";

const CELL_WIDTH = 148;

const MessageBubble = ({ message, user }) => {
  const isUserMessage = message.role === "user";
  const attachments = message.files || message.attachments || [];
  const author = isUserMessage ? user?.name || "Bạn" : "ACTVN-AGENT";
  const segments = parseRichContent(message.content || "");

  return (
    <View
      style={[
        styles.wrapper,
        isUserMessage ? styles.wrapperUser : styles.wrapperAssistant,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUserMessage ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.avatar,
              isUserMessage ? styles.userAvatar : styles.assistantAvatar,
            ]}
          >
            {isUserMessage ? (
              <OutlineIcon name="user" size={14} color="#fff" />
            ) : (
              <Image
                source={require("../../assets/kma.png")}
                style={styles.assistantLogo}
                resizeMode="contain"
              />
            )}
          </View>
          <Text
            style={[
              styles.author,
              isUserMessage ? styles.headerUser : styles.headerAssistant,
            ]}
            numberOfLines={1}
          >
            {author}
          </Text>
          <Text
            style={[
              styles.time,
              isUserMessage ? styles.headerUser : styles.headerAssistant,
            ]}
          >
            {formatTime(message.timestamp)}
          </Text>
        </View>

        {attachments.length > 0 && (
          <View style={styles.attachments}>
            {attachments.map((file, index) => (
              <View
                key={`${file.file_id || file.name || file.filename}-${index}`}
                style={[
                  styles.attachmentChip,
                  isUserMessage && styles.attachmentChipUser,
                ]}
              >
                <OutlineIcon
                  name="paperclip"
                  size={13}
                  color={isUserMessage ? "#fff" : COLORS.primary}
                />
                <Text
                  style={[
                    styles.attachmentText,
                    isUserMessage && styles.attachmentTextUser,
                  ]}
                  numberOfLines={1}
                >
                  {file.name || file.filename || "Tài liệu đính kèm"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <RichContent segments={segments} isUserMessage={isUserMessage} />
      </View>
    </View>
  );
};

const RichContent = ({ segments, isUserMessage }) => {
  const markdownStyles = getMarkdownStyles(isUserMessage);

  return (
    <View style={styles.richContent}>
      {segments.map((segment, index) => {
        if (segment.type === "table") {
          return (
            <MarkdownTable
              key={`table-${index}`}
              rows={segment.rows}
              isUserMessage={isUserMessage}
            />
          );
        }

        if (segment.type === "math") {
          return (
            <MathBlock
              key={`math-${index}`}
              value={segment.value}
              isUserMessage={isUserMessage}
            />
          );
        }

        return (
          <Markdown key={`text-${index}`} style={markdownStyles}>
            {normalizeInlineMath(segment.value)}
          </Markdown>
        );
      })}
    </View>
  );
};

const MarkdownTable = ({ rows, isUserMessage }) => {
  if (!rows.length) return null;
  const columnCount = Math.max(...rows.map((row) => row.length));
  const tableWidth = Math.max(columnCount * CELL_WIDTH, 280);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      style={styles.tableScroll}
    >
      <View
        style={[
          styles.table,
          { width: tableWidth },
          isUserMessage && styles.tableUser,
        ]}
      >
        {rows.map((row, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={[
              styles.tableRow,
              rowIndex === 0 && styles.tableHeaderRow,
              isUserMessage && rowIndex === 0 && styles.tableHeaderRowUser,
            ]}
          >
            {Array.from({ length: columnCount }).map((_, cellIndex) => (
              <View
                key={`cell-${rowIndex}-${cellIndex}`}
                style={[
                  styles.tableCell,
                  { width: CELL_WIDTH },
                  cellIndex === columnCount - 1 && styles.tableLastCell,
                ]}
              >
                <Text
                  style={[
                    styles.tableCellText,
                    rowIndex === 0 && styles.tableHeaderText,
                    isUserMessage && styles.tableCellTextUser,
                  ]}
                >
                  {formatMath(row[cellIndex] || "")}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const MathBlock = ({ value, isUserMessage }) => (
  <View style={[styles.mathBlock, isUserMessage && styles.mathBlockUser]}>
    <View style={styles.mathHeader}>
      <OutlineIcon
        name="hash"
        size={13}
        color={isUserMessage ? "rgba(255,255,255,0.82)" : COLORS.primary}
      />
      <Text style={[styles.mathLabel, isUserMessage && styles.mathLabelUser]}>
        Công thức
      </Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <Text style={[styles.mathText, isUserMessage && styles.mathTextUser]}>
        {formatMath(value)}
      </Text>
    </ScrollView>
  </View>
);

const parseRichContent = (content) => {
  const lines = String(content).split(/\r?\n/);
  const segments = [];
  let textBuffer = [];

  const flushText = () => {
    const value = textBuffer.join("\n").trim();
    if (value) segments.push({ type: "text", value });
    textBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed === "$$" || trimmed === "\\[") {
      flushText();
      const closing = trimmed === "$$" ? "$$" : "\\]";
      const mathLines = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== closing) {
        mathLines.push(lines[index]);
        index += 1;
      }
      segments.push({ type: "math", value: mathLines.join("\n") });
      continue;
    }

    if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) {
      flushText();
      segments.push({ type: "math", value: trimmed.slice(2, -2) });
      continue;
    }

    if (isTableStart(lines, index)) {
      flushText();
      const tableLines = [];
      while (index < lines.length && isTableLine(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      segments.push({ type: "table", rows: parseTable(tableLines) });
      continue;
    }

    textBuffer.push(line);
  }

  flushText();
  return segments.length ? segments : [{ type: "text", value: content }];
};

const isTableStart = (lines, index) =>
  isTableLine(lines[index]) &&
  index + 1 < lines.length &&
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1]);

const isTableLine = (line = "") => line.includes("|") && line.trim().length > 0;

const parseTable = (tableLines) =>
  tableLines
    .filter((line, index) => index !== 1)
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );

const normalizeInlineMath = (value) =>
  value
    .replace(/\\\((.*?)\\\)/gs, (_, math) => `\`${formatMath(math)}\``)
    .replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_, math) => `\`${formatMath(math)}\``);

const formatMath = (rawValue) => {
  let value = String(rawValue || "").trim();
  value = value.replace(/^\$\$|\$\$$/g, "").replace(/^\\\[|\\\]$/g, "");
  value = value.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1) / ($2)");
  value = value.replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)");
  value = value.replace(/\\left|\\right/g, "");
  value = value.replace(/\^\{([^{}]+)\}/g, "^$1");
  value = value.replace(/_\{([^{}]+)\}/g, "_$1");

  const replacements = {
    "\\times": "×",
    "\\cdot": "Â·",
    "\\div": "÷",
    "\\leq": "<=",
    "\\geq": ">=",
    "\\neq": "!=",
    "\\approx": "~=",
    "\\sum": "Sigma",
    "\\prod": "Product",
    "\\int": "Integral",
    "\\infty": "infinity",
    "\\Delta": "Delta",
    "\\alpha": "alpha",
    "\\beta": "beta",
    "\\gamma": "gamma",
    "\\lambda": "λ",
    "\\mu": "mu",
    "\\pi": "pi",
    "\\theta": "theta",
    "\\sigma": "sigma",
  };

  Object.entries(replacements).forEach(([source, target]) => {
    value = value.replaceAll(source, target);
  });

  return value.replace(/\\/g, "").replace(/\s+/g, " ").trim();
};

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getMarkdownStyles = (isUserMessage) => {
  const textColor = isUserMessage ? "#fff" : COLORS.onSurface;
  const mutedColor = isUserMessage ? "rgba(255,255,255,0.84)" : COLORS.onSurfaceVariant;
  const codeBg = isUserMessage ? "rgba(255,255,255,0.16)" : "#f3f4f6";

  return {
    body: {
      color: textColor,
      fontSize: TYPOGRAPHY.fontSize.sm,
      lineHeight: 22,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: SPACING.sm,
    },
    heading1: {
      color: textColor,
      fontSize: 22,
      fontWeight: "800",
      marginBottom: SPACING.sm,
    },
    heading2: {
      color: textColor,
      fontSize: 19,
      fontWeight: "800",
      marginBottom: SPACING.sm,
    },
    heading3: {
      color: textColor,
      fontSize: 17,
      fontWeight: "800",
      marginBottom: SPACING.sm,
    },
    strong: {
      color: textColor,
      fontWeight: "800",
    },
    em: {
      color: mutedColor,
      fontStyle: "italic",
    },
    bullet_list: {
      marginBottom: SPACING.sm,
    },
    ordered_list: {
      marginBottom: SPACING.sm,
    },
    list_item: {
      color: textColor,
      marginBottom: 4,
    },
    bullet_list_icon: {
      color: textColor,
    },
    ordered_list_icon: {
      color: textColor,
    },
    code_inline: {
      color: textColor,
      backgroundColor: codeBg,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      fontFamily: TYPOGRAPHY.fontFamily.mono,
      fontSize: 13,
    },
    fence: {
      backgroundColor: "#111827",
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      color: "#e5e7eb",
      fontFamily: TYPOGRAPHY.fontFamily.mono,
      fontSize: 13,
      lineHeight: 20,
    },
    code_block: {
      backgroundColor: "#111827",
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      color: "#e5e7eb",
      fontFamily: TYPOGRAPHY.fontFamily.mono,
      fontSize: 13,
      lineHeight: 20,
    },
    blockquote: {
      backgroundColor: isUserMessage ? "rgba(255,255,255,0.08)" : COLORS.surfaceTertiary,
      borderLeftWidth: 3,
      borderLeftColor: isUserMessage ? "rgba(255,255,255,0.65)" : COLORS.primary,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      marginVertical: SPACING.sm,
    },
    link: {
      color: isUserMessage ? "#fff" : COLORS.primary,
      textDecorationLine: "underline",
    },
    hr: {
      backgroundColor: isUserMessage ? "rgba(255,255,255,0.22)" : COLORS.outlineVariant,
      height: 1,
      marginVertical: SPACING.md,
    },
  };
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    marginBottom: SPACING.md,
  },
  wrapperUser: {
    alignItems: "flex-end",
  },
  wrapperAssistant: {
    alignItems: "flex-start",
  },
  bubble: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  userBubble: {
    maxWidth: "86%",
    borderRadius: RADIUS.lg,
    borderBottomRightRadius: 4,
    backgroundColor: COLORS.primary,
  },
  assistantBubble: {
    width: "100%",
    borderRadius: RADIUS.lg,
    borderBottomLeftRadius: 4,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: 2,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  userAvatar: {
    borderColor: "rgba(255,255,255,0.48)",
  },
  assistantAvatar: {
    borderColor: COLORS.primary20,
    backgroundColor: "#fff",
  },
  assistantLogo: {
    width: 19,
    height: 19,
  },
  author: {
    flexShrink: 1,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: "800",
  },
  time: {
    fontSize: 11,
    opacity: 0.72,
  },
  headerUser: {
    color: "rgba(255,255,255,0.88)",
  },
  headerAssistant: {
    color: COLORS.onSurfaceVariant,
  },
  attachments: {
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  attachmentChip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary50,
    borderWidth: 1,
    borderColor: COLORS.primary20,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  attachmentChipUser: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.28)",
  },
  attachmentText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: "700",
    maxWidth: 260,
  },
  attachmentTextUser: {
    color: "#fff",
  },
  richContent: {
    gap: SPACING.xs,
  },
  tableScroll: {
    marginVertical: SPACING.sm,
    maxWidth: "100%",
  },
  table: {
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  tableUser: {
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  tableHeaderRow: {
    backgroundColor: COLORS.surfaceTertiary,
  },
  tableHeaderRowUser: {
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  tableCell: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRightWidth: 1,
    borderRightColor: COLORS.outlineVariant,
  },
  tableLastCell: {
    borderRightWidth: 0,
  },
  tableCellText: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },
  tableCellTextUser: {
    color: "#fff",
  },
  tableHeaderText: {
    fontWeight: "800",
  },
  mathBlock: {
    borderWidth: 1,
    borderColor: COLORS.primary20,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary50,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  mathBlockUser: {
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  mathHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  mathLabel: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  mathLabelUser: {
    color: "rgba(255,255,255,0.82)",
  },
  mathText: {
    color: COLORS.onSurface,
    fontFamily: TYPOGRAPHY.fontFamily.mono,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: 25,
    fontWeight: "700",
  },
  mathTextUser: {
    color: "#fff",
  },
});

export default MessageBubble;
