import type { ChatMessage } from '../types/chat';

interface ChatMessageProps {
  message: ChatMessage;
  index: number;
}

export default function ChatMessageComponent({ message, index }: ChatMessageProps) {
  return (
    <div
      key={`${message.timestamp.getTime()}-${index}`}
      className={`message ${
        message.role === 'user' ? 'message-user' : 'message-assistant'
      }`}
      style={{
        animationDelay: `${index * 0.1}s`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono opacity-75">
            {message.role === 'user' ? '👤 USER' : '🤖 AI'}
          </span>
          <div
            className={`status-indicator ${
              message.role === 'user' ? 'status-online' : 'status-loading'
            }`}
          />
        </div>
        <div className="text-xs opacity-60 font-mono ml-auto">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  );
} 