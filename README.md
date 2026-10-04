# Medistock

Aplikasi manajemen stok obat berbasis Next.js dan PostgreSQL.

## Prasyarat

- Node.js 20 atau lebih baru
- npm
- PostgreSQL atau akun PostgreSQL seperti Neon

## Instalasi

1. Clone repository dan masuk ke folder project:

   ```bash
   git clone https://github.com/Masmas99/managementobat.git
   cd managementobat
   ```

2. Install dependency:

   ```bash
   npm install
   ```

3. Buat file environment dari template:

   ```bash
   cp .env.example .env
   ```

   Pada Windows PowerShell, gunakan:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Edit `.env` dan isi nilai berikut:

   ```env
   DATABASE_URL="postgresql://username:password@host:5432/database?sslmode=require"
   AUTH_SECRET="isi-dengan-string-rahasia-yang-panjang"
   ```

   `DATABASE_URL` wajib mengarah ke database PostgreSQL yang dapat diakses oleh aplikasi.

5. Pilih setup database sesuai kondisi:

   Untuk database PostgreSQL baru/kosong:

   ```bash
   npm run db:generate
   npm run db:push
   ```

   Jika database sudah berisi data dari versi lama, jangan jalankan `db:push`.
   Gunakan migrasi aman berikut. Data lama dipindahkan ke struktur produk,
   batch, dan stok per lokasi; tabel legacy tetap disimpan sebagai backup.

   ```bash
   npm run db:migrate:legacy
   npm run db:generate
   ```

   Jangan menjalankan `npm run db:seed` pada database lama karena seed menghapus
   data operasional dan mengisi data contoh.

6. Isi data awal (opsional):

   ```bash
   npm run db:seed
   ```

## Menjalankan aplikasi

Untuk development:

```bash
npm run dev
```

Buka http://localhost:3000 di browser.

Untuk production:

```bash
npm run build
npm run start
```

## Perintah yang tersedia

| Perintah | Keterangan |
| --- | --- |
| `npm run dev` | Menjalankan server development |
| `npm run build` | Membuat build production |
| `npm run start` | Menjalankan build production |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:push` | Sinkronisasi schema ke database |
| `npm run db:seed` | Memasukkan data awal |

