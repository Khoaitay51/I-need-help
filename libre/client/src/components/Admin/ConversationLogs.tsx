import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  User, 
  Clock, 
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
  Filter
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  userId: string;
  username: string;
  userName: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

const ConversationLogs: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('all');
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);

  useEffect(() => {
    fetchConversations();
  }, [dateFilter]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/conversations?dateFilter=${dateFilter}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      } else {
        // Mock data
        setConversations([
          {
            id: '1',
            userId: 'u1',
            username: 'sinhvien01',
            userName: 'Nguyễn Văn A',
            title: 'Hỏi về lịch thi học kỳ',
            messageCount: 8,
            createdAt: '2024-02-10 09:30',
            updatedAt: '2024-02-10 09:45',
          },
          {
            id: '2',
            userId: 'u2',
            username: 'sinhvien02',
            userName: 'Trần Thị B',
            title: 'Tra cứu điểm môn học',
            messageCount: 5,
            createdAt: '2024-02-10 10:15',
            updatedAt: '2024-02-10 10:25',
          },
          {
            id: '3',
            userId: 'u3',
            username: 'giangvien01',
            userName: 'Lê Văn C',
            title: 'Thông tin đào tạo',
            messageCount: 12,
            createdAt: '2024-02-09 14:30',
            updatedAt: '2024-02-09 15:00',
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setLoadingMessages(conversationId);
    try {
      const response = await fetch(`/api/admin/conversations/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversations(prev => prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, messages: data.messages }
            : conv
        ));
      } else {
        // Mock messages
        setConversations(prev => prev.map(conv => 
          conv.id === conversationId 
            ? { 
                ...conv, 
                messages: [
                  { id: 'm1', role: 'user', content: 'Xin chào, tôi muốn hỏi về lịch thi học kỳ này', timestamp: '09:30' },
                  { id: 'm2', role: 'assistant', content: 'Xin chào! Tôi có thể giúp bạn tra cứu lịch thi. Bạn muốn xem lịch thi của môn nào hoặc ngành nào?', timestamp: '09:30' },
                  { id: 'm3', role: 'user', content: 'Tôi muốn xem lịch thi ngành An toàn thông tin', timestamp: '09:32' },
                  { id: 'm4', role: 'assistant', content: 'Dựa trên dữ liệu từ phòng khảo thí, lịch thi học kỳ 2 năm học 2023-2024 cho ngành An toàn thông tin như sau:\n\n- Toán cao cấp: 15/02/2024\n- Lập trình căn bản: 18/02/2024\n- Mạng máy tính: 20/02/2024\n\nBạn cần thông tin chi tiết hơn không?', timestamp: '09:33' },
                ]
              }
            : conv
        ));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(null);
    }
  };

  const toggleExpand = async (conversationId: string) => {
    if (expandedId === conversationId) {
      setExpandedId(null);
    } else {
      setExpandedId(conversationId);
      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation?.messages) {
        await fetchMessages(conversationId);
      }
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.userName.toLowerCase().includes(search.toLowerCase()) ||
    conv.username.toLowerCase().includes(search.toLowerCase()) ||
    conv.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
      </div>
    );
  }

  return (
    <div className="conversation-logs">
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Lịch sử hội thoại</h2>
          <span className="conversation-count">{conversations.length} hội thoại</span>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm theo người dùng, tiêu đề..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="date-filter">
            <Filter className="filter-icon" />
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
              className="date-select"
            >
              <option value="all">Tất cả</option>
              <option value="today">Hôm nay</option>
              <option value="week">7 ngày qua</option>
              <option value="month">30 ngày qua</option>
            </select>
          </div>
        </div>

        {/* Conversations list */}
        <div className="conversations-list">
          {filteredConversations.length === 0 ? (
            <div className="admin-empty-state">
              <MessageSquare className="admin-empty-state-icon" />
              <h3 className="admin-empty-state-title">Không có hội thoại nào</h3>
              <p className="admin-empty-state-description">
                Chưa có hội thoại nào phù hợp với bộ lọc của bạn.
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div key={conv.id} className="conversation-item">
                <div 
                  className="conversation-header"
                  onClick={() => toggleExpand(conv.id)}
                >
                  <div className="conversation-left">
                    <button className="expand-btn">
                      {expandedId === conv.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <div className="conversation-info">
                      <h4 className="conversation-title">{conv.title}</h4>
                      <div className="conversation-meta">
                        <span className="meta-item">
                          <User className="w-3 h-3" />
                          {conv.userName} (@{conv.username})
                        </span>
                        <span className="meta-item">
                          <MessageSquare className="w-3 h-3" />
                          {conv.messageCount} tin nhắn
                        </span>
                        <span className="meta-item">
                          <Clock className="w-3 h-3" />
                          {conv.createdAt}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {expandedId === conv.id && (
                  <div className="conversation-messages">
                    {loadingMessages === conv.id ? (
                      <div className="messages-loading">
                        <div className="admin-spinner small"></div>
                        <span>Đang tải tin nhắn...</span>
                      </div>
                    ) : conv.messages ? (
                      conv.messages.map((msg) => (
                        <div key={msg.id} className={`message-item ${msg.role}`}>
                          <div className="message-avatar">
                            {msg.role === 'user' ? (
                              <User className="w-4 h-4" />
                            ) : (
                              <MessageSquare className="w-4 h-4" />
                            )}
                          </div>
                          <div className="message-content">
                            <div className="message-header">
                              <span className="message-role">
                                {msg.role === 'user' ? conv.userName : 'Trợ lý AI'}
                              </span>
                              <span className="message-time">{msg.timestamp}</span>
                            </div>
                            <p className="message-text">{msg.content}</p>
                          </div>
                        </div>
                      ))
                    ) : null}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .conversation-logs {
          width: 100%;
        }

        .conversation-count {
          font-size: 14px;
          color: var(--text-tertiary, #9ca3af);
          padding: 4px 10px;
          background: var(--surface-secondary, #f1f5f9);
          border-radius: 6px;
        }

        .filters-bar {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .search-wrapper {
          position: relative;
          flex: 1;
          min-width: 250px;
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

        .date-filter {
          position: relative;
          display: flex;
          align-items: center;
        }

        .filter-icon {
          position: absolute;
          left: 12px;
          color: var(--text-tertiary, #9ca3af);
          width: 16px;
          height: 16px;
        }

        .date-select {
          padding: 10px 14px 10px 36px;
          border: 1px solid var(--border-light, #e5e7eb);
          border-radius: 8px;
          font-size: 14px;
          background: var(--surface-primary, #fff);
          cursor: pointer;
        }

        .date-select:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .conversations-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .conversation-item {
          border: 1px solid var(--border-light, #e5e7eb);
          border-radius: 10px;
          overflow: hidden;
        }

        .conversation-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: var(--surface-primary, #fff);
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .conversation-header:hover {
          background: var(--surface-hover, #f8fafc);
        }

        .conversation-left {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .expand-btn {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: var(--text-tertiary, #9ca3af);
        }

        .conversation-info {
          flex: 1;
        }

        .conversation-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary, #1e293b);
          margin: 0 0 8px;
        }

        .conversation-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: var(--text-tertiary, #9ca3af);
        }

        .conversation-messages {
          padding: 16px;
          background: var(--surface-secondary, #f8fafc);
          border-top: 1px solid var(--border-light, #e5e7eb);
        }

        .messages-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 24px;
          color: var(--text-tertiary, #9ca3af);
        }

        .admin-spinner.small {
          width: 20px;
          height: 20px;
          border-width: 2px;
        }

        .message-item {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .message-item:last-child {
          margin-bottom: 0;
        }

        .message-avatar {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          flex-shrink: 0;
        }

        .message-item.user .message-avatar {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .message-item.assistant .message-avatar {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .message-content {
          flex: 1;
          background: var(--surface-primary, #fff);
          border-radius: 8px;
          padding: 12px;
          border: 1px solid var(--border-light, #e5e7eb);
        }

        .message-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .message-role {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #1e293b);
        }

        .message-time {
          font-size: 12px;
          color: var(--text-tertiary, #9ca3af);
        }

        .message-text {
          font-size: 14px;
          color: var(--text-primary, #1e293b);
          line-height: 1.6;
          margin: 0;
          white-space: pre-wrap;
        }

        @media (max-width: 640px) {
          .filters-bar {
            flex-direction: column;
          }

          .date-filter {
            width: 100%;
          }

          .date-select {
            width: 100%;
          }

          .conversation-meta {
            flex-direction: column;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
};

export default ConversationLogs;
