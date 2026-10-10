# KIZUNA · LIVE Fighting Arena

Game fighting 2D anime dan control room untuk satu TikTok LIVE, dua tim. Dibangun berdasarkan [PRD](docs/PRD.md), dengan rilis bertahap dan status implementasi yang eksplisit di [matriks fitur](docs/IMPLEMENTATION.md).

**Stack:** TypeScript, Phaser 3, Vite, Cloudflare Workers, Durable Objects, D1, R2. Empat fighter dan tiga arena orisinal procedural; font dan aset UI disajikan lokal.

## Menjalankan lokal

Node.js 22.12+ (divalidasi dengan Node 24). Dari root repositori:

```sh
npm ci
npm run admin:setup
npm run dev
```

`admin:setup` meminta username dan password dengan input password tersembunyi. Password harus minimal 12 karakter; hanya PBKDF2 salted hash disimpan. `.dev.vars` diabaikan Git dan tidak boleh dikomit. Secret webhook lokal dibuat bila belum ada, tanpa dicetak. Jalankan ulang perintah ini untuk mengganti password pengembangan dan restart Worker.

`dev` menyiapkan build awal bila belum ada, menjalankan migrasi D1 lokal secara idempoten, lalu menjalankan Vite port 5173 dan Worker port 8787. Untuk dua terminal terpisah: `npm run db:local`, `npm run build`, `npm run dev:api`, dan `npm run dev:ui`. Database/aset lokal berada di `.wrangler/state` dan tidak dicampur dengan resource remote.

## Alur operator

1. Masuk melalui tombol akun atau menu Control room.
2. Saat match idle, pilih fighter, arena, kontrol dan mode; klik **Terapkan**.
3. Klik **Mulai pertandingan**. Tidak ada auto-start atau auto-rematch.
4. Gunakan Jeda/Lanjutkan; setelah KO/timeout klik Ronde berikutnya. Reset menyiapkan match baru dan mengosongkan membership/kontribusi, tetapi jendela dedup tetap aktif; End merekam hasil.
5. Event Tester memakai room sandbox yang berbeda. Mulai sandbox sebelum mengirim event. Tim dipilih melalui `!merah` / `!biru` dengan stable user ID.
6. `/live` adalah overlay read-only; `/live?layout=portrait` mempertahankan simulasi yang sama dalam tata letak portrait. Tidak membawa secret atau kontrol admin.

Keyboard Merah: A/D/W, J light, K heavy, L block, I special, U ultimate, O dodge. Biru: panah kiri/kanan/atas, 1–6. Pilih mode Manual/Hybrid untuk memakai keyboard atau tombol sentuh. Admin session diperlukan untuk input manual pada versi ini; multiplayer terpisah belum diputuskan dalam PRD.

## Combat dan import fighter

Simulasi server 30 tick/s; rendering Phaser menargetkan 60 FPS. Light/heavy memakai stamina. Special memerlukan 25 energi dan ultimate 100 pada preset default. Startup, active, recovery, range/hitbox, cooldown, hurtbox, combo window/multiplier, serta statistik dapat diedit dalam batas validasi. Fighter/version disnapshot saat konfigurasi match sehingga edit tidak mengubah pertandingan aktif.

Panduan gambar, spritesheet siap upload, mapping frame, dan contoh background/atlas arena tersedia di [CUSTOM_ASSETS.md](docs/CUSTOM_ASSETS.md).

Upload PNG/WebP maksimal 8 MiB dan dimensi 8–8192 px, maksimal 8.388.608 pixel. Tentukan ukuran frame dan index animasi `idle`, `walk`, `jump`, `light_attack`, `heavy_attack`, `block`, `hit`, `ko`, `victory`. Sprite dianggap menghadap kanan dan dirender setinggi 270 px pada arena 1000 × 500; karakter bawaan memakai ukuran visual yang sama. Index mulai 0, baris-kolom dari kiri atas. Pose idle, walk, light attack harus berbeda. Simpan draft yang belum lengkap; publish/preview mensyaratkan seluruh mapping valid dan index berada dalam spritesheet. Preview memakai sandbox. Gambar tunggal tidak menghasilkan pose secara otomatis. Aset contoh QA bukan konten roster production.

## Webhook

Integrasi native repositori [tiktok-live-konektor](https://github.com/harvey-moeid/tiktok-live-konektor) kini tersedia melalui **`POST /api/game/tiktok`**, dengan verifikasi HMAC dan adapter payload provider. Ikuti [panduan koneksi LIVE](docs/TIKTOK.md).

`POST /api/game/webhook` memerlukan `Authorization: Bearer <WEBHOOK_SECRET>`. Ini **kontrak internal** untuk adapter lain; webhook native konektor memakai endpoint HMAC di atas.

```json
{
  "event_id": "unique-provider-event-id",
  "source": "tiktok-live-konektor",
  "user_id": "stable-provider-user-id",
  "event_type": "comment",
  "text": "!merah",
  "occurred_at": "ISO-8601 current timestamp"
}
```

Tipe internal: comment, gift, like, follow, share. Gift memakai `gift`, `count`, dan opsional `streak_finished` (false menunggu final streak). `event_id` harus stabil untuk pengulangan pengiriman; dedup dijaga 60 detik, timestamp ±30 detik. Keanggotaan menentukan rute, bukan display name. Prioritas pemilihan saat ini: join eksplisit → membership tersimpan → kebijakan unknown/auto assignment. Auto assignment bergantian; `team` hanya dipakai untuk assignment pertama. Kapten dan gift-to-team belum tersedia.

Queue terpisah per tim, kuota user/window, TTL, cap, like-energy merge, FIFO/priority/voting tersedia. Tie-break priority: priority desc → timestamp asc → ID lexical. Voting: jumlah desc → urutan aksi tetap; satu aksi mewakili satu window. Cooldown dan state combat tetap diperiksa ketika perintah dieksekusi. Hadiah energy/heal/shield memakai cap gabungan per tim per detik simulasi; competitive menolak heal. TikTok connector tidak termasuk repositori ini.

## Aksi dan skill

Tersedia **32 action**, termasuk tambahan 10 aksi taktis dan 10 skill serangan. Combat Editor menyediakan 14 profil serangan. Buka panel aksi/skill di Game arena; daftar biaya, efek, shortcut dan komentar LIVE ada di [ABILITIES.md](docs/ABILITIES.md). Untuk mapping yang pernah disimpan, klik **LIVE & webhook → Import 20 ability**.

## Pemeriksaan

```sh
npm test
npm run build
```

Lihat [hasil QA dan checklist operator](docs/QA.md), [deployment](docs/DEPLOYMENT.md), serta [batas implementasi](docs/IMPLEMENTATION.md). Deployment LIVE belum dijalankan. Database ID dalam `wrangler.toml` adalah placeholder untuk resource remote; dev lokal tetap berfungsi.
