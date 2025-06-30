interface ControlPanelProps {
  isListening: boolean;
  isProcessing: boolean;
  isMounted: boolean;
  sttSupported: boolean;
  onMicToggle: () => void;
  onClearChat: () => void;
}

export default function ControlPanel({
  isListening,
  isProcessing,
  isMounted,
  sttSupported,
  onMicToggle,
  onClearChat,
}: ControlPanelProps) {
  return (
    <div className="input-area">
      <div className="flex justify-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={onMicToggle}
          disabled={!isMounted || !sttSupported || isProcessing}
          className={`btn-primary ${
            isListening ? 'btn-danger' : ''
          } flex items-center gap-2 min-w-[180px] justify-center`}
        >
          <span className="text-lg">
            {isListening ? '🔴' : '🎤'}
          </span>
          <span className="font-mono text-sm">
            {isListening ? 'STOP RECORDING' : 'START VOICE'}
          </span>
        </button>

        <button
          type="button"
          onClick={onClearChat}
          className="btn-secondary flex items-center gap-2 min-w-[140px] justify-center"
        >
          <span className="text-lg">🗑️</span>
          <span className="font-mono text-sm">CLEAR CHAT</span>
        </button>
      </div>

      {/* システム状態表示 */}
      <div className="text-center mt-4">
        <div className="text-xs font-mono opacity-60">
          {isProcessing && (
            <div className="flex items-center justify-center gap-2">
              <div className="status-indicator status-loading" />
              <span>AI システム処理中...</span>
            </div>
          )}
          {isListening && (
            <div className="flex items-center justify-center gap-2">
              <div className="status-indicator status-online" />
              <span>音声入力待機中...</span>
            </div>
          )}
          {!isProcessing && !isListening && (
            <div className="flex items-center justify-center gap-2">
              <div className="status-indicator status-loading" />
              <span>システム待機中</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 