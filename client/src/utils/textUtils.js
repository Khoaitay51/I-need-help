export const stripThinkingContent = (text) => {
  if (!text) {
    return "";
  }

  let cleaned = String(text)
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "")
    .replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/gi, "")
    .trimStart();

  cleaned = stripResponseMeta(cleaned);

  return cleaned;
};

export const stripResponseMeta = (text) => {
  let cleaned = String(text || "").trimStart();
  if (!cleaned) return "";

  for (const pattern of [
    /Source included\?\s*Yes\.\s*/i,
    /Nguồn included\?\s*Yes\.\s*/i,
    /Draft:\s*/i,
  ]) {
    const matches = [...cleaned.matchAll(new RegExp(pattern, "gi"))];
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      cleaned = cleaned.slice((last.index || 0) + last[0].length).trimStart();
      break;
    }
  }

  const hasMetaIntro =
    /(^|\n)\s*(User Question|Role:|Constraints:|\[DOCUMENT CONTEXT\] provided|Professional,\s*Markdown\?|Concise\?|No greetings\?)/i.test(
      cleaned,
    ) ||
    /(^|\n)\s*\*?\s*Source\s+\d+\s*:/i.test(cleaned);

  if (hasMetaIntro) {
    const finalAnswerMatch = cleaned.match(
      /(?:^|\n)(Kết quả|Dựa trên|Theo|Không|Có|Để|Bài báo|Các|Tóm lại|Như vậy)[\s\S]*$/,
    );
    if (finalAnswerMatch && finalAnswerMatch.index > 0) {
      cleaned = cleaned.slice(finalAnswerMatch.index).trimStart();
    }
  }

  cleaned = cleaned.replace(
    /^\s*(User Question|Role:|Constraints:|Professional,\s*Markdown\?|Concise\?|No greetings\?|Other sources|Introduction:|Quantitative results:|Conclusion\/Qualitative result:|Source citation:|\[DOCUMENT CONTEXT\] provided).*$\n?/gim,
    "",
  );

  return cleaned.replace(/\n{3,}/g, "\n\n").trimStart();
};

export const prettifyMarkdownContent = (text) => {
  return stripThinkingContent(text)
    .replace(/\n[ \t]+\n/g, "\n\n")
    .replace(/^\s*Nguồn:\s*$/gim, "**Nguồn:**")
    .replace(/^\s*File:\s*/gim, "- File: ")
    .replace(/^\s*Các đoạn trích:\s*/gim, "- Các đoạn trích: ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const normalizeTextContent = (content) => {
  let normalized = "";

  if (content === null || content === undefined) {
    return "";
  }

  if (typeof content === "string") {
    normalized = content;
  } else if (Array.isArray(content)) {
    normalized = content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object") {
          return item.text || item.content || JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean)
      .join("\n");
  } else if (typeof content === "object") {
    normalized = content.text || content.content || JSON.stringify(content);
  } else {
    normalized = String(content);
  }

  return prettifyMarkdownContent(normalized);
};
