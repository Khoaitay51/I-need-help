import React from 'react';
import { FiBook, FiHelpCircle, FiClock, FiDollarSign, FiArrowRight } from 'react-icons/fi';
import './WelcomeScreen.css';

const WelcomeScreen = ({ onSendMessage, user }) => {
  const quickActions = [
    {
      icon: FiBook,
      title: 'Quy định học tập',
      description: 'Tìm hiểu quy định và chính sách học tập',
      query: 'Cho tôi biết về quy định học tập tại Học viện Kỹ thuật Mật mã',
    },
    {
      icon: FiClock,
      title: 'Lịch thi & Lịch học',
      description: 'Xem lịch thi, lịch học và thời gian biểu',
      query: 'Lịch thi cuối kỳ như thế nào?',
    },
    {
      icon: FiDollarSign,
      title: 'Học phí & Tài chính',
      description: 'Thông tin học phí và các khoản thu',
      query: 'Học phí của Học viện Kỹ thuật Mật mã là bao nhiêu?',
    },
    {
      icon: FiHelpCircle,
      title: 'Hỏi đáp chung',
      description: 'Các câu hỏi thường gặp về Học viện',
      query: 'Tôi muốn hỏi về Học viện Kỹ thuật Mật mã',
    },
  ];

  const sampleQuestions = [
    'Điều kiện tốt nghiệp là gì?',
    'Cách tính điểm trung bình?',
    'Quy định về đồ án tốt nghiệp',
    'Học bổng dành cho sinh viên',
    'Thủ tục chuyển ngành học',
  ];

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  return (
    <div className="welcome-screen">
      {/* Hero Section */}
      <div className="welcome-hero">
        <div className="welcome-brand">
          <div className="welcome-brand-circle">
            <img src="/img/kma.png" alt="ACTVN" />
          </div>
        </div>
        <h1 className="welcome-heading">
          {greeting()}{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="welcome-subheading">
          Tôi có thể giúp bạn tìm hiểu thông tin về Học viện Kỹ thuật Mật mã.
          Hãy hỏi bất cứ điều gì bạn muốn biết!
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div className="welcome-grid">
        {quickActions.map((action, index) => (
          <button
            key={index}
            onClick={() => onSendMessage(action.query)}
            className="welcome-grid-card"
          >
            <div className="welcome-grid-card-icon">
              <action.icon size={18} />
            </div>
            <h3 className="welcome-grid-card-title">{action.title}</h3>
            <p className="welcome-grid-card-desc">{action.description}</p>
            <div className="welcome-grid-card-arrow">
              <FiArrowRight size={14} />
            </div>
          </button>
        ))}
      </div>

      {/* Sample Questions */}
      <div className="welcome-suggestions">
        {sampleQuestions.map((question, index) => (
          <button
            key={index}
            onClick={() => onSendMessage(question)}
            className="welcome-suggestion-pill"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
};

export default WelcomeScreen;
