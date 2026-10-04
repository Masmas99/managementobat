import './globals.css';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'MediStock | Manajemen Persediaan Obat',
  description: 'Dashboard inventory obat untuk klinik dan rumah sakit.',
  icons: {
    icon: '/image.png',
    shortcut: '/image.png',
    apple: '/image.png',
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    title: 'MediStock | Manajemen Persediaan Obat',
    description: 'Dashboard inventory obat untuk klinik dan rumah sakit.',
    siteName: 'MediStock',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'MediStock' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MediStock | Manajemen Persediaan Obat',
    description: 'Dashboard inventory obat untuk klinik dan rumah sakit.',
    images: ['/og.jpg'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
