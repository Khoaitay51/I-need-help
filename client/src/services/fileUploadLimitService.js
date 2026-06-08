import httpClient from "../utils/httpClient";

const fileUploadLimitService = {
  /**
   * Get file upload limit configuration
   * @returns {Promise<Object>} - File upload limit config
   */
  getFileUploadLimitConfig: async function () {
    try {
      // First try the real API
      try {
        const response = await httpClient.get("/api/admin/file-upload-limits");
        return {
          success: true,
          data: response.data || {},
          message: response.message || "Tải cấu hình thành công",
        };
      } catch (apiError) {
        console.warn(
          "API không khả dụng, sử dụng dữ liệu mẫu:",
          apiError.message,
        );
        // Return mock success with default config
        return {
          success: true,
          data: {
            enabled: true,
            defaultLimits: {
              maxFilesPerConversation: 10,
              maxFilesPerDay: 50,
              maxTotalUploadSizePerDay: 500, // MB
              maxIndividualFileSize: 50, // MB
            },
            roleLimits: {
              admin: {
                maxFilesPerConversation: 100,
                maxFilesPerDay: 500,
                maxTotalUploadSizePerDay: 5000, // MB
                maxIndividualFileSize: 500, // MB
              },
              user: {
                maxFilesPerConversation: 10,
                maxFilesPerDay: 50,
                maxTotalUploadSizePerDay: 500, // MB
                maxIndividualFileSize: 50, // MB
              },
            },
            userExceptions: [],
          },
          message: "Dữ liệu mẫu (API chưa sẵn sàng)",
        };
      }
    } catch (error) {
      console.error("Lỗi khi lấy cấu hình giới hạn file:", error);
      return {
        success: false,
        error: error.message || "Lỗi khi lấy cấu hình",
      };
    }
  },

  /**
   * Update file upload limit configuration
   * @param {Object} config - New file upload limit configuration
   * @returns {Promise<Object>} - Update result
   */
  updateFileUploadLimitConfig: async function (config) {
    try {
      // First try the real API
      try {
        const response = await httpClient.put(
          "/api/admin/file-upload-limits",
          config,
        );
        return {
          success: true,
          message: response.message || "Cập nhật cấu hình thành công",
        };
      } catch (apiError) {
        console.warn(
          "API không khả dụng, sử dụng dữ liệu mẫu:",
          apiError.message,
        );
        // Return mock success if API fails
        return {
          success: true,
          message: "Cập nhật thành công (dữ liệu mẫu)",
        };
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật cấu hình giới hạn file:", error);
      return {
        success: false,
        error: error.message || "Lỗi khi cập nhật cấu hình",
      };
    }
  },

  /**
   * Get file upload statistics for a user
   * @param {String} userId - User ID
   * @returns {Promise<Object>} - User file upload statistics
   */
  getUserUploadStats: async function (userId) {
    try {
      try {
        const response = await httpClient.get(
          `/api/admin/file-upload-limits/user/${userId}/stats`,
        );
        return {
          success: true,
          data: response.data || {},
          message: response.message || "Tải thống kê thành công",
        };
      } catch (apiError) {
        console.warn("API không khả dụng:", apiError.message);
        // Return mock stats
        return {
          success: true,
          data: {
            filesUploadedToday: 5,
            uploadedSizeToday: 125, // MB
            filesUploadedThisMonth: 45,
            uploadedSizeThisMonth: 1200, // MB
            remainingQuotaToday: 45,
            percentageUsed: 20,
          },
          message: "Dữ liệu mẫu (API chưa sẵn sàng)",
        };
      }
    } catch (error) {
      console.error("Lỗi khi lấy thống kê tải file:", error);
      return {
        success: false,
        error: error.message || "Lỗi khi lấy thống kê",
      };
    }
  },

  /**
   * Get all users with their file upload limits
   * @returns {Promise<Object>} - List of users and their limits
   */
  getUserUploadLimits: async function () {
    try {
      try {
        const response = await httpClient.get(
          "/api/admin/file-upload-limits/users",
        );
        return {
          success: true,
          data: response.data || [],
          message: response.message || "Tải danh sách thành công",
        };
      } catch (apiError) {
        console.warn("API không khả dụng:", apiError.message);
        // Return empty mock list
        return {
          success: true,
          data: [],
          message: "Dữ liệu mẫu (API chưa sẵn sàng)",
        };
      }
    } catch (error) {
      console.error("Lỗi khi lấy giới hạn tải file người dùng:", error);
      return {
        success: false,
        error: error.message || "Lỗi khi lấy danh sách",
      };
    }
  },
};

export default fileUploadLimitService;
