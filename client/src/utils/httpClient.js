import { API_BASE_URL } from './constants';
import * as jwtHelper from './jwtHelper';

/**
 * HTTP Client với tính năng xử lý JWT token
 */
class HttpClient {
  constructor() {
    this.isRefreshing = false;
    this.failedQueue = [];
  }

  // Không sử dụng phương thức này trực tiếp nữa, thay vào đó sẽ dùng authService.refreshToken()
  // Giữ lại để tương thích với code cũ
  async refreshToken() {
    try {
      console.warn('Deprecation warning: Use authService.refreshToken() instead');
      
      // Import động để tránh circular dependency
      const authService = await import('../services/authService').then(module => module.default);
      const result = await authService.refreshToken();
      return result.success;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Xóa thông tin đăng nhập nếu refresh token thất bại
      jwtHelper.removeTokens();
      localStorage.removeItem('userInfo');
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('chatHistory');
      return false;
    }
  }

  // Xử lý các request thất bại do token hết hạn
  processQueue(success, error = null) {
    this.failedQueue.forEach(prom => {
      if (success) {
        prom.resolve();
      } else {
        prom.reject(error);
      }
    });
    
    this.failedQueue = [];
  }

  // Thêm request vào queue chờ xử lý
  addToQueue() {
    return new Promise((resolve, reject) => {
      this.failedQueue.push({ resolve, reject });
    });
  }

  // Thực hiện request với JWT authentication
  async request(url, options = {}) {
    // Kiểm tra xem url có phải là full URL không
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    
    // Debug authentication
    console.group('HttpClient Request Debug');
    console.log('Request URL:', fullUrl);
    console.log('Request method:', options.method || 'GET');
    console.log('Request options:', {...options, body: options.body instanceof FormData ? 'FormData object' : options.body});
    
    // Kiểm tra xem có phải là FormData không
    if (options.body instanceof FormData) {
      console.log('Request contains FormData');
      const formDataEntries = [];
      for (let [key, value] of options.body.entries()) {
        formDataEntries.push({
          key,
          value: value instanceof File ? 
            `File: ${value.name}, type: ${value.type}, size: ${value.size}` : 
            value
        });
      }
      console.log('FormData entries:', formDataEntries);
    }
    
    // Clone options để tránh mutation
    const requestOptions = { ...options };
    requestOptions.headers = { ...requestOptions.headers };
    
    // Thêm JWT token vào header cho tất cả request
    const accessToken = jwtHelper.getAccessToken();
    console.log('Access Token exists:', !!accessToken);
    
    if (accessToken) {
      console.log('Token expired?', jwtHelper.isTokenExpired(accessToken));
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        console.log('Token payload:', payload);
        console.log('Token expiry:', new Date(payload.exp * 1000).toLocaleString());
      } catch (e) {
        console.error('Error decoding token', e);
      }
    }
    
    // Kiểm tra token hết hạn trước khi gửi request
    if (accessToken && jwtHelper.isTokenExpired(accessToken)) {
        console.log('Access token expired, attempting to refresh before request');
        
        // Nếu đang refresh token, đưa request vào queue
        if (this.isRefreshing) {
          try {
            await this.addToQueue();
            // Thử request lại sau khi refresh token thành công
            return this.request(url, options);
          } catch (error) {
            throw error;
          }
        }
        
        // Bắt đầu refresh token
        this.isRefreshing = true;
        
        try {
          // Import động để tránh circular dependency
          const authService = await import('../services/authService').then(module => module.default);
          const refreshResult = await authService.refreshToken();
          
          this.isRefreshing = false;
          
          if (refreshResult.success) {
            // Thông báo cho các request đang chờ
            this.processQueue(true);
            
            // Sử dụng token mới
            requestOptions.headers['Authorization'] = `Bearer ${jwtHelper.getAccessToken()}`;
          } else {
            // Refresh token thất bại
            this.processQueue(false, new Error('Failed to refresh token'));
            throw new Error('Authentication failed');
          }
        } catch (error) {
          this.isRefreshing = false;
          this.processQueue(false, error);
          throw error;
        }
      } else if (accessToken) {
        // Sử dụng token hiện tại nếu chưa hết hạn
        console.log('Using existing token');
        requestOptions.headers['Authorization'] = `Bearer ${accessToken}`;
      } else {
        console.warn('No access token available for request');
      }
    
    console.log('Final request headers:', requestOptions.headers);
    console.groupEnd();
    
    try {
      // Thực hiện request
      const response = await fetch(fullUrl, requestOptions);
      
      // Xử lý token hết hạn (401 Unauthorized)
      if (response.status === 401) {
        // Nếu đang refresh token, đưa request vào queue
        if (this.isRefreshing) {
          try {
            await this.addToQueue();
            // Thử request lại sau khi refresh token thành công
            return this.request(url, options);
          } catch (error) {
            throw error;
          }
        }
        
        // Bắt đầu refresh token
        this.isRefreshing = true;
        
        try {
          // Import động để tránh circular dependency
          const authService = await import('../services/authService').then(module => module.default);
          const refreshResult = await authService.refreshToken();
          
          this.isRefreshing = false;
          
          if (refreshResult.success) {
            // Thông báo cho các request đang chờ
            this.processQueue(true);
            
            // Thử request lại với token mới
            return this.request(url, options);
          } else {
            // Refresh token thất bại
            this.processQueue(false, new Error('Failed to refresh token'));
            throw new Error('Authentication failed');
          }
        } catch (error) {
          this.isRefreshing = false;
          this.processQueue(false, error);
          throw error;
        }
      }
      
      // Trả về dữ liệu JSON nếu response ok
      if (response.ok) {
        // Kiểm tra xem response có phải JSON không
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const jsonData = await response.json();
          console.log('Response JSON data:', jsonData);
          return jsonData;
        }
        const textData = await response.text();
        console.log('Response text data:', textData);
        return textData;
      }
      
      // Xử lý lỗi HTTP
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText };
      }
      
      const error = new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      error.response = {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      };
      throw error;
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }
  
  // Helper methods
  async get(url, options = {}) {
    console.log(`HttpClient.get: ${url}`);
    try {
      const result = await this.request(url, { method: 'GET', ...options });
      console.log(`HttpClient.get result for ${url}:`, result);
      return result;
    } catch (error) {
      console.error(`HttpClient.get error for ${url}:`, error);
      throw error;
    }
  }
  
  async post(url, data = {}, options = {}) {
    return this.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });
  }
  
  async put(url, data = {}, options = {}) {
    return this.request(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });
  }
  
  async delete(url, options = {}) {
    return this.request(url, { method: 'DELETE', ...options });
  }
  
  async upload(url, formData, options = {}) {
    console.log('Upload method called with FormData:', formData);
    // Log FormData contents for debugging
    for (let [key, value] of formData.entries()) {
      console.log(`FormData field: ${key}, value:`, value instanceof File ? `File: ${value.name}, size: ${value.size}` : value);
    }
    
    // Không chỉ định Content-Type để trình duyệt tự động xử lý boundary
    return this.request(url, {
      method: 'POST',
      body: formData,
      ...options,
    });
  }
}

const httpClientInstance = new HttpClient();
export default httpClientInstance;
