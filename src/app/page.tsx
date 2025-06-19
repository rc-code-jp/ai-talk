'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStt } from './hooks/useStt';
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

  // マウント後の状態管理（Hydrationエラー回避）
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ページ表示時に自動的に音声認識を開始
  useEffect(() => {
    if (isMounted && sttSupported && !isListening) {
      // 少し待ってから音声認識を開始（ページの初期化が完了するまで待つ）
      const timer = setTimeout(() => {
        console.log('ページ表示時に音声認識を自動開始します');
        startListening();
      }, 1000); // 1秒待機
      
      return () => clearTimeout(timer);
    }
  }, [isMounted, sttSupported, isListening, startListening]);

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
              } else {
                console.log('⚠️ No content to process');
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
    [messages, isProcessing, generateMessageId],
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

  // AIからの返信が完了した後に自動的に音声認識を開始（自然な会話のため）
  useEffect(() => {
    // AIの返信が完了し、処理中でもなく、音声認識もしていない状態で、
    // メッセージ履歴がある場合に音声認識を自動開始
    if (!isProcessing && !isListening && isMounted && sttSupported && messages.length > 0) {
      // 最後のメッセージがAIからの返信の場合のみ自動開始
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        // 少し待ってから音声認識を開始（UIの更新が完了するまで待つ）
        const timer = setTimeout(() => {
          if (!isProcessing && !isListening) {
            console.log('AIの返信完了後、音声認識を自動開始します');
            startListening();
          }
        }, 1000); // 1秒待機
        
        return () => clearTimeout(timer);
      }
    }
  }, [isProcessing, isListening, isMounted, sttSupported, messages, startListening]);

  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setCurrentAssistantMessage('');
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
            マイクボタンを押して話しかけてください
          </p>
        </header>

        {/* 音声機能の対応状況 */}
        <div className="bg-white rounded p-4 mb-6 shadow-xs">
          <div className="text-sm">
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
          </div>
        </div>

        {/* エラー表示 */}
        {sttError && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
            <div className="text-red-700">{sttError}</div>
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
        </div>

        {/* 状態表示 */}
        <div className="text-center mt-4 text-sm text-gray-600">
          {isProcessing && '🤔 AI が考えています...'}
          {isListening && '👂 音声を聞いています...'}
        </div>
      </div>
    </div>
  );
}
