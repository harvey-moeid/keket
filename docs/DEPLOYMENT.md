# Deployment dan operasi

Konfigurasi terbaru repo memakai **satu Worker Production**, `kizuna-production`, dengan D1 Production yang sudah diikat dalam `wrangler.toml` dan R2 `kizuna-production-assets`. Environment Preview terpisah sudah dihapus pada perubahan upstream. Mode lokal tetap memakai storage lokal Wrangler; sandbox game merupakan room terpisah dan tidak menulis riwayat utama.

## Resource dan secrets

1. Pastikan akun Cloudflare mendukung SQLite Durable Objects, binding D1 yang tercantum dan bucket R2 Production.
2. Atur secrets Worker `ADMIN_PASSWORD_HASH` dan `WEBHOOK_SECRET`; untuk konektor native atur `WEBHOOK_SIGNING_SECRET` yang sama pada konektor dan Worker. Nilai secret tidak disimpan di Git atau HTML. Hash admin berformat `310000:<salt hex 16 bytes>:<hash hex 32 bytes>`.
3. `npm run admin:bootstrap` membuat hash akun awal di `.dev.vars` privat untuk lokal. Konfigurasi Production juga memakai `ADMIN_REQUIRE_PASSWORD_CHANGE="true"`; operator perlu memasukkan hash bootstrap yang sesuai ke secret Worker Production. Kredensial lokal tidak otomatis diunggah ke Cloudflare.
4. Jalankan migrasi `wrangler d1 migrations apply kizuna-production --remote` sebelum menjalankan Worker baru, atau gunakan workflow CD yang menjalankannya sebelum deploy. Dev lokal memakai `npm run db:local` / `npm run dev`.
5. Deployment manual memakai `npm run deploy:production`. Ikuti checklist operator [QA.md](QA.md) sebelum menggunakan LIVE nyata.

## Akun admin dan pemulihan

Pada environment baru, `ADMIN_USERNAME` dan `ADMIN_PASSWORD_HASH` menjadi kredensial bootstrap. Untuk password awal sementara, atur var Worker `ADMIN_REQUIRE_PASSWORD_CHANGE="true"` di environment tujuan (lokal dibuat oleh `npm run admin:bootstrap`). Hash tetap di secret Worker; tidak ada password default yang disimpan di source. Login pertama membuka form akun sebelum kontrol admin dapat digunakan. Password baru wajib berbeda dan minimal 12 karakter, dengan verifikasi password saat ini serta CSRF dan pembatasan percobaan.

**Settings → Akun admin** mengganti username/password. Kredensial baru disimpan sebagai salted PBKDF2 hash pada dokumen privat D1 `admin_credentials`, mengalahkan konfigurasi bootstrap. Sesi dicabut otomatis; versi kredensial juga menolak sesi dari login lama yang selesai bersamaan dengan rotasi. Hash tidak dikirim ke UI/catalog/overlay. Jalankan migrasi `0002_account_credentials.sql` sebelum menjalankan versi ini; migrasi mengeluarkan sesi versi lama.

Jika kehilangan password, operator dengan akses D1 dapat memulihkan lingkungan yang tepat: siapkan hash bootstrap baru sebagai secret Worker dan `ADMIN_REQUIRE_PASSWORD_CHANGE="true"`, lalu hapus dokumen `admin_credentials` serta semua rows `sessions` pada D1 lingkungan tersebut. Jangan menghapus data fighter/match. Login dengan akun bootstrap baru dan segera ganti melalui UI. Mengubah secret bootstrap saja tidak mengubah akun yang sudah tersimpan di D1. Pemulihan tidak tersedia lewat endpoint publik.

## GitHub Actions CI/CD

Workflow **Validate** menjalankan install, pemeriksaan format, 44 tes combat/security dan build TypeScript/Vite pada push/PR. **Deploy Cloudflare** menggunakan workflow validasi yang sama sebelum deployment Production pada push `main` atau `workflow_dispatch`. Konfigurasi upstream terbaru tidak memakai release/Preview sebagai pemicu deploy.

Di GitHub **Settings → Environments → production**, siapkan secrets `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID`. Token perlu scope Worker Scripts, D1 dan R2 pada akun terkait. Atur required reviewers/branch protection bila dibutuhkan dan didukung paket GitHub; kode workflow tidak membuat aturan tersebut otomatis. Secrets aplikasi tetap disimpan di Cloudflare, bukan bundel frontend.

Workflow memeriksa konfigurasi Production, membangun aplikasi, menjalankan migrasi D1, lalu deploy Worker. Kegagalan validasi/build/migrasi menghentikan deploy. Deployment satu environment diantrikan. Bila deploy gagal setelah migrasi berhasil, perubahan schema tetap ada; gunakan migrasi yang kompatibel dengan Worker sebelumnya. Tidak ada rollback database otomatis. Ringkasan job mencatat SHA commit yang berhasil dideploy.

Konfigurasi resource berasal dari perubahan upstream; akses credential, hasil runner GitHub dan deployment remote belum diverifikasi dari sesi ini.

## Operasi dan pemulihan

State dan seed AI disimpan dalam tabel SQLite Durable Object setelah kontrol dan tiap 60 tick selama combat. Saat instance direkonstruksi, match yang sebelumnya running diubah menjadi paused; operator melanjutkan secara manual. Ini mencegah asumsi waktu offline sebagai simulasi yang valid. Event dedup tersimpan dalam tabel ber-index setelah ingress dan tetap aktif saat reset; membership dan ringkasan contribution ikut snapshot state. Live socket reconnect mengambil state terbaru.

Perubahan konfigurasi fighter tidak memodifikasi snapshot pertandingan aktif. Nonaktifkan fighter menghapusnya dari pemilihan, bukan hasil historis. ID aset R2 unik; versi metadata meningkat. Tidak ada rollback, backup otomatis, replay, atau auto-rematch.

Log in-memory dibatasi 60 entri. Dedup map maksimal 5000 IDs / 60 detik; room ingress maksimal 100 event/detik, anggota maksimal 5000, per-team queue maksimal 100. Batas ini merupakan budget konfigurasi MVP, **bukan** hasil stress test LIVE ribuan penonton. D1 archive terbaru dibatasi 100 match pada layar/export. Retensi D1 berjalan ketika hasil baru diarsipkan; bukan scheduled purge. Tombol Hapus riwayat menghapus history environment, bukan state membership match aktif atau aset R2.

## Peringatan yang perlu diuji pada infrastruktur nyata

DO menggunakan fixed-step interval saat match running (30 tick/s), broadcast 10 Hz. Belum ada kapasitas/latensi production terukur atau scheduler catch-up untuk tick yang tertunda. Setiap room adalah satu sumber kebenaran; visual browser tidak menentukan damage. Visual FPS yang ditampilkan adalah pengukuran browser, bukan jaminan 60 FPS.

Gunakan HTTPS. Cookies sesi HttpOnly/SameSite Strict, Secure pada HTTPS, expiry 24 jam. Login dibatasi 5 percobaan per IP / 15 menit. Mutasi admin memerlukan sesi dan CSRF token; kontrol realtime tetap melalui REST admin. WebSocket publik hanya mengirim state, tanpa menerima kontrol. Webhook internal memakai Bearer token; endpoint native `/api/game/tiktok` memverifikasi HMAC-SHA256 konektor sebelum parsing, dengan freshness 30 detik + dedup/rate caps. Atur `WEBHOOK_SIGNING_SECRET` yang sama pada konektor dan Worker, serta opsional `TIKTOK_ROOM_ID`; lihat [panduan integrasi](TIKTOK.md). Konektor menyediakan event ID stabil pada retry, tetapi hanya username viewer (bukan numeric user ID); batas identitas didokumentasikan. Hadiah streak hanya diterapkan pada event final.

Periksa checklist QA sebelum LIVE; dukungan gamepad, low-latency multiplayer eksternal, penyimpanan ban viewer dan koneksi provider LIVE nyata belum diverifikasi.
