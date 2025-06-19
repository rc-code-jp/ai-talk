'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStt } from './hooks/useStt';
import { useTts } from './hooks/useTts';
import { streamSSE } from './lib/sse';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  const {
    isListening,
    transcript,
    error: sttError,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: sttSupported,
  } = useStt();

  const {
    speak,
    stop: stopTts,
    isSpeaking,
    isSupported: ttsSupported,
    error: ttsError,
    voices,
    isInitialized: ttsInitialized,
    initializeAudio,
  } = useTts();

  // マウント後の状態管理（Hydrationエラー回避）
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 音声機能の初期化を促すためのモーダル状態
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);

  // ページ読み込み後に音声許可プロンプトを表示
  useEffect(() => {
    if (isMounted && ttsSupported && !ttsInitialized) {
      // リロードかどうかをチェック（navigation API がサポートされている場合）
      const isReload = performance.navigation?.type === performance.navigation.TYPE_RELOAD ||
                      (performance.getEntriesByType('navigation')[0] as any)?.type === 'reload';
      
      const delay = isReload ? 1000 : 2000; // リロードの場合は1秒、初回は2秒
      
      const timer = setTimeout(() => {
        setShowAudioPrompt(true);
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [isMounted, ttsSupported, ttsInitialized]);

  const handleEnableAudio = () => {
    initializeAudio();
    speak('音声機能が有効になりました。AIと会話を始めましょう！');
    setShowAudioPrompt(false);
  };

  // ページ上の任意のクリックで音声初期化を試行
  useEffect(() => {
    if (!isMounted || !ttsSupported || ttsInitialized) return;

    const handleFirstClick = () => {
      if (!ttsInitialized) {
        initializeAudio();
        console.log('ユーザーのクリックにより音声機能を初期化しました');
      }
    };

    // 一度だけ実行されるイベントリスナー
    document.addEventListener('click', handleFirstClick, { once: true });

    return () => {
      document.removeEventListener('click', handleFirstClick);
    };
  }, [isMounted, ttsSupported, ttsInitialized, initializeAudio]);

  // ユニークなIDを生成する関数
  const generateMessageId = useCallback(() => {
    // crypto.randomUUIDが利用可能な場合は使用
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // フォールバック：現在時刻 + ランダム値
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // 音声認識の結果をメッセージに追加してAPIに送信
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isProcessing) return;

      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsProcessing(true);
      setCurrentAssistantMessage('');

      try {
        await streamSSE({
          endpoint: '/api/chat',
          body: {
            history: messages,
            user: content.trim(),
          },
          onMessage: (text) => {
            console.log('Received text chunk:', text);
            setCurrentAssistantMessage((prev) => prev + text);
          },
          onComplete: () => {
            console.log('🔄 Chat stream completed');
            
            // 現在のアシスタントメッセージを取得
            setCurrentAssistantMessage((prev) => {
              console.log('📝 Processing final assistant message:', `${prev?.substring(0, 100)}...`);
              
              if (prev.trim()) {
                const assistantMessage: ChatMessage = {
                  id: generateMessageId(),
                  role: 'assistant',
                  content: prev.trim(),
                  timestamp: new Date(),
                };
                
                console.log('💾 Adding message to history, ID:', assistantMessage.id);
                
                // 重複チェックを行いつつメッセージを追加
                setMessages((prevMessages) => {
                  // IDベースの重複チェック
                  const existsById = prevMessages.some(msg => msg.id === assistantMessage.id);
                  if (existsById) {
                    console.log('⚠️ Duplicate message ID detected, skipping');
                    return prevMessages;
                  }
                  
                  // 内容ベースの重複チェック（フォールバック）
                  const lastMessage = prevMessages[prevMessages.length - 1];
                  const now = assistantMessage.timestamp.getTime();
                  
                  if (lastMessage && 
                      lastMessage.role === 'assistant' && 
                      lastMessage.content === assistantMessage.content &&
                      Math.abs(lastMessage.timestamp.getTime() - now) < 1000) {
                    console.log('⚠️ Duplicate message content detected, skipping');
                    return prevMessages;
                  }
                  
                  console.log('✅ Adding assistant message to history');
                  return [...prevMessages, assistantMessage];
                });

                // 音声で読み上げ
                console.log('🔊 Attempting to start speech synthesis...');
                console.log('🔊 Text to speak:', prev.trim());
                console.log('🔊 TTS state check:', { 
                  ttsSupported, 
                  ttsInitialized, 
                  isSpeaking, 
                  voicesCount: voices.length,
                  hasError: !!ttsError,
                  errorMessage: ttsError
                });
                
                if (ttsSupported && ttsInitialized) {
                  console.log('✅ TTS ready, calling speak function...');
                  speak(prev.trim());
                  console.log('✅ speak() function called');
                } else {
                  console.warn('❌ TTS not ready:', { ttsSupported, ttsInitialized });
                  if (!ttsInitialized) {
                    console.log('🔧 Attempting to initialize TTS...');
                    initializeAudio();
                    // 初期化後に音声再生を試行
                    setTimeout(() => {
                      console.log('🔧 Retrying speak after initialization...');
                      speak(prev.trim());
                    }, 100);
                  }
                }
              } else {
                console.log('⚠️ No content to speak');
              }
              
              // ストリーミング表示をクリア
              console.log('🧹 Clearing current assistant message');
              return '';
            });
            
            setIsProcessing(false);
            console.log('✅ Processing complete, isProcessing set to false');
          },
          onError: (error) => {
            console.error('Chat error:', error);
            setIsProcessing(false);
            setCurrentAssistantMessage('');
          },
        });
      } catch (error) {
        console.error('Send message error:', error);
        setIsProcessing(false);
      }
    },
    [messages, isProcessing, speak, generateMessageId, ttsSupported, ttsInitialized, voices, ttsError, initializeAudio, isSpeaking],
  );

  // 音声認識の結果が更新されたときの処理
  useEffect(() => {
    if (transcript && !isListening && !isProcessing) {
      handleSendMessage(transcript);
      resetTranscript();
    }
  }, [
    transcript,
    isListening,
    isProcessing,
    handleSendMessage,
    resetTranscript,
  ]);

  // AIが話し終えたら自動的に音声認識を再開（自然な会話のため）
  useEffect(() => {
    if (!isSpeaking && !isProcessing && !isListening && isMounted && sttSupported && ttsInitialized) {
      // 音声合成完了後、少し待ってから再開（音声の切り替えのため）
      const timer = setTimeout(() => {
        if (!isSpeaking && !isProcessing && !isListening) {
          console.log('音声合成完了後、音声認識を自動再開します');
          startListening();
        }
      }, 1500); // 1.5秒に延長
      
      return () => clearTimeout(timer);
    }
  }, [isSpeaking, isProcessing, isListening, isMounted, sttSupported, ttsInitialized, startListening]);

  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      // 音声合成を停止（少し待ってから音声認識開始）
      if (isSpeaking) {
        stopTts();
        setTimeout(() => {
          if (!ttsInitialized) {
            initializeAudio();
          }
          startListening();
        }, 100);
      } else {
        if (!ttsInitialized) {
          initializeAudio();
        }
        startListening();
      }
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setCurrentAssistantMessage('');
    stopTts();
    stopListening();
    resetTranscript();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            AI Talk - 音声チャット
          </h1>
          <p className="text-gray-600">
            {ttsInitialized 
              ? 'マイクボタンを押して話しかけてください' 
              : '音声機能を有効にしてからご利用ください'
            }
          </p>
          {!ttsInitialized && ttsSupported && isMounted && (
            <div className="mt-2">
              <button
                type="button"
                onClick={handleEnableAudio}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                🔊 音声機能を有効にする
              </button>
            </div>
          )}
        </header>

        {/* 音声機能の対応状況 */}
        <div className="bg-white rounded p-4 mb-6 shadow-xs">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">音声認識: </span>
              {isMounted ? (
                <span
                  className={sttSupported ? 'text-green-600' : 'text-red-600'}
                >
                  {sttSupported ? '対応' : '非対応'}
                </span>
              ) : (
                <span className="text-gray-500">確認中...</span>
              )}
            </div>
            <div>
              <span className="font-medium">音声合成: </span>
              {isMounted ? (
                <span
                  className={ttsSupported ? 'text-green-600' : 'text-red-600'}
                >
                  {ttsSupported ? '対応' : '非対応'}
                </span>
              ) : (
                <span className="text-gray-500">確認中...</span>
              )}
              {isMounted && ttsSupported && (
                <span className={`ml-2 text-xs ${ttsInitialized ? 'text-green-600' : 'text-orange-600'}`}>
                  ({ttsInitialized ? '✓ 準備完了' : '⚠ 要初期化'})
                </span>
              )}
              {isMounted && ttsSupported && !ttsInitialized && (
                <span className="ml-2 text-xs text-blue-600 animate-pulse">
                  → クリックで初期化
                </span>
              )}
              {isMounted && ttsSupported && (
                <div className="text-gray-500 ml-2 text-xs">
                  <div>日本語音声: {voices.length}種類</div>
                  {voices.length > 0 && (
                    <div className="truncate max-w-xs">
                      {voices[0].name} ({voices[0].lang})
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* 音声機能が未初期化の場合の案内 */}
          {isMounted && ttsSupported && !ttsInitialized && (
            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded text-sm">
              <div className="flex items-center gap-2 text-orange-700">
                <span>⚠️</span>
                <span className="font-medium">音声機能を有効にしてください</span>
              </div>
              <div className="mt-1 text-orange-600 text-xs">
                AIの音声応答を受け取るために、音声再生の許可が必要です。
              </div>
            </div>
          )}
        </div>

        {/* エラー表示 */}
        {(sttError || ttsError) && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
            {sttError && <div className="text-red-700 mb-2">{sttError}</div>}
            {ttsError && (
              <div className="text-red-700 whitespace-pre-line">{ttsError}</div>
            )}
            
            {ttsError?.includes('not-allowed') && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                <div className="font-medium text-blue-800 mb-2">🔧 解決方法：</div>
                <div className="text-blue-700 space-y-1">
                  <div><strong>1. 音声テストボタンをクリック</strong></div>
                  <div>上の「🔊 音声テスト」ボタンを最初にクリックして音声合成を初期化してください。</div>
                  
                  <div className="mt-2"><strong>2. ブラウザ設定の確認</strong></div>
                  <div>• Chrome: サイト設定 → 音声 → 許可</div>
                  <div>• Safari: Webサイト → 自動再生 → 許可</div>
                  <div>• Edge: サイトのアクセス許可 → メディアの自動再生 → 許可</div>
                  
                  <div className="mt-2"><strong>3. ページの再読み込み</strong></div>
                  <div>設定変更後、ページを再読み込みしてください。</div>
                </div>
              </div>
            )}
            
            {ttsError && voices.length === 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <div className="font-medium text-yellow-800 mb-2">🔧 解決方法：</div>
                <div className="text-yellow-700 space-y-1">
                  <div><strong>macOSの場合：</strong></div>
                  <div>1. システム設定 → アクセシビリティ → 読み上げコンテンツ</div>
                  <div>2. 「システムの声」で日本語音声（Kyoko、Otoya、Sayaka等）を追加</div>
                  <div>3. ブラウザを再起動</div>
                  
                  <div className="mt-2"><strong>Chromeの場合：</strong></div>
                  <div>1. Chrome設定 → 言語 → 日本語を追加</div>
                  <div>2. ブラウザを再起動</div>
                  
                  <div className="mt-2"><strong>Safariの場合：</strong></div>
                  <div>macOSの音声設定を優先して使用します</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 音声認識の状態表示 */}
        {transcript && (
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
            <div className="text-blue-700">
              <strong>認識中:</strong> {transcript}
            </div>
          </div>
        )}

        {/* チャット履歴 */}
        <div className="chat-container bg-white rounded p-4 mb-6 shadow-xs">
          {messages.length === 0 && !currentAssistantMessage && (
            <div className="text-center text-gray-500 py-8">
              まだメッセージがありません。
              <br />
              マイクボタンを押して話しかけてください。
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={`${message.timestamp.getTime()}-${index}`}
              className={message.role === 'user' ? 'message-user' : 'message-assistant'}
            >
              <div className="font-medium mb-1">
                {message.role === 'user' ? 'あなた' : 'AI'}
              </div>
              <div>{message.content}</div>
              <div className="text-xs opacity-60 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}

          {/* 現在生成中のアシスタントメッセージ */}
          {currentAssistantMessage && (
                            <div className="message-assistant">
              <div className="font-medium mb-1">AI</div>
              <div>{currentAssistantMessage}</div>
              <div className="text-xs opacity-60 mt-1">生成中...</div>
            </div>
          )}
        </div>

        {/* コントロールボタン */}
        <div className="flex justify-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={handleMicToggle}
            disabled={!isMounted || !sttSupported || isProcessing}
            className={`btn-primary ${
              isListening ? 'bg-red-600 hover:bg-red-700' : ''
            }`}
          >
            {isListening ? '🔴 録音停止' : '🎤 音声認識開始'}
          </button>

          <button
            type="button"
            onClick={handleClearChat}
            className="btn-secondary"
          >
            🗑️ チャットクリア
          </button>

          {isSpeaking && (
            <button type="button" onClick={stopTts} className="btn-secondary">
              🔇 音声停止
            </button>
          )}

          {/* 音声テストボタン */}
          <button
            type="button"
            onClick={() => {
              // ユーザー操作による音声合成の初期化とテスト
              speak('こんにちは、音声テストです。音声合成が正常に動作しています。');
            }}
            disabled={!isMounted || !ttsSupported}
            className={`btn-secondary ${!ttsInitialized ? 'ring-2 ring-blue-300 ring-offset-2' : ''}`}
            title={ttsInitialized ? "音声合成をテストします" : "音声合成を初期化してテストします（推奨）"}
          >
            🔊 音声テスト {!ttsInitialized && <span className="text-xs ml-1">(推奨)</span>}
          </button>
        </div>

        {/* 状態表示 */}
        <div className="text-center mt-4 text-sm text-gray-600">
          {isProcessing && '🤔 AI が考えています...'}
          {isListening && '👂 音声を聞いています...'}
          {isSpeaking && '🔊 AI が話しています...'}
        </div>

        {/* 音声許可プロンプトモーダル */}
        {showAudioPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
              <div className="text-center">
                <div className="text-4xl mb-4">🔊</div>
                <h3 className="text-lg font-bold text-gray-800 mb-3">
                  音声機能を有効にしますか？
                </h3>
                <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                  {(performance.navigation?.type === performance.navigation.TYPE_RELOAD ||
                    (performance.getEntriesByType('navigation')[0] as any)?.type === 'reload') ? (
                    <>
                      ページがリロードされたため、音声機能を再度有効にする必要があります。
                      <br />
                      「音声を有効にする」ボタンを押してください。
                    </>
                  ) : (
                    <>
                      AIが音声で応答するために、音声再生の許可が必要です。
                      <br />
                      「音声を有効にする」ボタンを押すと、より自然な会話ができるようになります。
                    </>
                  )}
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={handleEnableAudio}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    🔊 音声を有効にする
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAudioPrompt(false)}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    後で
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
