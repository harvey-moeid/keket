# Integrasi tiktok-live-konektor

Adapter diverifikasi terhadap source [harvey-moeid/tiktok-live-konektor](https://github.com/harvey-moeid/tiktok-live-konektor/tree/c6105889968bd24aa372cace5f6341b5e21ecda0), commit `c6105889968bd24aa372cace5f6341b5e21ecda0`. Kontrak berasal dari `server/events.js`, `server/webhooks.js`, `server/tiktok.js`, `server/managed-live.js`, `server/gifts.js`, dan `python_fallback/events.py`. Tidak mengubah repositori konektor.

## Menghubungkan

1. Provision/deploy Worker game menggunakan [panduan deployment](DEPLOYMENT.md). D1 ID bawaan masih placeholder; belum ada deployment remote dalam workspace ini.
2. Buat secret acak minimal 32 karakter melalui password manager. Simpan **nilai yang sama** sebagai `WEBHOOK_SIGNING_SECRET` pada environment konektor dan Worker game. Gunakan input interaktif `npx wrangler secret put WEBHOOK_SIGNING_SECRET` untuk Worker Production yang dikonfigurasi saat ini (tanpa `--env production`). Jangan menaruh secret pada frontend, URL, source, atau chat. Untuk pengembangan lokal, simpan di `.dev.vars` yang diabaikan Git lalu restart Worker.
3. Opsional namun disarankan: tambahkan `TIKTOK_ROOM_ID` sebagai var Worker untuk mengikat satu room aktif. Nilai harus sama persis dengan string `roomId` pada envelope. Perbarui saat room LIVE berubah; ketidakcocokan ditolak, bukan dipindahkan otomatis.
4. Pada dashboard **konektor → Integrasi Webhook**, tambahkan `https://<domain-game>/api/game/tiktok`, aktifkan, pilih `chat,like,gift,follow,share`, lalu simpan. Konektor tidak mengirim Bearer token untuk endpoint ini. URL tujuan harus HTTPS publik; localhost/private tunnel endpoint tidak diterima oleh validasi konektor.
5. Start LIVE secara manual di konektor ketika broadcaster aktif. Di game, pilih kontrol webhook atau AI + webhook dan **Mulai pertandingan** secara manual. Penonton memilih `!merah` atau `!biru`, lalu memberi perintah sesuai mapping. Event yang datang saat idle tidak memulai game.
6. Periksa penerimaan event dan queue keputusan di control room. Label koneksi overlay menunjukkan WebSocket **game**, bukan bukti TikTok LIVE aktif; penerimaan webhook terakhir menunjukkan aktivitas event saja. Uji kedua tim, gift streak, retry/duplikat dan putus koneksi sebelum produksi.

Secret HMAC ini terpisah dari `WEBHOOK_SECRET` untuk endpoint kontrak internal, password admin, dan API key konektor. Konfigurasi saat ini memiliki satu Worker Production; pengembangan lokal harus memakai secret/konektor tujuan terpisah. Secret signature konektor berlaku bagi semua tujuan webhook layanan itu; jangan berbagi dengan tujuan yang tidak dipercaya. Rotasi pada kedua layanan.

## Pemetaan

| Konektor | Game |
|---|---|
| `id` | `event_id`, tetap sama pada retry |
| `timestamp` | `occurred_at` |
| `chat`, `data.message` | `comment`, `text` |
| `like`, `data.likeCount` | `like`, `count` (bukan totalLikeCount kumulatif) |
| `gift`, `data.giftName`, `data.repeatCount` | `gift`, `gift`, `count` |
| streakable gift + repeatEnd false | Pending; tidak memberi reward |
| streakable gift + repeatEnd true | Satu final reward berdasarkan repeatCount |
| non-streakable gift | Langsung selesai, meskipun repeatEnd false |
| `follow`, `share` | Event dengan nama sama |
| viewer/member/status/jenis lain | HTTP 200 ignored; tidak membuat aksi game |

Nama gift harus sama dengan mapping game. Nama fallback konektor `Gift #5953` dapat dipakai sebagai command mapping ketika nama asli tidak tersedia; belum ada kolom ID gift terpisah di editor game. Jumlah event dibatasi 1000 sebelum masuk engine; engine membatasi multiplier jumlah ke 100 dan menerapkan cap reward/queue/quota. Tidak membagi satu event menjadi beberapa reward.

**Batas identitas:** konektor saat ini membuang numeric user ID dan menyediakan `data.username`, yang dapat berasal dari fallback nickname upstream. Adapter memakai `tlk:<username lowercase>` untuk membership/contribution. Nilai dengan spasi dan placeholder `unknown`/`Penonton TikTok` ditolak; nickname yang tampak seperti username tidak bisa dibedakan dari username asli. Username bukan ID TikTok yang immutable: perubahan username dapat memutus membership, dan fallback bisa berkolisi. Diperlukan perubahan kontrak upstream untuk jaminan numeric user ID lintas engine. Jangan memakai data ini untuk pembayaran atau hadiah bernilai uang.

## Verifikasi dan replay

Signature menggunakan Web Crypto HMAC-SHA256 atas **timestamp + titik + raw body bytes**, sesuai `sha256=<hex>` dalam `x-tlk-signature`. Body dibaca maksimal 64 KiB sebelum parsing. Signature salah/hilang atau delivery timestamp lebih dari ±30 detik ditolak 401; secret belum dipasang menghasilkan 503. Envelope version 1, header ID/version, timestamp envelope ±30 detik, identitas dan metadata gift divalidasi; salah menghasilkan 400. Payload truncated konektor ditolak. Header admin internal dari pengirim tidak diteruskan.

Window 30 detik sengaja lebih ketat daripada contoh dokumentasi konektor 300 detik agar selaras dengan freshness game dan dedup 60 detik yang persisten di Durable Object. Signature timestamp dibuat ulang setiap retry, tetapi timestamp envelope dan ID tetap; delivery yang tertunda >30 detik ditolak meskipun signature baru. Retry valid tidak menggandakan aksi. Reset pertandingan tidak menghapus dedup. Ini delivery best-effort: konektor punya retry terbatas dan antrean dapat drop; game tidak melakukan backfill event lama dari REST history.

Endpoint internal `/api/game/webhook` tetap hanya menerima kontrak internal dengan Bearer `WEBHOOK_SECRET`. Jangan gunakan URL itu sebagai webhook native konektor.

## Pengujian

`npm test` mencakup signature raw bytes/tamper/secret/freshness, envelope, identitas, room binding, pemetaan tipe/count, streak final, dan jalur Worker → engine: join → attack → damage tepat satu kali pada retry, header admin palsu dibuang, serta lifecycle tetap manual. Uji source kontrak provider juga dilakukan dengan `createEvent`, `serializeEvent`, dan `webhookHeaders` dari commit di atas. Tidak diperlukan koneksi akun TikTok untuk fixture ini.

**Belum diuji:** broadcaster LIVE nyata, secret/cloud deployment, latensi dan burst produksi, serta ketersediaan signer/managed/Python konektor. Adapter siap dikonfigurasi; ini bukan klaim koneksi TikTok produksi sedang berjalan.
