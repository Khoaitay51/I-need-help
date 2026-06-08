import React, { useState, useRef, useEffect } from "react";
import "./FileUploadPanel.css";
import {
  HiOutlineXMark,
  HiOutlineArrowUpTray,
  HiOutlineDocument,
  HiOutlineTrash,
  HiOutlineEye,
} from "react-icons/hi2";
import { MdOutlineAutorenew } from "react-icons/md";

const FileUploadPanel = ({
  isOpen,
  onClose,
  onFilesSelected,
  conversation_id,
  onNeedLogin,
}) => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [serverFiles, setServerFiles] = useState([]); // Files from server
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingServerFiles, setIsLoadingServerFiles] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [fileContent, setFileContent] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("upload"); // "upload" or "existing"

  const ALLOWED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
    "image/png",
    "image/jpeg",
    "application/zip",
    "application/x-rar-compressed",
  ];

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  // Load user files from server when panel opens
  useEffect(() => {
    if (isOpen && activeTab === "existing") {
      loadUserFiles();
    }
  }, [isOpen, activeTab]);

  const loadUserFiles = async () => {
    setIsLoadingServerFiles(true);
    try {
      const token = localStorage.getItem("accessToken");
      const headers = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/files/", {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Transform server files to match our format
          const files = data.data.map((file) => ({
            file_id: file.file_id,
            filename: file.original_filename,
            size: file.size,
            status: file.status || "ready",
            created_at: file.created_at,
            embedding_count: file.embedding_count || 0,
          }));
          setServerFiles(files);
        }
      } else {
        console.error("Failed to load files:", response.statusText);
      }
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setIsLoadingServerFiles(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove("drag-over");
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");

    const files = Array.from(e.dataTransfer.files);
    await handleFilesSelected(files);
  };

  const handleFileInputChange = async (e) => {
    const files = Array.from(e.target.files || []);
    await handleFilesSelected(files);
  };

  const handleFilesSelected = async (files) => {
    // Validate files
    const validFiles = files.filter((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`File type not allowed: ${file.type}`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`File too large (max 50MB): ${file.name}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);

    for (const file of validFiles) {
      await uploadFile(file);
    }

    setIsUploading(false);
  };

  const uploadFile = async (file) => {
    // Check if user is authenticated (optional for anonymous users)
    const token = localStorage.getItem("accessToken");

    const formData = new FormData();
    formData.append("file", file);
    if (conversation_id) {
      formData.append("conversation_id", conversation_id);
    }

    try {
      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Upload file - this now automatically processes embeddings
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Upload failed: ${response.statusText}`,
        );
      }

      const data = await response.json();
      const fileData = data.data;

      console.info(`📝 File processing has been started: ${fileData.file_id}`);

      // File is now queued for processing automatically - no need for separate /process call
      setUploadedFiles((prev) => [
        ...prev,
        { ...fileData, status: "processing" },
      ]);

      // Reload server files after successful upload
      setTimeout(() => loadUserFiles(), 2000);
    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error);
      alert(`Error uploading ${file.name}: ${error.message}`);
    }
  };

  const handleRemoveFile = async (fileId) => {
    // Get file name for confirmation dialog
    const file = serverFiles.find((f) => f.file_id === fileId);
    const fileName = file?.filename || "Unknown file";

    // Ask for confirmation before deleting
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa file này không?\n\n📄 ${fileName}\n\n(Hành động này không thể được hoàn tác)`,
    );

    if (!confirmed) {
      console.log(`❌ Delete cancelled for file: ${fileId}`);
      return;
    }

    try {
      const token = localStorage.getItem("accessToken");
      const headers = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Delete failed: ${response.statusText}`,
        );
      }

      // Remove from local state
      setUploadedFiles((prev) => prev.filter((f) => f.file_id !== fileId));
      setServerFiles((prev) => prev.filter((f) => f.file_id !== fileId));

      console.log(`✅ File deleted: ${fileId}`);
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Lỗi xóa file: " + error.message);
    }
  };

  const handleViewContent = async (fileId, fileName) => {
    setSelectedFileName(fileName);
    setFileContent("Đang tải nội dung...");
    setShowContentModal(true);

    try {
      const token = localStorage.getItem("accessToken");
      const headers = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/files/${fileId}/content`, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFileContent(data.data.content || "Không có nội dung");
        } else {
          setFileContent(data.message || "Không thể lấy nội dung");
        }
      } else if (response.status === 404) {
        setFileContent(
          "⚠️ File chưa được xử lý hoặc nội dung không có sẵn. Vui lòng đợi file hoàn tất xử lý.",
        );
      } else {
        setFileContent("❌ Lỗi tải nội dung");
      }
    } catch (error) {
      console.error("Error loading file content:", error);
      setFileContent("❌ Lỗi: " + error.message);
    }
  };

  const handleSelectFiles = () => {
    let selectedFiles = [];

    // Get selected files from active tab
    if (activeTab === "upload") {
      selectedFiles = uploadedFiles
        .filter((f) => f.selected)
        .map((f) => ({
          id: f.file_id,
          name: f.filename || f.file_name || f.name || f.file_id,
        }));
    } else {
      selectedFiles = serverFiles
        .filter((f) => f.selected)
        .map((f) => ({
          id: f.file_id,
          name: f.filename || f.file_name || f.name || f.file_id,
        }));
    }

    if (selectedFiles.length === 0) {
      alert("Please select at least one file");
      return;
    }

    onFilesSelected(selectedFiles);
    onClose();
  };

  const toggleFileSelection = (fileId, tabType = "upload") => {
    if (tabType === "upload") {
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.file_id === fileId ? { ...f, selected: !f.selected } : f,
        ),
      );
    } else {
      setServerFiles((prev) =>
        prev.map((f) =>
          f.file_id === fileId ? { ...f, selected: !f.selected } : f,
        ),
      );
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="file-upload-modal" onClick={onClose}>
      <div className="file-upload-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <h3>Document Management</h3>
          <button className="close-btn" onClick={onClose}>
            <HiOutlineXMark size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="panel-tabs">
          <button
            className={`tab-btn ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            Upload New
          </button>
          <button
            className={`tab-btn ${activeTab === "existing" ? "active" : ""}`}
            onClick={() => setActiveTab("existing")}
          >
            My Documents ({serverFiles.length})
          </button>
        </div>

        <div className="panel-content">
          {/* Upload Tab */}
          {activeTab === "upload" && (
            <>
              {/* Upload Zone */}
              <div
                className={`upload-zone ${isUploading ? "uploading" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileInputChange}
                  style={{ display: "none" }}
                  disabled={isUploading}
                />

                <div className="upload-content">
                  {isUploading ? (
                    <>
                      <MdOutlineAutorenew size={40} className="rotating" />
                      <p>Uploading and processing files...</p>
                    </>
                  ) : (
                    <>
                      <HiOutlineArrowUpTray size={40} />
                      <p>Drag & drop files here or click to select</p>
                      <span className="file-hint">
                        PDF, DOCX, TXT, Images, etc. (Max 50MB)
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Recently Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="files-list">
                  <h4>Recently Uploaded ({uploadedFiles.length})</h4>
                  <div className="files-container">
                    {uploadedFiles.map((file) => (
                      <div key={file.file_id} className="file-item">
                        <input
                          type="checkbox"
                          checked={file.selected || false}
                          onChange={() =>
                            toggleFileSelection(file.file_id, "upload")
                          }
                          className="file-checkbox"
                        />
                        <div className="file-info">
                          <HiOutlineDocument size={20} className="file-icon" />
                          <div className="file-details">
                            <div className="file-name">{file.filename}</div>
                            <div className="file-meta">
                              {formatFileSize(file.size)} • {file.status}
                            </div>
                          </div>
                        </div>
                        <button
                          className="file-delete-btn"
                          onClick={() => handleRemoveFile(file.file_id)}
                          title="Delete file"
                        >
                          <HiOutlineTrash size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Existing Files Tab */}
          {activeTab === "existing" && (
            <>
              {isLoadingServerFiles ? (
                <div className="loading-indicator">
                  <MdOutlineAutorenew size={40} className="rotating" />
                  <p>Loading your documents...</p>
                </div>
              ) : serverFiles.length > 0 ? (
                <div className="files-list">
                  <h4>Your Documents ({serverFiles.length})</h4>
                  <div className="files-container">
                    {serverFiles.map((file) => (
                      <div key={file.file_id} className="file-item">
                        <input
                          type="checkbox"
                          checked={file.selected || false}
                          onChange={() =>
                            toggleFileSelection(file.file_id, "existing")
                          }
                          className="file-checkbox"
                        />
                        <div className="file-info">
                          <HiOutlineDocument size={20} className="file-icon" />
                          <div className="file-details">
                            <div className="file-name">{file.filename}</div>
                            <div className="file-meta">
                              {formatFileSize(file.size)} • Embeddings:{" "}
                              {file.embedding_count || 0}
                            </div>
                            <div className="file-date">
                              {new Date(file.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="file-actions">
                          <button
                            className="file-view-btn"
                            onClick={() =>
                              handleViewContent(file.file_id, file.filename)
                            }
                            title="View content"
                          >
                            <HiOutlineEye size={18} />
                          </button>
                          <button
                            className="file-delete-btn"
                            onClick={() => handleRemoveFile(file.file_id)}
                            title="Delete file"
                          >
                            <HiOutlineTrash size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="no-files-message">
                  <HiOutlineDocument size={40} className="icon" />
                  <p>No documents uploaded yet</p>
                  <span>Switch to "Upload New" to add documents</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="panel-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-attach"
            onClick={handleSelectFiles}
            disabled={
              activeTab === "upload"
                ? uploadedFiles.filter((f) => f.selected).length === 0
                : serverFiles.filter((f) => f.selected).length === 0
            }
          >
            Attach{" "}
            {(activeTab === "upload"
              ? uploadedFiles.filter((f) => f.selected).length
              : serverFiles.filter((f) => f.selected).length) > 0 &&
              `(${
                activeTab === "upload"
                  ? uploadedFiles.filter((f) => f.selected).length
                  : serverFiles.filter((f) => f.selected).length
              })`}
          </button>
        </div>

        {/* Content Viewer Modal */}
        {showContentModal && (
          <div
            className="file-content-overlay"
            onClick={() => setShowContentModal(false)}
          >
            <div
              className="file-content-viewer"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="viewer-header">
                <h3>{selectedFileName}</h3>
                <button
                  onClick={() => setShowContentModal(false)}
                  className="close-btn"
                >
                  ✕
                </button>
              </div>
              <div className="viewer-content">
                <pre>{fileContent}</pre>
              </div>
              <div className="viewer-footer">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(fileContent);
                    alert("✅ Nội dung đã được sao chép");
                  }}
                  className="copy-btn"
                >
                  📋 Sao chép
                </button>
                <button
                  onClick={() => setShowContentModal(false)}
                  className="close-viewer-btn"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploadPanel;
