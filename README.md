# AnimeExtract v1.0.0 — ekstrak asset Unity dari HP, tanpa PC

> ## 🚀 Sudah live!
> **https://kyokoapp.github.io/animestudio/** — buka di Chrome HP → menu ⋮ → **Add to Home screen / Install app**.
> Paket app: [Release v1.0.0](https://github.com/KyokoApp/animestudio/releases/tag/v1.0.0) (`AnimeExtract-v1.0.0.zip`).
> Halaman demo/uji: `test-ui.py` (tanpa token) · `deploy.js` (deploy ulang sekali jalan).

Aplikasi (PWA) untuk mengendalikan **AnimeStudio** yang berjalan di **PC Windows gratis milik GitHub
Actions**. Semua dari HP: pilih file bundle → kirim → atur → jalankan → unduh hasilnya.

> App ini **tidak punya server sendiri**. Token GitHub-mu disimpan **hanya di HP** (localStorage)
> dan dipakai untuk memanggil `api.github.com` langsung dari browser.

---

## Isi folder

| File | Guna |
|---|---|
| `index.html` · `style.css` · `app.js` | aplikasi (vanilla JS, tanpa dependensi) |
| `manifest.webmanifest` · `sw.js` · `icons/` | supaya bisa **di-install** ke home screen & jalan offline |
| `data/games.js` · `data/classids.js` | daftar 74 kode game + 539 nama ClassID (dimuat lewat `<script>`, bebas CORS) |
| `serve.js` | server statis mini untuk mencoba di komputer/LAN (`PORT=8899 node serve.js`) |
| `test-ui.py` | uji otomatis alur app dengan API GitHub palsu (tanpa token) |
| `deploy.js` | mendeploy folder ini ke GitHub Pages sekali jalan (butuh token) |
| `release/AnimeExtract-v1.0.0.zip` | paket rilis siap dibagikan / di-upload ke Releases |

---

## Cara pakai (di HP)

1. Buka URL app-nya (setelah deploy: `https://<user>.github.io/anime-extract-app/`).
2. **Setelan** → isi repo ekstraksi (`KyokoApp/anime-extract`) + **token GitHub**
   (fine-grained: *Contents: Read and write* · *Actions: Read and write*, masa berlaku 90 hari) →
   **Simpan & uji koneksi**.
3. **Kirim** → pilih file bundle (`.zip/.7z/.rar/.ab/.bin`).
   * ≤ ± 45 MB → langsung dari app (masuk folder `inbox/` di repo private-mu).
   * lebih besar → tombol “Buka halaman release baru”, attach file-nya di browser HP (batas 2 GB),
     lalu tempel link-nya di kotak “pakai bundle yang sudah ada”.
4. **Ekstrak** → pilih game + jenis asset (ada preset Gambar/Audio/Model 3D/Animasi/Data) → **Jalankan ekstraksi**.
5. **Proses** → pantau langkah demi langkah (boleh ditutup, HP boleh dikunci; jalan di server GitHub).
6. **Hasil** → unduh zip hasilnya. Hasil kecil = artifact, hasil besar otomatis ditaruh di tab **Releases**.

**Install ke home screen:** buka di Chrome → menu ⋮ → **Add to Home screen / Install app**.
Setelah itu app muncul seperti aplikasi biasa (tanpa address bar).

---

## Deploy ke GitHub Pages (sekali saja)

```bash
GITHUB_TOKEN=ghp_xxx node deploy.js                 # repo: <user>/anime-extract-app (PUBLIC)
GITHUB_TOKEN=ghp_xxx node deploy.js KyokoApp/animestudio --release
```

Yang dilakukan skrip: buat repo publik (kalau belum ada) → unggah file app → aktifkan Pages →
tunggu sampai URL-nya hidup → (opsional) bikin Release `v1.0.0` + lampirkan `release/AnimeExtract-v1.0.0.zip`.

> Catatan: app shell ini **boleh publik** — isinya cuma kode tampilan, tanpa token dan tanpa hasil ekstraksi.
> Semua hasilmu tetap tersimpan di repo **private** `KyokoApp/anime-extract`.
> (GitHub Pages dari repo *private* hanya tersedia di plan berbayar, jadi repo terpisah lebih aman & gratis.)

---

## Uji sendiri di komputer

```bash
node serve.js          # http://localhost:8899
python3 test-ui.py     # uji alur lengkap dengan API GitHub palsu
```

Test suite memverifikasi: simpan token & uji koneksi, pembersihan nama file, upload ke repo,
pengisian otomatis bundle, dispatch workflow, daftar run + langkah runner, daftar hasil + artifact,
daftar & hapus isi inbox, dan tidak adanya error konsol.

---

## Batas & catatan teknis

* **Upload ke tab Releases langsung dari browser tidak bisa** (endpoint `uploads.github.com`
  menolak preflight CORS — sudah diuji). Karena itu jalur utamanya memakai Contents API
  (`api.github.com`, CORS `*`) dan jalur Releases hanya untuk file besar yang dilampirkan manual.
* Kuota runner Windows: ± 1.000 menit/bulan di plan Free (repo private), ± 2.000 menit kalau publik.
* Hasil > 450 MB otomatis ditaruh di Releases (kuota artifact 500 MB); > 1,8 GB dipecah otomatis oleh workflow.
* Mesin ekstraksi: **AnimeStudio** © Escartem (MIT) → Studio (Razmoth) → AssetStudio (Perfare).
  Pakai hasil ekstraksi hanya untuk keperluan pribadi.
