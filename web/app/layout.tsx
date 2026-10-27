import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RepoDoctor — Understand Systems, Not Repositories',
  description: 'Evidence-backed multi-repository system intelligence graph and architecture explorer.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
