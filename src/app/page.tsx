'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types/chat';
import { useStt } from '../hooks/useStt';
import { streamSSE } from '../lib/sse';
import ChatContainer from '../components/ChatContainer';
import StatusPanel from '../components/StatusPanel';
import ControlPanel from '../components/ControlPanel';

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  
  // チャットコンテナのref
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(0);
  const prevCurrentMessageRef = useRef('');

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

  // メッセージが追加された際に自動スクロール
  useEffect(() => {
    const messagesChanged = messages.length !== prevMessagesLengthRef.current;
    const currentMessageChanged = currentAssistantMessage !== prevCurrentMessageRef.current;
    
    if ((messagesChanged || currentMessageChanged) && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      prevMessagesLengthRef.current = messages.length;
      prevCurrentMessageRef.current = currentAssistantMessage;
    }
  });

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
    <div className="h-screen w-screen flex flex-col">
      {/* サイバーヘッダー */}
      <header className="cyber-header flex-shrink-0 px-6 pt-6">
        <h1 className="cyber-title">
          AI TALK SYSTEM
        </h1>
        <p className="cyber-subtitle font-mono">
          Neural Voice Interface • Version 2.0
        </p>
        <div className="mt-4 flex justify-center">
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        </div>
      </header>

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col px-6 pb-6 min-h-0">
        {/* ステータスパネル */}
        <div className="flex-shrink-0 mb-4">
          <StatusPanel
            sttSupported={sttSupported}
            isListening={isListening}
            isProcessing={isProcessing}
            isMounted={isMounted}
            sttError={sttError || undefined}
            transcript={transcript}
          />
        </div>

        {/* チャットコンテナ - 残りのスペースを全て使用 */}
        <div className="flex-1 min-h-0 mb-4">
          <ChatContainer
            ref={chatContainerRef}
            messages={messages}
            currentAssistantMessage={currentAssistantMessage}
          />
        </div>

        {/* コントロールパネル */}
        <div className="flex-shrink-0">
          <ControlPanel
            isListening={isListening}
            isProcessing={isProcessing}
            isMounted={isMounted}
            sttSupported={sttSupported}
            onMicToggle={handleMicToggle}
            onClearChat={handleClearChat}
          />
        </div>
      </div>
    </div>
  );
}
