import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: '家具工厂 AI 系统', description: 'Furniture Factory AI System' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

