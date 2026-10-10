# QA — 10 Oktober 2026

Validasi ini dilakukan pada environment cloud Linux, Node 24.19, Vite 7.3.7, Wrangler 4.149, Chromium headless yang tersedia di mesin. Pengujian browser otomatis dan inspeksi visual screenshot **tidak menggantikan** sign-off manual operator sebelum production.

## Hasil yang sudah diperiksa

| Pemeriksaan | Hasil | Bukti/metode |
|---|---|---|
| TypeScript client & Worker, Vite production build | Lulus | `npm run build` |
| Combat/security suite | Lulus — 39 tests, 0 skipped | `npm test` |
| Advisori dependensi | 0 known vulnerabilities | `npm audit` setelah upgrade Vite/Wrangler |
| Startup dan migrasi berulang | Lulus | `npm run dev`; D1 melaporkan no migrations pada pengulangan |
| Manual vs manual menghasilkan hit/damage | Lulus | API: 15 langkah Merah, light attack; HP Biru berkurang, HP Merah tetap |
| AI vs AI, pause/resume, reset | Lulus | Browser: HP berubah dari 1000 ke sekitar 800 dalam 5 detik; pause membekukan tick |
| Classic, next round, KO, draw/timeout, elimination | Lulus simulasi | Suite engine; KO dan layar kemenangan juga terlihat pada sandbox browser |
| Login benar/salah, pesan error terlihat | Lulus | Browser; password salah menampilkan error; login benar membuka admin |
| Sesi wajib, spoof header admin, CSRF/origin | Lulus | API unauthenticated/spoof → 401; missing CSRF/wrong origin → 403 |
| Merah/Biru dari satu stream internal | Lulus | Membership terpisah dan event Alice Merah hanya masuk queue Merah |
| Dedup dan reset | Lulus | Event ID sama ditolak; dedup tetap aktif setelah reset dalam window |
| TTL/priority/voting/quota/cap | Lulus simulasi | Suite engine; hanya satu hasil voting, expired queue tidak dieksekusi |
| Reward cap gabungan tim | Lulus simulasi | Budget satu detik untuk energy/heal/shield, terpisah antar tim |
| Sandbox vs riwayat lingkungan utama | Lulus | End sandbox tidak menambah jumlah row matches utama |
| Upload skrip menyamar PNG | Ditolak | API 400; signature/container validation |
| Upload/publish/play spritesheet 9 pose | Lulus | PNG fixture 1152×128 → R2 → D1 → Phaser; terlihat di arena dan memenangkan ronde |
| Fighter snapshot dan Combat Editor | Lulus | Metadata berubah tidak mengubah fighter active; skill/frame/hurtbox/combo tervalidasi |
| Arena Editor dan hazard | Lulus untuk form + simulasi | Form background/hazard tersedia; hazard damage hanya pada non-competitive |
| Overlay portrait/landscape read-only | Lulus browser | State dari WebSocket sama; jumlah kontrol admin di overlay = 0 |
| Mobile 390×844 | Lulus layout | Scroll width tidak melebihi viewport; screenshot diinspeksi |
| Runtime browser | 0 errors pada pemeriksaan akhir | Tidak ada page error/resource failure |

Fixtures bersifat sintetis dan tidak membuktikan TikTok LIVE nyata. Pengujian tidak mengklaim stress capacity, multiplayer online, audio yang didengar manusia, atau deployment Cloudflare.

## Screenshot tampilan

- [Control room](screenshots/control-room.png)
- [Mobile](screenshots/mobile.png)

## Checklist manual operator sebelum LIVE

Catat perangkat, versi browser, environment dan hasil setiap skenario. Jalankan pada Preview, bukan pertandingan production.

- [ ] Mainkan manual vs AI selama beberapa ronde: movement, jump, light/heavy, block, dodge, special dan ultimate.
- [ ] Mainkan manual vs manual; periksa kedua set keyboard dan kontrol sentuh.
- [ ] Start/pause/resume/next/reset/end; pastikan tidak ada auto-rematch.
- [ ] Verifikasi best-of, elimination roster, endless, draw/timeout dan kebijakan End (HP saat ini).
- [ ] SFX dan announcer setelah gesture; volume/mute dan kualitas suara pada perangkat OBS.
- [ ] Upload spritesheet milik sendiri; periksa semua animasi, frame, direction, hitbox/range, draft/publish dan preview.
- [ ] Upload background sendiri; periksa floor Y=420 dan hazard non-competitive.
- [ ] Hubungkan adapter **provider nyata yang sudah diverifikasi**; join Merah/Biru dengan stable ID, comment/like/gift/follow/share sesuai event yang benar-benar tersedia.
- [ ] Gift streak hanya final; duplicate retry, timestamp stale, team lock, queue cap, voting/priority dan spam.
- [ ] Putuskan webhook: webhook-only idle, AI + webhook tetap AI; tidak ada match restart otomatis.
- [ ] Gunakan browser source OBS landscape dan portrait; periksa crop, HUD, performance dan reconnect.
- [ ] Verifikasi secrets terpisah dan tidak ada token/password di HTML, overlay, export publik atau console.
- [ ] Verifikasi resource dan data Preview/Production terisolasi; cocokkan analytics dengan hasil match.
- [ ] Tetapkan lisensi aset, retensi dan pemberitahuan privasi sebelum penonton nyata.

## Batas material

Bundle Phaser dimuat lazy, sekitar 336 KB gzip; Vite masih memberi warning ukuran chunk vendor. FPS aktual ditampilkan di arena, tetapi target 60 FPS belum divalidasi pada perangkat mobile fisik. Simulasi interval fixed-step dan room ingress 100 event/detik belum di-stress-test pada Cloudflare remote. Pemulihan dari snapshot mengubah running menjadi paused dan dapat mengembalikan state ke snapshot terakhir (maksimal sekitar dua detik pada alur normal).

PNG/WebP diperiksa tipe, signature, container, dimensi, byte/pixel budget dan index frame. Full decode dan image rewrite server-side belum diimplementasikan; periksa kompatibilitas aset di sandbox. Fitur lanjutan yang belum selesai terdapat dalam [matriks implementasi](IMPLEMENTATION.md), bukan dinyatakan sudah lulus QA.

## Adapter konektor native

Source konektor commit `c6105889968bd24aa372cace5f6341b5e21ecda0` diverifikasi: 6 fixture melalui fungsi asli `createEvent`, `serializeEvent`, dan `webhookHeaders` berhasil diverifikasi/diadaptasi. Empat tes tambahan mencakup raw-byte HMAC/tamper/freshness, pemetaan gift streak/count, metadata/identity/room validation, dan ingress Worker ke engine dengan damage tepat satu kali saat retry. Panduan lengkap ada di [TIKTOK.md](TIKTOK.md). Koneksi broadcaster LIVE dan deployment remote tetap belum diuji.

## Pembaruan visual karakter

Ukuran template meningkat dari sekitar 165 ke 270 px di koordinat arena; spritesheet custom juga dirender pada tinggi 270 px. Wajah memiliki mata/pupil/highlight, alis, hidung, bibir, shading kulit dan rambut berlapis. Kostum memiliki seam, lapel, armor, gauntlet, sabuk dan boots; limb bersegmen mengikuti pose. Shield dan slash mengikuti tinggi tubuh baru. KO jatuh menuju tengah arena agar wajah tidak keluar di sisi arena.

Pemeriksaan browser dengan state fixture terisolasi: 4 fighter × 11 pose (idle/move/startup/active/recovery/hit/guard/dodge/jump/KO/victory), tanpa mutasi backend dan tanpa page error. Screenshot idle/guard diperiksa secara visual; game/overlay desktop dan mobile 390 px tidak memiliki horizontal overflow. Angka FPS pada screenshot memakai Chromium software rendering dalam cloud, bukan benchmark GPU perangkat pengguna. Lihat [Akari dan Ren](screenshots/characters-akari-ren.png), [Yuki dan Kuro](screenshots/characters-yuki-kuro.png), serta [detail arena](screenshots/characters-detail.png).

## Tambahan 10 aksi dan 10 skill

Katalog menjadi 32 action dan 14 profil serangan. Engine/API menambahkan 20 tes untuk biaya/startup/cooldown/damage sekali, status effects, movement collision, air/ground restrictions, parry/channel/feint/brace, mapping dan profile validation. Total suite terbaru 39 tes lulus. Browser fixture terisolasi memeriksa 20 tombol, Shift/Alt shortcut pada tim terpilih, 10 field skill custom, rendering 20 ability dan viewport 390 px tanpa overflow/page error; tidak memutasi backend. Detail dan screenshot ada di [ABILITIES.md](ABILITIES.md).

## Panduan aset custom

[Custom asset guide](CUSTOM_ASSETS.md) menyertakan 8 PNG contoh/diagram, 2 mapping karakter JSON/CSV, dan 2 preset/atlas arena JSON. Sheet core: 54 frame, 2688 × 2736, 7.354.368 pixel; sheet semua aksi: 58 mapped + 2 empty, 2688 × 3040, 8.171.520 pixel. Kedua sheet memiliki frame 448 × 304, PNG alpha 0–255, batas atas/samping sel bersih, dan mapping yang lulus validator publish. Semua PNG memenuhi signature/container/byte/pixel budget; seluruh tautan lokal dokumen resolve. Exporter berjalan tanpa page error dan tanpa mutasi backend. Angka/grid hanya berada di guide, tidak di file upload. Background 1000 × 420; atlas 512 × 512 untuk referensi artist, bukan fitur tilemap runtime. Pemeriksaan ini memverifikasi file/model, bukan sesi upload admin LIVE nyata.

## GitHub CI/CD

Workflow diperiksa dengan actionlint 1.7.7 dan parser YAML. Script konfigurasi deployment diuji menggunakan credential fixture tanpa koneksi remote: perubahan ID hanya berlaku untuk environment tujuan, file asal tetap sama, credential tidak masuk file hasil, dan secret kosong/ID invalid/placeholder/target unknown ditolak sebelum file dibuat. CI lokal tetap lulus format, 39 tes dan build. Eksekusi GitHub Actions, environment protection serta deployment remote belum diverifikasi; instruksi aktivasi ada di [DEPLOYMENT.md](DEPLOYMENT.md#github-actions-cicd).
