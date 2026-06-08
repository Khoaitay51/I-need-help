import httpClient from "../utils/httpClient";
import constants from "../utils/constants";

// Mock data for development while backend is not ready
const MOCK_DATA = {
  config: {
    roles: {
      user: {
        requests: {
          per_minute: 10,
          per_hour: 100,
          per_day: 500,
        },
        tokens: {
          per_day: 10000,
          per_month: 100000,
        },
      },
      admin: {
        requests: {
          per_minute: 20,
          per_hour: 200,
          per_day: 1000,
        },
        tokens: {
          per_day: 50000,
          per_month: 500000,
        },
      },
    },
    exceptions: [],
  },
  stats: {
    enabled: true,
    usage: {
      requestsPerMinute: 5,
      requestsPerHour: 25,
      requestsPerDay: 120,
      tokensToday: 3500,
      tokensThisMonth: 25000,
      resetTimes: {
        minute: new Date(Date.now() + 30000).toISOString(),
        hour: new Date(Date.now() + 35 * 60000).toISOString(),
        day: new Date(Date.now() + 8 * 3600000).toISOString(),
        month: new Date(Date.now() + 15 * 24 * 3600000).toISOString(),
      },
    },
    limits: {
      requestsPerMinute: 10,
      requestsPerHour: 100,
      requestsPerDay: 500,
      tokensPerDay: 10000,
      tokensPerMonth: 100000,
    },
  },
};

const rateLimitService = {
  /**
   * Get rate limit configuration
   * @returns {Promise<Object>} - Rate limit config
   */
  getRateLimitConfig: async function () {
    try {
      try {
        const response = await httpClient.get("/api/rate-limits");
        return {
          success: true,
          data: response.data,
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
          },
          message: "Dữ liệu mẫu (API chưa sẵn sàng)",
        };
      }
    } catch (error) {
      console.error("Lỗi khi lấy cấu hình giới hạn tốc độ:", error);
      return {
        success: false,
        error: error.message || "Lỗi khi lấy cấu hình",
      };
    }
  },

  /**
   * Update rate limit configuration
   * @param {Object} config - New rate limit configuration
   * @returns {Promise<Object>} - Update result
   */
  updateRateLimitConfig: async function (config) {
    try {
      try {
        const response = await httpClient.put("/api/rate-limits", config);
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
      console.error("Lỗi khi cập nhật cấu hình giới hạn tốc độ:", error);
      return {
        success: false,
        error: error.message || "Lỗi khi cập nhật cấu hình",
      };
    }
  },

  /**
   * Get rate limit statistics for a user
   * @returns {Promise<Object>} - User rate limit statistics
   */
  getRateLimitStats: async function () {
    try {
      try {
        const response = await httpClient.get("/api/rate-limits/stats");
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
            requestsPerMinute: 5,
            requestsPerHour: 25,
            requestsPerDay: 120,
            tokensToday: 3500,
            tokensThisMonth: 25000,
          },
          message: "Dữ liệu mẫu (API chưa sẵn sàng)",
        };
      }
    } catch (error) {
      console.error("Lỗi khi lấy thống kê giới hạn tốc độ:", error);
      return {
        success: false,
        error: error.message || "Lỗi khi lấy thống kê",
      };
    }
  },
};

export default rateLimitService;
