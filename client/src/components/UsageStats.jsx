import React, { useState, useEffect } from 'react';
import { FiAlertCircle, FiBarChart2, FiClock, FiRefreshCw } from 'react-icons/fi';
import rateLimitService from '../services/rateLimitService';

import './UsageStats.css';

const UsageStats = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await rateLimitService.getRateLimitStats();
      if (response.success) {
        setStats(response.data);
        setError(null);
      } else {
        setError('Không thể tải thống kê sử dụng: ' + response.error);
      }
    } catch (err) {
      console.error('Error fetching usage stats:', err);
      setError('Đã xảy ra lỗi khi tải thống kê sử dụng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <div className="usage-stats-loading">Đang tải thống kê sử dụng...</div>;
  }

  if (error && !stats) {
    return (
      <div className="usage-stats-error">
        <FiAlertCircle />
        <p>{error}</p>
        <button onClick={fetchStats} className="refresh-button">
          <FiRefreshCw /> Tải lại
        </button>
      </div>
    );
  }

  // Format thời gian reset
  const formatResetTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Tính phần trăm sử dụng
  const calculatePercentage = (used, limit) => {
    if (!limit || limit === 0) return 0;
    const percentage = (used / limit) * 100;
    return Math.min(percentage, 100); // Giới hạn ở 100%
  };

  // Check if rate limiting is enabled
  const enabled = stats?.enabled !== false;

  if (!enabled) {
    return (
      <div className="usage-stats-disabled">
        <FiAlertCircle />
        <p>Giới hạn tốc độ hiện đang bị tắt.</p>
      </div>
    );
  }

  const usage = stats?.usage || {
    requestsPerMinute: 0,
    requestsPerHour: 0,
    requestsPerDay: 0,
    tokensToday: 0,
    tokensThisMonth: 0,
    resetTimes: {
      minute: new Date().toISOString(),
      hour: new Date().toISOString(),
      day: new Date().toISOString(),
      month: new Date().toISOString()
    }
  };

  const limits = stats?.limits || {
    requestsPerMinute: 0,
    requestsPerHour: 0,
    requestsPerDay: 0,
    tokensPerDay: 0,
    tokensPerMonth: 0
  };

  return (
    <div className="usage-stats-wrapper">
      <div className="usage-stats-header">
        <h3>
          <FiBarChart2 />
          <span>Thống kê sử dụng của bạn</span>
        </h3>
        <button onClick={fetchStats} className="refresh-button" title="Tải lại">
          <FiRefreshCw />
        </button>
      </div>

      <div className="usage-stats-grid">
        {/* Request limits */}
        <div className="usage-stat-card">
          <div className="stat-header">
            <FiClock />
            <div>
              <h4>Yêu cầu mỗi phút</h4>
              <div className="stat-reset">
                <small>Reset: {formatResetTime(usage.resetTimes.minute)}</small>
              </div>
            </div>
          </div>
          <div className="stat-content">
            <div className="stat-counts">
              <span className="stat-value">{usage.requestsPerMinute}</span>
              <span className="stat-limit">/ {limits.requestsPerMinute}</span>
            </div>
            <div className="stat-progress-bar">
              <div 
                className="stat-progress" 
                style={{ width: `${calculatePercentage(usage.requestsPerMinute, limits.requestsPerMinute)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="usage-stat-card">
          <div className="stat-header">
            <FiClock />
            <div>
              <h4>Yêu cầu mỗi giờ</h4>
              <div className="stat-reset">
                <small>Reset: {formatResetTime(usage.resetTimes.hour)}</small>
              </div>
            </div>
          </div>
          <div className="stat-content">
            <div className="stat-counts">
              <span className="stat-value">{usage.requestsPerHour}</span>
              <span className="stat-limit">/ {limits.requestsPerHour}</span>
            </div>
            <div className="stat-progress-bar">
              <div 
                className="stat-progress" 
                style={{ width: `${calculatePercentage(usage.requestsPerHour, limits.requestsPerHour)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="usage-stat-card">
          <div className="stat-header">
            <FiClock />
            <div>
              <h4>Yêu cầu mỗi ngày</h4>
              <div className="stat-reset">
                <small>Reset: {new Date(usage.resetTimes.day).toLocaleDateString('vi-VN')}</small>
              </div>
            </div>
          </div>
          <div className="stat-content">
            <div className="stat-counts">
              <span className="stat-value">{usage.requestsPerDay}</span>
              <span className="stat-limit">/ {limits.requestsPerDay}</span>
            </div>
            <div className="stat-progress-bar">
              <div 
                className="stat-progress" 
                style={{ width: `${calculatePercentage(usage.requestsPerDay, limits.requestsPerDay)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Token limits */}
        <div className="usage-stat-card token-card">
          <div className="stat-header">
            <div className="token-icon">T</div>
            <div>
              <h4>Token mỗi ngày</h4>
              <div className="stat-reset">
                <small>Reset: {new Date(usage.resetTimes.day).toLocaleDateString('vi-VN')}</small>
              </div>
            </div>
          </div>
          <div className="stat-content">
            <div className="stat-counts">
              <span className="stat-value">{usage.tokensToday.toLocaleString()}</span>
              <span className="stat-limit">/ {limits.tokensPerDay.toLocaleString()}</span>
            </div>
            <div className="stat-progress-bar">
              <div 
                className="stat-progress" 
                style={{ width: `${calculatePercentage(usage.tokensToday, limits.tokensPerDay)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="usage-stat-card token-card">
          <div className="stat-header">
            <div className="token-icon">T</div>
            <div>
              <h4>Token mỗi tháng</h4>
              <div className="stat-reset">
                <small>Reset: {new Date(usage.resetTimes.month).toLocaleDateString('vi-VN')}</small>
              </div>
            </div>
          </div>
          <div className="stat-content">
            <div className="stat-counts">
              <span className="stat-value">{usage.tokensThisMonth.toLocaleString()}</span>
              <span className="stat-limit">/ {limits.tokensPerMonth.toLocaleString()}</span>
            </div>
            <div className="stat-progress-bar">
              <div 
                className="stat-progress" 
                style={{ width: `${calculatePercentage(usage.tokensThisMonth, limits.tokensPerMonth)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageStats;
