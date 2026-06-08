import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Shield, 
  User, 
  Check, 
  X, 
  Save,
  ChevronDown,
  ChevronRight,
  Wrench,
  Users,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@librechat/client';

interface Tool {
  id: string;
  name: string;
  description?: string;
  serverName: string;
}

interface MCPServer {
  id: string;
  name: string;
  tools: Tool[];
}

interface UserPermission {
  userId: string;
  username: string;
  name: string;
  email: string;
  role: string;
  allowedTools: string[];
  allowedServers: string[];
}

interface RolePermission {
  roleName: string;
  displayName: string;
  allowedTools: string[];
  allowedServers: string[];
}

const UserToolPermissions: React.FC = () => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [users, setUsers] = useState<UserPermission[]>([]);
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('roles');
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [selectedEntity, setSelectedEntity] = useState<UserPermission | RolePermission | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string[]>>({});
  const [pendingServerChanges, setPendingServerChanges] = useState<Record<string, string[]>>({});
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch servers with tools
      const serversRes = await fetch('/api/admin/mcp-servers', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      
      // Fetch users
      const usersRes = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      // Fetch roles
      const rolesRes = await fetch('/api/admin/roles', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      // Mock data for development
      setServers([
        {
          id: '1',
          name: 'kma-chatbot-mcp',
          tools: [
            { id: 't1', name: 'phongdaotao_tools', description: 'Công cụ tra cứu phòng đào tạo', serverName: 'kma-chatbot-mcp' },
            { id: 't2', name: 'phongkhaothi_tools', description: 'Công cụ tra cứu phòng khảo thí', serverName: 'kma-chatbot-mcp' },
            { id: 't3', name: 'common_tools', description: 'Công cụ chung', serverName: 'kma-chatbot-mcp' },
          ],
        },
        {
          id: '2',
          name: 'filesystem',
          tools: [
            { id: 't4', name: 'read_file', description: 'Đọc file', serverName: 'filesystem' },
            { id: 't5', name: 'write_file', description: 'Ghi file', serverName: 'filesystem' },
            { id: 't6', name: 'list_directory', description: 'Liệt kê thư mục', serverName: 'filesystem' },
          ],
        },
      ]);

      setUsers([
        {
          userId: 'u1',
          username: 'admin',
          name: 'Admin User',
          email: 'admin@kma.edu.vn',
          role: 'ADMIN',
          allowedTools: ['*'],
          allowedServers: ['*'],
        },
        {
          userId: 'u2',
          username: 'sinhvien01',
          name: 'Nguyễn Văn A',
          email: 'sinhvien01@kma.edu.vn',
          role: 'USER',
          allowedTools: ['phongdaotao_tools', 'phongkhaothi_tools', 'common_tools'],
          allowedServers: ['kma-chatbot-mcp'],
        },
      ]);

      setRoles([
        {
          roleName: 'ADMIN',
          displayName: 'Quản trị viên',
          allowedTools: ['*'],
          allowedServers: ['*'],
        },
        {
          roleName: 'USER',
          displayName: 'Người dùng',
          allowedTools: ['phongdaotao_tools', 'phongkhaothi_tools', 'common_tools'],
          allowedServers: ['kma-chatbot-mcp'],
        },
        {
          roleName: 'GUEST',
          displayName: 'Khách',
          allowedTools: ['common_tools'],
          allowedServers: ['kma-chatbot-mcp'],
        },
      ]);

    } catch (error) {
      console.error('Error fetching data:', error);
      showToast({ message: 'Không thể tải dữ liệu', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const toggleServer = (serverId: string) => {
    const newExpanded = new Set(expandedServers);
    if (newExpanded.has(serverId)) {
      newExpanded.delete(serverId);
    } else {
      newExpanded.add(serverId);
    }
    setExpandedServers(newExpanded);
  };

  const isToolAllowed = (toolName: string): boolean => {
    if (!selectedEntity) return false;
    const entityKey = 'userId' in selectedEntity ? selectedEntity.userId : selectedEntity.roleName;
    const pending = pendingChanges[entityKey];
    if (pending) {
      return pending.includes(toolName) || pending.includes('*');
    }
    return selectedEntity.allowedTools.includes(toolName) || selectedEntity.allowedTools.includes('*');
  };

  const isServerAllowed = (serverName: string): boolean => {
    if (!selectedEntity) return false;
    const entityKey = 'userId' in selectedEntity ? selectedEntity.userId : selectedEntity.roleName;
    const pending = pendingServerChanges[entityKey];
    if (pending) {
      return pending.includes(serverName) || pending.includes('*');
    }
    return selectedEntity.allowedServers.includes(serverName) || selectedEntity.allowedServers.includes('*');
  };

  const toggleTool = (toolName: string) => {
    if (!selectedEntity) return;
    
    const entityKey = 'userId' in selectedEntity ? selectedEntity.userId : selectedEntity.roleName;
    const currentTools = pendingChanges[entityKey] || [...selectedEntity.allowedTools];
    
    let newTools: string[];
    if (currentTools.includes('*')) {
      return; // Admin has all access, don't toggle
    }
    
    if (currentTools.includes(toolName)) {
      newTools = currentTools.filter(t => t !== toolName);
    } else {
      newTools = [...currentTools, toolName];
    }
    
    setPendingChanges(prev => ({
      ...prev,
      [entityKey]: newTools,
    }));
  };

  const toggleServer = (serverName: string) => {
    if (!selectedEntity) return;
    
    const entityKey = 'userId' in selectedEntity ? selectedEntity.userId : selectedEntity.roleName;
    const currentServers = pendingServerChanges[entityKey] || [...selectedEntity.allowedServers];
    
    let newServers: string[];
    if (currentServers.includes('*')) {
      return; // Admin has all access
    }
    
    if (currentServers.includes(serverName)) {
      newServers = currentServers.filter(s => s !== serverName);
    } else {
      newServers = [...currentServers, serverName];
    }
    
    setPendingServerChanges(prev => ({
      ...prev,
      [entityKey]: newServers,
    }));
  };

  const toggleAllToolsForServer = (serverName: string, tools: Tool[]) => {
    if (!selectedEntity) return;
    
    const entityKey = 'userId' in selectedEntity ? selectedEntity.userId : selectedEntity.roleName;
    const currentTools = pendingChanges[entityKey] || [...selectedEntity.allowedTools];
    
    if (currentTools.includes('*')) return;
    
    const serverToolNames = tools.map(t => t.name);
    const allSelected = serverToolNames.every(t => currentTools.includes(t));
    
    let newTools: string[];
    if (allSelected) {
      newTools = currentTools.filter(t => !serverToolNames.includes(t));
    } else {
      newTools = [...new Set([...currentTools, ...serverToolNames])];
    }
    
    setPendingChanges(prev => ({
      ...prev,
      [entityKey]: newTools,
    }));
  };

  const saveChanges = async () => {
    if (!selectedEntity) return;
    
    try {
      const entityKey = 'userId' in selectedEntity ? selectedEntity.userId : selectedEntity.roleName;
      const isUser = 'userId' in selectedEntity;
      
      const url = isUser 
        ? `/api/admin/users/${entityKey}/permissions`
        : `/api/admin/roles/${entityKey}/permissions`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allowedTools: pendingChanges[entityKey] || selectedEntity.allowedTools,
          allowedServers: pendingServerChanges[entityKey] || selectedEntity.allowedServers,
        }),
      });

      if (response.ok) {
        showToast({ message: 'Lưu phân quyền thành công', severity: 'success' });
        fetchData();
        setPendingChanges({});
        setPendingServerChanges({});
      } else {
        throw new Error('Failed to save permissions');
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      showToast({ message: 'Không thể lưu phân quyền', severity: 'error' });
    }
  };

  const hasChanges = (): boolean => {
    if (!selectedEntity) return false;
    const entityKey = 'userId' in selectedEntity ? selectedEntity.userId : selectedEntity.roleName;
    return !!(pendingChanges[entityKey] || pendingServerChanges[entityKey]);
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
      </div>
    );
  }

  return (
    <div className="permissions-container">
      <div className="permissions-layout">
        {/* Left panel - Users/Roles list */}
        <div className="permissions-list-panel">
          <div className="panel-header">
            <div className="tab-buttons">
              <button 
                className={`tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('roles');
                  setSelectedEntity(null);
                }}
              >
                <Shield className="w-4 h-4" />
                Vai trò
              </button>
              <button 
                className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('users');
                  setSelectedEntity(null);
                }}
              >
                <Users className="w-4 h-4" />
                Người dùng
              </button>
            </div>
          </div>

          {activeTab === 'users' && (
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Tìm kiếm người dùng..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
              />
            </div>
          )}

          <div className="entity-list">
            {activeTab === 'roles' ? (
              roles.map((role) => (
                <div 
                  key={role.roleName}
                  className={`entity-item ${selectedEntity && 'roleName' in selectedEntity && selectedEntity.roleName === role.roleName ? 'selected' : ''}`}
                  onClick={() => setSelectedEntity(role)}
                >
                  <div className="entity-icon role-icon">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="entity-info">
                    <span className="entity-name">{role.displayName}</span>
                    <span className="entity-meta">
                      {role.allowedTools.includes('*') ? 'Tất cả quyền' : `${role.allowedTools.length} công cụ`}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              filteredUsers.map((user) => (
                <div 
                  key={user.userId}
                  className={`entity-item ${selectedEntity && 'userId' in selectedEntity && selectedEntity.userId === user.userId ? 'selected' : ''}`}
                  onClick={() => setSelectedEntity(user)}
                >
                  <div className="entity-icon user-icon">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="entity-info">
                    <span className="entity-name">{user.name || user.username}</span>
                    <span className="entity-meta">{user.email}</span>
                  </div>
                  <span className={`role-badge ${user.role.toLowerCase()}`}>
                    {user.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right panel - Permissions editor */}
        <div className="permissions-editor-panel">
          {selectedEntity ? (
            <>
              <div className="editor-header">
                <div className="editor-title">
                  <h3>
                    {'userId' in selectedEntity 
                      ? `Phân quyền cho ${selectedEntity.name || selectedEntity.username}`
                      : `Phân quyền vai trò ${selectedEntity.displayName}`
                    }
                  </h3>
                  {'userId' in selectedEntity && (
                    <span className="editor-subtitle">
                      Kế thừa từ vai trò: {selectedEntity.role}
                    </span>
                  )}
                </div>
                {hasChanges() && (
                  <button className="admin-btn admin-btn-primary" onClick={saveChanges}>
                    <Save className="w-4 h-4" />
                    Lưu thay đổi
                  </button>
                )}
              </div>

              {selectedEntity.allowedTools.includes('*') && (
                <div className="admin-notice">
                  <AlertCircle className="w-5 h-5" />
                  <span>Tài khoản này có quyền truy cập tất cả các công cụ.</span>
                </div>
              )}

              <div className="servers-list">
                {servers.map((server) => (
                  <div key={server.id} className="server-group">
                    <div 
                      className="server-group-header"
                      onClick={() => toggleServer(server.id)}
                    >
                      <div className="server-group-left">
                        {expandedServers.has(server.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <Wrench className="w-4 h-4" />
                        <span className="server-group-name">{server.name}</span>
                        <span className="tools-count">({server.tools.length} công cụ)</span>
                      </div>
                      <div className="server-group-right">
                        <label className="checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isServerAllowed(server.name)}
                            onChange={() => toggleAllToolsForServer(server.name, server.tools)}
                            disabled={selectedEntity.allowedTools.includes('*')}
                          />
                          <span>Chọn tất cả</span>
                        </label>
                      </div>
                    </div>

                    {expandedServers.has(server.id) && (
                      <div className="tools-list">
                        {server.tools.map((tool) => (
                          <div key={tool.id} className="tool-item">
                            <label className="tool-checkbox">
                              <input
                                type="checkbox"
                                checked={isToolAllowed(tool.name)}
                                onChange={() => toggleTool(tool.name)}
                                disabled={selectedEntity.allowedTools.includes('*')}
                              />
                              <div className="tool-info">
                                <span className="tool-name">{tool.name}</span>
                                {tool.description && (
                                  <span className="tool-description">{tool.description}</span>
                                )}
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="editor-empty">
              <Shield className="empty-icon" />
              <h3>Chọn vai trò hoặc người dùng</h3>
              <p>Chọn một vai trò hoặc người dùng từ danh sách bên trái để quản lý phân quyền công cụ.</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .permissions-container {
          height: calc(100vh - 180px);
        }

        .permissions-layout {
          display: flex;
          gap: 24px;
          height: 100%;
        }

        .permissions-list-panel {
          width: 360px;
          flex-shrink: 0;
          background: var(--surface-primary, #fff);
          border: 1px solid var(--border-light, #e5e7eb);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .panel-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-light, #e5e7eb);
        }

        .tab-buttons {
          display: flex;
          gap: 8px;
        }

        .tab-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          border: 1px solid var(--border-light, #e5e7eb);
          border-radius: 8px;
          background: var(--surface-secondary, #f8fafc);
          color: var(--text-secondary, #64748b);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tab-btn:hover {
          background: var(--surface-hover, #f1f5f9);
        }

        .tab-btn.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: #fff;
        }

        .search-wrapper {
          position: relative;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-light, #e5e7eb);
        }

        .search-icon {
          position: absolute;
          left: 28px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary, #9ca3af);
          width: 16px;
          height: 16px;
        }

        .search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border: 1px solid var(--border-light, #e5e7eb);
          border-radius: 8px;
          font-size: 14px;
        }

        .entity-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .entity-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .entity-item:hover {
          background: var(--surface-hover, #f1f5f9);
        }

        .entity-item.selected {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .entity-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
        }

        .role-icon {
          background: rgba(139, 92, 246, 0.1);
          color: #8b5cf6;
        }

        .user-icon {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .entity-info {
          flex: 1;
          min-width: 0;
        }

        .entity-name {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary, #1e293b);
        }

        .entity-meta {
          display: block;
          font-size: 12px;
          color: var(--text-tertiary, #9ca3af);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .role-badge {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .role-badge.admin {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .role-badge.user {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .role-badge.guest {
          background: rgba(107, 114, 128, 0.1);
          color: #6b7280;
        }

        .permissions-editor-panel {
          flex: 1;
          background: var(--surface-primary, #fff);
          border: 1px solid var(--border-light, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .editor-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-light, #e5e7eb);
        }

        .editor-title h3 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary, #1e293b);
          margin: 0;
        }

        .editor-subtitle {
          font-size: 13px;
          color: var(--text-tertiary, #9ca3af);
          margin-top: 4px;
          display: block;
        }

        .admin-notice {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 24px;
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          font-size: 14px;
        }

        .servers-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
        }

        .server-group {
          border: 1px solid var(--border-light, #e5e7eb);
          border-radius: 10px;
          margin-bottom: 12px;
          overflow: hidden;
        }

        .server-group-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: var(--surface-secondary, #f8fafc);
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .server-group-header:hover {
          background: var(--surface-hover, #f1f5f9);
        }

        .server-group-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .server-group-name {
          font-weight: 600;
          color: var(--text-primary, #1e293b);
        }

        .tools-count {
          font-size: 13px;
          color: var(--text-tertiary, #9ca3af);
        }

        .checkbox-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary, #64748b);
          cursor: pointer;
        }

        .checkbox-wrapper input {
          width: 16px;
          height: 16px;
        }

        .tools-list {
          padding: 8px 16px 16px;
        }

        .tool-item {
          padding: 10px 12px;
          border-radius: 8px;
          transition: background 0.2s ease;
        }

        .tool-item:hover {
          background: var(--surface-hover, #f1f5f9);
        }

        .tool-checkbox {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
        }

        .tool-checkbox input {
          width: 18px;
          height: 18px;
          margin-top: 2px;
        }

        .tool-info {
          flex: 1;
        }

        .tool-name {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary, #1e293b);
        }

        .tool-description {
          display: block;
          font-size: 12px;
          color: var(--text-tertiary, #9ca3af);
          margin-top: 2px;
        }

        .editor-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 48px;
          text-align: center;
        }

        .empty-icon {
          width: 64px;
          height: 64px;
          color: var(--text-tertiary, #9ca3af);
          margin-bottom: 16px;
        }

        .editor-empty h3 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary, #1e293b);
          margin: 0 0 8px;
        }

        .editor-empty p {
          font-size: 14px;
          color: var(--text-secondary, #64748b);
          max-width: 300px;
        }

        @media (max-width: 1024px) {
          .permissions-layout {
            flex-direction: column;
          }

          .permissions-list-panel {
            width: 100%;
            max-height: 300px;
          }
        }
      `}</style>
    </div>
  );
};

export default UserToolPermissions;
