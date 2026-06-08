import constants from "../utils/constants";
import * as jwtHelper from "../utils/jwtHelper";
import httpClient from "../utils/httpClient";

const { API_BASE_URL, API_ENDPOINTS } = constants;

class AuthService {
  async register(userData) {
    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.CREATE_USER}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: userData.username,
            email: userData.email,
            password: userData.password,
            student_code: userData.studentCode,
            student_name: userData.studentName,
            student_class: userData.studentClass,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || "Đăng ký thất bại");
      }

      return {
        success: true,
        data: data.data,
        message: data.message || "Đăng ký thành công",
      };
    } catch (error) {
      console.error("Register error:", error);
      return {
        success: false,
        error: error.message || "Lỗi kết nối server",
      };
    }
  }

  async login(credentials) {
    try {
      console.log("Login endpoint:", `${API_BASE_URL}${API_ENDPOINTS.LOGIN}`);
      console.log("Login payload:", {
        username: credentials.username,
        password: credentials.password,
      });

      // FormData đối với OAuth2PasswordRequestForm
      const formData = new URLSearchParams();
      formData.append("username", credentials.username);
      formData.append("password", credentials.password);

      // Sử dụng fetch trực tiếp vì đây là endpoint login đặc biệt
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.LOGIN}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      const result = await response.json();
      console.log("Login response:", result);

      if (!response.ok) {
        throw new Error(
          result.detail ||
            result.message ||
            "Tên đăng nhập hoặc mật khẩu không đúng"
        );
      }

      // Kiểm tra dữ liệu trả về
      const data = result.data;
      if (!data) {
        throw new Error("No data in login response");
      }

      // Lưu JWT tokens
      console.log("Saving tokens from login response");
      jwtHelper.saveTokens(data.access_token, data.refresh_token);

      // Debug token info
      try {
        const payload = JSON.parse(atob(data.access_token.split(".")[1]));
        console.log("Token payload:", payload);
        console.log(
          "Token expiry:",
          new Date(payload.exp * 1000).toLocaleString()
        );
      } catch (e) {
        console.error("Error decoding token", e);
      }

      // Lấy thông tin người dùng từ API (sẽ sử dụng httpClient với khả năng refresh token)
      const userResponse = await this.getCurrentUserInfo();

      if (!userResponse.success) {
        throw new Error("Không thể lấy thông tin người dùng");
      }

      const user = userResponse.data;
      const userId = user._id;

      if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
        console.error("User response data:", user);
        throw new Error("Invalid or missing user ID in user response");
      }

      // Lấy role từ response nếu có, nếu không thì kiểm tra bằng username
      let userRole = user.role;

      // Fallback nếu API không trả về role
      if (!userRole) {
        // Check if user is admin (mocked for development)
        const isAdmin =
          user.username === "admin" ||
          user.username === "root" ||
          user.email === "admin@kma.edu.vn";

        userRole = isAdmin ? "admin" : "user";
        console.log(
          "Role not provided by API, using fallback detection:",
          userRole
        );
      }

      const userInfo = {
        id: userId,
        username: user.username,
        name: user.student_name || user.username,
        studentCode: user.student_code,
        studentClass: user.student_class,
        role: userRole,
        loginTime: new Date().toISOString(),
        email: user.email,
      };

      // Lưu thông tin user vào localStorage
      localStorage.setItem("userInfo", JSON.stringify(userInfo));
      localStorage.setItem("isLoggedIn", "true");

      console.log("Stored userInfo:", userInfo);

      return {
        success: true,
        data: userInfo,
        message: "Đăng nhập thành công",
      };
    } catch (error) {
      console.error("Login error:", error.message);
      return {
        success: false,
        error: error.message || "Lỗi kết nối server",
      };
    }
  }

  logout() {
    try {
      // Xóa JWT tokens
      jwtHelper.removeTokens();

      // Xóa thông tin người dùng
      localStorage.removeItem("userInfo");
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("chatHistory");

      return {
        success: true,
        message: "Đăng xuất thành công",
      };
    } catch (error) {
      console.error("Logout error:", error);
      return {
        success: false,
        error: "Lỗi khi đăng xuất",
      };
    }
  }

  isAuthenticated() {
    try {
      const isLoggedIn = localStorage.getItem("isLoggedIn");
      const userInfo = localStorage.getItem("userInfo");
      const accessToken = jwtHelper.getAccessToken();

      // Kiểm tra cả token và userInfo
      return (
        isLoggedIn === "true" &&
        userInfo !== null &&
        accessToken !== null &&
        !jwtHelper.isTokenExpired(accessToken)
      );
    } catch (error) {
      console.error("Auth check error:", error);
      return false;
    }
  }

  getCurrentUser() {
    try {
      const userInfo = localStorage.getItem("userInfo");
      const user = userInfo ? JSON.parse(userInfo) : null;
      console.log("Current user:", user);
      if (user && !user.id) {
        console.error("User object missing id field");
      }
      return user;
    } catch (error) {
      console.error("Get current user error:", error);
      return null;
    }
  }

  async getCurrentUserInfo() {
    try {
      console.group("getCurrentUserInfo Debug");
      const accessToken = jwtHelper.getAccessToken();

      console.log("Access Token exists:", !!accessToken);
      if (accessToken) {
        try {
          const payload = JSON.parse(atob(accessToken.split(".")[1]));
          console.log("Token payload:", payload);
          console.log(
            "Token expiry:",
            new Date(payload.exp * 1000).toLocaleString()
          );
          console.log("Is expired:", jwtHelper.isTokenExpired(accessToken));
        } catch (e) {
          console.error("Error decoding token", e);
        }
      }

      if (!accessToken) {
        console.log("No access token found");
        console.groupEnd();
        return {
          success: false,
          error: "Không có token đăng nhập",
        };
      }

      // Sử dụng httpClient để tự động xử lý refresh token nếu cần
      console.log("Calling GET_ME endpoint:", API_ENDPOINTS.GET_ME);
      const result = await httpClient.get(API_ENDPOINTS.GET_ME);
      console.log("GET_ME response:", result);
      console.groupEnd();

      return {
        success: true,
        data: result.data,
        message: result.message || "Lấy thông tin người dùng thành công",
      };
    } catch (error) {
      console.error("Get user info error:", error);
      return {
        success: false,
        error: error.message || "Lỗi khi lấy thông tin người dùng",
      };
    }
  }

  async refreshToken() {
    try {
      const refreshToken = jwtHelper.getRefreshToken();

      if (!refreshToken) {
        console.error("No refresh token available");
        return {
          success: false,
          error: "Không có refresh token",
        };
      }

      console.log("Refreshing token...");

      // Sử dụng fetch trực tiếp thay vì httpClient để tránh vòng lặp
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.REFRESH_TOKEN}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || errorData.message || "Không thể làm mới token"
        );
      }

      const result = await response.json();

      if (!result.data || !result.data.access_token) {
        throw new Error("Invalid response format from refresh token endpoint");
      }

      console.log("Token refreshed successfully");

      // Lưu tokens mới
      jwtHelper.saveTokens(result.data.access_token, result.data.refresh_token);

      return {
        success: true,
        data: {
          access_token: result.data.access_token,
          refresh_token: result.data.refresh_token,
        },
        message: "Làm mới token thành công",
      };
    } catch (error) {
      console.error("Refresh token error:", error);
      return {
        success: false,
        error: error.message || "Lỗi khi làm mới token",
      };
    }
  }

  async updateUser(userData) {
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        throw new Error("Chưa đăng nhập");
      }

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.GET_USER}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_code: currentUser.studentCode,
          ...userData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Cập nhật thất bại");
      }

      const updatedUser = {
        ...currentUser,
        ...userData,
      };
      localStorage.setItem("userInfo", JSON.stringify(updatedUser));

      return {
        success: true,
        data: updatedUser,
        message: "Cập nhật thành công",
      };
    } catch (error) {
      console.error("Update user error:", error);
      return {
        success: false,
        error: error.message || "Lỗi kết nối server",
      };
    }
  }

  async checkConnection() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch (error) {
      console.error("Connection check error:", error);
      return false;
    }
  }
}

const authService = new AuthService();
export default authService;
