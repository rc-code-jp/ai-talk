export const runtime = 'edge';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  history: ChatMessage[];
  user: string;
}

export async function POST(req: Request) {
  try {
    const { history, user }: RequestBody = await req.json();
    console.log('Chat API request:', { history, user });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('Gemini API key not configured');
      return new Response('API key not configured', { status: 500 });
    }

    // システムプロンプトを追加してGemini API用にメッセージ形式を変換
    const contents = [
      // システムプロンプト（日本語での応答を指定）
      {
        role: 'user' as const,
        parts: [{ 
          text: `あなたは親しみやすい日本語のAIアシスタントです。以下のルールに従って応答してください：

1. 必ず日本語のみで応答してください
2. 英語や他の言語は一切使用しないでください
3. 自然で親しみやすい日本語で会話してください
4. 簡潔で分かりやすい応答を心がけてください
5. 絵文字は適度に使用してください

これらのルールを必ず守って、ユーザーと日本語で会話してください。` 
        }],
      },
      {
        role: 'model' as const,
        parts: [{ text: '分かりました！日本語のみで親しみやすく会話させていただきます。' }],
      },
      // 会話履歴
      ...history.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      // ユーザーの新しいメッセージ
      {
        role: 'user' as const,
        parts: [{ text: user }],
      },
    ];

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            maxOutputTokens: 256,
            temperature: 0.7,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_NONE',
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_NONE',
            },
          ],
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return new Response('Failed to fetch from Gemini API', { status: 500 });
    }

    console.log('Gemini API response status:', geminiResponse.status);
    console.log('Gemini API response headers:', Object.fromEntries(geminiResponse.headers.entries()));

    // ストリーミングレスポンスをそのまま返す
    return new Response(geminiResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
