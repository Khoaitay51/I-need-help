import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import './RateLimitMessage.css';

const RateLimitMessage = ({ message }) => {
  // Ensure message is displayed properly, even if it includes HTML/markdown
  const cleanMessage = message.replace(/⚠️/g, '').trim();
  
  return (
    <div className="rate-limit-message">
      <FiAlertCircle size={20} />
      <div>
      <p>{cleanMessage}. Vui lòng thử lại sau!</p>
      </div>
    </div>
  );
};

export default RateLimitMessage;
