import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import * as jwtHelper from './utils/jwtHelper';

// Thêm jwtHelper vào window để có thể sử dụng ở mọi nơi
window.jwtHelper = jwtHelper;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
