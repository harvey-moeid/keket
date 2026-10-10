# Aksi dan skill tambahan

Ada **32 action IDs**: 12 sebelumnya + 10 aksi taktis + 10 skill baru. Di antara action tersebut, 14 merupakan serangan yang memiliki profil Combat Editor (light/heavy/special/ultimate + 10 skill tambahan). Semua fighter dapat memakai skill baru; profil damage/range/frame/cost/energy bisa diubah per fighter. Nama dan efek mekanik skill tambahan saat ini tetap berdasarkan katalog, bukan script skill custom.

Simulasi 30 tick/s. Cooldown dihitung sejak aksi dimulai; durasi startup/active/recovery mengunci input combat, lalu cooldown masing-masing skill tetap berlaku. Damage di tabel adalah nilai dasar, sebelum statistik attack/defense, damageScale, combo, block, brace dan shield. Setiap serangan termasuk Whirlwind mengenai lawan maksimal satu kali per penggunaan; tidak ada multi-hit/DoT implisit. Efek wave/lance visual tidak memakai simulasi projectile travel terpisah.

## 10 aksi taktis

| Aksi | Komentar LIVE | Stamina | Cooldown (tick) | Mekanik |
|---|---|---:|---:|---|
| Dash maju | `!dashforward` | 14 | 20 | Maju cepat 85 unit tanpa menembus lawan di tanah. |
| Dash mundur | `!dashback` | 14 | 20 | Mundur cepat 85 unit. |
| Merunduk | `!crouch` | 3 | 20 | Hurtbox lebih rendah; menghindari Crescent Wave saat merunduk. |
| Lompat tinggi | `!highjump` | 18 | 35 | Lompatan lebih tinggi; memerlukan posisi di tanah. |
| Air dash | `!airdash` | 18 | 35 | Dash maju di udara; sekali per lompatan. |
| Parry | `!parry` | 25 | 45 | Window 6 tick: menangkis satu hit dan membuat penyerang stun. |
| Focus | `!focus` | 10 | 75 | Channel 24 tick untuk 12 energi; batal jika terkena hit. |
| Taunt | `!taunt` | 5 | 90 | Pose terbuka 30 tick untuk 8 energi; batal jika terkena hit. |
| Brace | `!brace` | 15 | 50 | Tahan 18 tick; menerima 45% damage tanpa hitstun, kecuali Piercing Thrust. |
| Feint | `!feint` | 8 | 40 | Startup serangan berikutnya 35% lebih cepat selama 60 tick. |

Dash tidak memberi invulnerability. Parry memerlukan ground, menangkis satu hit dalam window 6 tick dan memberikan 6 energi pada keberhasilan; piercing tetap dapat diparry. Crouch/focus/taunt/brace/feint memerlukan ground. Focus dan Taunt memberi energi hanya setelah channel selesai, dibatalkan oleh hitstun. Focus/taunt merupakan kemampuan fighter yang menggunakan stamina dan cooldown, terpisah dari reward viewer energy/heal/shield. Tidak menambah HP atau mengabaikan competitive heal restriction.

## 10 skill serangan

| Skill | Komentar LIVE | Damage dasar | Energi | Stamina | Cooldown (tick) | Efek |
|---|---|---:|---:|---:|---:|---|
| Flame Wave | `!flamewave` | 110 | 20 | 20 | 60 | Gelombang jarak menengah dengan knockback 35 unit. |
| Frost Lance | `!frostlance` | 85 | 25 | 18 | 65 | Lance es memperlambat gerakan 45 tick jika tidak diblok. |
| Thunder Strike | `!thunderstrike` | 100 | 30 | 20 | 70 | Petir memberi hitstun 14 tick jika tidak diblok. |
| Shadow Assault | `!shadowassault` | 90 | 25 | 22 | 60 | Dash 140 unit sebelum serangan jarak dekat. |
| Rising Slash | `!risingslash` | 95 | 15 | 18 | 50 | Tebasan meluncurkan lawan ke udara jika tidak diblok. |
| Whirlwind | `!whirlwind` | 110 | 30 | 25 | 75 | Serangan melingkar dua arah; block menerima 50% damage. |
| Earth Shatter | `!earthshatter` | 125 | 35 | 28 | 85 | Hanya di tanah; block menerima 75% damage, knockback kuat. |
| Piercing Thrust | `!piercingthrust` | 105 | 20 | 20 | 60 | Tusukan menembus block/brace; shield tetap menyerap damage. |
| Meteor Dive | `!meteordive` | 160 | 35 | 30 | 90 | Hanya di udara; dash dan menyelam dengan damage besar. |
| Crescent Wave | `!crescentwave` | 100 | 30 | 23 | 80 | Gelombang tinggi; drain 15 energi pada hit tanpa block, bisa dihindari dengan crouch. |

Slow mengurangi kecepatan movement/dash ke 55% selama status aktif. Stun, launch, slow dan drain berlaku ketika serangan tidak diblok/brace, kecuali Piercing Thrust yang menembus keduanya. Shield menyerap damage sebelum HP; tidak memberikan kekebalan terhadap hitstun/debuff. Serangan harus memenuhi range, arah, hurtbox, stamina dan energi. Whirlwind boleh mengenai kedua arah. Meteor Dive harus dimulai di udara; Earth Shatter di tanah. Efek dan biaya ditentukan server, bukan visual browser.

## Kontrol dan mapping

Di **Game arena → MANUAL INPUT**, pilih tim lalu buka panel **10 aksi taktis** atau **10 skill**. Klik tombol untuk memberi input manual pada fighter dengan mode Manual/Hybrid. Tooltip berisi mekanik; tombol menampilkan biaya dan komentar LIVE.

Shortcut untuk tim terpilih: **Shift+A/D/C/W/E/P/F/T/B/G**, sesuai urutan aksi tabel. **Alt+1…9, lalu Alt+0** memilih skill sesuai urutan tabel. Kontrol dasar Merah/Biru tetap tersedia seperti panduan Help. Overlay hanya menampilkan state dan tidak menerima kontrol.

Database baru memiliki 20 mapping komentar default. Jika pernah menyimpan mapping sebelumnya, buka **LIVE & webhook → Import 20 ability** untuk menambah default sambil mempertahankan mapping yang sudah ada. Import idempotent, bukan auto-replace. Maksimal 50 mapping; edit gift/komentar/prioritas di Event mapping bila diperlukan. Perintah join tetap `!merah` / `!biru`; membership, dedup, TTL, queue dan quota berlaku untuk ability baru juga. Event tetap tidak memulai pertandingan otomatis.

Untuk karakter custom: Combat Editor menyediakan 14 profil serangan. Sembilan animasi dasar tetap wajib; mapping animasi ability tambahan **opsional** menggunakan nama action ID (contoh `frost_lance`). Jika tidak diisi, spritesheet memakai animasi dasar attack/block/jump/idle; efek skill tetap dirender. Frame opsional yang diisi juga harus valid dan berada di spritesheet. Rig procedural bawaan mempunyai pose crouch/dash/parry/focus/taunt/brace/feint serta efek skill berbeda.

AI memakai seleksi seeded yang mempertimbangkan range, biaya dan cooldown untuk skill baru; juga menggunakan dash/parry/focus. AI belum memiliki planner kombo udara untuk high jump → Meteor Dive. Operator/manual/LIVE bisa menjalankan rangkaian itu melalui queue.

## Validasi

Tes engine memeriksa setiap skill: biaya, startup, damage sekali, cooldown dan miss; ditambah dash collision, air-dash limits, parry window, channel interrupted, feint expiry, brace, slow/stun/launch/drain, piercing/shield, crouch, mapping/dedup, lifecycle dan determinisme AI. Tes API memastikan 20 action diterima di mapping admin, CSRF/unknown action ditolak, dan 14 profil skill karakter dapat disimpan. Browser fixtures memeriksa 20 tombol, shortcut tim, 10 field skill, 20 efek/pose serta mobile overflow; fixture tidak mengubah state backend. QA LIVE/perangkat nyata tetap perlu dilakukan.

[Contoh panel kontrol](screenshots/ability-controls.png) · [Frost Lance](screenshots/skill-frost_lance.png) · [Whirlwind](screenshots/skill-whirlwind.png)
