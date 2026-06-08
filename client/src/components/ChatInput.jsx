import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiSend, FiMic, FiMicOff, FiPaperclip, FiX, FiBookOpen, FiAward, FiLock } from "react-icons/fi";
import FileUploadPanel from "./FileUploadPanel";
import "./ChatInput.css";

const ChatInput = ({
  onSendMessage,
  onVoiceInput,
  disabled,
  placeholder = "Nhập câu hỏi cho ACTVN-AGENT...",
  selectedFolder,
  onFolderChange,
  folders = [],
  conversationId,
  onNeedLogin,
  chatMode = "document",
  onChatModeChange,
  canUseStudentMode = false,
}) => {
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [attachmentFileIds, setAttachmentFileIds] = useState([]); // Store {id, name} objects
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false); // NEW: Control FileUploadPanel
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const folderRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      // Extract IDs from file objects for sending to API
      const fileIds = attachmentFileIds.map((f) =>
        typeof f === "string" ? f : f.id,
      );
      onSendMessage(message, selectedFolder, fileIds, chatMode);
      setMessage("");
      setAttachmentFileIds([]); // Clear attachments after send
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const startVoiceRecognition = () => {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      alert("Trình duyệt của bạn không hỗ trợ tính năng nhận diện giọng nói");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "vi-VN";

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setMessage(transcript);
      if (onVoiceInput) onVoiceInput(transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
  };

  const handleVoiceClick = () => {
    if (isListening) stopVoiceRecognition();
    else startVoiceRecognition();
  };

  const handleTextareaInput = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  };

  // NEW: Handle file selection from FileUploadPanel
  const handleFilesSelected = (fileIds) => {
    setAttachmentFileIds((prev) => [...prev, ...fileIds]);
  };

  // NEW: Remove attachment by file_id
  const removeAttachment = (fileIdOrObj) => {
    setAttachmentFileIds((prev) =>
      prev.filter((item) => {
        const itemId = typeof item === "string" ? item : item.id;
        return itemId !== fileIdOrObj;
      }),
    );
  };

  const activeFolderValue = selectedFolder || "all";
  const isStudentMode = chatMode === "student";

  const folderItems = useMemo(() => {
    const unique = new Map();
    (folders || []).forEach((f) => {
      const name = f?.name || "";
      if (!name || unique.has(name)) return;
      unique.set(name, {
        name,
        displayName: f?.displayName || name,
      });
    });
    return Array.from(unique.values()).sort((a, b) =>
      (a.displayName || "").localeCompare(b.displayName || "", "vi"),
    );
  }, [folders]);

  const activeFolderLabel = useMemo(() => {
    if (activeFolderValue === "all") return "Tất cả";
    const match = (folders || []).find((f) => f?.name === activeFolderValue);
    return match?.displayName || match?.name || "Chọn phạm vi";
  }, [activeFolderValue, folders]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!folderRef.current) return;
      if (!folderRef.current.contains(e.target)) {
        setIsFolderOpen(false);
      }
    };
    const onDocKeyDown = (e) => {
      if (e.key === "Escape") setIsFolderOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, []);

  useEffect(() => {
    if (isStudentMode) {
      setAttachmentFileIds([]);
      setIsUploadPanelOpen(false);
    }
  }, [isStudentMode]);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    const root = document.documentElement;
    const container = document.querySelector(".chat-app-main");

    const updateKeyboardOffset = () => {
      const focusedInsideInput = document.activeElement === textareaRef.current;
      if (!visualViewport || !focusedInsideInput) {
        root.style.setProperty("--mobile-keyboard-offset", "0px");
        container?.classList.remove("keyboard-open");
        return;
      }

      const keyboardOffset = Math.max(
        0,
        window.innerHeight - visualViewport.height - visualViewport.offsetTop,
      );
      root.style.setProperty("--mobile-keyboard-offset", `${keyboardOffset}px`);
      container?.classList.toggle("keyboard-open", keyboardOffset > 24);
    };

    const handleFocus = () => {
      updateKeyboardOffset();
      window.setTimeout(() => {
        updateKeyboardOffset();
        textareaRef.current?.scrollIntoView({ block: "nearest" });
      }, 80);
    };

    const handleBlur = () => {
      window.setTimeout(updateKeyboardOffset, 80);
    };

    const textarea = textareaRef.current;
    textarea?.addEventListener("focus", handleFocus);
    textarea?.addEventListener("blur", handleBlur);
    visualViewport?.addEventListener("resize", updateKeyboardOffset);
    visualViewport?.addEventListener("scroll", updateKeyboardOffset);
    window.addEventListener("orientationchange", updateKeyboardOffset);

    return () => {
      textarea?.removeEventListener("focus", handleFocus);
      textarea?.removeEventListener("blur", handleBlur);
      visualViewport?.removeEventListener("resize", updateKeyboardOffset);
      visualViewport?.removeEventListener("scroll", updateKeyboardOffset);
      window.removeEventListener("orientationchange", updateKeyboardOffset);
      root.style.setProperty("--mobile-keyboard-offset", "0px");
      container?.classList.remove("keyboard-open");
    };
  }, []);

  return (
    <div className="chat-input-container">
      <div className="chat-mode-row" aria-label="Chọn chế độ hỏi">
        <button
          type="button"
          className={`chat-mode-chip ${chatMode === "document" ? "active" : ""}`}
          onClick={() => onChatModeChange?.("document")}
          disabled={disabled}
        >
          <FiBookOpen size={15} />
          <span>Hỏi tài liệu</span>
        </button>
        <button
          type="button"
          className={`chat-mode-chip ${isStudentMode ? "active" : ""}`}
          onClick={() => {
            if (canUseStudentMode) onChatModeChange?.("student");
          }}
          disabled={disabled || !canUseStudentMode}
          title={
            canUseStudentMode
              ? "Hỏi điểm và thông tin sinh viên của tài khoản"
              : "Cần cập nhật mã sinh viên để dùng chức năng hỏi điểm"
          }
        >
          {canUseStudentMode ? <FiAward size={15} /> : <FiLock size={15} />}
          <span>Hỏi điểm</span>
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="chat-input-wrapper">
          {/* Folder selector */}
          <div className="chat-folder" ref={folderRef}>
            <button
              type="button"
              className="chat-folder-trigger"
              disabled={disabled || isStudentMode}
              onClick={() => setIsFolderOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={isFolderOpen}
              title="Chọn phạm vi tìm kiếm"
            >
              <span className="chat-folder-dot" aria-hidden="true" />
              <span className="chat-folder-label">{activeFolderLabel}</span>
              <span
                className={`chat-folder-chevron ${isFolderOpen ? "open" : ""}`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>

            {isFolderOpen && (
              <div
                className="chat-folder-popover"
                role="listbox"
                aria-label="Danh sách phòng ban"
              >
                <button
                  type="button"
                  className={`chat-folder-item ${activeFolderValue === "all" ? "active" : ""}`}
                  onClick={() => {
                    onFolderChange && onFolderChange("all");
                    setIsFolderOpen(false);
                  }}
                >
                  <span className="chat-folder-item-title">Tất cả</span>
                  <span className="chat-folder-item-sub">
                    Tìm trên toàn bộ dữ liệu
                  </span>
                </button>

                <div className="chat-folder-divider" role="separator" />

                <div className="chat-folder-groups">
                  {folderItems.length === 0 ? (
                    <div className="chat-folder-empty">
                      Không có danh sách phòng ban
                    </div>
                  ) : (
                    <div className="chat-folder-group-list">
                      {folderItems.map((item) => (
                        <button
                          type="button"
                          key={item.name}
                          className={`chat-folder-item ${activeFolderValue === item.name ? "active" : ""}`}
                          onClick={() => {
                            onFolderChange && onFolderChange(item.name);
                            setIsFolderOpen(false);
                          }}
                        >
                          <span className="chat-folder-item-title">
                            {item.displayName}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            onInput={handleTextareaInput}
            placeholder={placeholder}
            disabled={disabled}
            className="chat-input-textarea"
            rows="1"
          />

          {/* File attachment button - Opens FileUploadPanel */}
          <button
            type="button"
            onClick={() => setIsUploadPanelOpen(true)}
            disabled={disabled || isStudentMode}
            className="chat-attach-btn"
            title={isStudentMode ? "Chế độ hỏi điểm không dùng tài liệu đính kèm" : `Đính kèm tài liệu (${attachmentFileIds.length}/5)`}
          >
            <FiPaperclip size={16} />
            {attachmentFileIds.length > 0 && (
              <span className="chat-attach-badge">
                {attachmentFileIds.length}
              </span>
            )}
          </button>

          {/* Hidden file input - No longer need this, but kept for compatibility */}
          {/* Removed: fileInputRef usage */}

          {/* Voice button */}
          <button
            type="button"
            onClick={handleVoiceClick}
            disabled={disabled}
            className={`chat-voice-btn ${isListening ? "listening" : ""}`}
            title={isListening ? "Dừng thu âm" : "Nhấn để nói"}
          >
            {isListening ? <FiMicOff size={16} /> : <FiMic size={16} />}
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className="chat-send-btn"
            title="Gửi tin nhắn"
          >
            <FiSend />
          </button>
        </div>

        {/* Attachments display */}
        {attachmentFileIds.length > 0 && (
          <div className="chat-attachments">
            {attachmentFileIds.map((file) => {
              const fileId = typeof file === "string" ? file : file.id;
              const fileName =
                typeof file === "string" ? file : file.name || file.id;
              return (
                <div key={fileId} className="chat-attachment-item">
                  <div className="chat-attachment-info">
                    <div className="chat-attachment-name">{fileName}</div>
                    <div className="chat-attachment-status">Đã tải lên</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(fileId)}
                    className="chat-attachment-remove"
                    title="Xóa"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </form>

      {/* FileUploadPanel Modal */}
      <FileUploadPanel
        isOpen={isUploadPanelOpen}
        onClose={() => setIsUploadPanelOpen(false)}
        onFilesSelected={handleFilesSelected}
        conversation_id={conversationId}
        onNeedLogin={onNeedLogin}
      />

      {/* Voice listening indicator */}
      {isListening && (
        <div className="voice-listening-indicator">
          <span className="voice-listening-dot" />
          Đang nghe...
        </div>
      )}
    </div>
  );
};

export default ChatInput;
