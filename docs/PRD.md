# PRD — Fighting 2D Anime: Manual & TikTok LIVE Webhook

**Versi:** 1.0 (draft keputusan produk)\
**Tanggal:** 10 Oktober 2026\
**Status:** Perencanaan saja — belum coding / belum ada perubahan repository\
**Platform:** Web desktop, mobile, browser source OBS/TikTok LIVE\
**Prinsip:** satu game state pertandingan otoritatif; banyak cara kontrol; konfigurasi melalui admin.

## 1. Ringkasan

Game fighting 2D bergaya anime dengan karakter yang dapat dikendalikan manual, AI lokal, webhook, atau kombinasi. Mode utama untuk TikTok LIVE ialah **Webhook vs Webhook dalam satu siaran**: penonton mendukung Tim Merah atau Tim Biru dengan komentar, gift, like, follow, dan share; event diarahkan ke fighter tim sesuai konfigurasi. Admin memulai, menjeda, melanjutkan, mengganti ronde, dan mengakhiri pertandingan **secara manual**.

Rilis awal menyediakan **4 fighter anime bawaan + 3 arena bawaan**, serta rancangan sistem **penambahan fighter melalui upload aset karakter**. Karena roadmap dipilih bertahap, Fighter Editor/upload penuh boleh hadir pada fase kustomisasi; struktur data dan jalur impor harus disiapkan sejak awal agar tidak perlu migrasi besar.

## 2. Tujuan dan non-tujuan

**Tujuan:**
- Pertarungan 2D terasa responsif dan konsisten (input, hitbox, damage, combo, KO).
- Kontrol per fighter: manual, AI, webhook langsung, AI + webhook, dan webhook penuh.
- Satu TikTok LIVE mengendalikan dua tim/fighter dengan routing event yang aman dan tidak tertukar.
- Admin dapat mengonfigurasi event, fighter, arena, keseimbangan, audio, dan layout tanpa mengubah source code untuk tindakan yang didukung editor.
- Game, Admin, dan Overlay LIVE terpisah tetapi membaca state yang sama.
- Preview dan production terisolasi.

**Non-tujuan yang diputuskan:**
- Tidak ada auto-start/auto-rematch pertandingan: admin mengendalikan siklus pertandingan.
- Tidak mewajibkan Replay Center, perekaman highlight, atau pengambilan klip video; cukup layar kemenangan sederhana.
- Tidak mewajibkan Integration Center lengkap atau replay event; cukup integrasi webhook + Event Tester.
- Tidak mewajibkan automated testing atau stress testing suite khusus dalam scope yang disepakati; pengujian manual tetap wajib.
- Tidak memasukkan backup otomatis dan rollback khusus sebagai persyaratan pilihan deployment B.
- Login admin sederhana satu akun, tanpa Cloudflare Access atau multi-admin/RBAC.

## 3. Rekap keputusan yang telah disetujui

| No. | Area | Keputusan |
|---|---|---|
| 1 | Gaya | Fighting 2D |
| 2 | Pertandingan | 1 vs 1 + mode tim |
| 3 | Kontrol | Semua: manual, AI, langsung webhook, AI + webhook, webhook penuh/hybrid |
| 4 | Karakter | Custom penuh lewat Fighter Editor |
| 5 | Event TikTok | Semua metode + custom event mapping |
| 6 | Ronde | Classic / Team Elimination / Endless, dapat disetel admin |
| 7 | Penonton | Pilih tim / otomatis / kapten + pengaturan admin |
| 8 | Visual | Anime Fighting 2D |
| 9 | Layar | Landscape, portrait, fullscreen + layout custom admin |
| 10 | Audio | SFX, musik, voice fighter, announcer, TTS + pengaturan admin |
| 11 | AI | Sederhana, adaptif, kepribadian + tuning admin |
| 12 | Aset karakter | Bawaan + upload aset + Character Creator + Fighter Editor |
| 13 | Arena | Statis, dinamis, interaktif + Arena Editor |
| 14 | Infrastruktur | Workers + Durable Objects + D1 + R2; KV opsional |
| 15 | Login admin | Satu username/password |
| 16 | Otomasi pertandingan | Manual (admin memegang lifecycle pertandingan) |
| 17 | Statistik | Analytics Center + leaderboard dan riwayat |
| 18 | Reward | Visual, gameplay, achievement + Reward Editor |
| 19 | Multiplayer | **Belum diputuskan**: opsi pernah diajukan, belum dipilih |
| 20 | Sumber Webhook vs Webhook | **Satu TikTok LIVE, dua tim** |
| 21 | Pemilihan tim | Semua metode + aturan admin |
| 22 | Webhook ramai | FIFO, voting, prioritas + Smart Command Engine |
| 23 | Balance | Kompetitif/dukungan/dinamis + Balance Editor |
| 24 | Integrasi | Webhook langsung + Event Tester (opsi B) |
| 25 | Akhir pertandingan | Layar kemenangan sederhana (opsi A) |
| 26 | Game engine | Phaser + Performance Center, target 60 FPS |
| 27 | Halaman | Game + Admin + Overlay LIVE terpisah (opsi C) |
| 28 | Deployment | Production + Preview (opsi B) |
| 29 | QA | Pengujian manual (opsi A) |
| 30 | Roadmap | MVP bertahap (opsi B) |
| 31 | Konten bawaan | **4 fighter + 3 arena; dukung tambah fighter melalui upload aset karakter** |

## 4. Peran dan antarmuka

### 4.1 Pengguna
- **Admin tunggal:** login, membuat/menyetel fighter, arena, mode pertandingan, mapping event, kontrol pertandingan, tes webhook, leaderboard.
- **Pemain manual:** memainkan fighter lewat keyboard, kontrol sentuh, atau gamepad bila diaktifkan.
- **Penonton TikTok LIVE:** bergabung ke tim, memicu aksi atau energi melalui event yang diizinkan.
- **Spectator overlay:** hanya melihat pertandingan; tidak mendapat kredensial admin atau token webhook.

### 4.2 Halaman
- `/` atau `/game`: game/arena fullscreen dengan HUD, pilihan mode (akses kontrol disesuaikan dengan status pertandingan).
- `/admin`: dashboard single-admin, status game dan pengaturan pertandingan.
- `/admin/fighters`: pengelolaan roster, upload aset, editor fighter/skill.
- `/admin/arenas`: pengelolaan arena, background, hazard dan preview.
- `/admin/webhooks`: endpoint yang dapat disalin, secret, mapping, event tester.
- `/admin/matches`: kontrol mulai/pause/resume/next round/reset/end dan mode kontrol tiap fighter.
- `/admin/settings`: balance, audio/TTS, performa, layout.
- `/admin/analytics`: statistik/leaderboard/riwayat.
- `/live` (atau `/overlay`): read-only browser source; opsi portrait 9:16 dan landscape 16:9; tidak menampilkan admin.

Nama route di atas usulan teknis, dapat disesuaikan saat desain UI.

## 5. Roster awal dan sistem upload fighter

### 5.1 Konten default
- **4 fighter bawaan**, masing-masing mempunyai identitas visual anime, statistik terukur, minimal satu gaya bertarung dan skill/ultimate khusus. Nama dan elemen skill **belum diputuskan**.
- **3 arena bawaan**, mendukung mode low/medium/high; tema dan nama arena **belum diputuskan**.
- Pemilihan fighter manual oleh admin sebelum pertandingan; mode tim dapat memiliki roster lebih dari satu fighter.

### 5.2 Tambah fighter melalui upload aset (persyaratan eksplisit)
Admin dapat membuat fighter baru dari aset yang diunggah, bukan terbatas empat karakter default.

**Masukan awal yang direncanakan:**
- Gambar/spritesheet **PNG atau WebP**; transparansi bila diperlukan; batas ukuran dan dimensi ditentukan saat rancangan teknis.
- Metadata sprite: ukuran frame, jumlah frame, fps animasi, pivot/origin, arah hadap, skala, offset per animasi.
- Klip/animasi dasar: `idle`, `walk`, `jump`, `light_attack`, `heavy_attack`, `block`, `hit`, `ko`, `victory`; `special`/`ultimate` jika tersedia.
- Audio opsional: voice fighter dan SFX terkait jurus.
- Data combat: HP, stamina, speed, attack, defense, cooldown, combo, frame data dan hurtbox/hitbox.

**Alur admin:** Upload → validasi tipe/ukuran/dimensi → mapping sprite/frame → set animasi & hitbox → set statistik/skill → preview sandbox → simpan sebagai draft → publish ke roster. Admin dapat duplikasi, nonaktifkan, ubah, dan hapus secara aman (referensi pertandingan historis tetap konsisten).

**Batasan penting:** Upload satu gambar statis **tidak otomatis** menghasilkan seluruh pose/animasi. Untuk dipakai bertarung, admin harus menyediakan frame kompatibel atau memakai rig/template Character Creator yang disediakan. Format aset alternatif di luar PNG/WebP hanya jika diputuskan kemudian. Aset publik perlu lisensi/hak penggunaan; upload dibatasi dan disanitasi.

**Penyimpanan:** File aset R2; metadata dan versi fighter D1. Perubahan fighter versi baru tidak boleh mengubah hasil pertandingan historis. Aset memiliki ID tetap dan versi.

### 5.3 Character Creator/Fighter Editor
- Preset karakter bawaan; komposisi bagian karakter kompatibel untuk rambut/wajah/kostum/warna dan aksesori sesuai template.
- Editor animasi, hitbox/hurtbox, skill/ultimate, combo dan cooldown; semua tindakan yang mampu divalidasi sebelum publish.
- Preview arena pada fighter tanpa mengubah pertandingan production yang sedang berlangsung.
- Validasi untuk mencegah frame kosong, hitbox tidak masuk akal, animation key hilang, atau damage melebihi batas mode.

## 6. Combat engine

- Pertarungan side-view 2D Phaser, visual anime.
- Aksi: berjalan kiri/kanan, melompat, pukulan ringan/berat, block, dodge, special, ultimate; combo dan cooldown.
- State: idle, move, startup attack, active frames, recovery, guard, hitstun, knockdown, KO, victory.
- Hitbox, hurtbox, collision, invulnerability/cooldown, damage, stamina dan timer diputuskan pada **simulasi otoritatif**; visual lokal tidak boleh mengubah hasil pertandingan.
- Mode: Classic best-of-N, Team Elimination dengan pergantian setelah KO, Endless dengan administrasi manual.
- Jika waktu habis, pemenang ditentukan oleh kebijakan admin yang terdokumentasi (misalnya HP tersisa); aturan tie belum ditetapkan.
- Perintah tak valid/kedaluwarsa, saat KO, atau melanggar cooldown ditolak.

## 7. Kontrol fighter

| Mode | Perilaku |
|---|---|
| Manual | Input manusia dengan keyboard/touch; gamepad opsional |
| AI | Engine perilaku internal mengontrol fighter |
| Direct webhook | Setiap perintah valid dapat memicu aksi |
| AI + webhook | AI beraksi mandiri, webhook memodifikasi atau menginstruksikan aksi khusus |
| Webhook penuh | Fighter hanya beraksi berdasarkan webhook, idle bila tidak ada perintah |
| Hybrid | Pengaturan prioritas konflik input sesuai fighter, tidak boleh menghasilkan dua aksi tak sah dalam satu tick |
| Webhook vs Webhook | Dua fighter dikontrol event dari satu LIVE, dipilah menurut identitas/keanggotaan tim |

Pilihan **multiplayer online/perangkat berbeda belum final**; tidak dimasukkan sebagai kewajiban MVP sampai diputuskan.

## 8. Integrasi satu TikTok LIVE untuk Merah vs Biru

### 8.1 Sumber
- `tiktok-live-konektor` bertindak sebagai sumber event; kontrak payload aktual harus diverifikasi saat implementasi, **jangan mengasumsikan nama field/ketersediaan event**.
- Satu aliran event memiliki metadata event ID, user ID stabil bila tersedia, jenis event, detail gift/jumlah, timestamp, dan sumber.
- Endpoint penerima usulan: `POST /api/game/webhook`; nama endpoint final mengikuti routing backend.

### 8.2 Penentuan tim
- Komentar `!merah`/`!biru`; gift mapping ke tim; auto assignment; kapten tim bila diaktifkan.
- Admin memilih prioritas aturan dan mengunci/perbolehkan pindah tim.
- Event user tanpa tim memakai kebijakan admin: abaikan, auto-assign, atau tangani menurut gift mapping.
- Identitas user didasarkan pada ID sumber yang stabil jika tersedia, bukan display name saja.
- Perubahan tim tidak boleh merutekan ulang event yang sudah dieksekusi.

### 8.3 Custom mapping
- Aksi: `move_left`, `move_right`, `jump`, `light_attack`, `heavy_attack`, `block`, `dodge`, `special_attack`, `ultimate`; juga add energy/buff/heal/shield yang dibatasi balance.
- Mapping dapat memakai tipe event, jenis gift, ambang like, command komentar, team, cooldown, kondisi energi, dan priority.
- Tidak semua event yang mungkin disebutkan dijamin tersedia dari provider; menu admin harus menampilkan event yang benar-benar didukung konektor.

### 8.4 Smart Command Engine
- Strategi per pertandingan: FIFO, voting jendela waktu, prioritas event, atau gabungan yang deterministik.
- Antrean terpisah Tim Merah/Tim Biru; kuota per pengguna/window, batas queue, TTL perintah, penggabungan like, deduplikasi `event_id`, penanganan gift streak.
- Event simultan dipetakan ke game tick; admin dapat melihat alasan perintah diterima/ditolak dalam Event Tester/log terbatas.
- Fairness tidak bergantung pada urutan jaringan semata. Priority dan tie-break harus ditetapkan eksplisit.
- Graceful degradation: bila webhook terputus, fighter webhook penuh idle, sedangkan mode AI + webhook tetap menggunakan AI; **lifecycle pertandingan tetap manual**.

### 8.5 Keamanan dan contoh payload konseptual
```json
{
  "event_id": "evt_001",
  "source": "tiktok-live-konektor",
  "user_id": "viewer_stable_id",
  "event_type": "comment",
  "text": "!attack",
  "occurred_at": "2026-10-10T07:00:00Z"
}
```
Contoh di atas **kontrak internal konseptual**, bukan klaim format payload nyata konektor. Secret webhook harus terpisah dari password admin, disimpan sebagai secret, ditransmisikan melalui HTTPS, diverifikasi dengan token/signature yang didukung, plus anti-replay/rate-limit.

### 8.6 Event Tester yang dipilih
- Admin dapat memilih tim/user simulasi dan mengirim event Like, Gift, Follow, Share, komentar.
- Panel tester menampilkan routing, aksi yang terbentuk, status antrean dan keputusan validasi.
- Mode sandbox/Preview tidak mencemari skor/leaderboard production.
- Tidak mewajibkan Event Replay atau Integration Center penuh.

## 9. AI fighter

- AI non-generatif in-game (FSM / behavior tree / utility AI), tanpa kebutuhan LLM per langkah.
- Parameter per fighter: aggressiveness, defense likelihood, reaction time, spacing, combo preference, stamina discipline, karakter agresif/defensif/counter/balanced.
- Difficulty Easy/Normal/Hard mengubah pola dan kecepatan reaksi dalam batas fair play.
- Webhook memiliki prioritas sesuai rule mode, bukan menggandakan aksi tidak valid.

## 10. Balance dan reward

- Balance Editor dengan preset **kompetitif (default)**, berbasis dukungan, dan dynamic balance.
- HP, damage, block, energy, cooldown, heal, shield, buff, caps per event/team, serta anti-spam.
- Reward Editor: cosmetic badges, MVP, achievements, supporter levels, energy/buffs jika diperbolehkan mode; reward dibedakan dari currency nyata.
- Gameplay reward tidak boleh melewati batas fairness yang ditentukan mode. Aturan gift mapping bersifat configurable, tidak menjanjikan hasil kemenangan.

## 11. Arena Editor

- Arena statis, parallax/dinamis, dan interaktif.
- Konfigurasi background berlapis, bounds, spawn, floor, hazard, destructible objects, efek cuaca, animasi serta pergantian arena manual/trigger yang diizinkan.
- Hazard dan elemen damage diproses otoritatif, dapat dimatikan pada mode kompetitif.
- 3 arena bawaan; tambahan arena pada tahap kustomisasi. Render kualitas rendah tidak mengubah gameplay.

## 12. Audio dan overlay

- BGM arena, SFX hit/block/special, voice per fighter, announcer round/KO/winner, TTS nama/event penonton.
- Volume terpisah dan toggle masing-masing kategori; TTS queue, spam suppression, panjang teks dan sanitasi input; mute TTS/streamer-safe mode.
- Overlay 16:9 / 9:16 / fullscreen dengan HP bar, fighter name, score, round, timer, peristiwa LIVE, ranking terbatas; editor posisi HUD dan safe area TikTok.
- Overlay **read-only**, status realtime, tidak membawa token atau tombol admin.
- Hasil selesai sederhana: KO, pemenang, skor, tombol admin untuk memulai match berikutnya. Tidak perlu replay/capture.

## 13. Statistik / Analytics Center

- Per fighter: win/loss, KO, total damage, combo, win rate; per tim: kemenangan & kontribusi.
- Per penonton: kontribusi valid (like/gift/comment/aksi), badge dan ranking; gunakan ID stabil dari provider bila ada.
- Riwayat pertandingan: match ID, waktu, mode, roster/version, hasil dan ringkasan event.
- Webhook analytics: diterima/deduplikasi/ditolak/diaplikasikan, antrean, penyebab penolakan.
- Export JSON/CSV; retensi data dan kebijakan privasi harus ditetapkan sebelum production.

## 14. Sistem admin dan keamanan

- **Satu akun username/password**; password dengan algoritma hash kuat ber-salt, proteksi brute force, cookie sesi HttpOnly/Secure/SameSite, CSRF defense dan sesi kadaluwarsa.
- Token/signature webhook terpisah, dapat diputar/dicabut; tidak menyimpan plaintext token pada log.
- API admin memerlukan autentikasi server-side; overlay publik tidak memiliki secret.
- Upload aset menggunakan allowlist format, pembatas ukuran, validasi content dan path, serta izin upload hanya admin; aset yang dieksekusi sebagai script ditolak.
- Kontrol start/pause/reset/end dibatasi admin; aksi penonton hanya dalam mapping yang diizinkan.

## 15. Arsitektur usulan

- **Frontend game:** Phaser; rendering dan input browser; kualitas Low/Medium/High dan adaptive resolution.
- **Workers:** API/admin dan penerima webhook.
- **Durable Objects:** actor/state otoritatif per room, WebSocket realtime, tick/sinkronisasi dan command queue; perlu menguji kapasitas dan latensi sebelum final desain.
- **D1:** fighter metadata, arena/config, mapping, members/contributions, score/leaderboard, match history.
- **R2:** sprite/spritesheets, background/arena, audio, metadata paket aset.
- **KV opsional:** cache non-otoritatif; jangan dijadikan sumber kebenaran state match.
- **GitHub:** source code + deployment workflows.
- **Production & Preview:** project/environment dan secrets/storage yang terisolasi; Preview tidak dapat mengganggu LIVE production.

## 16. Performa

- Target visual **60 FPS desktop** dan **30–60 FPS mobile** sesuai perangkat (target, bukan jaminan).
- Pengaturan manual Low/Medium/High: resolusi internal, partikel, parallax, motion effects; game physics & combat deterministik dan tidak bergantung FPS render.
- Asset preloading, sprite atlases, memori terukur, lazy-load aset tidak aktif, cache browser, responsive touch controls.
- Portrait mempertahankan rasio/logika arena, dapat menyesuaikan framing kamera dan tata letak HUD tanpa mengubah hitbox.

## 17. Lifecycle pertandingan (manual admin)

1. Admin memilih arena, fighter/roster, mode tim, kontrol, balance dan mapping event.
2. Admin memulai pertandingan (countdown opsional yang dipicu admin).
3. Engine memproses input manual/AI/webhook sesuai aturan dan menerima event bersamaan secara aman.
4. KO/time-out mengubah state round ke selesai; admin menentukan langkah selanjutnya sesuai rule mode (termasuk next round/match).
5. Hasil dan statistik tercatat, layar pemenang ditampilkan.
6. Admin dapat pause/resume/reset/end kapan pun sesuai role tunggal.

## 18. Tahapan MVP bertahap

| Fase | Lingkup | Exit criteria |
|---|---|---|
| 1 — Core Fighting | Phaser, 4 fighter bawaan, 3 arena, 1vs1, kontrol manual, AI sederhana, HP/hitbox/combo/KO, HUD | Pertarungan manual stabil; aset default termuat |
| 2 — Webhook First | Webhook penerima, satu LIVE dua tim, membership rules, mapping, Smart Command Engine, Webhook vs Webhook, Event Tester | Kedua tim dapat dikontrol event berbeda dari satu LIVE; deduplikasi/cooldown benar |
| 3 — Customization | Upload fighter, Fighter Editor, Character Creator berbasis template, Arena Editor, AI/balance/reward editor | Fighter unggahan tervalidasi dapat dimainkan; publish tidak merusak match aktif |
| 4 — LIVE & Analytics | Overlay portrait/landscape, layout editor, audio/TTS, ranking, kontribusi, history | Status overlay sinkron; statistik valid; TTS terkendali |
| 5 — Production | Manual QA di Preview, perbaikan aksesibilitas/performa, deploy production | Uji skenario kritis lulus dan operator bisa mengendalikan LIVE |

Catatan: fase merupakan urutan prioritas, **bukan estimasi durasi**. Modul edit lanjutan dapat mulai disiapkan secara data schema pada fase awal.

## 19. Acceptance criteria minimum

- [ ] Empat fighter dan tiga arena default tersedia, dapat dipilih.
- [ ] Manual vs manual/AI dan mode kontrol yang diaktifkan bekerja tanpa aksi ganda.
- [ ] Admin bisa mulai, jeda, lanjut, reset, next round dan end; tidak ada auto-start tanpa izin.
- [ ] Satu konektor TikTok LIVE mengendalikan Merah/Biru melalui pemilihan tim.
- [ ] Perintah `!attack` penonton Merah tidak pernah diarahkan ke fighter Biru.
- [ ] Event dengan ID sama tidak dieksekusi dua kali.
- [ ] Burst event diproses sesuai FIFO/voting/priority yang ditetapkan tanpa menggandakan damage.
- [ ] Event Tester dapat menghasilkan event sintetis terisolasi dari produksi.
- [ ] Fighter baru dapat di-upload melalui aset sprite kompatibel, diuji dan dipublikasikan pada fase Fighter Editor.
- [ ] Input gambar tunggal tidak secara keliru dinyatakan memiliki seluruh animasi.
- [ ] Overlay 9:16 dan 16:9 menyajikan match state yang konsisten.
- [ ] Login admin dan webhook secret tidak terekspos ke pengguna/overlay publik.
- [ ] Data Preview dan Production tidak tercampur.
- [ ] Semua skenario kritis diuji **manual** melalui checklist dan dicatat lulus/gagal sebelum rilis.

## 20. Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Ribuan event LIVE/spam | Deduplikasi, cap, voting window, TTL, queue per tim |
| Koneksi TikTok tidak tersedia | Indikator status; manual/AI tetap dapat dimainkan; tidak klaim LIVE tanpa data |
| Asimetri tim/gift | Default competitive balance, caps buff/damage |
| Upload karakter tak lengkap | Schema animasi wajib, validator, preview draft |
| Roster/perubahan aset di tengah pertandingan | Snapshot fighter/version per match |
| Browser mobile lemah | Low preset, pembatas efek, asset budget |
| Terputusnya tab/overlay | Reconnect dan state resync dari backend |
| Penyalahgunaan admin/API | Password hash, sesi aman, webhook auth, rate-limit |
| Ketidaksamaan event konektor dengan rancangan | Verifikasi kontrak API saat tahap integrasi |
| Tidak ada automated/stress test wajib | Checklist manual yang jelas; review kegagalan penting sebelum production |

## 21. Hal yang masih perlu diputuskan

1. Nama final game dan domain/subdomain production serta preview.
2. Nama/desain, skill, statistik dan elemen empat fighter bawaan.
3. Tema dan nama tiga arena bawaan.
4. Spesifikasi teknis format sprite, jumlah animasi minimal, maksimum ukuran file dan batas aset.
5. Mode multiplayer lokal/online (pertanyaan terdahulu **belum dijawab**); jangan dianggap disetujui.
6. Detail input keyboard/touch/gamepad dan konflik control manual/webhook.
7. Default window voting, cooldown, TTL queue, caps reward dan urutan prioritas event.
8. Kebijakan skor tie, timeout, pergantian fighter, dan Endless yang tetap dikendalikan admin.
9. Retensi leaderboard, data penonton, penghapusan riwayat dan data privacy.
10. Kontrak event aktual dari tiktok-live-konektor, termasuk metadata gift streak dan ID user.

---

**Status dokumen:** seluruh pilihan eksplisit pengguna sampai pertanyaan 31 dicatat; bagian yang belum diputuskan diberi tanda dan tidak diasumsikan. **Belum ada implementasi atau perubahan GitHub/Cloudflare.**
