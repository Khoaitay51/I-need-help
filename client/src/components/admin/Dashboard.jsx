import React, { useState, useEffect } from "react";
import {
  FiTrendingUp,
  FiUsers,
  FiZap,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";
import "./Dashboard.css";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalRequests: 0,
    tokenUsedNow: 0,
    tokenUsedMonth: 0,
    activeUsers: 0,
    requestChange: 0,
    tokenChange: 0,
    userChange: 0,
  });

  const [topUsers, setTopUsers] = useState([]);
  const [tokenUsage, setTokenUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("accessToken");

        if (!token) {
          console.warn("No token, using mock data");
          setError("No authentication token - using demo data");
          getMockData();
          return;
        }

        console.log("Fetching from /api/admin/dashboard/stats...");
        const apiUrl = "http://192.168.0.102:8000/api/admin/dashboard/stats";
        const response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        // Check response status
        if (!response.ok) {
          const contentType = response.headers.get("content-type") || "";
          console.warn(
            `API returned ${response.status}. Content-Type: ${contentType}`,
          );

          // Use mock data as fallback
          getMockData();
          setError(`API error (HTTP ${response.status}) - showing demo data`);
          return;
        }

        // Check content type BEFORE parsing
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          console.error(`Invalid content-type: ${contentType}. Expected JSON.`);
          getMockData();
          setError(`Invalid API response (${contentType}) - showing demo data`);
          return;
        }

        try {
          const data = await response.json();
          console.log("API Response:", data);
          const dashboardData = data.data;

          if (!dashboardData) {
            console.error("Missing 'data' field in response");
            getMockData();
            setError("API response format invalid - showing demo data");
            return;
          }

          setStats({
            totalRequests: dashboardData.total_requests_today || 0,
            tokenUsedNow: dashboardData.tokens_used_today || 0,
            tokenUsedMonth: dashboardData.tokens_used_month || 0,
            activeUsers: dashboardData.total_users || 0,
            requestChange: dashboardData.request_change_percent || 0,
            tokenChange: dashboardData.tokens_change_percent || 0,
            userChange: dashboardData.user_change_percent || 0,
          });

          // Format top users for today
          const topUsersFormatted = (dashboardData.top_users_today || []).map(
            (user) => ({
              name: user.username,
              requests: user.requests,
              tokens: user.tokens,
            }),
          );
          setTopUsers(topUsersFormatted);

          // Format top users for tokens this month
          const tokenUsageFormatted = (dashboardData.top_users_month || []).map(
            (user) => ({
              name: user.username,
              tokens: user.tokens,
            }),
          );
          setTokenUsage(tokenUsageFormatted);

          setError(null);
        } catch (jsonError) {
          console.error("Failed to parse JSON:", jsonError);
          getMockData();
          setError("Server response invalid - showing demo data");
        }
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        getMockData();
        setError("API error - showing demo data");
      } finally {
        setLoading(false);
      }
    };

    const getMockData = () => {
      setStats({
        totalRequests: 245,
        tokenUsedNow: 12540,
        tokenUsedMonth: 125400,
        activeUsers: 18,
        requestChange: 12.5,
        tokenChange: 8.3,
        userChange: 5.2,
      });
      setTopUsers([
        { name: "user1", requests: 45, tokens: 3200 },
        { name: "user2", requests: 38, tokens: 2800 },
        { name: "user3", requests: 32, tokens: 2100 },
      ]);
      setTokenUsage([
        { name: "user1", tokens: 8500 },
        { name: "user3", tokens: 7200 },
        { name: "user2", tokens: 6100 },
      ]);
    };

    fetchDashboardStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchDashboardStats, 30000);

    return () => clearInterval(interval);
  }, []);

  // StatCard Component
  const StatCard = ({ icon: Icon, title, value, unit, change, positive }) => (
    <div className="dashboard-stat-card">
      <div className="stat-icon-container">
        <Icon className="stat-icon" />
      </div>
      <div className="stat-content">
        <p className="stat-title">{title}</p>
        <div className="stat-value-row">
          <span className="stat-value">
            {value.toLocaleString()}
            {unit && <span className="stat-unit">{unit}</span>}
          </span>
          {change !== undefined && (
            <span
              className={`stat-change ${positive ? "positive" : "negative"}`}
            >
              {positive ? <FiArrowUp /> : <FiArrowDown />}
              {Math.abs(change)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-container">
      {/* Layout: Bảng điều khiển */}
      <h1 className="dashboard-title">Bảng điều khiển</h1>

      {/* Loading State */}
      {loading && (
        <div className="dashboard-loading">
          <p>Đang tải dữ liệu...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="dashboard-error">
          <p>⚠️ Lỗi: {error}</p>
        </div>
      )}

      {/* Statistics Cards Grid */}
      {!loading && (
        <>
          <div className="dashboard-stats-grid">
            <StatCard
              icon={FiTrendingUp}
              title="Tổng số yêu cầu hôm nay"
              value={stats.totalRequests}
              unit=""
              change={stats.requestChange}
              positive={stats.requestChange >= 0}
            />
            <StatCard
              icon={FiZap}
              title="Token đã sử dụng hôm nay"
              value={stats.tokenUsedNow}
              unit=""
              change={stats.tokenChange}
              positive={stats.tokenChange >= 0}
            />
            <StatCard
              icon={FiZap}
              title="Token đã sử dụng tháng này"
              value={stats.tokenUsedMonth}
              unit=""
            />
            <StatCard
              icon={FiUsers}
              title="Số người dùng"
              value={stats.activeUsers}
              unit=""
              change={stats.userChange}
              positive={stats.userChange >= 0}
            />
          </div>

          {/* Tables Row */}
          <div className="dashboard-tables-row">
            {/* Top Users Table */}
            <div className="dashboard-table-card">
              <h3>Người dùng hoạt động nhất hôm nay</h3>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Tên người dùng</th>
                    <th>Số yêu cầu</th>
                    <th>Token đã dùng</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.length > 0 ? (
                    topUsers.map((user, idx) => (
                      <tr key={idx}>
                        <td>{user.name}</td>
                        <td>{user.requests}</td>
                        <td>{user.tokens.toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="3"
                        style={{ textAlign: "center", color: "#9ca3af" }}
                      >
                        Chưa có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Token Usage Table */}
            <div className="dashboard-table-card">
              <h3>Người dùng sử dụng nhiều token nhất tháng này</h3>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Tên người dùng</th>
                    <th>Token đã dùng</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenUsage.length > 0 ? (
                    tokenUsage.map((user, idx) => (
                      <tr key={idx}>
                        <td>{user.name}</td>
                        <td>{user.tokens.toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="2"
                        style={{ textAlign: "center", color: "#9ca3af" }}
                      >
                        Chưa có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
