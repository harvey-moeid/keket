# Deployment dan operasi

Satu Worker Production, `kizuna-production`, memakai **KV DATA**, **R2 ASSET_BUCKET**, Durable Object **MatchRoom** untuk game realtime, dan Durable Object **AuthStore** untuk autentikasi. Tidak ada binding, database, atau migrasi D1 yang diperlukan aplikasi ini.

## Resource dan secrets

1. Akun Cloudflare harus mendukung SQLite-backed Durable Objects dan bucket R2 `kizuna-production-assets`. Nama backend SQLite ini milik Durable Object, bukan D1; autentikasi menggunakan API penyimpanan key-value Durable Object.
2. Binding KV `DATA` dalam `wrangler.toml` sengaja tidak memiliki ID. Wrangler 4 membuat namespace otomatis saat deploy pertama dan memakai binding yang sama pada deploy berikutnya. Tidak perlu secret KV namespace ID. Untuk namespace yang sudah tersedia, tambahkan `id` ke binding `DATA`.
3. Pasang secret Worker `ADMIN_PASSWORD` dengan password biasa untuk akun bootstrap dan `WEBHOOK_SECRET` untuk endpoint internal. Untuk konektor TikTok, pasang `WEBHOOK_SIGNING_SECRET` yang sama di konektor dan Worker, minimal 32 karakter. Jangan simpan nilainya di Git atau frontend.
4. `ADMIN_USERNAME` dan `ADMIN_REQUIRE_PASSWORD_CHANGE="true"` merupakan vars biasa. Opsional `TIKTOK_ROOM_ID` membatasi penerimaan room TikTok.
5. Jalankan `npm run deploy:production`. Tidak ada langkah migrasi SQL. Migrasi kelas Durable Object `v1` dipertahankan untuk MatchRoom; `v2-auth-kv` menambahkan AuthStore tanpa menghapus state game lama.

`npm run dev` memakai KV, R2, dan Durable Object lokal di `.wrangler/state`. `npm run admin:bootstrap` memasukkan password biasa ke `.dev.vars` privat (ignored Git), bukan mengunggah secret Production. Untuk dua terminal, gunakan `npm run build`, `npm run dev:api`, dan `npm run dev:ui`.

## Penyimpanan KV dan konsistensi

- `document:fighters`, `document:arenas`, `document:settings`, `document:mappings`: konfigurasi JSON.
- `asset:<id>`: metadata upload; file gambar tetap di R2.
- `match:<environment>:<reverse-timestamp>:<id>`: hasil pertandingan final. Timestamp tersimpan bersama snapshot MatchRoom sehingga retry menggunakan key yang sama. Sandbox tidak diarsipkan.

Riwayat ditampilkan terbaru dahulu, maksimal 100 hasil, dengan pagination KV. Masa simpan memakai expiration sesuai `retentionDays` pada saat pertandingan selesai; perubahan pengaturan berlaku untuk hasil baru. Tombol Hapus riwayat menghapus seluruh halaman pada prefix environment terkait, tanpa menghapus konfigurasi atau aset.

[KV bersifat eventually consistent](https://developers.cloudflare.com/kv/concepts/how-kv-works/): perubahan konfigurasi, riwayat baru, dan penghapusan riwayat dapat memerlukan 60 detik atau lebih untuk terlihat di lokasi lain. Edit konfigurasi memakai last-write-wins; hindari mengedit dokumen yang sama secara bersamaan. Mapping baru dikirim langsung ke kedua MatchRoom setelah KV berhasil ditulis, sehingga penerapannya tidak menunggu pembacaan KV. Saat room dibangun ulang, konfigurasi dibaca dari KV dan dapat mengikuti jeda propagasi tersebut.

Kredensial admin, sesi, dan batas percobaan login **tidak** mengandalkan cache KV. Semuanya memakai key-value storage AuthStore dengan transaksi. Logout langsung mencabut sesi; rotasi password langsung membatalkan semua versi sesi sebelumnya. Percobaan login serentak tetap dihitung pada satu AuthStore untuk environment tersebut. Alarm membersihkan sesi kedaluwarsa/dicabut dan batas percobaan kedaluwarsa.

## Akun admin dan pemulihan

`ADMIN_USERNAME` dan `ADMIN_PASSWORD` adalah akun bootstrap sebelum akun diganti lewat UI. Dengan `ADMIN_REQUIRE_PASSWORD_CHANGE="true"`, login pertama harus mengganti akun sebelum kontrol admin tersedia. Password baru wajib berbeda, minimal 12 karakter, dan perubahan memerlukan password saat ini, sesi, serta CSRF.

**Settings → Akun admin** menyimpan salted PBKDF2 hash pada key `admin_credentials` milik AuthStore. Password biasa hanya berada di secret bootstrap, tidak disimpan ke KV atau dikirim ke browser. Akun yang tersimpan mengalahkan konfigurasi bootstrap; mengubah `ADMIN_PASSWORD` saja tidak mengganti akun aktif.

Pemulihan oleh operator memerlukan akses administratif ke storage AuthStore lingkungan yang benar: siapkan password bootstrap baru dan `ADMIN_REQUIRE_PASSWORD_CHANGE="true"`, lalu hapus key `admin_credentials` dan semua key `session:` di AuthStore. Jangan menghapus storage MatchRoom atau namespace KV DATA. Setelah pemulihan, login menggunakan akun bootstrap dan segera ganti password. Tidak ada endpoint pemulihan publik.

## GitHub Actions CI/CD

Workflow **Validate** menjalankan install, pemeriksaan format, tes, dan build TypeScript/Vite. **Deploy Cloudflare** menunggu validasi, kemudian deploy Production pada push `main` atau `workflow_dispatch`.

Di GitHub **Settings → Environments → production**, siapkan:

- `CLOUDFLARE_API_TOKEN`: izin Edit Workers Scripts, Workers KV Storage, dan Workers R2 Storage pada akun tujuan; Account Settings Read bila dibutuhkan untuk akses akun. D1 tidak lagi diperlukan.
- `CLOUDFLARE_ACCOUNT_ID`: ID akun tujuan.

Secret aplikasi tetap dipasang di Cloudflare. Workflow memeriksa binding KV/auth, membangun aplikasi, lalu menjalankan `wrangler deploy` tanpa migrasi D1. Ringkasan job mencatat SHA commit yang berhasil dideploy. Atur required reviewers/branch protection bila diperlukan; workflow tidak membuat aturan tersebut.

## Data dari versi D1 sebelumnya

Perubahan kode ini tidak menghapus resource D1 remote atau memindahkan data lama secara otomatis. Deploy versi KV pada instalasi yang sebelumnya memakai D1 akan memakai konfigurasi default dan akun bootstrap sampai data diimpor. Sesi lama tidak diterima AuthStore baru.

Jika D1 lama berisi data penting, ekspor dan migrasikan konfigurasi serta riwayat ke format key KV di atas sebelum mengganti layanan aktif. Akun dapat dibuat ulang melalui bootstrap. Simpan backup dan verifikasi hasil KV sebelum menghapus database lama. Resource remote belum diubah dari workspace ini.

## Operasi

MatchRoom tetap menyimpan snapshot game, seed AI, membership, contributions, serta dedup event dalam storage Durable Object. Setelah instance dibangun ulang, pertandingan running menjadi paused dan harus dilanjutkan operator. Lifecycle tetap manual. Perubahan fighter tidak mengubah snapshot pertandingan aktif.

Gunakan HTTPS. Cookie sesi HttpOnly/SameSite Strict/Secure pada HTTPS, berlaku 24 jam. Login dibatasi 5 percobaan per IP selama 15 menit. Mutasi admin memerlukan sesi dan CSRF. Webhook internal memakai Bearer token; webhook TikTok memakai HMAC-SHA256, freshness dan dedup/rate limit.

DO berjalan pada tick simulasi 30 Hz dan broadcast 10 Hz. Kapasitas/latensi LIVE produksi belum diukur. Ikuti [checklist QA](QA.md) dan [panduan TikTok](TIKTOK.md) sebelum LIVE. Tidak ada backup otomatis atau rollback storage aplikasi.
