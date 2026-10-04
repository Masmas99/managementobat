import './globals.css';

export const metadata = {
  title: 'MediStock | Manajemen Persediaan Obat',
  description: 'Dashboard inventory obat untuk klinik dan rumah sakit.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
