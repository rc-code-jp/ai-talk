interface StreamingMessageProps {
  content: string;
}

export default function StreamingMessage({ content }: StreamingMessageProps) {
  if (!content) return null;

  return (
    <div className="message message-assistant message-streaming">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono opacity-75">🤖 AI</span>
          <div className="status-indicator status-loading" />
        </div>
        <div className="text-xs opacity-60 font-mono ml-auto">
          生成中...
        </div>
      </div>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
} 