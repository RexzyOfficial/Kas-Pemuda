# 💰 Kas Pemuda Remaja

Aplikasi manajemen keuangan kas pemuda remaja berbasis web. Dibangun dengan HTML, CSS, JavaScript, dan Firebase Firestore.

## ✨ Fitur

- 🔐 Autentikasi login (Firebase Auth)
- 📊 Dashboard dengan ringkasan saldo bulanan
- 📈 Grafik tren keuangan 7 hari terakhir
- 📋 History bulanan dengan tren grafik pemasukan & pengeluaran
- ➕ Tambah / Edit / Hapus transaksi (khusus Pengurus)
- 📤 Ekspor laporan ke Excel (.xlsx) & PDF
- 📋 Salin laporan ke clipboard
- 📱 Responsif di semua perangkat (mobile, tablet, desktop)
- ⚡ Progressive Web App (PWA) — bisa di-install

## 🛠️ Teknologi

| Stack | Detail |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend / DB | Firebase Firestore |
| Auth | Firebase Authentication |
| Charts | Chart.js |
| Animasi | GSAP |
| Export | SheetJS (Excel), jsPDF + AutoTable (PDF) |
| Deploy | Vercel |

## 🚀 Deploy

Aplikasi ini di-deploy otomatis via **Vercel** setiap kali ada push ke branch `main`.

### Cara Deploy Manual

1. Fork / clone repo ini
2. Connect repo ke [Vercel](https://vercel.com)
3. Tidak perlu konfigurasi build — langsung deploy sebagai Static Site
4. Isi Firebase config kamu di `js/firebase-config.js`

## ⚙️ Konfigurasi Firebase

Edit file `js/firebase-config.js` dengan konfigurasi Firebase project kamu:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## 📁 Struktur Proyek

```
kas-pemuda/
├── index.html          # Halaman login
├── dashboard.html      # Halaman dashboard
├── history.html        # Halaman history bulanan
├── manifest.json       # PWA manifest
├── sw.js               # Service worker
├── vercel.json         # Konfigurasi Vercel
├── css/
│   ├── style.css       # Style utama
│   └── responsive.css  # Style responsif
├── js/
│   ├── firebase-config.js
│   ├── auth.js
│   ├── dashboard.js
│   ├── history.js
│   ├── transactions.js
│   └── utils.js
└── assets/
    └── images/         # Logo, favicon, icon PWA
```

## 👥 Role Pengguna

| Role | Akses |
|---|---|
| **Anggota** | Lihat dashboard & history |
| **Pengurus** | Tambah, edit, hapus transaksi + ekspor laporan |