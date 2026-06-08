import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Clock,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface StatCard {
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ReactNode;
  color: string;
}

interface UsageData {
  totalUsers: number;
  activeUsers: number;
  totalConversations: number;
  totalMessages: number;
  avgResponseTime: number;
  tokenUsage: number;
  userGrowth: number;
  conversationGrowth: number;
}

const UsageStatistics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const [data, setData] = useState<UsageData | null>(null);

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/statistics?range=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        // Mock data for development
        setData({
          totalUsers: 1250,
          activeUsers: 342,
          totalConversations: 5678,
          totalMessages: 23456,
          avgResponseTime: 1.2,
          tokenUsage: 1500000,
          userGrowth: 12.5,
          conversationGrowth: 8.3,
        });
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
      // Mock data
      setData({
        totalUsers: 1250,
        activeUsers: 342,
        totalConversations: 5678,
        totalMessages: 23456,
        avgResponseTime: 1.2,
        tokenUsage: 1500000,
        userGrowth: 12.5,
        conversationGrowth: 8.3,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const stats: StatCard[] = data ? [
    {
      title: 'Tổng người dùng',
      value: formatNumber(data.totalUsers),
      change: data.userGrowth,
      changeType: data.userGrowth > 0 ? 'increase' : data.userGrowth < 0 ? 'decrease' : 'neutral',
      icon: <Users className="w-6 h-6" />,
      color: '#3b82f6',
    },
    {
      title: 'Người dùng hoạt động',
      value: formatNumber(data.activeUsers),
      change: 5.2,
      changeType: 'increase',
      icon: <TrendingUp className="w-6 h-6" />,
      color: '#10b981',
    },
    {
      title: 'Tổng hội thoại',
      value: formatNumber(data.totalConversations),
      change: data.conversationGrowth,
      changeType: data.conversationGrowth > 0 ? 'increase' : 'decrease',
      icon: <MessageSquare className="w-6 h-6" />,
      color: '#8b5cf6',
    },
    {
      title: 'Thời gian phản hồi TB',
      value: `${data.avgResponseTime}s`,
      change: -0.3,
      changeType: 'decrease',
      icon: <Clock className="w-6 h-6" />,
      color: '#f59e0b',
    },
  ] : [];

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
      </div>
    );
  }

  return (
    <div className="usage-statistics">
      {/* Time range selector */}
      <div className="time-range-selector">
        <button 
          className={`range-btn ${timeRange === 'day' ? 'active' : ''}`}
          onClick={() => setTimeRange('day')}
        >
          <Calendar className="w-4 h-4" />
          Hôm nay
        </button>
        <button 
          className={`range-btn ${timeRange === 'week' ? 'active' : ''}`}
          onClick={() => setTimeRange('week')}
        >
          <Calendar className="w-4 h-4" />
          7 ngày
        </button>
        <button 
          className={`range-btn ${timeRange === 'month' ? 'active' : ''}`}
          onClick={() => setTimeRange('month')}
        >
          <Calendar className="w-4 h-4" />
          30 ngày
        </button>
      </div>

      {/* Stats cards */}
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-content">
              <span className="stat-title">{stat.title}</span>
              <span className="stat-value">{stat.value}</span>
              <div className={`stat-change ${stat.changeType}`}>
                {stat.changeType === 'increase' && <ArrowUp className="w-3 h-3" />}
                {stat.changeType === 'decrease' && <ArrowDown className="w-3 h-3" />}
                {stat.changeType === 'neutral' && <Minus className="w-3 h-3" />}
                <span>{Math.abs(stat.change)}%</span>
                <span className="change-label">so với kỳ trước</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Additional stats */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Thống kê chi tiết</h2>
        </div>
        <div className="detailed-stats">
          <div className="detail-row">
            <span className="detail-label">Tổng tin nhắn</span>
            <span className="detail-value">{data ? formatNumber(data.totalMessages) : '-'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Token sử dụng</span>
            <span className="detail-value">{data ? formatNumber(data.tokenUsage) : '-'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Tin nhắn/Hội thoại TB</span>
            <span className="detail-value">
              {data ? (data.totalMessages / data.totalConversations).toFixed(1) : '-'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Tỷ lệ người dùng hoạt động</span>
            <span className="detail-value">
              {data ? ((data.activeUsers / data.totalUsers) * 100).toFixed(1) + '%' : '-'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .usage-statistics {
          width: 100%;
        }

        .time-range-selector {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
        }

        .range-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: 1px solid var(--border-light, #e5e7eb);
          border-radius: 8px;
          background: var(--surface-primary, #fff);
          color: var(--text-secondary, #64748b);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .range-btn:hover {
          background: var(--surface-hover, #f1f5f9);
        }

        .range-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: #fff;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .stat-card {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 20px;
          background: var(--surface-primary, #fff);
          border: 1px solid var(--border-light, #e5e7eb);
          border-radius: 12px;
          transition: box-shadow 0.2s ease;
        }

        .stat-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          flex-shrink: 0;
        }

        .stat-content {
          flex: 1;
        }

        .stat-title {
          display: block;
          font-size: 13px;
          color: var(--text-secondary, #64748b);
          margin-bottom: 4px;
        }

        .stat-value {
          display: block;
          font-size: 28px;
          font-weight: 700;
          color: var(--text-primary, #1e293b);
          margin-bottom: 8px;
        }

        .stat-change {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .stat-change.increase {
          color: #10b981;
        }

        .stat-change.decrease {
          color: #ef4444;
        }

        .stat-change.neutral {
          color: #6b7280;
        }

        .change-label {
          color: var(--text-tertiary, #9ca3af);
          margin-left: 4px;
        }

        .detailed-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: var(--surface-secondary, #f8fafc);
          border-radius: 8px;
        }

        .detail-label {
          font-size: 14px;
          color: var(--text-secondary, #64748b);
        }

        .detail-value {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary, #1e293b);
        }

        @media (max-width: 640px) {
          .time-range-selector {
            flex-wrap: wrap;
          }

          .range-btn {
            flex: 1;
            min-width: 100px;
            justify-content: center;
          }

          .stat-value {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
};

export default UsageStatistics;
