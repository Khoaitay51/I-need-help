import React, { useState } from 'react';
import { FiUser, FiLock, FiAlertCircle } from 'react-icons/fi';
import authService from '../../services/authService';
import './AdminLogin.css';

const AdminLogin = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await authService.login({
        username,
        password,
      });
      
      if (response.success) {
        const user = response.data;
        // Check if user has admin role
        if (user.role !== 'admin') {
          setError('Bạn không có quyền truy cập vào trang quản trị');
          setLoading(false);
          return;
        }
        
        onLogin(user);
      } else {
        setError(response.error || 'Đăng nhập thất bại');
      }
    } catch (error) {
      setError(error.message || 'Đã xảy ra lỗi khi đăng nhập');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <img 
            src="/assets/kma-logo.svg" 
            alt="KMA Logo" 
            className="admin-logo" 
          />
          <h1>Quản trị hệ thống Chatbot KMA</h1>
        </div>
        
        {error && (
          <div className="admin-error-message">
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-form-group">
            <label htmlFor="username">
              <FiUser />
              Tên đăng nhập
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              disabled={loading}
            />
          </div>
          
          <div className="admin-form-group">
            <label htmlFor="password">
              <FiLock />
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit" 
            className="admin-login-button"
            disabled={loading}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
