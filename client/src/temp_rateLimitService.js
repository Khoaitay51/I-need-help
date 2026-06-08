import httpClient from '../utils/httpClient';
import constants from '../utils/constants';

const { API_BASE_URL, API_ENDPOINTS } = constants;

// Mock data for development while backend is not ready
const MOCK_DATA = {
  config: {
    roles: {
      user: {
        requests: {
          per_minute: 10,
          per_hour: 100,
          per_day: 500
        },
        tokens: {
          per_day: 10000,
          per_month: 100000
        }
      },
      admin: {
        requests: {
          per_minute: 20,
          per_hour: 200,
          per_day: 1000
        },
        tokens: {
          per_day: 50000,
          per_month: 500000
        }
      }
    },
    exceptions: []
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
        month: new Date(Date.now() + 15 * 24 * 3600000).toISOString()
      }
    },
    limits: {
      requestsPerMinute: 10,
      requestsPerHour: 100,
      requestsPerDay: 500,
      tokensPerDay: 10000,
      tokensPerMonth: 100000
    }
  }
};

class RateLimitService {
  /**
   * Lấy cấu hình giới hạn tốc độ
   * @returns {Promise<Object>} - Cấu hình giới hạn tốc độ
   */
  async getRateLimitConfig() {
    try {
      // First try the real API
      try {
        const response = await httpClient.get(API_ENDPOINTS.ADMIN_GET_RATE_LIMITS);
        return {
          success: true,
          data: response.data,
          message: response.message || 'Lấy cấu hình giới hạn tốc độ thành công'
        };
      } catch (apiError) {
        console.warn('Sử dụng dữ liệu mẫu cho cấu hình giới hạn tốc độ:', apiError.message);
        
        // Convert mock data to the expected format if needed
        return {
          success: true,
          data: MOCK_DATA.config,
          message: 'Lấy cấu hình giới hạn tốc độ thành công (dữ liệu mẫu)'
        };
      }
    } catch (error) {
      console.error('Lỗi khi lấy cấu hình giới hạn tốc độ:', error);
      return {
        success: false,
        error: error.message || 'Lỗi khi lấy cấu hình giới hạn tốc độ'
      };
    }
  }

  /**
   * Cập nhật cấu hình giới hạn tốc độ
   * @param {Object} config - Cấu hình giới hạn tốc độ mới
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  async updateRateLimitConfig(config) {
    try {
      // First try the real API
      try {
        const response = await httpClient.put(API_ENDPOINTS.ADMIN_UPDATE_RATE_LIMITS, config);
        return {
          success: true,
          message: response.message || 'Cập nhật cấu hình giới hạn tốc độ thành công'
        };
      } catch (apiError) {
        console.warn('Sử dụng dữ liệu mẫu cho cập nhật giới hạn tốc độ:', apiError.message);
        // Return mock success if API fails
        return {
          success: true,
          message: 'Cập nhật cấu hình giới hạn tốc độ thành công (dữ liệu mẫu)'
        };
      }
    } catch (error) {
      console.error('Lỗi khi cập nhật cấu hình giới hạn tốc độ:', error);
      return {
        success: false,
        error: error.message || 'Lỗi khi cập nhật cấu hình giới hạn tốc độ'
      };
    }
  }

  /**
   * Lấy thống kê sử dụng và giới hạn của người dùng hiện tại
   * @returns {Promise<Object>} - Thống kê sử dụng và giới hạn
   */
  async getRateLimitStats() {
    try {
      // First try the real API
      try {
        const response = await httpClient.get(`${API_ENDPOINTS.ADMIN_GET_USAGE_STATS}/user/rate-limits`);
        return {
          success: true,
          data: response.data,
          message: response.message || 'Lấy thống kê giới hạn tốc độ thành công'
        };
      } catch (apiError) {
        console.warn('Sử dụng dữ liệu mẫu cho thống kê sử dụng:', apiError.message);
        
        // Return mock data in the format expected by UsageStats component
        return {
          success: true,
          data: MOCK_DATA.stats,
          message: 'Lấy thống kê giới hạn tốc độ thành công (dữ liệu mẫu)'
        };
      }
    } catch (error) {
      console.error('Lỗi khi lấy thống kê giới hạn tốc độ:', error);
      return {
        success: false,
        error: error.message || 'Lỗi khi lấy thống kê giới hạn tốc độ'
      };
    }
  }
}

const rateLimitService = new RateLimitService();
export default rateLimitService;
