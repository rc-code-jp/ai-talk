import { forwardRef } from 'react';
import type { ChatMessage } from '../types/chat';
import ChatMessageComponent from './ChatMessage';
import StreamingMessage from './StreamingMessage';

interface ChatContainerProps {
  messages: ChatMessage[];
  currentAssistantMessage: string;
}

const ChatContainer = forwardRef<HTMLDivElement, ChatContainerProps>(
  ({ messages, currentAssistantMessage }, ref) => {
    return (
      <div className="chat-container" ref={ref}>
        {messages.length === 0 && !currentAssistantMessage && (
          <div className="text-center py-12">
            <div className="mb-4">
              <div className="text-4xl mb-2">🤖</div>
              <div className="text-lg font-semibold text-gray-300 mb-2">
                AI Talk システム起動完了
              </div>
              <div className="text-sm text-gray-500 font-mono">
                音声認識システム待機中...
              </div>
            </div>
            <div className="flex justify-center">
              <div className="status-indicator status-loading" />
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <ChatMessageComponent
            key={`${message.timestamp.getTime()}-${index}`}
            message={message}
            index={index}
          />
        ))}

        <StreamingMessage content={currentAssistantMessage} />
      </div>
    );
  }
);

ChatContainer.displayName = 'ChatContainer';

export default ChatContainer; 