import httpClient from '../utils/httpClient';
import constants from '../utils/constants';

const { API_ENDPOINTS } = constants;

class UserService {
  /**
   * Lấy danh sách tất cả người dùng (chỉ dành cho admin)
   * @returns {Promise<Object>} - Danh sách người dùng
   */
  async getAllUsers() {
    try {
      // Debug authentication state
      const accessToken = localStorage.getItem('accessToken');
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      
      console.group('Auth Debug - getAllUsers');
      console.log('Access Token exists:', !!accessToken);
      console.log('User info:', userInfo);
      console.log('User role:', userInfo.role);
      console.log('isLoggedIn flag:', localStorage.getItem('isLoggedIn'));
      console.groupEnd();
      
      console.log('Gọi API lấy danh sách người dùng');
      const response = await httpClient.get(API_ENDPOINTS.ADMIN_GET_USERS);
      console.log('Kết quả API lấy danh sách người dùng:', response);
      return {
        success: true,
        data: response.data,
        message: response.message || 'Lấy danh sách người dùng thành công'
      };
    } catch (error) {
      console.error('Lỗi khi lấy danh sách người dùng:', error);
      console.error('Error response:', error.response);
      
      let errorMessage = 'Lỗi khi lấy danh sách người dùng';
      
      if (error.response) {
        const status = error.response.status;
        const detail = error.response.data?.detail || error.response.data?.message;
        
        if (status === 403) {
          errorMessage = 'Bạn không có quyền truy cập. Vui lòng đăng nhập với tài khoản admin.';
        } else if (status === 401) {
          errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
        } else if (status === 500) {
          errorMessage = 'Lỗi máy chủ. Vui lòng thử lại sau.';
        } else if (detail) {
          errorMessage = detail;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Cập nhật thông tin người dùng (chỉ dành cho admin)
   * @param {string} userId - ID của người dùng cần cập nhật
   * @param {Object} userData - Dữ liệu cập nhật
   * @returns {Promise<Object>} - Kết quả cập nhật
   */
  async updateUser(userId, userData) {
    try {
      const response = await httpClient.put(`/api/users/admin/${userId}`, userData);
      return {
        success: true,
        data: response.data,
        message: response.message || 'Cập nhật thông tin người dùng thành công'
      };
    } catch (error) {
      console.error('Lỗi khi cập nhật thông tin người dùng:', error);
      
      let errorMessage = 'Lỗi khi cập nhật thông tin người dùng';
      
      if (error.response) {
        const status = error.response.status;
        const detail = error.response.data?.detail || error.response.data?.message;
        
        if (status === 404) {
          errorMessage = 'Không tìm thấy người dùng.';
        } else if (status === 403) {
          errorMessage = 'Bạn không có quyền cập nhật người dùng này.';
        } else if (status === 400) {
          errorMessage = detail || 'Dữ liệu không hợp lệ.';
        } else if (detail) {
          errorMessage = detail;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async updateOwnProfile(profileData) {
    try {
      const response = await httpClient.put('/api/users/me/profile', profileData);
      return {
        success: true,
        data: response.data,
        message: response.message || 'Cập nhật thông tin cá nhân thành công'
      };
    } catch (error) {
      console.error('Lỗi khi cập nhật thông tin cá nhân:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Lỗi khi cập nhật thông tin cá nhân'
      };
    }
  }

  async changeOwnPassword(passwordData) {
    try {
      const response = await httpClient.put('/api/users/me/password', passwordData);
      return {
        success: true,
        data: response.data,
        message: response.message || 'Đổi mật khẩu thành công'
      };
    } catch (error) {
      console.error('Lỗi khi đổi mật khẩu:', error);
      return {
        success: false,
        error: error.response?.data?.detail || error.message || 'Lỗi khi đổi mật khẩu'
      };
    }
  }

  /**
   * Xóa người dùng (chỉ dành cho admin)
   * @param {string} userId - ID của người dùng cần xóa
   * @returns {Promise<Object>} - Kết quả xóa
   */
  async deleteUser(userId) {
    try {
      const response = await httpClient.delete(`/api/users/admin/${userId}`);
      return {
        success: true,
        data: response.data,
        message: response.message || 'Xóa người dùng thành công'
      };
    } catch (error) {
      console.error('Lỗi khi xóa người dùng:', error);
      
      let errorMessage = 'Lỗi khi xóa người dùng';
      
      if (error.response) {
        const status = error.response.status;
        const detail = error.response.data?.detail || error.response.data?.message;
        
        if (status === 404) {
          errorMessage = 'Không tìm thấy người dùng.';
        } else if (status === 403) {
          errorMessage = 'Bạn không có quyền xóa người dùng này.';
        } else if (detail) {
          errorMessage = detail;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Tạo người dùng mới (chỉ dành cho admin)
   * @param {Object} userData - Dữ liệu người dùng mới
   * @returns {Promise<Object>} - Kết quả tạo người dùng
   */
  async createUser(userData) {
    try {
      const response = await httpClient.post('/api/users', userData);
      return {
        success: true,
        data: response.data,
        message: response.message || 'Tạo người dùng thành công'
      };
    } catch (error) {
      console.error('Lỗi khi tạo người dùng:', error);
      
      let errorMessage = 'Lỗi khi tạo người dùng';
      
      if (error.response) {
        const status = error.response.status;
        const detail = error.response.data?.detail || error.response.data?.message;
        
        if (status === 400) {
          // Xử lý các lỗi validation cụ thể
          if (detail?.includes('Tên đăng nhập')) {
            errorMessage = 'Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.';
          } else if (detail?.includes('Email')) {
            errorMessage = 'Email đã được sử dụng. Vui lòng sử dụng email khác.';
          } else if (detail?.includes('Mã sinh viên')) {
            errorMessage = 'Mã sinh viên đã tồn tại. Vui lòng kiểm tra lại.';
          } else {
            errorMessage = detail || 'Dữ liệu không hợp lệ.';
          }
        } else if (status === 403) {
          errorMessage = 'Bạn không có quyền tạo người dùng.';
        } else if (status === 500) {
          errorMessage = 'Lỗi máy chủ. Vui lòng thử lại sau.';
        } else if (detail) {
          errorMessage = detail;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}

const userService = new UserService();
export default userService;
