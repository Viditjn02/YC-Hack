import './global.css';
import Providers from './providers';

const fontClass = 'font-sans';

export const metadata = {
  title: 'BossBot',
  description: 'Voxel 3D Office World',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || '';

  return (
    <html lang="en" className={fontClass}>
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
