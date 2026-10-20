import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import { PracticeProvider } from '@/components/practice-context';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Communication Coach',
    template: '%s · Communication Coach',
  },
  description: 'Practice spoken English and get evidence-based communication coaching.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AuthProvider>
          <PracticeProvider>{children}</PracticeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
