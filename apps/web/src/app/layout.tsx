import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'RARY Vizion',
  description: 'O espaço de trabalho para equipes',
  icons: {
    icon: '/Eye-RARYVizion.svg',
    shortcut: '/Eye-RARYVizion.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
