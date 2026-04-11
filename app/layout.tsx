import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import AppBootSplash from '@/components/ui/AppBootSplash';

export const metadata: Metadata = {
  title: 'NexResto',
  description: 'NexResto Home Page',
  icons: {
    icon: '/nexresto-logo.svg',
    shortcut: '/nexresto-logo.svg',
    apple: '/nexresto-logo.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppBootSplash />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
