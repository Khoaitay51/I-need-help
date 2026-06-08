import React from 'react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

const ChatMessages = ({ messages, isLoading, messagesEndRef }) => {
  return (
    <div className="chat-messages-stream">
      {messages.map((message) => (
        <MessageBubble 
          key={message.id} 
          message={message} 
        />
      ))}
      
      {isLoading && <TypingIndicator />}
      
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;
