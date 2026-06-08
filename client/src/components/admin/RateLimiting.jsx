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
import "./RateLimiting.css";
import rateLimitService from "../../services/rateLimitService";

const RateLimiting = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const [settings, setSettings] = useState({
    enabled: true,
    defaultLimits: {
      requestsPerMinute: 10,
      requestsPerHour: 100,
      requestsPerDay: 500,
      tokensPerDay: 50000,
      tokensPerMonth: 500000,
    },
    roleLimits: {
      admin: {
        requestsPerMinute: 30,
        requestsPerHour: 300,
        requestsPerDay: 1000,
        tokensPerDay: 200000,
        tokensPerMonth: 2000000,
      },
      user: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        requestsPerDay: 500,
        tokensPerDay: 50000,
        tokensPerMonth: 500000,
      },
    },
    userExceptions: [],
  });

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const response = await rateLimitService.getRateLimitConfig();
        if (response.success) {
          const configData = response.data || {};
          const completeSettings = {
            enabled:
              configData.enabled !== undefined ? configData.enabled : true,
            defaultLimits: {
              requestsPerMinute: 10,
              requestsPerHour: 100,
              requestsPerDay: 500,
              tokensPerDay: 50000,
              tokensPerMonth: 500000,
              ...(configData.defaultLimits || {}),
            },
            roleLimits: {
              admin: {
                requestsPerMinute: 30,
                requestsPerHour: 300,
                requestsPerDay: 1000,
                tokensPerDay: 200000,
                tokensPerMonth: 2000000,
                ...(configData.roleLimits?.admin || {}),
              },
              user: {
                requestsPerMinute: 10,
                requestsPerHour: 100,
                requestsPerDay: 500,
                tokensPerDay: 50000,
                tokensPerMonth: 500000,
                ...(configData.roleLimits?.user || {}),
              },
            },
            userExceptions: configData.userExceptions || [],
          };
          setSettings(completeSettings);
          setError(null);
        } else {
          setError("Không thể tải cài đặt giới hạn tốc độ: " + response.error);
        }
      } catch (err) {
        console.error("Error fetching rate limit settings:", err);
        setError("Đã xảy ra lỗi khi tải cài đặt giới hạn tốc độ");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleRateLimitChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "enabled") {
      setSettings((prev) => ({
        ...prev,
        enabled: checked,
      }));
      return;
    }

    const path = name.split(".");
    setSettings((prev) => {
      const newSettings = { ...prev };
      let current = newSettings;

      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) {
          current[path[i]] = {};
        }
        current = current[path[i]];
      }

      current[path[path.length - 1]] =
        type === "number" ? parseInt(value, 10) : value;
      return newSettings;
    });
  };

  const handleUserExceptionChange = (index, field, value) => {
    setSettings((prev) => {
      const newSettings = { ...prev };
      if (!newSettings.userExceptions) {
        newSettings.userExceptions = [];
      }
      if (!newSettings.userExceptions[index]) {
        newSettings.userExceptions[index] = {
          username: "",
          requestsPerMinute: newSettings.defaultLimits?.requestsPerMinute || 10,
          requestsPerHour: newSettings.defaultLimits?.requestsPerHour || 100,
          requestsPerDay: newSettings.defaultLimits?.requestsPerDay || 500,
          tokensPerDay: newSettings.defaultLimits?.tokensPerDay || 50000,
          tokensPerMonth: newSettings.defaultLimits?.tokensPerMonth || 500000,
        };
      }

      newSettings.userExceptions[index][field] =
        field === "username" ? value : parseInt(value, 10);
      return newSettings;
    });
  };

  const addUserException = () => {
    setSettings((prev) => {
      const defaultLimits = prev.defaultLimits || {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        requestsPerDay: 500,
        tokensPerDay: 50000,
        tokensPerMonth: 500000,
      };

      return {
        ...prev,
        userExceptions: [
          ...(prev.userExceptions || []),
          {
            username: "",
            requestsPerMinute: defaultLimits.requestsPerMinute,
            requestsPerHour: defaultLimits.requestsPerHour,
            requestsPerDay: defaultLimits.requestsPerDay,
            tokensPerDay: defaultLimits.tokensPerDay,
            tokensPerMonth: defaultLimits.tokensPerMonth,
          },
        ],
      };
    });
  };

  const removeUserException = (index) => {
    setSettings((prev) => {
      const newSettings = { ...prev };
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

  const saveSettings = async () => {
    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      const response = await rateLimitService.updateRateLimitConfig(settings);

      if (response.success) {
        setSuccess("Cài đặt đã được lưu thành công");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Đã xảy ra lỗi khi lưu cài đặt: " + response.error);
      }
    } catch (err) {
      console.error("Error saving rate limit settings:", err);
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
          requestsPerMinute: 10,
          requestsPerHour: 100,
          requestsPerDay: 500,
          tokensPerDay: 50000,
          tokensPerMonth: 500000,
        },
        roleLimits: {
          admin: {
            requestsPerMinute: 30,
            requestsPerHour: 300,
            requestsPerDay: 1000,
            tokensPerDay: 200000,
            tokensPerMonth: 2000000,
          },
          user: {
            requestsPerMinute: 10,
            requestsPerHour: 100,
            requestsPerDay: 500,
            tokensPerDay: 50000,
            tokensPerMonth: 500000,
          },
        },
        userExceptions: [],
      });

      setSuccess(
        'Đã đặt lại cài đặt về mặc định. Nhấn "Lưu cài đặt" để áp dụng.',
      );
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  if (loading) {
    return <div className="rate-loading">Đang tải cài đặt...</div>;
  }

  return (
    <div className="rate-limiting">
      <div className="rate-header">
        <div className="rate-info">
          <FiInfo />
          <p>
            Cài đặt giới hạn tốc độ giúp bảo vệ hệ thống, kiểm soát việc sử dụng
            tài nguyên và đảm bảo trải nghiệm công bằng cho tất cả người dùng.
          </p>
        </div>

        <div className="rate-actions">
          <button className="reset-button" onClick={resetToDefaults}>
            <FiRotateCcw />
            <span>Đặt lại mặc định</span>
          </button>

          <button
            className="save-button"
            onClick={saveSettings}
            disabled={saving}
          >
            <FiSave />
            <span>{saving ? "Đang lưu..." : "Lưu cài đặt"}</span>
          </button>
        </div>
      </div>

      {success && <div className="rate-success">{success}</div>}
      {error && <div className="rate-error">{error}</div>}

      {/* Enable/Disable Toggle */}
      <div className="rate-toggle-section">
        <label className="rate-checkbox-label">
          <input
            type="checkbox"
            name="enabled"
            checked={settings.enabled}
            onChange={handleRateLimitChange}
          />
          <span>Kích hoạt giới hạn tốc độ</span>
        </label>
        {!settings.enabled && (
          <p className="rate-disabled-notice">
            Giới hạn tốc độ hiện đang bị vô hiệu hóa
          </p>
        )}
      </div>

      {/* Default Limits Section */}
      <div className="rate-section">
        <h3>
          <FiUsers /> Giới hạn mặc định
        </h3>
        <p className="rate-section-desc">
          Các giới hạn này sẽ được áp dụng cho tất cả người dùng không có ngoại
          lệ
        </p>
        <div className="rate-grid">
          <div className="rate-field">
            <label>Yêu cầu/phút</label>
            <input
              type="number"
              name="defaultLimits.requestsPerMinute"
              value={settings.defaultLimits?.requestsPerMinute || 0}
              onChange={handleRateLimitChange}
              disabled={!settings.enabled}
            />
          </div>
          <div className="rate-field">
            <label>Yêu cầu/giờ</label>
            <input
              type="number"
              name="defaultLimits.requestsPerHour"
              value={settings.defaultLimits?.requestsPerHour || 0}
              onChange={handleRateLimitChange}
              disabled={!settings.enabled}
            />
          </div>
          <div className="rate-field">
            <label>Yêu cầu/ngày</label>
            <input
              type="number"
              name="defaultLimits.requestsPerDay"
              value={settings.defaultLimits?.requestsPerDay || 0}
              onChange={handleRateLimitChange}
              disabled={!settings.enabled}
            />
          </div>
          <div className="rate-field">
            <label>Token/ngày</label>
            <input
              type="number"
              name="defaultLimits.tokensPerDay"
              value={settings.defaultLimits?.tokensPerDay || 0}
              onChange={handleRateLimitChange}
              disabled={!settings.enabled}
            />
          </div>
          <div className="rate-field">
            <label>Token/tháng</label>
            <input
              type="number"
              name="defaultLimits.tokensPerMonth"
              value={settings.defaultLimits?.tokensPerMonth || 0}
              onChange={handleRateLimitChange}
              disabled={!settings.enabled}
            />
          </div>
        </div>
      </div>

      {/* Role-based Limits Section */}
      <div className="rate-section">
        <h3>
          <FiAlertCircle /> Giới hạn theo vai trò
        </h3>
        <p className="rate-section-desc">
          Thiết lập giới hạn khác nhau cho các vai trò khác nhau
        </p>

        {/* Admin Role */}
        <div className="rate-role-subsection">
          <h4>Quản trị viên (Admin)</h4>
          <div className="rate-grid">
            <div className="rate-field">
              <label>Yêu cầu/phút</label>
              <input
                type="number"
                name="roleLimits.admin.requestsPerMinute"
                value={settings.roleLimits?.admin?.requestsPerMinute || 0}
                onChange={handleRateLimitChange}
                disabled={!settings.enabled}
              />
            </div>
            <div className="rate-field">
              <label>Yêu cầu/giờ</label>
              <input
                type="number"
                name="roleLimits.admin.requestsPerHour"
                value={settings.roleLimits?.admin?.requestsPerHour || 0}
                onChange={handleRateLimitChange}
                disabled={!settings.enabled}
              />
            </div>
            <div className="rate-field">
              <label>Yêu cầu/ngày</label>
              <input
                type="number"
                name="roleLimits.admin.requestsPerDay"
                value={settings.roleLimits?.admin?.requestsPerDay || 0}
                onChange={handleRateLimitChange}
                disabled={!settings.enabled}
              />
            </div>
            <div className="rate-field">
              <label>Token/ngày</label>
              <input
                type="number"
                name="roleLimits.admin.tokensPerDay"
                value={settings.roleLimits?.admin?.tokensPerDay || 0}
                onChange={handleRateLimitChange}
                disabled={!settings.enabled}
              />
            </div>
            <div className="rate-field">
              <label>Token/tháng</label>
              <input
                type="number"
                name="roleLimits.admin.tokensPerMonth"
                value={settings.roleLimits?.admin?.tokensPerMonth || 0}
                onChange={handleRateLimitChange}
                disabled={!settings.enabled}
              />
            </div>
          </div>
        </div>

        {/* User Role */}
        <div className="rate-role-subsection">
          <h4>Người dùng thường (User)</h4>
          <div className="rate-grid">
            <div className="rate-field">
              <label>Yêu cầu/phút</label>
              <input
                type="number"
                name="roleLimits.user.requestsPerMinute"
                value={settings.roleLimits?.user?.requestsPerMinute || 0}
                onChange={handleRateLimitChange}
                disabled={!settings.enabled}
              />
            </div>
            <div className="rate-field">
              <label>Yêu cầu/giờ</label>
              <input
                type="number"
                name="roleLimits.user.requestsPerHour"
                value={settings.roleLimits?.user?.requestsPerHour || 0}
                onChange={handleRateLimitChange}
                disabled={!settings.enabled}
              />
            </div>
            <div className="rate-field">
              <label>Yêu cầu/ngày</label>
              <input
                type="number"
                name="roleLimits.user.requestsPerDay"
                value={settings.roleLimits?.user?.requestsPerDay || 0}
                onChange={handleRateLimitChange}
                disabled={!settings.enabled}
              />
            </div>
            <div className="rate-field">
              <label>Token/ngày</label>
              <input
                type="number"
                name="roleLimits.user.tokensPerDay"
                value={settings.roleLimits?.user?.tokensPerDay || 0}
                onChange={handleRateLimitChange}
                disabled={!settings.enabled}
              />
            </div>
            <div className="rate-field">
              <label>Token/tháng</label>
              <input
                type="number"
                name="roleLimits.user.tokensPerMonth"
                value={settings.roleLimits?.user?.tokensPerMonth || 0}
                onChange={handleRateLimitChange}
                disabled={!settings.enabled}
              />
            </div>
          </div>
        </div>
      </div>

      {/* User Exceptions Section */}
      <div className="rate-section">
        <div className="rate-section-header">
          <h3>
            <FiUsers /> Ngoại lệ cho người dùng cụ thể
          </h3>
          <button className="rate-add-button" onClick={addUserException}>
            <FiPlus />
            <span>Thêm ngoại lệ</span>
          </button>
        </div>
        <p className="rate-section-desc">
          Đặt giới hạn tốc độ tùy chỉnh cho từng người dùng cụ thể
        </p>

        {settings.userExceptions && settings.userExceptions.length > 0 ? (
          <div className="rate-exceptions-list">
            {settings.userExceptions.map((exception, index) => (
              <div key={index} className="rate-exception-item">
                <div className="rate-exception-header">
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
                    className="rate-username-input"
                  />
                  <button
                    className="rate-delete-button"
                    onClick={() => removeUserException(index)}
                  >
                    <FiTrash2 />
                  </button>
                </div>

                <div className="rate-grid">
                  <div className="rate-field">
                    <label>Yêu cầu/phút</label>
                    <input
                      type="number"
                      value={exception.requestsPerMinute || 0}
                      onChange={(e) =>
                        handleUserExceptionChange(
                          index,
                          "requestsPerMinute",
                          e.target.value,
                        )
                      }
                      disabled={!settings.enabled}
                    />
                  </div>
                  <div className="rate-field">
                    <label>Yêu cầu/giờ</label>
                    <input
                      type="number"
                      value={exception.requestsPerHour || 0}
                      onChange={(e) =>
                        handleUserExceptionChange(
                          index,
                          "requestsPerHour",
                          e.target.value,
                        )
                      }
                      disabled={!settings.enabled}
                    />
                  </div>
                  <div className="rate-field">
                    <label>Yêu cầu/ngày</label>
                    <input
                      type="number"
                      value={exception.requestsPerDay || 0}
                      onChange={(e) =>
                        handleUserExceptionChange(
                          index,
                          "requestsPerDay",
                          e.target.value,
                        )
                      }
                      disabled={!settings.enabled}
                    />
                  </div>
                  <div className="rate-field">
                    <label>Token/ngày</label>
                    <input
                      type="number"
                      value={exception.tokensPerDay || 0}
                      onChange={(e) =>
                        handleUserExceptionChange(
                          index,
                          "tokensPerDay",
                          e.target.value,
                        )
                      }
                      disabled={!settings.enabled}
                    />
                  </div>
                  <div className="rate-field">
                    <label>Token/tháng</label>
                    <input
                      type="number"
                      value={exception.tokensPerMonth || 0}
                      onChange={(e) =>
                        handleUserExceptionChange(
                          index,
                          "tokensPerMonth",
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
          <div className="rate-empty-message">
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

export default RateLimiting;
