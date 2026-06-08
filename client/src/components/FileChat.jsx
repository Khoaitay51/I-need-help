import React, { useState, useEffect, useRef } from 'react';
import chatService from '../services/chatService';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import '../components/ChatInput.css';

// CSS cho component này
const styles = {
  container: 'flex flex-col h-full max-h-screen bg-gray-50 rounded-lg shadow-lg',
  header: 'px-4 py-3 bg-blue-600 text-white font-semibold rounded-t-lg flex justify-between items-center',
  fileInfo: 'mt-2 px-4 py-2 bg-blue-50 border-l-4 border-blue-500 text-sm',
  chatArea: 'flex-1 overflow-y-auto p-4 space-y-4',
  messageList: 'space-y-3',
  inputArea: 'p-3 border-t border-gray-200 bg-white rounded-b-lg',
  inputWrapper: 'flex items-center rounded-full border border-gray-300 px-3 py-1 bg-white',
  input: 'flex-1 outline-none py-2 px-2',
  sendButton: 'ml-2 bg-blue-500 text-white rounded-full p-2 hover:bg-blue-600 transition-colors',
  uploadSection: 'p-4 border-b border-gray-200',
  uploadButton: 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors',
  filePreview: 'mt-2 p-3 bg-gray-100 rounded-lg',
  fileName: 'font-medium text-gray-800',
  fileSize: 'text-xs text-gray-500',
  errorMessage: 'mt-2 text-red-500 text-sm',
  deleteButton: 'ml-2 text-red-500 hover:text-red-700',
  backButton: 'text-white hover:underline cursor-pointer',
};

const FileChat = ({ onBack }) => {
  const [file, setFile] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');
  const chatAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Scroll xuống dưới khi có tin nhắn mới
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Xử lý tải lên file
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  // Tải lên file
  const uploadFile = async () => {
    if (!file) {
      setError('Vui lòng chọn file để tải lên');
      return;
    }
    
    setIsUploading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const result = await chatService.uploadFile(formData);
      
      if (result.success) {
        setFileInfo(result.fileInfo);
        setMessages([
          { 
            id: 'system-1', 
            content: `File "${result.fileInfo.filename}" đã được tải lên thành công. Bạn có thể đặt câu hỏi về nội dung file.`, 
            isUser: false, 
            isSystem: true,
            timestamp: new Date().toISOString()
          }
        ]);
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setError(result.error || 'Không thể tải lên file. Vui lòng thử lại.');
      }
    } catch (error) {
      setError('Đã xảy ra lỗi khi tải file. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };

  // Xử lý gửi tin nhắn
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || !fileInfo) return;
    
    const userMessage = { 
      id: `user-${Date.now()}`, 
      content: message, 
      isUser: true,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);
    
    try {
      const result = await chatService.queryFile(fileInfo.id, message);
      
      if (result.success) {
        // Format bot response
        const botResponse = { 
          id: `bot-${Date.now()}`, 
          content: result.answer, 
          isUser: false,
          sources: result.sources,
          timestamp: result.timestamp || new Date().toISOString()
        };
        
        setMessages(prev => [...prev, botResponse]);
      } else {
        // Handle error in response
        setMessages(prev => [...prev, { 
          id: `error-${Date.now()}`, 
          content: result.error || 'Không thể xử lý câu hỏi của bạn. Vui lòng thử lại.', 
          isUser: false, 
          isError: true,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      // Handle exception
      setMessages(prev => [...prev, { 
        id: `error-${Date.now()}`, 
        content: 'Đã xảy ra lỗi khi xử lý câu hỏi. Vui lòng thử lại.', 
        isUser: false, 
        isError: true,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Xóa file đã tải lên
  const handleClearFile = () => {
    setFileInfo(null);
    setMessages([]);
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>Hỏi đáp tài liệu</span>
        <span className={styles.backButton} onClick={onBack}>Quay lại</span>
      </div>
      
      {!fileInfo ? (
        <div className={styles.uploadSection}>
          <h3 className="font-medium mb-2">Tải lên tài liệu để bắt đầu hỏi đáp</h3>
          <p className="text-sm text-gray-600 mb-4">
            Hỗ trợ các định dạng: PDF, DOCX, TXT, v.v.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center">
            <input
              type="file"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 mb-2 sm:mb-0 sm:mr-3"
              ref={fileInputRef}
            />
            <button
              onClick={uploadFile}
              disabled={isUploading || !file}
              className={`${styles.uploadButton} ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isUploading ? 'Đang tải lên...' : 'Tải lên'}
            </button>
          </div>
          
          {file && (
            <div className={styles.filePreview}>
              <div className={styles.fileName}>{file.name}</div>
              <div className={styles.fileSize}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          )}
          
          {error && <div className={styles.errorMessage}>{error}</div>}
        </div>
      ) : (
        <>
          <div className={styles.fileInfo}>
            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium">File: </span> 
                {fileInfo.filename} ({fileInfo.chunks} đoạn)
              </div>
              <button 
                onClick={handleClearFile} 
                className={styles.deleteButton}
              >
                Xóa file
              </button>
            </div>
          </div>
          
          <div className={styles.chatArea} ref={chatAreaRef}>
            <div className={styles.messageList}>
              {messages.map((msg) => (
                <MessageBubble 
                  key={msg.id}
                  message={{
                    content: msg.content,
                    sender: msg.isUser ? 'user' : msg.isError ? 'error' : 'bot',
                    timestamp: msg.timestamp || new Date().toISOString(),
                    isError: msg.isError,
                    isSystem: msg.isSystem,
                    metadata: msg.sources ? { sources: msg.sources } : null
                  }}
                />
              ))}
              {isTyping && <TypingIndicator />}
            </div>
          </div>
          
          <div className={styles.inputArea}>
            <form onSubmit={handleSendMessage} className={styles.inputWrapper}>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Nhập câu hỏi của bạn về tài liệu..."
                className={styles.input}
              />
              <button
                type="submit"
                disabled={!message.trim() || isTyping}
                className={`${styles.sendButton} ${(!message.trim() || isTyping) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default FileChat;
