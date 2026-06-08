import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  Save, 
  RefreshCw,
  Clock,
  MessageSquare,
  Upload,
  Users
} from 'lucide-react';
import { useToast } from '@librechat/client';

interface RateLimitConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  limits: {
    userMax: number;
    userWindowInMinutes: number;
    ipMax: number;
    ipWindowInMinutes: number;
  };
}

const RateLimiting: React.FC = () => {
  const [configs, setConfigs] = useState<RateLimitConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/rate-limits', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
      } else {
        // Mock data
        setConfigs([
          {
            id: 'messages',
            name: 'Tin nhắn',
            description: 'Giới hạn số lượng tin nhắn được gửi',
            icon: <MessageSquare className="w-5 h-5" />,
            limits: {
              userMax: 100,
              userWindowInMinutes: 60,
              ipMax: 200,
              ipWindowInMinutes: 60,
            },
          },
          {
            id: 'fileUploads',
            name: 'Tải file',
            description: 'Giới hạn số lượng file được tải lên',
            icon: <Upload className="w-5 h-5" />,
            limits: {
              userMax: 50,
              userWindowInMinutes: 60,
              ipMax: 100,
              ipWindowInMinutes: 60,
            },
          },
          {
            id: 'conversations',
            name: 'Hội thoại mới',
            description: 'Giới hạn số hội thoại mới được tạo',
            icon: <Users className="w-5 h-5" />,
            limits: {
              userMax: 20,
              userWindowInMinutes: 60,
              ipMax: 50,
              ipWindowInMinutes: 60,
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching rate limits:', error);
      showToast({ message: 'Không thể tải cấu hình giới hạn', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (configId: string, field: string, value: number) => {
    setConfigs(prev => prev.map(config => {
      if (config.id === configId) {
        return {
          ...config,
          limits: {
            ...config.limits,
            [field]: value,
          },
        };
      }
      return config;
    }));
    setHasChanges(true);
  };

  const saveConfigs = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/rate-limits', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configs }),
      });

      if (response.ok) {
        showToast({ message: 'Lưu cấu hình thành công', severity: 'success' });
        setHasChanges(false);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Error saving rate limits:', error);
      showToast({ message: 'Không thể lưu cấu hình', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (!confirm('Bạn có chắc chắn muốn đặt lại về cấu hình mặc định?')) return;
    
    setConfigs([
      {
        id: 'messages',
        name: 'Tin nhắn',
        description: 'Giới hạn số lượng tin nhắn được gửi',
        icon: <MessageSquare className="w-5 h-5" />,
        limits: {
          userMax: 100,
          userWindowInMinutes: 60,
          ipMax: 200,
          ipWindowInMinutes: 60,
        },
      },
      {
        id: 'fileUploads',
        name: 'Tải file',
        description: 'Giới hạn số lượng file được tải lên',
        icon: <Upload className="w-5 h-5" />,
        limits: {
          userMax: 50,
          userWindowInMinutes: 60,
          ipMax: 100,
          ipWindowInMinutes: 60,
        },
      },
      {
        id: 'conversations',
        name: 'Hội thoại mới',
        description: 'Giới hạn số hội thoại mới được tạo',
        icon: <Users className="w-5 h-5" />,
        limits: {
          userMax: 20,
          userWindowInMinutes: 60,
          ipMax: 50,
          ipWindowInMinutes: 60,
        },
      },
    ]);
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
      </div>
    );
  }

  return (
    <div className="rate-limiting">
      <div className="admin-card">
        <div className="admin-card-header">
          <div className="header-left">
            <h2 className="admin-card-title">Cấu hình giới hạn tốc độ</h2>
            <p className="header-description">
              Cấu hình giới hạn số lượng yêu cầu cho người dùng và IP
            </p>
          </div>
          <div className="header-actions">
            <button 
              className="admin-btn admin-btn-secondary"
              onClick={resetToDefaults}
            >
              <RefreshCw className="w-4 h-4" />
              Đặt lại mặc định
            </button>
            <button 
              className="admin-btn admin-btn-primary"
              onClick={saveConfigs}
              disabled={!hasChanges || saving}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>

        <div className="info-banner">
          <AlertCircle className="w-5 h-5" />
          <span>
            Giới hạn tốc độ giúp bảo vệ hệ thống khỏi lạm dụng và đảm bảo tài nguyên được phân phối công bằng cho tất cả người dùng.
          </span>
        </div>

        <div className="configs-grid">
          {configs.map((config) => (
            <div key={config.id} className="config-card">
              <div className="config-header">
                <div className="config-icon">
                  {config.icon}
                </div>
                <div className="config-info">
                  <h3 className="config-name">{config.name}</h3>
                  <p className="config-description">{config.description}</p>
                </div>
              </div>

              <div className="config-limits">
                <h4 className="limits-section-title">
                  <Users className="w-4 h-4" />
                  Giới hạn theo người dùng
                </h4>
                <div className="limits-row">
                  <div className="limit-field">
                    <label>Số lượng tối đa</label>
                    <input
                      type="number"
                      value={config.limits.userMax}
                      onChange={(e) => handleInputChange(config.id, 'userMax', parseInt(e.target.value))}
                      min={1}
                    />
                  </div>
                  <div className="limit-field">
                    <label>Khung thời gian (phút)</label>
                    <input
                      type="number"
                      value={config.limits.userWindowInMinutes}
                      onChange={(e) => handleInputChange(config.id, 'userWindowInMinutes', parseInt(e.target.value))}
                      min={1}
                    />
                  </div>
                </div>

                <h4 className="limits-section-title">
                  <Clock className="w-4 h-4" />
                  Giới hạn theo IP
                </h4>
                <div className="limits-row">
                  <div className="limit-field">
                    <label>Số lượng tối đa</label>
                    <input
                      type="number"
                      value={config.limits.ipMax}
                      onChange={(e) => handleInputChange(config.id, 'ipMax', parseInt(e.target.value))}
                      min={1}
                    />
                  </div>
                  <div className="limit-field">
                    <label>Khung thời gian (phút)</label>
                    <input
                      type="number"
                      value={config.limits.ipWindowInMinutes}
                      onChange={(e) => handleInputChange(config.id, 'ipWindowInMinutes', parseInt(e.target.value))}
                      min={1}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .rate-limiting {
          width: 100%;
        }

        .header-left {
          flex: 1;
        }

        .header-description {
          font-size: 14px;
          color: var(--text-tertiary, #9ca3af);
          margin: 4px 0 0;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .info-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 10px;
          margin-bottom: 24px;
          color: #3b82f6;
          font-size: 14px;
          line-height: 1.5;
        }

        .info-banner svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .configs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 20px;
        }

        .config-card {
          background: var(--surface-primary, #fff);
          border: 1px solid var(--border-light, #e5e7eb);
          border-radius: 12px;
          padding: 20px;
          transition: box-shadow 0.2s ease;
        }

        .config-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .config-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-light, #e5e7eb);
        }

        .config-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          border-radius: 10px;
          flex-shrink: 0;
        }

        .config-info {
          flex: 1;
        }

        .config-name {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary, #1e293b);
          margin: 0 0 4px;
        }

        .config-description {
          font-size: 13px;
          color: var(--text-tertiary, #9ca3af);
          margin: 0;
        }

        .config-limits {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .limits-section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary, #64748b);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .limits-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .limit-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .limit-field label {
          font-size: 13px;
          color: var(--text-secondary, #64748b);
        }

        .limit-field input {
          padding: 10px 12px;
          border: 1px solid var(--border-medium, #d1d5db);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary, #1e293b);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .limit-field input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .limit-field input:hover {
          border-color: var(--border-heavy, #9ca3af);
        }

        @media (max-width: 640px) {
          .header-actions {
            flex-direction: column;
            width: 100%;
          }

          .admin-card-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .configs-grid {
            grid-template-columns: 1fr;
          }

          .limits-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default RateLimiting;
