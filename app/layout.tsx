import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import { PracticeProvider } from '@/components/practice-context';
import { SessionExitGuard } from '@/components/session-exit-guard';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Sayform',
    template: '%s · Sayform',
  },
  description: 'Practice spoken English and get evidence-based communication coaching.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AuthProvider>
          <PracticeProvider>
            <SessionExitGuard />
            {children}
          </PracticeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
