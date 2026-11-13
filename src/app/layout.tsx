import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Inter, Montserrat, Roboto } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const beVietnamPro = Be_Vietnam_Pro({
  weight: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
});

const montserrat = Montserrat({
  weight: ['400', '700', '900'],
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-montserrat',
});

const inter = Inter({
  weight: ['400', '700', '900'],
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
});

const roboto = Roboto({
  weight: ['400', '700', '900'],
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: 'TikVoice — AI Video Voice-Over Studio',
  description:
    'Tự động hóa lồng tiếng, tạo phụ đề karaoke động và biên tập video TikTok Affiliate Marketing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`dark ${beVietnamPro.variable} ${montserrat.variable} ${inter.variable} ${roboto.variable}`}
    >
      <body
        className={`${beVietnamPro.className} min-h-screen bg-[#09090b] text-[#fafafa] antialiased selection:bg-[#f97316]/30 selection:text-white`}
      >
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fafafa',
            },
          }}
        />
      </body>
    </html>
  );
}
