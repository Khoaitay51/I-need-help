import React, { useState, useEffect } from "react";
import "./Login.css";
import LoginAppBar from "./LoginAppBar";
import authService from "../services/authService";
import { useLocation } from "react-router-dom";

// ---- SVG Icons for Social Login ----
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="#333">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const Login = ({
  onLogin,
  adminMode = false,
  initialMode,
  onBackToLanding,
}) => {
  const [isLoginMode, setIsLoginMode] = useState(
    initialMode === "register" ? false : true
  );
  const [isAdminMode, setIsAdminMode] = useState(adminMode);
  const location = useLocation();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    studentCode: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Kiểm tra nếu đang ở trang admin từ URL
  useEffect(() => {
    const path = location?.pathname || "";
    if (path.includes("/admin") || adminMode) {
      setIsAdminMode(true);
      setIsLoginMode(true);
    } else {
      setIsAdminMode(false);
    }
  }, [location, adminMode]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (isLoginMode) {
        if (!formData.username?.trim() || !formData.password?.trim()) {
          setError("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu");
          setIsLoading(false);
          return;
        }

        const result = await authService.login({
          username: formData.username.trim(),
          password: formData.password,
        });

        if (result.success) {
          const user = result.data;
          if (isAdminMode && user.role !== "admin") {
            setError("Bạn không có quyền truy cập vào trang quản trị");
            setIsLoading(false);
            return;
          }
          onLogin(user);
        } else {
          setError(result.error);
        }
      } else {
        if (
          !formData.username?.trim() ||
          !formData.email?.trim() ||
          !formData.password?.trim() ||
          !formData.confirmPassword?.trim()
        ) {
          setError("Vui lòng điền đầy đủ thông tin bắt buộc");
          setIsLoading(false);
          return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          setError("Địa chỉ email không hợp lệ");
          setIsLoading(false);
          return;
        }
        const studentCodeRegex = /^[ACDMT]T\d{6}$/i;
        if (
          formData.studentCode?.trim() &&
          !studentCodeRegex.test(formData.studentCode.trim())
        ) {
          setError("Mã sinh viên không hợp lệ. Ví dụ: AT170001");
          setIsLoading(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setError("Mật khẩu xác nhận không khớp");
          setIsLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          setError("Mật khẩu phải có ít nhất 6 ký tự");
          setIsLoading(false);
          return;
        }

        const result = await authService.register({
          username: formData.username,
          email: formData.email,
          studentCode: formData.studentCode.trim()
            ? formData.studentCode.trim().toUpperCase()
            : undefined,
          password: formData.password,
        });

        if (result.success) {
          setFormData({
            username: "",
            email: "",
            studentCode: "",
            password: "",
            confirmPassword: "",
          });
          setIsLoginMode(true);
          setError("");
          alert(
            "Đăng ký thành công! Hãy đăng nhập với tài khoản vừa tạo."
          );
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("Có lỗi xảy ra. Vui lòng thử lại sau.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    if (isAdminMode) return;
    setIsLoginMode(!isLoginMode);
    setFormData({
      username: "",
      email: "",
      studentCode: "",
      password: "",
      confirmPassword: "",
    });
    setError("");
  };

  const handleSocialLogin = (provider) => {
    // Placeholder — cần tích hợp OAuth thực tế
    alert(
      `Tính năng đăng nhập bằng ${provider} đang được phát triển. Vui lòng sử dụng tài khoản hệ thống.`
    );
  };

  return (
    <div className="login-page">
      <LoginAppBar onBackToLanding={onBackToLanding} />

      {/* Background orbs */}
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />

      <div className="login-container">
        <div className="login-card">
          {/* Logo */}
          <div className="login-logo-area">
            <div className="login-logo-icon">
              <img src="/img/kma.png" alt="Logo Học viện Kỹ thuật Mật mã" />
            </div>
          </div>

          {/* Header */}
          <div className="login-header">
            <h2 className="login-title">
              {isAdminMode
                ? "Đăng nhập quản trị"
                : isLoginMode
                ? "Chào mừng trở lại!"
                : "Tạo tài khoản mới"}
            </h2>
            <p className="login-subtitle">
              {isAdminMode
                ? "Quản trị hệ thống ACTVN-AGENT"
                : isLoginMode
                ? "Đăng nhập để sử dụng trợ lý ảo ACTVN-AGENT"
                : "Đăng ký để bắt đầu trải nghiệm AI Chatbot"}
            </p>
          </div>

          {/* Social Login — chỉ hiện khi không phải admin */}
          {!isAdminMode && (
            <>
              <div className="social-login-section">
                <div className="social-btn-group">
                  <button
                    type="button"
                    className="social-btn social-btn-google"
                    onClick={() => handleSocialLogin("Google")}
                  >
                    <GoogleIcon />
                    {isLoginMode
                      ? "Đăng nhập với Google"
                      : "Đăng ký với Google"}
                  </button>
                  <button
                    type="button"
                    className="social-btn social-btn-github"
                    onClick={() => handleSocialLogin("GitHub")}
                  >
                    <GitHubIcon />
                    {isLoginMode
                      ? "Đăng nhập với GitHub"
                      : "Đăng ký với GitHub"}
                  </button>
                </div>
              </div>

              <div className="auth-divider">
                <div className="auth-divider-line" />
                <span className="auth-divider-text">hoặc</span>
                <div className="auth-divider-line" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Tên đăng nhập
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username || ""}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Nhập tên đăng nhập..."
                required
                autoComplete="username"
              />
            </div>

            {!isLoginMode && (
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email || ""}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Nhập địa chỉ email..."
                  required={!isLoginMode}
                  autoComplete="email"
                />
              </div>
            )}

            {!isLoginMode && (
              <div className="form-group">
                <label htmlFor="studentCode" className="form-label">
                  Mã sinh viên{" "}
                  <span className="form-label-optional">(không bắt buộc)</span>
                </label>
                <input
                  type="text"
                  id="studentCode"
                  name="studentCode"
                  value={formData.studentCode || ""}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Ví dụ: AT170001"
                  autoComplete="off"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Mật khẩu
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password || ""}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Nhập mật khẩu..."
                required
                autoComplete={isLoginMode ? "current-password" : "new-password"}
              />
            </div>

            {!isLoginMode && (
              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Xác nhận mật khẩu
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword || ""}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Nhập lại mật khẩu..."
                  required={!isLoginMode}
                  autoComplete="new-password"
                />
              </div>
            )}

            <button
              type="submit"
              className={`login-button ${isLoading ? "loading" : ""}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner" />
                  {isLoginMode ? "Đang đăng nhập..." : "Đang đăng ký..."}
                </>
              ) : isLoginMode ? (
                "Đăng nhập"
              ) : (
                "Tạo tài khoản"
              )}
            </button>
          </form>

          {/* Form Switch */}
          <div className="form-switch">
            {!isAdminMode && (
              <p>
                {isLoginMode
                  ? "Chưa có tài khoản?"
                  : "Đã có tài khoản?"}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="switch-mode-btn"
                >
                  {isLoginMode ? "Đăng ký ngay" : "Đăng nhập"}
                </button>
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="login-footer">
            <p className="help-text">
              Cần hỗ trợ? Liên hệ:
              <a
                href="mailto:ductrongbui1213@gmail.com"
                className="help-link"
              >
                ductrongbui1213@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
