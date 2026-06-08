import React, { useState, useEffect } from 'react';
import { 
  Search, 
  UserPlus, 
  Edit2, 
  Trash2, 
  User,
  Shield,
  Check,
  X,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@librechat/client';

interface UserData {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  messageCount?: number;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { showToast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    email: '',
    role: 'USER',
    isActive: true,
    password: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        // Mock data
        setUsers([
          {
            id: '1',
            username: 'admin',
            name: 'Quản trị viên',
            email: 'admin@kma.edu.vn',
            role: 'ADMIN',
            isActive: true,
            createdAt: '2024-01-01',
            lastLogin: '2024-02-10',
            messageCount: 150,
          },
          {
            id: '2',
            username: 'giangvien01',
            name: 'Nguyễn Văn A',
            email: 'giangvien01@kma.edu.vn',
            role: 'USER',
            isActive: true,
            createdAt: '2024-01-15',
            lastLogin: '2024-02-09',
            messageCount: 85,
          },
          {
            id: '3',
            username: 'sinhvien01',
            name: 'Trần Thị B',
            email: 'sinhvien01@kma.edu.vn',
            role: 'USER',
            isActive: true,
            createdAt: '2024-02-01',
            lastLogin: '2024-02-10',
            messageCount: 42,
          },
          {
            id: '4',
            username: 'sinhvien02',
            name: 'Lê Văn C',
            email: 'sinhvien02@kma.edu.vn',
            role: 'USER',
            isActive: false,
            createdAt: '2024-02-05',
            messageCount: 10,
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast({ message: 'Không thể tải danh sách người dùng', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(search.toLowerCase()) ||
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.username) errors.username = 'Tên đăng nhập là bắt buộc';
    if (!formData.name) errors.name = 'Họ tên là bắt buộc';
    if (!formData.email) errors.email = 'Email là bắt buộc';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email không hợp lệ';
    }
    
    if (!editingUser) {
      if (!formData.password) errors.password = 'Mật khẩu là bắt buộc';
      else if (formData.password.length < 6) {
        errors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
      }
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      const url = editingUser 
        ? `/api/admin/users/${editingUser.id}` 
        : '/api/admin/users';
      
      const method = editingUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showToast({ 
          message: editingUser ? 'Cập nhật người dùng thành công' : 'Thêm người dùng thành công', 
          severity: 'success' 
        });
        fetchUsers();
        closeModal();
      } else {
        throw new Error('Failed to save user');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      showToast({ message: 'Không thể lưu thông tin người dùng', severity: 'error' });
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa người dùng này?')) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        showToast({ message: 'Xóa người dùng thành công', severity: 'success' });
        fetchUsers();
      } else {
        throw new Error('Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast({ message: 'Không thể xóa người dùng', severity: 'error' });
    }
  };

  const toggleUserStatus = async (user: UserData) => {
    try {
      const response = await fetch(`/api/admin/users/${user.id}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (response.ok) {
        showToast({ 
          message: user.isActive ? 'Đã khóa tài khoản' : 'Đã kích hoạt tài khoản', 
          severity: 'success' 
        });
        fetchUsers();
      } else {
        throw new Error('Failed to update user status');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      showToast({ message: 'Không thể cập nhật trạng thái', severity: 'error' });
    }
  };

  const openEditModal = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      password: '',
      confirmPassword: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      name: '',
      email: '',
      role: 'USER',
      isActive: true,
      password: '',
      confirmPassword: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setShowPassword(false);
  };

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { bg: string; color: string; label: string }> = {
      ADMIN: { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', label: 'Quản trị' },
      USER: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', label: 'Người dùng' },
      GUEST: { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280', label: 'Khách' },
    };
    const config = roleConfig[role] || roleConfig.USER;
    return (
      <span 
        className="role-badge" 
        style={{ backgroundColor: config.bg, color: config.color }}
      >
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="admin-card">
        <div className="admin-card-header">
          <div className="header-left">
            <h2 className="admin-card-title">Danh sách người dùng</h2>
            <span className="user-count">{users.length} người dùng</span>
          </div>
          <button className="admin-btn admin-btn-primary" onClick={openAddModal}>
            <UserPlus className="w-4 h-4" />
            Thêm người dùng
          </button>
        </div>

        {/* Search */}
        <div className="search-bar">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Users table */}
        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Đăng nhập cuối</th>
                <th>Tin nhắn</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="user-name">{user.name}</span>
                        <span className="user-username">@{user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{getRoleBadge(user.role)}</td>
                  <td>
                    <span className={`status-badge ${user.isActive ? 'status-badge-success' : 'status-badge-error'}`}>
                      {user.isActive ? (
                        <>
                          <Check className="w-3 h-3" />
                          Hoạt động
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3" />
                          Đã khóa
                        </>
                      )}
                    </span>
                  </td>
                  <td>{user.lastLogin || '-'}</td>
                  <td>{user.messageCount || 0}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="action-btn edit"
                        onClick={() => openEditModal(user)}
                        title="Sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        className={`action-btn ${user.isActive ? 'lock' : 'unlock'}`}
                        onClick={() => toggleUserStatus(user)}
                        title={user.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                      >
                        {user.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      </button>
                      {user.role !== 'ADMIN' && (
                        <button 
                          className="action-btn delete"
                          onClick={() => handleDelete(user.id)}
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editingUser ? 'Sửa người dùng' : 'Thêm người dùng'}</h2>
              <button className="modal-close-btn" onClick={closeModal}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="admin-modal-body">
              <div className="form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label">Tên đăng nhập *</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className={`admin-form-input ${formErrors.username ? 'error' : ''}`}
                    disabled={!!editingUser}
                  />
                  {formErrors.username && <span className="error-text">{formErrors.username}</span>}
                </div>

                <div className="admin-form-group">
                  <label className="admin-form-label">Họ tên *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`admin-form-input ${formErrors.name ? 'error' : ''}`}
                  />
                  {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`admin-form-input ${formErrors.email ? 'error' : ''}`}
                />
                {formErrors.email && <span className="error-text">{formErrors.email}</span>}
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Vai trò</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="admin-form-input"
                >
                  <option value="USER">Người dùng</option>
                  <option value="ADMIN">Quản trị viên</option>
                  <option value="GUEST">Khách</option>
                </select>
              </div>

              {!editingUser && (
                <div className="form-row">
                  <div className="admin-form-group">
                    <label className="admin-form-label">Mật khẩu *</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className={`admin-form-input ${formErrors.password ? 'error' : ''}`}
                      />
                      <button 
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {formErrors.password && <span className="error-text">{formErrors.password}</span>}
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-form-label">Xác nhận mật khẩu *</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className={`admin-form-input ${formErrors.confirmPassword ? 'error' : ''}`}
                    />
                    {formErrors.confirmPassword && <span className="error-text">{formErrors.confirmPassword}</span>}
                  </div>
                </div>
              )}

              <div className="admin-form-group admin-form-checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                  />
                  <span>Tài khoản hoạt động</span>
                </label>
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeModal}>
                  Hủy
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  <Save className="w-4 h-4" />
                  {editingUser ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .user-management {
          width: 100%;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-count {
          font-size: 14px;
          color: var(--text-tertiary, #9ca3af);
          padding: 4px 10px;
          background: var(--surface-secondary, #f1f5f9);
          border-radius: 6px;
        }

        .search-bar {
          position: relative;
          margin-bottom: 20px;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary, #9ca3af);
          width: 18px;
          height: 18px;
        }

        .search-input {
          width: 100%;
          max-width: 400px;
          padding: 10px 14px 10px 42px;
          border: 1px solid var(--border-light, #e5e7eb);
          border-radius: 8px;
          font-size: 14px;
        }

        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .table-wrapper {
          overflow-x: auto;
        }

        .user-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
          border-radius: 8px;
        }

        .user-name {
          display: block;
          font-weight: 500;
          color: var(--text-primary, #1e293b);
        }

        .user-username {
          display: block;
          font-size: 12px;
          color: var(--text-tertiary, #9ca3af);
        }

        .role-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-btn.edit {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .action-btn.edit:hover {
          background: rgba(59, 130, 246, 0.2);
        }

        .action-btn.lock {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }

        .action-btn.lock:hover {
          background: rgba(245, 158, 11, 0.2);
        }

        .action-btn.unlock {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .action-btn.unlock:hover {
          background: rgba(16, 185, 129, 0.2);
        }

        .action-btn.delete {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .action-btn.delete:hover {
          background: rgba(239, 68, 68, 0.2);
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
          max-width: 560px;
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
          margin: 0;
        }

        .modal-close-btn {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          color: var(--text-tertiary, #9ca3af);
          border-radius: 8px;
        }

        .modal-close-btn:hover {
          background: var(--surface-hover, #f1f5f9);
        }

        .admin-modal-body {
          padding: 24px;
          overflow-y: auto;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .admin-form-input.error {
          border-color: #ef4444;
        }

        .error-text {
          display: block;
          font-size: 12px;
          color: #ef4444;
          margin-top: 4px;
        }

        .password-input-wrapper {
          position: relative;
        }

        .password-input-wrapper .admin-form-input {
          padding-right: 40px;
        }

        .password-toggle {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: var(--text-tertiary, #9ca3af);
        }

        .password-toggle:hover {
          color: var(--text-secondary, #64748b);
        }

        .admin-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 20px;
          border-top: 1px solid var(--border-light, #e5e7eb);
          margin-top: 20px;
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
        }

        .checkbox-label input {
          width: 18px;
          height: 18px;
        }

        @media (max-width: 640px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default UserManagement;
