import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Talk - 音声チャット',
  description: '日本語音声チャットアプリ',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
