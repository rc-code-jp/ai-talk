# AI Talk - 音声チャットアプリ

日本語音声入出力に対応したWebアプリケーションです。ブラウザのWeb Speech APIを使用して音声認識と音声合成を実行し、Gemini 2.0 Flash-Liteで会話を行います。

## 🚀 機能

- **音声認識**: ブラウザの音声認識機能を使用した日本語音声入力
- **音声合成**: 日本語音声での応答読み上げ
- **リアルタイムチャット**: Gemini 2.0 Flash-Liteによるストリーミング応答
- **レスポンシブデザイン**: モバイル・デスクトップ対応

## 🛠️ 技術スタック

- **Next.js 15** (App Router)
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **Biome** (Lint/Format)
- **Web Speech API**
- **Gemini 2.0 Flash-Lite API**

## 📋 対応ブラウザ

### 音声認識 (SpeechRecognition)
- ✅ Chrome/Chromium
- ✅ Edge
- ✅ Android Chrome
- ❌ Safari
- ❌ Firefox

### 音声合成 (SpeechSynthesis)
- ✅ Chrome/Chromium
- ✅ Edge
- ✅ Safari
- ✅ Firefox
- ✅ モバイルブラウザ

## 🔧 セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
# ローカル環境の場合
cp .env.example .env.local
```

`.env.local`に以下を設定：

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリにアクセスできます。

### 4. プロダクションビルド

```bash
npm run build
npm run export
```

`out/`フォルダに静的ファイルが生成されます。

## 🚀 AWS Amplify デプロイ

### 1. Amplify CLIのインストール

```bash
npm install -g @aws-amplify/cli
```

### 2. Amplifyプロジェクトの初期化

```bash
amplify init
```

### 3. 環境変数の設定

Amplify Console > Environment variables で以下を設定：

- `GEMINI_API_KEY`: あなたのGemini APIキー

### 4. デプロイ

```bash
git add .
git commit -m "Initial commit"
git push
```

AmplifyはGitにプッシュすると自動的にビルド・デプロイされます。

## 📝 使用方法

### 初回セットアップ
1. アプリにアクセス
2. **音声機能を有効化**（重要！）
   - 自動表示されるモーダルで「🔊 音声を有効にする」をクリック
   - または「🔊 音声テスト (推奨)」ボタンをクリック
3. マイクへの許可を与える

### 会話の流れ
1. 「🎤 音声認識開始」ボタンをクリック
2. 日本語で話しかける（2秒の無音で自動終了）
3. 音声認識が終了すると自動的にAIが応答
4. AIの応答が音声で読み上げられる
5. 応答終了後、自動的に次の音声入力待機状態になる

### 音声許可の事前設定

#### Chrome
```
1. chrome://settings/content/sound
2. 「音声を再生できるサイト」にサイトURLを追加
3. または アドレスバーの鍵アイコン → 音声 → 許可
```

#### Safari
```
1. Safari → このWebサイトの設定
2. 自動再生 → 「すべての自動再生を許可」
```

#### Edge
```
1. edge://settings/content/mediaAutoplay
2. 「許可」リストにサイトURLを追加
```

## 🔧 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# 静的ビルド
npm run build
npm run export

# コードフォーマット
npm run format

# Lint実行
npm run lint
```

## ⚠️ 注意事項

- **音声認識**: Chrome系ブラウザでのみ動作します
- **音声合成**: 初回利用時にユーザー操作による許可が必要です
- **HTTPS必須**: 本番環境では音声機能にHTTPS接続が必要です
- **API制限**: Gemini APIの使用量制限にご注意ください
- **自動再生ポリシー**: ブラウザの自動再生ポリシーにより音声初期化が必要です
- **テストコード**: このプロジェクトにはテストコードは含まれていません

## 🐛 トラブルシューティング

### 音声合成エラー: not-allowed
**原因**: ブラウザの自動再生ポリシーにより音声再生が制限されています

**解決方法**:
1. 「🔊 音声テスト (推奨)」ボタンを最初にクリック
2. ブラウザの音声再生設定を確認
3. ページを再読み込みして再試行

### 音声認識が動作しない
**解決方法**:
1. マイクの使用許可を確認
2. HTTPS または localhost でアクセスしているか確認
3. Chrome系ブラウザを使用しているか確認

### AIが応答しない
**解決方法**:
1. 開発者ツールのコンソールでエラーをチェック
2. Gemini API キーが正しく設定されているか確認
3. ネットワーク接続を確認

## 📚 API仕様

### POST /api/chat

音声チャットのエンドポイント

**Request Body:**
```json
{
  "history": [
    {
      "role": "user",
      "content": "こんにちは"
    },
    {
      "role": "assistant", 
      "content": "こんにちは！何かお手伝いできることはありますか？"
    }
  ],
  "user": "今日の天気は？"
}
```

**Response:**
Server-Sent Events形式でストリーミングレスポンス

## 🌐 デモ

https://your-amplify-app.amplifyapp.com

## 📄 ライセンス

ISC 