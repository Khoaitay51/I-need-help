/**
 * Các utility functions để xử lý JWT authentication
 */

// Lưu JWT tokens
export const saveTokens = (accessToken, refreshToken) => {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
};

// Lấy access token
export const getAccessToken = () => {
  return localStorage.getItem('accessToken');
};

// Lấy refresh token
export const getRefreshToken = () => {
  return localStorage.getItem('refreshToken');
};

// Xóa tokens
export const removeTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// Kiểm tra xem token có hết hạn không
export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    // JWT token có 3 phần, phân cách bởi dấu chấm (.), phần thứ 2 chứa payload
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    // Kiểm tra expiration time
    const expiry = payload.exp * 1000; // Convert to milliseconds
    return Date.now() >= expiry;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // Nếu có lỗi, coi như token đã hết hạn
  }
};

// Decode JWT token để lấy thông tin
export const decodeToken = (token) => {
  if (!token) return null;
  
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};
