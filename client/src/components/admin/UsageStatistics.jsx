import React, { useState, useEffect } from 'react';
import { FiBarChart, FiMessageSquare, FiAlertCircle } from 'react-icons/fi';
import './UsageStatistics.css';
import httpClient from '../../utils/httpClient';

const UsageStatistics = () => {
  const [timeRange, setTimeRange] = useState('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalRequests: 0,
    tokensUsed: 0,
    avgResponseTime: 0,
    errorRate: 0,
    dailyStats: [],
    topUsers: [],
    activeUsersCount: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch real data from the API
        const response = await httpClient.get('/api/admin/rate-limits/usage-summary');
        if (response && response.statusCode === 200 && response.data) {
          // Transform the API data to match our component's expected format
          const apiData = response.data;
          const transformedData = {
            totalRequests: apiData.totalRequestsToday || 0,
            tokensUsed: apiData.totalTokensToday || 0,
            tokensThisMonth: apiData.totalTokensThisMonth || 0,
            activeUsersCount: apiData.activeUsersCount || 0,
            topUsers: apiData.mostActiveUsers?.map(user => ({
              username: user.username || 'Không xác định',
              requests: user.requestsToday || 0,
              tokens: user.tokensToday || 0
            })) || [],
            mostTokenUsers: apiData.mostTokenUsers?.map(user => ({
              username: user.username || 'Không xác định',
              tokens: user.tokensThisMonth || 0
            })) || []
          };
          
          setStats(transformedData);
        } else {
          throw new Error('Invalid response format from API');
        }
      } catch (error) {
        console.error('Error fetching statistics:', error);
        setError('Không thể tải dữ liệu thống kê. Vui lòng thử lại sau.');
        
        // Fallback to mock data for development/testing
        const mockData = {
          totalRequests: 0,
          tokensUsed: 0,
          tokensThisMonth: 0,
          activeUsersCount: 0,
          topUsers: [],
          mostTokenUsers: []
        };
        setStats(mockData);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [timeRange]);

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  if (loading) {
    return <div className="stats-loading">Loading statistics...</div>;
  }

  return (
    <div className="usage-statistics">
      {/* Time range selector */}
      <div className="stats-time-selector">
        <button 
          className={timeRange === 'today' ? 'active' : ''}
          onClick={() => handleTimeRangeChange('today')}
        >
          Hôm nay
        </button>
        <button 
          className={timeRange === 'week' ? 'active' : ''}
          onClick={() => handleTimeRangeChange('week')}
        >
          Tuần này
        </button>
        <button 
          className={timeRange === 'month' ? 'active' : ''}
          onClick={() => handleTimeRangeChange('month')}
        >
          Tháng này
        </button>
        <button 
          className={timeRange === 'year' ? 'active' : ''}
          onClick={() => handleTimeRangeChange('year')}
        >
          Năm này
        </button>
      </div>

      {error && (
        <div className="stats-error-message">
          <FiAlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Key metrics */}
      <div className="stats-metrics">
        <div className="stats-card">
          <div className="stats-card-icon">
            <FiMessageSquare />
          </div>
          <div className="stats-card-content">
            <h3>Tổng số yêu cầu</h3>
            <p className="stats-card-value">{stats.totalRequests.toLocaleString()}</p>
            <p className="stats-card-label">yêu cầu hôm nay</p>
          </div>
        </div>
        
        <div className="stats-card">
          <div className="stats-card-icon token-icon">
            <span>T</span>
          </div>
          <div className="stats-card-content">
            <h3>Token đã sử dụng hôm nay</h3>
            <p className="stats-card-value">{stats.tokensUsed.toLocaleString()}</p>
            <p className="stats-card-label">token</p>
          </div>
        </div>
        
        <div className="stats-card">
          <div className="stats-card-icon">
            <FiAlertCircle />
          </div>
          <div className="stats-card-content">
            <h3>Token đã sử dụng tháng này</h3>
            <p className="stats-card-value">{stats.tokensThisMonth?.toLocaleString() || '0'}</p>
            <p className="stats-card-label">token</p>
          </div>
        </div>
        
        <div className="stats-card">
          <div className="stats-card-icon">
            <FiBarChart />
          </div>
          <div className="stats-card-content">
            <h3>Số người dùng</h3>
            <p className="stats-card-value">{stats.activeUsersCount}</p>
            <p className="stats-card-label">người dùng hoạt động</p>
          </div>
        </div>
      </div>

      {/* Top Users - Active Users */}
      <div className="stats-top-users">
        <h3>Người dùng hoạt động nhất hôm nay</h3>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Tên người dùng</th>
              <th>Số yêu cầu</th>
              <th>Token đã dùng</th>
            </tr>
          </thead>
          <tbody>
            {stats.topUsers && stats.topUsers.length > 0 ? (
              stats.topUsers.map((user, index) => (
                <tr key={index}>
                  <td>{user.username}</td>
                  <td>{user.requests}</td>
                  <td>{user.tokens.toLocaleString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="text-center">Không có dữ liệu</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Top Users - Token Usage */}
      <div className="stats-top-users">
        <h3>Người dùng sử dụng nhiều token nhất tháng này</h3>
        <table className="stats-table">
          <thead>
            <tr>
              <th>Tên người dùng</th>
              <th>Token đã dùng</th>
            </tr>
          </thead>
          <tbody>
            {stats.mostTokenUsers && stats.mostTokenUsers.length > 0 ? (
              stats.mostTokenUsers.map((user, index) => (
                <tr key={index}>
                  <td>{user.username}</td>
                  <td>{user.tokens.toLocaleString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2" className="text-center">Không có dữ liệu</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UsageStatistics;
