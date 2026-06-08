import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks/AuthContext';
import AdminSidebar from './AdminSidebar';
import ToolManagement from './ToolManagement';
import UserToolPermissions from './UserToolPermissions';
import UsageStatistics from './UsageStatistics';
import UserManagement from './UserManagement';
import ConversationLogs from './ConversationLogs';
import RateLimiting from './RateLimiting';
import './AdminDashboard.css';

// Admin Dashboard Views
export const ADMIN_VIEWS = {
  STATS: 'statistics',
  USERS: 'users',
  TOOLS: 'tools',
  TOOL_PERMISSIONS: 'tool-permissions',
  LOGS: 'logs',
  RATE_LIMITS: 'rate-limits',
} as const;

export type AdminView = typeof ADMIN_VIEWS[keyof typeof ADMIN_VIEWS];

const VIEW_TITLES: Record<AdminView, string> = {
  [ADMIN_VIEWS.STATS]: 'Thống kê sử dụng',
  [ADMIN_VIEWS.USERS]: 'Quản lý người dùng',
  [ADMIN_VIEWS.TOOLS]: 'Quản lý MCP Server/Tools',
  [ADMIN_VIEWS.TOOL_PERMISSIONS]: 'Phân quyền công cụ',
  [ADMIN_VIEWS.LOGS]: 'Lịch sử hội thoại',
  [ADMIN_VIEWS.RATE_LIMITS]: 'Giới hạn tốc độ',
};

const AdminDashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuthContext();
  const [activeView, setActiveView] = useState<AdminView>(ADMIN_VIEWS.STATS);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated and is admin
    if (!isAuthenticated || user?.role !== 'ADMIN') {
      navigate('/login');
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogout = () => {
    // Logout will be handled by AuthContext
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleViewChange = (view: AdminView) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  // Render content based on active view
  const renderContent = () => {
    switch (activeView) {
      case ADMIN_VIEWS.STATS:
        return <UsageStatistics />;
      case ADMIN_VIEWS.USERS:
        return <UserManagement />;
      case ADMIN_VIEWS.TOOLS:
        return <ToolManagement />;
      case ADMIN_VIEWS.TOOL_PERMISSIONS:
        return <UserToolPermissions />;
      case ADMIN_VIEWS.LOGS:
        return <ConversationLogs />;
      case ADMIN_VIEWS.RATE_LIMITS:
        return <RateLimiting />;
      default:
        return <UsageStatistics />;
    }
  };

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="admin-dashboard">
      {/* Mobile menu toggle */}
      <button 
        className="mobile-menu-toggle" 
        onClick={toggleMobileMenu}
        aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
      >
        {isMobileMenuOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Sidebar */}
      <AdminSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        onLogout={handleLogout}
        isMobileOpen={isMobileMenuOpen}
        user={user}
      />

      {/* Main content */}
      <main className="admin-content">
        <header className="admin-content-header">
          <h1>{VIEW_TITLES[activeView]}</h1>
        </header>
        
        <div className="admin-content-body">
          {renderContent()}
        </div>
      </main>
      
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-menu-overlay" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
