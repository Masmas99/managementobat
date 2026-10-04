import './globals.css';

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
const siteUrl = configuredSiteUrl && !configuredSiteUrl.includes('domain-website-anda.com')
  ? configuredSiteUrl
  : 'https://managementobat-5zh5.vercel.app';

export const metadata = {
  metadataBase: new URL(siteUrl),
  alternates: { canonical: siteUrl },
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
    images: [{ url: '/og.jpg?v=2', type: 'image/jpeg', width: 1200, height: 630, alt: 'MediStock' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MediStock | Manajemen Persediaan Obat',
    description: 'Dashboard inventory obat untuk klinik dan rumah sakit.',
    images: ['/og.jpg?v=2'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
