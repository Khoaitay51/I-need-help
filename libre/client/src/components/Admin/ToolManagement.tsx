import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Plus, 
  Trash2, 
  Edit2, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Settings,
  Terminal,
  Globe,
  Save,
  X
} from 'lucide-react';
import { useToast } from '@librechat/client';

interface MCPServer {
  id: string;
  name: string;
  type: 'stdio' | 'sse';
  url?: string;
  command?: string;
  args?: string[];
  timeout?: number;
  iconPath?: string;
  isEnabled: boolean;
  connectionState: 'connected' | 'disconnected' | 'connecting' | 'error';
  tools?: string[];
}

interface ToolManagementProps {
  // Props if needed
}

const ToolManagement: React.FC<ToolManagementProps> = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const { showToast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'sse' as 'stdio' | 'sse',
    url: '',
    command: '',
    args: '',
    timeout: 60000,
    iconPath: '',
    isEnabled: true,
  });

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/mcp-servers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setServers(data.servers || []);
      } else {
        // Mock data for development
        setServers([
          {
            id: '1',
            name: 'kma-chatbot-mcp',
            type: 'sse',
            url: 'http://localhost:3001/sse',
            timeout: 60000,
            isEnabled: true,
            connectionState: 'connected',
            tools: ['phongdaotao_tools', 'phongkhaothi_tools', 'common_tools'],
          },
          {
            id: '2',
            name: 'filesystem',
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user/data'],
            timeout: 60000,
            isEnabled: true,
            connectionState: 'disconnected',
            tools: ['read_file', 'write_file', 'list_directory'],
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
      showToast({ message: 'Không thể tải danh sách MCP Server', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const serverData = {
        ...formData,
        args: formData.args ? formData.args.split('\n').filter(arg => arg.trim()) : [],
      };

      const url = editingServer 
        ? `/api/admin/mcp-servers/${editingServer.id}` 
        : '/api/admin/mcp-servers';
      
      const method = editingServer ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serverData),
      });

      if (response.ok) {
        showToast({ 
          message: editingServer ? 'Cập nhật MCP Server thành công' : 'Thêm MCP Server thành công', 
          severity: 'success' 
        });
        fetchServers();
        closeModal();
      } else {
        throw new Error('Failed to save MCP server');
      }
    } catch (error) {
      console.error('Error saving MCP server:', error);
      showToast({ message: 'Không thể lưu MCP Server', severity: 'error' });
    }
  };

  const handleDelete = async (serverId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa MCP Server này?')) return;

    try {
      const response = await fetch(`/api/admin/mcp-servers/${serverId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        showToast({ message: 'Xóa MCP Server thành công', severity: 'success' });
        fetchServers();
      } else {
        throw new Error('Failed to delete MCP server');
      }
    } catch (error) {
      console.error('Error deleting MCP server:', error);
      showToast({ message: 'Không thể xóa MCP Server', severity: 'error' });
    }
  };

  const handleRefresh = async (serverId: string) => {
    setRefreshing(serverId);
    try {
      const response = await fetch(`/api/admin/mcp-servers/${serverId}/reconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        showToast({ message: 'Đã kết nối lại MCP Server', severity: 'success' });
        fetchServers();
      } else {
        throw new Error('Failed to reconnect');
      }
    } catch (error) {
      console.error('Error reconnecting MCP server:', error);
      showToast({ message: 'Không thể kết nối lại MCP Server', severity: 'error' });
    } finally {
      setRefreshing(null);
    }
  };

  const openEditModal = (server: MCPServer) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      type: server.type,
      url: server.url || '',
      command: server.command || '',
      args: server.args?.join('\n') || '',
      timeout: server.timeout || 60000,
      iconPath: server.iconPath || '',
      isEnabled: server.isEnabled,
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingServer(null);
    setFormData({
      name: '',
      type: 'sse',
      url: '',
      command: '',
      args: '',
      timeout: 60000,
      iconPath: '',
      isEnabled: true,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingServer(null);
  };

  const getStatusBadge = (state: MCPServer['connectionState']) => {
    switch (state) {
      case 'connected':
        return (
          <span className="status-badge status-badge-success">
            <CheckCircle className="w-3 h-3" />
            Đã kết nối
          </span>
        );
      case 'connecting':
        return (
          <span className="status-badge status-badge-info">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Đang kết nối
          </span>
        );
      case 'error':
        return (
          <span className="status-badge status-badge-error">
            <XCircle className="w-3 h-3" />
            Lỗi
          </span>
        );
      default:
        return (
          <span className="status-badge status-badge-warning">
            <XCircle className="w-3 h-3" />
            Ngắt kết nối
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
      </div>
    );
  }

  return (
    <div className="tool-management">
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Danh sách MCP Server</h2>
          <button className="admin-btn admin-btn-primary" onClick={openAddModal}>
            <Plus className="w-4 h-4" />
            Thêm MCP Server
          </button>
        </div>

        {servers.length === 0 ? (
          <div className="admin-empty-state">
            <Server className="admin-empty-state-icon" />
            <h3 className="admin-empty-state-title">Chưa có MCP Server nào</h3>
            <p className="admin-empty-state-description">
              Thêm MCP Server để kết nối các công cụ cho hệ thống chatbot.
            </p>
          </div>
        ) : (
          <div className="server-grid">
            {servers.map((server) => (
              <div key={server.id} className="server-card">
                <div className="server-card-header">
                  <div className="server-info">
                    <div className="server-icon">
                      {server.type === 'sse' ? (
                        <Globe className="w-5 h-5" />
                      ) : (
                        <Terminal className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="server-name">{server.name}</h3>
                      <span className="server-type">
                        {server.type === 'sse' ? 'HTTP/SSE' : 'STDIO'}
                      </span>
                    </div>
                  </div>
                  {getStatusBadge(server.connectionState)}
                </div>

                <div className="server-details">
                  {server.type === 'sse' && server.url && (
                    <div className="server-detail-item">
                      <span className="detail-label">URL:</span>
                      <span className="detail-value">{server.url}</span>
                    </div>
                  )}
                  {server.type === 'stdio' && server.command && (
                    <div className="server-detail-item">
                      <span className="detail-label">Command:</span>
                      <span className="detail-value">{server.command}</span>
                    </div>
                  )}
                  <div className="server-detail-item">
                    <span className="detail-label">Timeout:</span>
                    <span className="detail-value">{server.timeout}ms</span>
                  </div>
                </div>

                {server.tools && server.tools.length > 0 && (
                  <div className="server-tools">
                    <span className="tools-label">Công cụ ({server.tools.length}):</span>
                    <div className="tools-list">
                      {server.tools.slice(0, 3).map((tool, index) => (
                        <span key={index} className="tool-tag">{tool}</span>
                      ))}
                      {server.tools.length > 3 && (
                        <span className="tool-tag tool-tag-more">
                          +{server.tools.length - 3} khác
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="server-actions">
                  <button 
                    className="admin-btn admin-btn-secondary"
                    onClick={() => handleRefresh(server.id)}
                    disabled={refreshing === server.id}
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing === server.id ? 'animate-spin' : ''}`} />
                    Kết nối lại
                  </button>
                  <button 
                    className="admin-btn admin-btn-secondary"
                    onClick={() => openEditModal(server)}
                  >
                    <Edit2 className="w-4 h-4" />
                    Sửa
                  </button>
                  <button 
                    className="admin-btn admin-btn-danger"
                    onClick={() => handleDelete(server.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editingServer ? 'Sửa MCP Server' : 'Thêm MCP Server'}</h2>
              <button className="modal-close-btn" onClick={closeModal}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="admin-modal-body">
              <div className="admin-form-group">
                <label className="admin-form-label">Tên Server *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="admin-form-input"
                  placeholder="Ví dụ: kma-chatbot-mcp"
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Loại kết nối *</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="admin-form-input"
                >
                  <option value="sse">HTTP/SSE</option>
                  <option value="stdio">STDIO (Command Line)</option>
                </select>
              </div>

              {formData.type === 'sse' ? (
                <div className="admin-form-group">
                  <label className="admin-form-label">URL *</label>
                  <input
                    type="url"
                    name="url"
                    value={formData.url}
                    onChange={handleInputChange}
                    className="admin-form-input"
                    placeholder="http://localhost:3001/sse"
                    required
                  />
                </div>
              ) : (
                <>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Command *</label>
                    <input
                      type="text"
                      name="command"
                      value={formData.command}
                      onChange={handleInputChange}
                      className="admin-form-input"
                      placeholder="npx"
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Arguments (mỗi dòng một argument)</label>
                    <textarea
                      name="args"
                      value={formData.args}
                      onChange={handleInputChange}
                      className="admin-form-input admin-form-textarea"
                      placeholder="-y&#10;@modelcontextprotocol/server-filesystem&#10;/path/to/directory"
                      rows={4}
                    />
                  </div>
                </>
              )}

              <div className="admin-form-group">
                <label className="admin-form-label">Timeout (ms)</label>
                <input
                  type="number"
                  name="timeout"
                  value={formData.timeout}
                  onChange={handleInputChange}
                  className="admin-form-input"
                  min={1000}
                  max={600000}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Icon Path (tùy chọn)</label>
                <input
                  type="text"
                  name="iconPath"
                  value={formData.iconPath}
                  onChange={handleInputChange}
                  className="admin-form-input"
                  placeholder="/assets/logo.svg"
                />
              </div>

              <div className="admin-form-group admin-form-checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isEnabled"
                    checked={formData.isEnabled}
                    onChange={handleInputChange}
                  />
                  <span>Kích hoạt server</span>
                </label>
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeModal}>
                  Hủy
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  <Save className="w-4 h-4" />
                  {editingServer ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .tool-management {
          width: 100%;
        }

        .server-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 20px;
        }

        .server-card {
          background: var(--surface-primary, #fff);
          border: 1px solid var(--border-light, #e5e7eb);
          border-radius: 12px;
          padding: 20px;
          transition: box-shadow 0.2s ease;
        }

        .server-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .server-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .server-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .server-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 10px;
          color: #3b82f6;
        }

        .server-name {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary, #1e293b);
          margin: 0;
        }

        .server-type {
          font-size: 12px;
          color: var(--text-tertiary, #9ca3af);
        }

        .server-details {
          margin-bottom: 16px;
          padding: 12px;
          background: var(--surface-secondary, #f8fafc);
          border-radius: 8px;
        }

        .server-detail-item {
          display: flex;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .server-detail-item:last-child {
          margin-bottom: 0;
        }

        .detail-label {
          font-weight: 500;
          color: var(--text-secondary, #64748b);
          min-width: 80px;
        }

        .detail-value {
          color: var(--text-primary, #1e293b);
          word-break: break-all;
        }

        .server-tools {
          margin-bottom: 16px;
        }

        .tools-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary, #64748b);
          display: block;
          margin-bottom: 8px;
        }

        .tools-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tool-tag {
          display: inline-block;
          padding: 4px 10px;
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .tool-tag-more {
          background: var(--surface-secondary, #f1f5f9);
          color: var(--text-tertiary, #64748b);
        }

        .server-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .server-actions .admin-btn {
          padding: 8px 12px;
          font-size: 13px;
        }

        /* Modal styles */
        .admin-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .admin-modal {
          background: var(--surface-primary, #fff);
          border-radius: 16px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .admin-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-light, #e5e7eb);
        }

        .admin-modal-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary, #1e293b);
          margin: 0;
        }

        .modal-close-btn {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          color: var(--text-tertiary, #9ca3af);
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .modal-close-btn:hover {
          background: var(--surface-hover, #f1f5f9);
          color: var(--text-primary, #1e293b);
        }

        .admin-modal-body {
          padding: 24px;
          overflow-y: auto;
        }

        .admin-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 20px;
          border-top: 1px solid var(--border-light, #e5e7eb);
          margin-top: 20px;
        }

        .admin-form-textarea {
          resize: vertical;
          min-height: 80px;
          font-family: monospace;
        }

        .admin-form-checkbox {
          margin-top: 16px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-size: 14px;
          color: var(--text-primary, #1e293b);
        }

        .checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        @media (max-width: 640px) {
          .server-grid {
            grid-template-columns: 1fr;
          }

          .server-actions {
            flex-direction: column;
          }

          .server-actions .admin-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default ToolManagement;
