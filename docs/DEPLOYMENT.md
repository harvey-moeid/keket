# Deployment dan operasi

## Resource yang perlu disediakan operator

Akun Cloudflare dengan Workers Paid yang mendukung SQLite Durable Objects, dua D1 database dan dua R2 bucket. Kredensial Cloudflare belum diberikan dan resource remote belum dibuat pada pengerjaan ini. CI berjalan pada push/PR; CD Preview otomatis dapat diaktifkan setelah resource dan secrets siap.

1. Autentikasi Wrangler dengan akses akun yang sesuai.
2. Buat database `kizuna-preview` dan `kizuna-production`; ganti kedua placeholder `database_id` di `wrangler.toml` dengan ID sebenarnya.
3. Buat bucket `kizuna-preview-assets` dan `kizuna-production-assets`.
4. Atur secret `ADMIN_PASSWORD_HASH` dan `WEBHOOK_SECRET` untuk **masing-masing** environment menggunakan secret Worker. Username berada di vars. Hash format `310000:<salt hex 16 bytes>:<hash hex 32 bytes>`; `npm run admin:setup` menghasilkan hash lokal. Jangan gunakan secret pengujian untuk production atau menyalin nilai ke log/chat/Git. Jangan memakai password sebagai token webhook.
5. Terapkan migrasi dengan `wrangler d1 migrations apply kizuna-preview --remote` dan `wrangler d1 migrations apply kizuna-production --remote --env production`.
6. `npm run deploy:preview`. Verifikasi login HTTPS, cookie Secure, kontrol, overlay dan adapter konektor di Preview; kemudian `npm run deploy:production` setelah QA operator.

Resource binding environment tidak diwariskan antar-environment; konfigurasi menyebut DO, D1, R2 secara terpisah. Environment name memberi room utama masing-masing identitas. Room sandbox terpisah dan tidak menulis tabel history. Secrets harus berbeda di Preview/Production. Review retensi, pemberitahuan privasi dan lisensi aset sebelum LIVE.

Setelah rotasi password admin, revokasi sesi melalui penghapusan rows `sessions` pada D1 environment yang sesuai; sesi lama tidak otomatis terkait versi password.

## GitHub Actions CI/CD

Workflow **Validate** menjalankan `npm ci`, pemeriksaan format, 39 tes combat/security dan build TypeScript/Vite pada push dan pull request. Workflow yang sama dipanggil oleh **Deploy Cloudflare** sebelum deployment; kegagalan validasi menghentikan deploy. PR tidak mengakses secrets deployment.

1. Di **Settings → Environments**, buat `preview` dan `production`. Untuk production, atur required reviewers jika paket GitHub mendukungnya; workflow tidak membuat aturan approval otomatis. Batasi branch/tag deployment sesuai kebijakan repo. Commit deployment wajib berada dalam history `main`.
2. Pada **masing-masing environment**, tambahkan secrets `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID`. Token perlu akses Worker Scripts, D1 dan R2 pada akun yang sesuai. Gunakan token dengan scope sekecil mungkin dan nilai terpisah bila memungkinkan.
3. Tambahkan environment variable `D1_DATABASE_ID` untuk database lingkungan itu. ID harus UUID sebenarnya. Script menulis `.wrangler-deploy.toml` sementara dan hanya mengganti database lingkungan tujuan; file asal tidak berubah. Jika ID sebenarnya sudah dikomit dalam `wrangler.toml`, variable ini opsional. Placeholder selalu ditolak untuk tujuan deployment.
4. Sediakan bucket/D1 dan secret Worker pada langkah resource di atas. Secrets aplikasi (`ADMIN_PASSWORD_HASH`, `WEBHOOK_SECRET`, `WEBHOOK_SIGNING_SECRET`) tetap di Cloudflare, tidak dibundel oleh GitHub. Workflow tidak membuat resource atau mengatur password aplikasi.
5. Untuk Preview otomatis, tambahkan **repository variable** `ENABLE_PREVIEW_DEPLOY=true` di **Settings → Secrets and variables → Actions → Variables**. Push berikutnya ke `main` menjalankan validasi, migrasi D1 Preview dan deploy Worker Preview. Tanpa variable ini, CD push dilewati dan CI tetap berjalan.
6. Untuk Production, publikasikan GitHub Release stabil dengan tag pada commit yang sudah masuk `main`. Release bertanda prerelease dilewati; gunakan Preview manual untuk pengujian. Alternatif: **Actions → Deploy Cloudflare → Run workflow**, pilih ref `main` atau tag yang sudah masuk `main`, lalu target `preview` / `production`. Approval berlaku jika environment protection sudah dikonfigurasi.

Deployment satu environment diantrikan dan tidak dibatalkan di tengah migrasi. Build selesai sebelum migrasi remote; jika migrasi gagal, Worker tidak dideploy. Jika deploy gagal setelah migrasi berhasil, perubahan schema tetap ada: migrasi harus kompatibel dengan Worker sebelumnya dan tidak ada rollback database otomatis. Ringkasan job mencatat environment dan SHA commit setelah deploy berhasil. Mode manual tidak memerlukan `ENABLE_PREVIEW_DEPLOY`.

Saat konfigurasi baru ini ditambahkan, resource/secrets GitHub dan deployment Cloudflare belum diverifikasi. Pemeriksaan lokal tidak membuktikan eksekusi runner GitHub atau deployment remote.

## Operasi dan pemulihan

State dan seed AI disimpan dalam tabel SQLite Durable Object setelah kontrol dan tiap 60 tick selama combat. Saat instance direkonstruksi, match yang sebelumnya running diubah menjadi paused; operator melanjutkan secara manual. Ini mencegah asumsi waktu offline sebagai simulasi yang valid. Event dedup tersimpan dalam tabel ber-index setelah ingress dan tetap aktif saat reset; membership dan ringkasan contribution ikut snapshot state. Live socket reconnect mengambil state terbaru.

Perubahan konfigurasi fighter tidak memodifikasi snapshot pertandingan aktif. Nonaktifkan fighter menghapusnya dari pemilihan, bukan hasil historis. ID aset R2 unik; versi metadata meningkat. Tidak ada rollback, backup otomatis, replay, atau auto-rematch.

Log in-memory dibatasi 60 entri. Dedup map maksimal 5000 IDs / 60 detik; room ingress maksimal 100 event/detik, anggota maksimal 5000, per-team queue maksimal 100. Batas ini merupakan budget konfigurasi MVP, **bukan** hasil stress test LIVE ribuan penonton. D1 archive terbaru dibatasi 100 match pada layar/export. Retensi D1 berjalan ketika hasil baru diarsipkan; bukan scheduled purge. Tombol Hapus riwayat menghapus history environment, bukan state membership match aktif atau aset R2.

## Peringatan yang perlu diuji pada infrastruktur nyata

DO menggunakan fixed-step interval saat match running (30 tick/s), broadcast 10 Hz. Belum ada kapasitas/latensi production terukur atau scheduler catch-up untuk tick yang tertunda. Setiap room adalah satu sumber kebenaran; visual browser tidak menentukan damage. Visual FPS yang ditampilkan adalah pengukuran browser, bukan jaminan 60 FPS.

Gunakan HTTPS. Cookies sesi HttpOnly/SameSite Strict, Secure pada HTTPS, expiry 24 jam. Login dibatasi 5 percobaan per IP / 15 menit. Mutasi admin memerlukan sesi dan CSRF token; kontrol realtime tetap melalui REST admin. WebSocket publik hanya mengirim state, tanpa menerima kontrol. Webhook internal memakai Bearer token; endpoint native `/api/game/tiktok` memverifikasi HMAC-SHA256 konektor sebelum parsing, dengan freshness 30 detik + dedup/rate caps. Atur `WEBHOOK_SIGNING_SECRET` yang sama pada konektor dan Worker, serta opsional `TIKTOK_ROOM_ID`; lihat [panduan integrasi](TIKTOK.md). Konektor menyediakan event ID stabil pada retry, tetapi hanya username viewer (bukan numeric user ID); batas identitas didokumentasikan. Hadiah streak hanya diterapkan pada event final.

Periksa checklist QA sebelum LIVE; dukungan gamepad, low-latency multiplayer eksternal, penyimpanan ban viewer dan koneksi provider LIVE nyata belum diverifikasi.
