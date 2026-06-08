import React from 'react';
import './LoginAppBar.css';

const LoginAppBar = ({ onBackToLanding }) => {
  return (
    <div className="login-appbar">
      <div className="login-appbar-content">
        <div className="login-appbar-left">
          <div className="logo-section">
            {onBackToLanding && (
              <button
                onClick={onBackToLanding}
                className="back-to-landing-btn"
                title="Quay lại trang chủ"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            )}
            <img 
              src="/img/kma.png" 
              alt="Logo Học viện Kỹ thuật Mật mã" 
              className="appbar-logo"
              onClick={onBackToLanding}
              style={onBackToLanding ? { cursor: 'pointer' } : {}}
            />
            <div className="title-section">
              <h1 className="appbar-title">ACTVN-AGENT</h1>
              <p className="appbar-subtitle">AI Chatbot — Học viện Kỹ thuật Mật mã</p>
            </div>
          </div>
        </div>
        
        <div className="login-appbar-right">
          <div className="system-info">
            <span className="system-name">Hệ thống Chatbot AI</span>
            <span className="system-version">v2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginAppBar;
