import React from 'react';
import { 
  BarChart2, 
  Users, 
  Settings, 
  Clock, 
  AlertCircle, 
  LogOut, 
  UserCheck,
  Wrench,
  Shield
} from 'lucide-react';
import type { TUser } from 'librechat-data-provider';
import { ADMIN_VIEWS, type AdminView } from './AdminDashboard';

interface AdminSidebarProps {
  activeView: AdminView;
  onViewChange: (view: AdminView) => void;
  onLogout: () => void;
  isMobileOpen: boolean;
  user: TUser | null | undefined;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeView,
  onViewChange,
  onLogout,
  isMobileOpen,
  user,
}) => {
  const navItems = [
    {
      view: ADMIN_VIEWS.STATS,
      icon: BarChart2,
      label: 'Thống kê sử dụng',
    },
    {
      view: ADMIN_VIEWS.USERS,
      icon: Users,
      label: 'Quản lý người dùng',
    },
    {
      view: ADMIN_VIEWS.TOOLS,
      icon: Wrench,
      label: 'Quản lý MCP Server',
    },
    {
      view: ADMIN_VIEWS.TOOL_PERMISSIONS,
      icon: Shield,
      label: 'Phân quyền công cụ',
    },
    {
      view: ADMIN_VIEWS.LOGS,
      icon: Clock,
      label: 'Lịch sử hội thoại',
    },
    {
      view: ADMIN_VIEWS.RATE_LIMITS,
      icon: AlertCircle,
      label: 'Giới hạn tốc độ',
    },
  ];

  return (
    <aside className={`admin-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="admin-sidebar-header">
        <img 
          src="/assets/kma-logo.svg" 
          alt="KMA Logo" 
          className="admin-logo"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/assets/logo.svg';
          }}
        />
        <h2>Quản trị Chatbot</h2>
        <span className="admin-subtitle">Học viện Kỹ thuật Mật mã</span>
      </div>
      
      <nav className="admin-nav">
        <ul>
          {navItems.map(({ view, icon: Icon, label }) => (
            <li key={view}>
              <button 
                className={activeView === view ? 'active' : ''} 
                onClick={() => onViewChange(view)}
              >
                <Icon className="nav-icon" />
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="admin-sidebar-footer">
        <div className="admin-user-info">
          <UserCheck className="user-icon" />
          <div className="user-details">
            <span className="user-name">{user?.name || user?.username || 'Admin'}</span>
            <span className="user-role">Quản trị viên</span>
          </div>
        </div>
        <button className="admin-logout-button" onClick={onLogout}>
          <LogOut className="logout-icon" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
