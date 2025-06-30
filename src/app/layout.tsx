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
      <body className="h-screen w-screen overflow-hidden bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">{children}</body>
    </html>
  );
}
