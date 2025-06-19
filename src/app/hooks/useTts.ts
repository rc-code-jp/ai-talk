'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTtsReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  error: string | null;
  voices: SpeechSynthesisVoice[];
  isInitialized: boolean;
  initializeAudio: () => void;
}

export function useTts(): UseTtsReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPendingCancellationRef = useRef(false);

  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const loadVoices = useCallback(() => {
    if (!isSupported) return;

    const availableVoices = speechSynthesis.getVoices();
    console.log('利用可能な全音声:', availableVoices.map(v => `${v.name} (${v.lang})`));
    
    const japaneseVoices = availableVoices.filter((voice) =>
      voice.lang.startsWith('ja'),
    );

    setVoices(japaneseVoices);
    console.log('日本語音声:', japaneseVoices.map(v => `${v.name} (${v.lang})`));

    if (japaneseVoices.length === 0) {
      const errorMsg = `日本語音声が見つかりません。
利用可能な音声数: ${availableVoices.length}
macOSの場合: システム設定 > アクセシビリティ > 読み上げコンテンツ で日本語音声を追加してください。
Chromeの場合: 設定 > 言語 で日本語を追加し、ブラウザを再起動してください。`;
      setError(errorMsg);
    } else {
      setError(null);
    }
  }, [isSupported]);

  // 音声合成の初期化（ユーザー操作により一度だけ実行）
  const initializeAudio = useCallback(async () => {
    if (!isSupported || isInitialized) return;

    try {
      console.log('🔧 Starting audio initialization...');
      console.log('📊 Initial speechSynthesis state:', {
        speaking: speechSynthesis.speaking,
        pending: speechSynthesis.pending,
        paused: speechSynthesis.paused,
        voicesCount: speechSynthesis.getVoices().length
      });
      
      // Web Audio APIでオーディオコンテキストを初期化
      if ('AudioContext' in window || 'webkitAudioContext' in window) {
        const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContext();
        
        console.log('🎵 AudioContext state:', audioContext.state);
        
        // 短い無音を再生してコンテキストを起動
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.01);
        
        console.log('✅ Web Audio Context initialized, state:', audioContext.state);
      }

      // Speech Synthesis API を初期化
      const utterance = new SpeechSynthesisUtterance('');
      utterance.volume = 0;
      speechSynthesis.speak(utterance);
      
      // 初期化時もresume()を試す
      setTimeout(() => {
        if (speechSynthesis.paused) {
          console.log('🔄 Resume during initialization...');
          speechSynthesis.resume();
        }
      }, 50);
      
      setIsInitialized(true);
      
      // 初期化状態をローカルストレージに保存
      localStorage.setItem('audioInitialized', 'true');
      localStorage.setItem('audioInitializedTime', Date.now().toString());
      
      console.log('✅ Speech synthesis initialized');
    } catch (error) {
      console.warn('❌ Audio initialization failed:', error);
    }
  }, [isSupported, isInitialized]);

  const speak = useCallback(
    (text: string) => {
      console.log('🎤 speak() function called with text:', `${text?.substring(0, 50)}...`);
      
      if (!isSupported) {
        console.error('❌ Browser does not support speech synthesis');
        setError('このブラウザは音声合成に対応していません');
        return;
      }

      if (!text.trim()) {
        console.warn('⚠️ Empty text provided to speak function');
        return;
      }

      console.log('✅ Speech synthesis supported, proceeding...');

      // 初期化が必要な場合は実行
      if (!isInitialized) {
        console.log('🔧 TTS not initialized, attempting initialization...');
        initializeAudio();
      }

      // 既存の発話を停止
      if (currentUtteranceRef.current) {
        console.log('⏹️ Stopping existing utterance...');
        isPendingCancellationRef.current = true;
        speechSynthesis.cancel();
        currentUtteranceRef.current = null;
        
        // キャンセル後の安定化を待つ
        setTimeout(() => {
          isPendingCancellationRef.current = false;
          console.log('⏰ Cancellation cooldown complete, proceeding with new utterance...');
          createAndSpeakUtterance(text);
        }, 200);
        return;
      }
      
      createAndSpeakUtterance(text);
    },
    [isSupported, isInitialized, initializeAudio],
  );

  // Utteranceの作成と実行を分離
  const createAndSpeakUtterance = useCallback((text: string) => {
    console.log('🔊 Creating new SpeechSynthesisUtterance...');
    const utterance = new SpeechSynthesisUtterance(text);
    currentUtteranceRef.current = utterance;

    // 日本語音声を選択（フォールバック処理付き）
    const japaneseVoice = voices.find((voice) => voice.lang.startsWith('ja'));
    if (japaneseVoice) {
      console.log('✅ Japanese voice found:', japaneseVoice.name);
      utterance.voice = japaneseVoice;
      utterance.lang = 'ja-JP';
    } else {
      // 日本語音声がない場合、デフォルト音声を使用
      console.warn('⚠️ No Japanese voice found, using default voice');
      const allVoices = speechSynthesis.getVoices();
      if (allVoices.length > 0) {
        utterance.voice = allVoices[0];
        console.log('🔄 Using fallback voice:', allVoices[0].name);
      }
      utterance.lang = 'ja-JP'; // 言語設定は日本語のまま
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    console.log('🔊 Audio settings:', {
      rate: utterance.rate,
      pitch: utterance.pitch,
      volume: utterance.volume,
      lang: utterance.lang,
      voice: utterance.voice?.name || 'default'
    });

    console.log('🎯 Setting up utterance event handlers...');

    utterance.onstart = () => {
      console.log('▶️ Speech synthesis started');
      setIsSpeaking(true);
      setError(null);
      isPendingCancellationRef.current = false;
    };

    utterance.onend = () => {
      console.log('⏹️ Speech synthesis ended');
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
    };

    utterance.onerror = (event) => {
      if (event.error === 'canceled') {
        // canceledエラーは通常の動作なので、簡潔なログのみ
        console.debug('🔄 音声合成キャンセル（正常動作）:', event.error);
        setError(null);
        
        // ペンディング中のキャンセルの場合はisSpeaking状態を更新しない
        if (!isPendingCancellationRef.current) {
          setIsSpeaking(false);
        }
      } else {
        // canceled以外のエラーは詳細ログを出力
        console.error('❌ 音声合成エラー:', {
          error: event.error,
          type: event.type,
          text: `${(event.target as SpeechSynthesisUtterance)?.text?.substring(0, 50)}...`,
          voice: (event.target as SpeechSynthesisUtterance)?.voice?.name
        });
        
        if (event.error === 'not-allowed') {
          // 許可状態が無効になった場合はローカルストレージもクリア
          localStorage.removeItem('audioInitialized');
          localStorage.removeItem('audioInitializedTime');
          setIsInitialized(false);
          
          setError(`音声合成が許可されていません。
ブラウザの設定で音声再生を許可するか、
音声テストボタンを先にクリックしてください。`);
        } else if (event.error === 'network' || event.error === 'synthesis-failed') {
          // ネットワークエラーや合成失敗は一時的なものの可能性
          console.warn('⚠️ 音声合成の一時的エラー:', event.error);
          setError(`音声合成に一時的な問題が発生しました。
しばらくしてから再試行してください。`);
          setIsSpeaking(false);
        } else if (event.error === 'audio-busy') {
          // オーディオデバイスが使用中
          console.warn('⚠️ オーディオデバイスが使用中:', event.error);
          setError('オーディオデバイスが使用中です。しばらくしてから再試行してください。');
          setIsSpeaking(false);
        } else if (event.error === 'synthesis-unavailable') {
          // 音声合成が利用できない
          console.warn('⚠️ 音声合成が利用できません:', event.error);
          setError('音声合成機能が現在利用できません。ブラウザを再起動してください。');
          setIsSpeaking(false);
        } else if (event.error === 'language-unavailable') {
          // 言語が利用できない
          console.warn('⚠️ 指定された言語が利用できません:', event.error);
          setError('日本語音声が利用できません。システムの音声設定を確認してください。');
          setIsSpeaking(false);
        } else {
          // その他のエラー
          console.error('❌ 未知の音声合成エラー:', event.error);
          setError(`音声合成エラー: ${event.error || '不明なエラー'}`);
          setIsSpeaking(false);
        }
      }
      
      currentUtteranceRef.current = null;
    };

    try {
      console.log('🚀 Calling speechSynthesis.speak()...');
      console.log('📊 Pre-speak state:', {
        speaking: speechSynthesis.speaking,
        pending: speechSynthesis.pending,
        paused: speechSynthesis.paused,
        voicesLength: speechSynthesis.getVoices().length,
        utteranceVoice: utterance.voice?.name,
        utteranceText: `${utterance.text.substring(0, 50)}...`,
        utteranceVolume: utterance.volume,
        utteranceRate: utterance.rate,
        utterancePitch: utterance.pitch
      });
      
      speechSynthesis.speak(utterance);
      console.log('✅ speechSynthesis.speak() called successfully');
      
      // macOS/Safari対応: speak()の直後にresume()を呼ぶ
      // これは一部のブラウザで音声合成が開始されない問題を解決します
      setTimeout(() => {
        if (speechSynthesis.paused) {
          console.log('🔄 Detected paused state, calling resume()...');
          speechSynthesis.resume();
        }
      }, 10);
      
      // 少し待ってから状態を確認
      setTimeout(() => {
        console.log('📊 Post-speak state (100ms later):', {
          speaking: speechSynthesis.speaking,
          pending: speechSynthesis.pending,
          paused: speechSynthesis.paused
        });
      }, 100);
      
      // さらに待ってから状態を確認
      setTimeout(() => {
        console.log('📊 Post-speak state (500ms later):', {
          speaking: speechSynthesis.speaking,
          pending: speechSynthesis.pending,
          paused: speechSynthesis.paused
        });
        
        // もし500ms後も何も起こっていなければ、resume()を試す
        if (!speechSynthesis.speaking && !speechSynthesis.pending) {
          console.log('⚠️ Speech synthesis seems stuck, trying resume()...');
          speechSynthesis.resume();
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ speechSynthesis.speak エラー:', error);
      setError('音声合成の開始に失敗しました');
      setIsSpeaking(false);
    }
  }, [voices]);

  const stop = useCallback(() => {
    if (isSupported) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      isPendingCancellationRef.current = false;
    }
  }, [isSupported]);

  // 音声許可状態をテストする関数
  const testAudioPermission = useCallback(() => {
    if (!isSupported) return;

    const wasInitialized = localStorage.getItem('audioInitialized') === 'true';
    const initTime = localStorage.getItem('audioInitializedTime');
    const isRecent = initTime && (Date.now() - Number.parseInt(initTime)) < 24 * 60 * 60 * 1000; // 24時間
    
    if (wasInitialized && isRecent && !isInitialized) {
      // 実際に音声合成をテストして許可状態を確認
      const testUtterance = new SpeechSynthesisUtterance('');
      testUtterance.volume = 0;
      
      testUtterance.onstart = () => {
        setIsInitialized(true);
        console.log('音声合成の初期化状態を復元しました（テスト成功）');
      };
      
      testUtterance.onerror = (event) => {
        if (event.error === 'canceled') {
          // canceledは正常な動作なので無視
          console.log('音声合成テストがキャンセルされました（正常動作）');
          return;
        }
        
        console.warn('音声合成テスト失敗:', event.error);
        // 許可状態が無効になっている場合はローカルストレージをクリア
        localStorage.removeItem('audioInitialized');
        localStorage.removeItem('audioInitializedTime');
        setIsInitialized(false);
      };
      
      try {
        speechSynthesis.speak(testUtterance);
      } catch (error) {
        console.warn('音声合成テストでエラー:', error);
        localStorage.removeItem('audioInitialized');
        localStorage.removeItem('audioInitializedTime');
        setIsInitialized(false);
      }
    } else if (wasInitialized && !isRecent) {
      // 古い初期化状態をクリア
      localStorage.removeItem('audioInitialized');
      localStorage.removeItem('audioInitializedTime');
      setIsInitialized(false);
      console.log('古い音声初期化状態をクリアしました');
    }
  }, [isSupported, isInitialized]);

  useEffect(() => {
    if (!isSupported) return;

    loadVoices();
    testAudioPermission();

    // 音声リストの読み込み完了を待つ
    const handleVoicesChanged = () => {
      loadVoices();
    };

    // ページが表示状態になったときに音声許可状態を再チェック
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('ページがアクティブになりました。音声許可状態を再チェックします。');
        testAudioPermission();
      }
    };

    speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      speechSynthesis.cancel();
    };
  }, [loadVoices, isSupported, testAudioPermission]);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
    error,
    voices,
    isInitialized,
    initializeAudio,
  };
}
