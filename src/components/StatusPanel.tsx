interface StatusPanelProps {
  sttSupported: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isMounted: boolean;
  sttError?: string;
  transcript?: string;
}

export default function StatusPanel({
  sttSupported,
  isListening,
  isProcessing,
  isMounted,
  sttError,
  transcript,
}: StatusPanelProps) {
  return (
    <div className="space-y-3">
      {/* ステータスカード */}
      <div className="status-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center">
              <div
                className={`status-indicator ${
                  isMounted
                    ? sttSupported
                      ? 'status-online'
                      : 'status-offline'
                    : 'status-loading'
                }`}
              />
              <span className="text-sm font-mono">
                音声認識:{' '}
                {isMounted ? (
                  <span className={sttSupported ? 'text-green-400' : 'text-red-400'}>
                    {sttSupported ? 'ONLINE' : 'OFFLINE'}
                  </span>
                ) : (
                  <span className="text-gray-400">CHECKING...</span>
                )}
              </span>
            </div>
            <div className="text-xs font-mono opacity-60">
              {isProcessing && '🧠 AI PROCESSING...'}
              {isListening && '🎤 LISTENING...'}
              {!isProcessing && !isListening && 'STANDBY'}
            </div>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {sttError && (
        <div className="error-display">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-mono">⚠️ SYSTEM ERROR</span>
          </div>
          <div className="text-sm font-mono">{sttError}</div>
        </div>
      )}

      {/* トランスクリプト表示 */}
      {transcript && (
        <div className="transcript-display">
          <div className="flex items-center gap-2 mb-2">
            <div className="status-indicator status-loading" />
            <span className="text-sm font-mono">🎙️ VOICE INPUT</span>
          </div>
          <div className="text-sm font-mono">{transcript}</div>
        </div>
      )}
    </div>
  );
} 