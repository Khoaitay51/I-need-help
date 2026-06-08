import React, { useState, useEffect } from "react";
import {
  HiOutlineDocument,
  HiOutlineTrash,
  HiOutlineEye,
} from "react-icons/hi2";
import { MdOutlineAutorenew } from "react-icons/md";
import "./FileManagement.css";

const FileManagement = ({ sidebarExpanded = true }) => {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [fileContent, setFileContent] = useState("");
  const [showContentModal, setShowContentModal] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");

  // Load files when modal opens
  useEffect(() => {
    if (showModal && files.length === 0) {
      loadFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  const loadFiles = async () => {
    setIsLoading(true);
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
          setFiles(data.data);
        }
      } else {
        console.error("Failed to load files:", response.statusText);
      }
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (fileId, fileName) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa file "${fileName}"? Điều này sẽ xóa metadata từ MongoDB và vectors từ Milvus.`,
      )
    ) {
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

      if (response.ok) {
        setFiles((prev) => prev.filter((f) => f.file_id !== fileId));
        alert(`✅ File "${fileName}" đã được xóa thành công`);
      } else {
        const error = await response.json();
        alert(`❌ Lỗi: ${error.detail || "Không thể xóa file"}`);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("❌ Lỗi xóa file: " + error.message);
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

      // Get file content from Milvus via API
      const response = await fetch(`/api/files/${fileId}/content`, {
        method: "GET",
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFileContent(data.data.content || "Không có nội dung");
        } else {
          setFileContent(data.message || "Không thể lấy nội dung từ Milvus");
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="file-management-wrapper">
      {/* File Management Button - Always visible in sidebar */}
      {sidebarExpanded && (
        <button
          className="sidebar-file-btn"
          onClick={() => {
            setShowModal(true);
            if (files.length === 0) {
              loadFiles();
            }
          }}
          title="Quản lý các file đã upload"
        >
          <HiOutlineDocument size={18} />
          <span className="btn-text">Quản lý File</span>
          {files.length > 0 && (
            <span className="file-badge">{files.length}</span>
          )}
        </button>
      )}

      {!sidebarExpanded && (
        <button
          className="sidebar-file-btn-collapsed"
          onClick={() => {
            setShowModal(true);
            if (files.length === 0) {
              loadFiles();
            }
          }}
          title="Quản lý File"
        >
          <HiOutlineDocument size={18} />
          {files.length > 0 && (
            <span className="file-badge">{files.length}</span>
          )}
        </button>
      )}

      {/* Modal for file management */}
      {showModal && (
        <div
          className="file-management-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="file-management-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="file-modal-header">
              <div>
                <h2>📁 Quản lý File</h2>
                <p className="file-count-text">{files.length} file</p>
              </div>
              <button
                className="close-modal-btn"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="file-modal-content">
              {isLoading ? (
                <div className="file-loading-state">
                  <MdOutlineAutorenew size={32} className="rotating" />
                  <p>Đang tải danh sách file...</p>
                </div>
              ) : files.length > 0 ? (
                <div className="file-list-container">
                  {files.map((file) => (
                    <div key={file.file_id} className="file-item">
                      <div className="file-item-left">
                        <HiOutlineDocument
                          size={20}
                          className="file-item-icon"
                        />
                        <div className="file-item-info">
                          <h4 title={file.original_filename || file.filename}>
                            {file.original_filename ||
                              file.filename ||
                              "Unknown"}
                          </h4>
                          <p>
                            {formatFileSize(file.size || 0)}
                            {file.embedding_count !== undefined &&
                              ` • ${file.embedding_count} chunks`}
                          </p>
                        </div>
                      </div>
                      <div className="file-item-actions">
                        <button
                          className="file-action-btn view-btn"
                          onClick={() =>
                            handleViewContent(
                              file.file_id,
                              file.original_filename || file.filename || "File",
                            )
                          }
                          title="Xem nội dung"
                        >
                          <HiOutlineEye size={16} />
                        </button>
                        <button
                          className="file-action-btn delete-btn"
                          onClick={() =>
                            handleDeleteFile(
                              file.file_id,
                              file.original_filename || file.filename || "File",
                            )
                          }
                          title="Xóa file"
                        >
                          <HiOutlineTrash size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="file-empty-state">
                  <HiOutlineDocument size={40} />
                  <p>Chưa có file nào được upload</p>
                </div>
              )}

              {files.length > 0 && (
                <button className="file-refresh-btn" onClick={loadFiles}>
                  🔄 Làm mới
                </button>
              )}
            </div>

            {/* Modal Footer */}
            <div className="file-modal-footer">
              <button className="btn-close" onClick={() => setShowModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Modal */}
      {showContentModal && (
        <div
          className="file-content-modal-overlay"
          onClick={() => setShowContentModal(false)}
        >
          <div
            className="file-content-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-mgmt">
              <h3>📄 {selectedFileName}</h3>
              <button
                className="btn-close-modal"
                onClick={() => setShowContentModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-content-mgmt">
              <pre className="file-content-text">{fileContent}</pre>
            </div>

            <div className="modal-footer-mgmt">
              <button
                className="btn-close-mgmt"
                onClick={() => setShowContentModal(false)}
              >
                Đóng
              </button>
              <button
                className="btn-copy-mgmt"
                onClick={() => {
                  navigator.clipboard.writeText(fileContent);
                  alert("✅ Nội dung đã được sao chép");
                }}
              >
                📋 Sao chép
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManagement;
