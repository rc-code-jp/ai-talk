export interface SSEOptions {
  endpoint: string;
  body: Record<string, unknown>;
  onMessage: (text: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export async function streamSSE({
  endpoint,
  body,
  onMessage,
  onError,
  onComplete,
}: SSEOptions): Promise<void> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

                buffer += decoder.decode(value, { stream: true });
        
        // Gemini APIのストリーミングレスポンスを処理
        // 完全なJSONオブジェクトを抽出
        let jsonStart = 0;
        while (jsonStart < buffer.length) {
          // JSONオブジェクトの開始を探す
          const openBrace = buffer.indexOf('{', jsonStart);
          if (openBrace === -1) break;
          
          // 対応する閉じブレースを探す（ネストされたオブジェクトを考慮）
          let braceCount = 0;
          let i = openBrace;
          for (; i < buffer.length; i++) {
            if (buffer[i] === '{') braceCount++;
            if (buffer[i] === '}') braceCount--;
            if (braceCount === 0) break;
          }
          
          // 完全なJSONオブジェクトが見つかった場合
          if (braceCount === 0) {
            const jsonStr = buffer.substring(openBrace, i + 1);
            console.log('Processing JSON object:', jsonStr);
            
            try {
              const responseData = JSON.parse(jsonStr);
              console.log('Parsed response data:', responseData);
              
              const text = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                console.log('Extracted text:', text);
                onMessage(text);
              }
            } catch (parseError) {
              console.warn('Failed to parse JSON:', parseError, 'JSON:', jsonStr);
            }
            
            jsonStart = i + 1;
          } else {
            // 不完全なJSONオブジェクトの場合、バッファを更新して次の読み取りを待つ
            buffer = buffer.substring(openBrace);
            break;
          }
        }
        
        // 処理済みの部分をバッファから削除
        if (jsonStart > 0 && jsonStart < buffer.length) {
          buffer = buffer.substring(jsonStart);
        } else if (jsonStart >= buffer.length) {
          buffer = '';
        }
      }
    } finally {
      reader.releaseLock();
    }

    onComplete?.();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error : new Error('Unknown error');
    onError?.(errorMessage);
  }
}
