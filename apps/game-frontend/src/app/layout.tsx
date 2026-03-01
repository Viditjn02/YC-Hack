import './global.css';
import { Sora } from 'next/font/google';
import Providers from './providers';

const sora = Sora({ subsets: ['latin'] });

export const metadata = {
  title: 'BossRoom',
  description: 'Voxel 3D Office World',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || '';

  return (
    <html lang="en" className={sora.className}>
      <head>
        {wsUrl && <meta name="ws-url" content={wsUrl} />}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__WS_URL__ = ${JSON.stringify(wsUrl)};`,
          }}
        />
      </head>
      <body className="bg-[#0a0a1a]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
