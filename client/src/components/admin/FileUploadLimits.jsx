import React, { useState, useEffect } from "react";
import {
  FiSave,
  FiRotateCcw,
  FiUsers,
  FiAlertCircle,
  FiInfo,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import "./FileUploadLimits.css";
import fileUploadLimitService from "../../services/fileUploadLimitService";

const FileUploadLimits = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // File upload limit settings
  const [settings, setSettings] = useState({
    enabled: true,
    defaultLimits: {
      maxFilesPerConversation: 10,
      maxFilesPerDay: 50,
      maxFilesTotal: 1000,
      maxTotalUploadSizePerDay: 500, // MB
      maxIndividualFileSize: 50, // MB
    },
    roleLimits: {
      admin: {
        maxFilesPerConversation: 100,
        maxFilesPerDay: 500,
        maxFilesTotal: 100000,
        maxTotalUploadSizePerDay: 5000, // MB
        maxIndividualFileSize: 500, // MB
      },
      user: {
        maxFilesPerConversation: 10,
        maxFilesPerDay: 50,
        maxFilesTotal: 1000,
        maxTotalUploadSizePerDay: 500, // MB
        maxIndividualFileSize: 50, // MB
      },
    },
    userExceptions: [],
  });

  useEffect(() => {
    // Fetch file upload limit settings from the API
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const response =
          await fileUploadLimitService.getFileUploadLimitConfig();
        if (response.success) {
          const configData = response.data || {};

          // Create a complete settings object with all required properties
          const completeSettings = {
            enabled:
              configData.enabled !== undefined ? configData.enabled : true,
            defaultLimits: {
              maxFilesPerConversation: 10,
              maxFilesPerDay: 50,
              maxFilesTotal: 1000,
              maxTotalUploadSizePerDay: 500,
              maxIndividualFileSize: 50,
              ...(configData.defaultLimits || {}),
            },
            roleLimits: {
              admin: {
                maxFilesPerConversation: 100,
                maxFilesPerDay: 500,
                maxFilesTotal: 100000,
                maxTotalUploadSizePerDay: 5000,
                maxIndividualFileSize: 500,
                ...(configData.roleLimits?.admin || {}),
              },
              user: {
                maxFilesPerConversation: 10,
                maxFilesPerDay: 50,
                maxFilesTotal: 1000,
                maxTotalUploadSizePerDay: 500,
                maxIndividualFileSize: 50,
                ...(configData.roleLimits?.user || {}),
              },
            },
            userExceptions: configData.userExceptions || [],
          };

          setSettings(completeSettings);
          setError(null);
        } else {
          setError("Không thể tải cài đặt giới hạn file: " + response.error);
        }
      } catch (err) {
        console.error("Error fetching file upload limit settings:", err);
        setError("Đã xảy ra lỗi khi tải cài đặt giới hạn file");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSettingChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "enabled") {
      setSettings((prev) => ({
        ...prev,
        enabled: checked,
      }));
      return;
    }

    // Parse the nested property path
    const path = name.split(".");

    setSettings((prev) => {
      const newSettings = { ...prev };
      let current = newSettings;

      // Navigate to the nested property, creating objects if they don't exist
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) {
          current[path[i]] = {};
        }
        current = current[path[i]];
      }

      // Set the value
      current[path[path.length - 1]] =
        type === "number" ? parseInt(value, 10) : value;

      return newSettings;
    });
  };

  const handleUserExceptionChange = (index, field, value) => {
    setSettings((prev) => {
      const newSettings = { ...prev };

      // Ensure userExceptions array exists
      if (!newSettings.userExceptions) {
        newSettings.userExceptions = [];
      }

      // Ensure the user exception at the specified index exists
      if (!newSettings.userExceptions[index]) {
        newSettings.userExceptions[index] = {
          username: "",
          maxFilesPerConversation:
            newSettings.defaultLimits?.maxFilesPerConversation || 10,
          maxFilesPerDay: newSettings.defaultLimits?.maxFilesPerDay || 50,
          maxFilesTotal: newSettings.defaultLimits?.maxFilesTotal || 1000,
          maxTotalUploadSizePerDay:
            newSettings.defaultLimits?.maxTotalUploadSizePerDay || 500,
          maxIndividualFileSize:
            newSettings.defaultLimits?.maxIndividualFileSize || 50,
        };
      }

      newSettings.userExceptions[index][field] =
        field === "username" ? value : parseInt(value, 10);
      return newSettings;
    });
  };

  const addUserException = () => {
    setSettings((prev) => {
      // Get default values from existing settings or use fallbacks
      const defaultLimits = prev.defaultLimits || {
        maxFilesPerConversation: 10,
        maxFilesPerDay: 50,
        maxFilesTotal: 1000,
        maxTotalUploadSizePerDay: 500,
        maxIndividualFileSize: 50,
      };

      return {
        ...prev,
        userExceptions: [
          ...(prev.userExceptions || []),
          {
            username: "",
            maxFilesPerConversation: defaultLimits.maxFilesPerConversation,
            maxFilesPerDay: defaultLimits.maxFilesPerDay,
            maxFilesTotal: defaultLimits.maxFilesTotal,
            maxTotalUploadSizePerDay: defaultLimits.maxTotalUploadSizePerDay,
            maxIndividualFileSize: defaultLimits.maxIndividualFileSize,
          },
        ],
      };
    });
  };

  const removeUserException = (index) => {
    setSettings((prev) => {
      const newSettings = { ...prev };
      // Ensure userExceptions array exists
      if (!newSettings.userExceptions) {
        newSettings.userExceptions = [];
        return newSettings;
      }

      newSettings.userExceptions = newSettings.userExceptions.filter(
        (_, i) => i !== index,
      );
      return newSettings;
    });
  };

  const validateFileUploadLimits = (limitsObject, objectName = "") => {
    const prefix = objectName ? `${objectName}: ` : "";

    if (!limitsObject) return null;

    const { maxFilesPerConversation, maxFilesPerDay, maxFilesTotal } =
      limitsObject;

    // Check if values are valid numbers
    if (
      typeof maxFilesPerConversation !== "number" ||
      typeof maxFilesPerDay !== "number" ||
      typeof maxFilesTotal !== "number"
    ) {
      return null;
    }

    // Validate: maxFilesPerConversation <= maxFilesPerDay
    if (maxFilesPerConversation > maxFilesPerDay) {
      return `${prefix}Số file tối đa/hội thoại (${maxFilesPerConversation}) không được lớn hơn số file tối đa/ngày (${maxFilesPerDay})`;
    }

    // Validate: maxFilesPerDay <= maxFilesTotal
    if (maxFilesPerDay > maxFilesTotal) {
      return `${prefix}Số file tối đa/ngày (${maxFilesPerDay}) không được lớn hơn số file tối đa trong hệ thống (${maxFilesTotal})`;
    }

    return null;
  };

  const validateAllLimits = (settingsData) => {
    // Validate default limits
    const defaultError = validateFileUploadLimits(
      settingsData.defaultLimits,
      "Giới hạn mặc định",
    );
    if (defaultError) return defaultError;

    // Validate role limits
    if (settingsData.roleLimits) {
      const adminError = validateFileUploadLimits(
        settingsData.roleLimits.admin,
        "Giới hạn Admin",
      );
      if (adminError) return adminError;

      const userError = validateFileUploadLimits(
        settingsData.roleLimits.user,
        "Giới hạn User",
      );
      if (userError) return userError;
    }

    // Validate user exceptions
    if (settingsData.userExceptions && settingsData.userExceptions.length > 0) {
      for (let i = 0; i < settingsData.userExceptions.length; i++) {
        const exception = settingsData.userExceptions[i];
        const exceptionError = validateFileUploadLimits(
          exception,
          `Ngoại lệ người dùng "${exception.username}"`,
        );
        if (exceptionError) return exceptionError;
      }
    }

    return null;
  };

  // Helper to check if specific field has validation error (for visual feedback)
  const hasFieldError = (limitsObject, fieldName) => {
    if (!limitsObject) return false;
    const { maxFilesPerConversation, maxFilesPerDay, maxFilesTotal } =
      limitsObject;

    if (fieldName === "maxFilesPerConversation") {
      return maxFilesPerConversation > maxFilesPerDay;
    }
    if (fieldName === "maxFilesPerDay") {
      return (
        maxFilesPerDay < maxFilesPerConversation ||
        maxFilesPerDay > maxFilesTotal
      );
    }
    if (fieldName === "maxFilesTotal") {
      return maxFilesTotal < maxFilesPerDay;
    }
    return false;
  };

  const saveSettings = async () => {
    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      // First validate file upload limits logic
      const limitValidationError = validateAllLimits(settings);
      if (limitValidationError) {
        setError(limitValidationError);
        setSaving(false);
        return;
      }

      // Validate that user exceptions have usernames
      const validExceptions = settings.userExceptions.filter(
        (exc) => exc.username && exc.username.trim(),
      );
      const invalidExceptions = settings.userExceptions.filter(
        (exc) => !exc.username || !exc.username.trim(),
      );

      if (invalidExceptions.length > 0) {
        setError(
          `Vui lòng nhập tên người dùng cho ${invalidExceptions.length} ngoại lệ`,
        );
        setSaving(false);
        return;
      }

      const configToSave = {
        ...settings,
        userExceptions: validExceptions,
      };

      // Save the settings to the API
      const response =
        await fileUploadLimitService.updateFileUploadLimitConfig(configToSave);

      if (response.success) {
        setSuccess("Cài đặt đã được lưu thành công");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Đã xảy ra lỗi khi lưu cài đặt: " + response.error);
      }
    } catch (err) {
      console.error("Error saving file upload limit settings:", err);
      setError("Đã xảy ra lỗi khi lưu cài đặt");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (
      window.confirm(
        "Bạn có chắc chắn muốn đặt lại tất cả cài đặt về mặc định?",
      )
    ) {
      setSettings({
        enabled: true,
        defaultLimits: {
          maxFilesPerConversation: 10,
          maxFilesPerDay: 50,
          maxFilesTotal: 1000,
          maxTotalUploadSizePerDay: 500,
          maxIndividualFileSize: 50,
        },
        roleLimits: {
          admin: {
            maxFilesPerConversation: 100,
            maxFilesPerDay: 500,
            maxFilesTotal: 100000,
            maxTotalUploadSizePerDay: 5000,
            maxIndividualFileSize: 500,
          },
          user: {
            maxFilesPerConversation: 10,
            maxFilesPerDay: 50,
            maxFilesTotal: 1000,
            maxTotalUploadSizePerDay: 500,
            maxIndividualFileSize: 50,
          },
        },
        userExceptions: [],
      });

      // Hiển thị thông báo
      setSuccess(
        'Đã đặt lại cài đặt về mặc định. Nhấn "Lưu cài đặt" để áp dụng.',
      );
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  if (loading) {
    return <div className="file-upload-loading">Đang tải cài đặt...</div>;
  }

  return (
    <div className="file-upload-limits">
      <div className="file-upload-header">
        <div className="file-upload-info">
          <FiInfo />
          <p>
            Thiết lập giới hạn tải file giúp kiểm soát việc sử dụng bộ nhớ, đảm
            bảo dung lượng máy chủ và ngăn chặn lạm dụng. Bạn có thể đặt giới
            hạn chung cho tất cả người dùng hoặc tạo ngoại lệ cho từng người
            dùng cụ thể.
          </p>
        </div>

        <div className="file-upload-actions">
          <button
            className="file-upload-reset-button"
            onClick={resetToDefaults}
          >
            <FiRotateCcw />
            <span>Đặt lại mặc định</span>
          </button>

          <button
            className="file-upload-save-button"
            onClick={saveSettings}
            disabled={saving}
          >
            <FiSave />
            <span>{saving ? "Đang lưu..." : "Lưu cài đặt"}</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {success && <div className="file-upload-success">{success}</div>}
      {error && <div className="file-upload-error">{error}</div>}

      {/* Enable/Disable Toggle */}
      <div className="file-upload-toggle-section">
        <label className="file-upload-checkbox-label">
          <input
            type="checkbox"
            name="enabled"
            checked={settings.enabled}
            onChange={handleSettingChange}
          />
          <span>Kích hoạt giới hạn tải file</span>
        </label>
        {!settings.enabled && (
          <p className="file-upload-disabled-notice">
            Giới hạn tải file hiện đang bị vô hiệu hóa
          </p>
        )}
      </div>

      {/* Default Limits Section */}
      <div className="file-upload-section">
        <h3>
          <FiUsers /> Giới hạn mặc định
        </h3>
        <p className="file-upload-section-desc">
          Các giới hạn này sẽ được áp dụng cho tất cả người dùng không có ngoại
          lệ
        </p>
        <div className="file-upload-grid">
          <div
            className={`file-upload-field ${hasFieldError(settings.defaultLimits, "maxFilesPerConversation") ? "error" : ""}`}
          >
            <label>Số file tối đa mỗi hội thoại</label>
            <input
              type="number"
              name="defaultLimits.maxFilesPerConversation"
              value={settings.defaultLimits?.maxFilesPerConversation || 0}
              onChange={handleSettingChange}
              disabled={!settings.enabled}
            />
          </div>
          <div
            className={`file-upload-field ${hasFieldError(settings.defaultLimits, "maxFilesPerDay") ? "error" : ""}`}
          >
            <label>Số file tối đa mỗi ngày</label>
            <input
              type="number"
              name="defaultLimits.maxFilesPerDay"
              value={settings.defaultLimits?.maxFilesPerDay || 0}
              onChange={handleSettingChange}
              disabled={!settings.enabled}
            />
          </div>
          <div
            className={`file-upload-field ${hasFieldError(settings.defaultLimits, "maxFilesTotal") ? "error" : ""}`}
          >
            <label>Số file tối đa trong hệ thống</label>
            <input
              type="number"
              name="defaultLimits.maxFilesTotal"
              value={settings.defaultLimits?.maxFilesTotal || 0}
              onChange={handleSettingChange}
              disabled={!settings.enabled}
            />
          </div>
          <div className="file-upload-field">
            <label>Dung lượng tối đa mỗi ngày (MB)</label>
            <input
              type="number"
              name="defaultLimits.maxTotalUploadSizePerDay"
              value={settings.defaultLimits?.maxTotalUploadSizePerDay || 0}
              onChange={handleSettingChange}
              disabled={!settings.enabled}
            />
          </div>
          <div className="file-upload-field">
            <label>Kích thước file tối đa (MB)</label>
            <input
              type="number"
              name="defaultLimits.maxIndividualFileSize"
              value={settings.defaultLimits?.maxIndividualFileSize || 0}
              onChange={handleSettingChange}
              disabled={!settings.enabled}
            />
          </div>
        </div>
      </div>

      {/* Role-based Limits Section */}
      <div className="file-upload-section">
        <h3>
          <FiAlertCircle /> Giới hạn theo vai trò
        </h3>
        <p className="file-upload-section-desc">
          Thiết lập giới hạn khác nhau cho các vai trò khác nhau
        </p>

        {/* Admin Role */}
        <div className="file-upload-role-subsection">
          <h4>Quản trị viên (Admin)</h4>
          <div className="file-upload-grid">
            <div
              className={`file-upload-field ${hasFieldError(settings.roleLimits?.admin, "maxFilesPerConversation") ? "error" : ""}`}
            >
              <label>Số file tối đa mỗi hội thoại</label>
              <input
                type="number"
                name="roleLimits.admin.maxFilesPerConversation"
                value={settings.roleLimits?.admin?.maxFilesPerConversation || 0}
                onChange={handleSettingChange}
                disabled={!settings.enabled}
              />
            </div>
            <div
              className={`file-upload-field ${hasFieldError(settings.roleLimits?.admin, "maxFilesPerDay") ? "error" : ""}`}
            >
              <label>Số file tối đa mỗi ngày</label>
              <input
                type="number"
                name="roleLimits.admin.maxFilesPerDay"
                value={settings.roleLimits?.admin?.maxFilesPerDay || 0}
                onChange={handleSettingChange}
                disabled={!settings.enabled}
              />
            </div>
            <div
              className={`file-upload-field ${hasFieldError(settings.roleLimits?.admin, "maxFilesTotal") ? "error" : ""}`}
            >
              <label>Số file tối đa trong hệ thống</label>
              <input
                type="number"
                name="roleLimits.admin.maxFilesTotal"
                value={settings.roleLimits?.admin?.maxFilesTotal || 0}
                onChange={handleSettingChange}
                disabled={!settings.enabled}
              />
            </div>
            <div className="file-upload-field">
              <label>Dung lượng tối đa mỗi ngày (MB)</label>
              <input
                type="number"
                name="roleLimits.admin.maxTotalUploadSizePerDay"
                value={
                  settings.roleLimits?.admin?.maxTotalUploadSizePerDay || 0
                }
                onChange={handleSettingChange}
                disabled={!settings.enabled}
              />
            </div>
            <div className="file-upload-field">
              <label>Kích thước file tối đa (MB)</label>
              <input
                type="number"
                name="roleLimits.admin.maxIndividualFileSize"
                value={settings.roleLimits?.admin?.maxIndividualFileSize || 0}
                onChange={handleSettingChange}
                disabled={!settings.enabled}
              />
            </div>
          </div>
        </div>

        {/* User Role */}
        <div className="file-upload-role-subsection">
          <h4>Người dùng thường (User)</h4>
          <div className="file-upload-grid">
            <div
              className={`file-upload-field ${hasFieldError(settings.roleLimits?.user, "maxFilesPerConversation") ? "error" : ""}`}
            >
              <label>Số file tối đa mỗi hội thoại</label>
              <input
                type="number"
                name="roleLimits.user.maxFilesPerConversation"
                value={settings.roleLimits?.user?.maxFilesPerConversation || 0}
                onChange={handleSettingChange}
                disabled={!settings.enabled}
              />
            </div>
            <div
              className={`file-upload-field ${hasFieldError(settings.roleLimits?.user, "maxFilesPerDay") ? "error" : ""}`}
            >
              <label>Số file tối đa mỗi ngày</label>
              <input
                type="number"
                name="roleLimits.user.maxFilesPerDay"
                value={settings.roleLimits?.user?.maxFilesPerDay || 0}
                onChange={handleSettingChange}
                disabled={!settings.enabled}
              />
            </div>
            <div
              className={`file-upload-field ${hasFieldError(settings.roleLimits?.user, "maxFilesTotal") ? "error" : ""}`}
            >
              <label>Số file tối đa trong hệ thống</label>
              <input
                type="number"
                name="roleLimits.user.maxFilesTotal"
                value={settings.roleLimits?.user?.maxFilesTotal || 0}
                onChange={handleSettingChange}
                disabled={!settings.enabled}
              />
            </div>
            <div className="file-upload-field">
              <label>Dung lượng tối đa mỗi ngày (MB)</label>
              <input
                type="number"
                name="roleLimits.user.maxTotalUploadSizePerDay"
                value={settings.roleLimits?.user?.maxTotalUploadSizePerDay || 0}
                onChange={handleSettingChange}
                disabled={!settings.enabled}
              />
            </div>
            <div className="file-upload-field">
              <label>Kích thước file tối đa (MB)</label>
              <input
                type="number"
                name="roleLimits.user.maxIndividualFileSize"
                value={settings.roleLimits?.user?.maxIndividualFileSize || 0}
                onChange={handleSettingChange}
                disabled={!settings.enabled}
              />
            </div>
          </div>
        </div>
      </div>

      {/* User Exceptions Section */}
      <div className="file-upload-section">
        <div className="file-upload-section-header">
          <h3>
            <FiUsers /> Ngoại lệ người dùng
          </h3>
          <button className="file-upload-add-button" onClick={addUserException}>
            <FiPlus />
            <span>Thêm ngoại lệ</span>
          </button>
        </div>
        <p className="file-upload-section-desc">
          Đặt giới hạn tải file tùy chỉnh cho từng người dùng cụ thể
        </p>

        {settings.userExceptions && settings.userExceptions.length > 0 ? (
          <div className="file-upload-exceptions-list">
            {settings.userExceptions.map((exception, index) => (
              <div key={index} className="file-upload-exception-item">
                <div className="file-upload-exception-header">
                  <input
                    type="text"
                    placeholder="Tên người dùng"
                    value={exception.username || ""}
                    onChange={(e) =>
                      handleUserExceptionChange(
                        index,
                        "username",
                        e.target.value,
                      )
                    }
                    disabled={!settings.enabled}
                    className="file-upload-username-input"
                  />
                  <button
                    className="file-upload-delete-button"
                    onClick={() => removeUserException(index)}
                  >
                    <FiTrash2 />
                  </button>
                </div>

                <div className="file-upload-grid">
                  <div
                    className={`file-upload-field ${hasFieldError(exception, "maxFilesPerConversation") ? "error" : ""}`}
                  >
                    <label>Số file tối đa/hội thoại</label>
                    <input
                      type="number"
                      value={exception.maxFilesPerConversation || 0}
                      onChange={(e) =>
                        handleUserExceptionChange(
                          index,
                          "maxFilesPerConversation",
                          e.target.value,
                        )
                      }
                      disabled={!settings.enabled}
                    />
                  </div>
                  <div
                    className={`file-upload-field ${hasFieldError(exception, "maxFilesPerDay") ? "error" : ""}`}
                  >
                    <label>Số file tối đa/ngày</label>
                    <input
                      type="number"
                      value={exception.maxFilesPerDay || 0}
                      onChange={(e) =>
                        handleUserExceptionChange(
                          index,
                          "maxFilesPerDay",
                          e.target.value,
                        )
                      }
                      disabled={!settings.enabled}
                    />
                  </div>
                  <div
                    className={`file-upload-field ${hasFieldError(exception, "maxFilesTotal") ? "error" : ""}`}
                  >
                    <label>Số file tối đa trong hệ thống</label>
                    <input
                      type="number"
                      value={exception.maxFilesTotal || 0}
                      onChange={(e) =>
                        handleUserExceptionChange(
                          index,
                          "maxFilesTotal",
                          e.target.value,
                        )
                      }
                      disabled={!settings.enabled}
                    />
                  </div>
                  <div className="file-upload-field">
                    <label>Dung lượng tối đa/ngày (MB)</label>
                    <input
                      type="number"
                      value={exception.maxTotalUploadSizePerDay || 0}
                      onChange={(e) =>
                        handleUserExceptionChange(
                          index,
                          "maxTotalUploadSizePerDay",
                          e.target.value,
                        )
                      }
                      disabled={!settings.enabled}
                    />
                  </div>
                  <div className="file-upload-field">
                    <label>Kích thước file tối đa (MB)</label>
                    <input
                      type="number"
                      value={exception.maxIndividualFileSize || 0}
                      onChange={(e) =>
                        handleUserExceptionChange(
                          index,
                          "maxIndividualFileSize",
                          e.target.value,
                        )
                      }
                      disabled={!settings.enabled}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="file-upload-empty-message">
            <p>
              Chưa có ngoại lệ nào. Nhấn "Thêm ngoại lệ" để tạo giới hạn tùy
              chỉnh cho một người dùng cụ thể.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploadLimits;
