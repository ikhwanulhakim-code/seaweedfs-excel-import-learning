# Student Management System

> Web app untuk manage data siswa dengan bulk import dari Excel (termasuk fotonya).

[🇬🇧 English](./README.md) | [🇮🇩 Bahasa Indonesia](./README.id.md)

---

## Kenapa Bikin Ini

Jujur aja, pengen belajar dua hal:

1. **SeaweedFS** - Distributed file storage yang S3-compatible. Kebetulan lagi pengen tau gimana cara kerja object storage selain AWS S3.

2. **Import Excel dengan Foto** - Ternyata extract gambar dari Excel itu tricky. Ada yang anchored, ada yang floating. ExcelJS punya 2 API berbeda buat handle ini. Menarik buat dipelajari.

Jadi daripada bikin todo app yang ke-1000, mending bikin yang ada challengenya dikit.

---

## Tech Stack

**Backend:**

- Node.js + Express (standar lah)
- Prisma ORM (type-safe, migration gampang)
- PostgreSQL (database production)
- ExcelJS (buat parse Excel)
- AWS SDK v3 (S3-compatible API)

**Frontend:**

- Vanilla JS (no framework, keep it simple)
- Tailwind CSS + DaisyUI
- Notyf (toast notifications)

**Storage:**

- SeaweedFS (distributed object storage, S3-compatible)

---

## Yang Gue Pelajari

### SeaweedFS

- Setup master + volume + S3 server
- S3 API operations (PutObject, DeleteObject)
- `forcePathStyle: true` itu wajib buat non-AWS S3
- Trade-offs antara object storage vs database storage

### Excel Import

- Excel nyimpen gambar dengan 2 cara: anchored (punya cell reference) dan floating (ngambang gitu aja)
- ExcelJS punya `worksheet.getImages()` dan `workbook.model.media` - beda use case
- Memory buffer > disk I/O buat file kecil-menengah
- Rollback pattern: upload foto dulu, kalo DB insert gagal, delete fotonya

> Penjelasan detail implementasinya udah gue tulis di sini: [docs/import-flow.md](./docs/import-flow.md)

### General

- Prisma migration workflow
- Multer memory storage
- Debouncing search input (500ms)
- Inline validation > toast spam
- Skeleton loading states

---

## Fitur

**CRUD Siswa**

- Create, read, update, delete data siswa
- Upload foto profil (max 2MB)
- Search by nama atau NISN
- Pagination

**Bulk Import**

- Upload file Excel (.xlsx)
- Auto-extract gambar embedded
- Validasi per baris
- Error reporting yang detail
- Rollback kalo ada yang gagal

**UI/UX**

- Responsive design
- Skeleton loading
- Debounced search
- Inline form validation
- Smooth transitions

---

## Cara Jalanin

### Prerequisites

- Node.js >= 20
- PostgreSQL
- SeaweedFS (atau S3-compatible storage lain)

### Installation

```bash
# Clone repo
git clone <repo-url>
cd seaweedfs-excel-import-learning

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env sesuai kebutuhan

# Run migrations
npx prisma migrate dev

# Start server
npm run dev
```

Server jalan di `http://localhost:3002`

### Setup SeaweedFS (Local)

```bash
# Download SeaweedFS
wget https://github.com/seaweedfs/seaweedfs/releases/download/3.x/seaweedfs.tar.gz
tar -xzf seaweedfs.tar.gz

# Terminal 1: Master
./weed master

# Terminal 2: Volume
./weed volume -port=8080 -dir=./data

# Terminal 3: S3 API
./weed s3 -port=8333
```

### Setup Docker (Alternatif)

Kalau mau pakai Docker:

```bash
# Start PostgreSQL dan SeaweedFS
docker-compose up -d

# Cek service jalan
docker-compose ps

# Lihat logs
docker-compose logs -f

# Stop services
docker-compose down
```

File `docker-compose.yml` sudah include:

- PostgreSQL di port 5432
- SeaweedFS master di port 9333
- SeaweedFS volume di port 8080
- SeaweedFS S3 API di port 8333

---

## API Endpoints

### Students

**GET** `/api/students?page=1&limit=10&search=john`

- Get data siswa dengan pagination dan search

**POST** `/api/students`

- Create siswa baru (multipart/form-data)
- Fields: nisn, name, email (optional), photo (optional)

**PUT** `/api/students/:id`

- Update data siswa

**DELETE** `/api/students/:id`

- Delete siswa (sekalian delete foto dari storage)

### Import

**GET** `/api/import/template`

- Download template Excel

**POST** `/api/import`

- Bulk import dari file Excel
- Returns: jumlah berhasil, skip, dan detail error

---

## Database Schema

```prisma
model Student {
  id        Int      @id @default(autoincrement())
  nisn      String   @unique @db.VarChar(10)
  name      String   @db.VarChar(255)
  email     String?  @db.VarChar(255)
  photoKey  String?  @db.VarChar(500)   // S3 key
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## Alur Import

Diagram lengkap ada di [docs/import-flow.md](./docs/import-flow.md)

**TL;DR:**

1. User upload Excel
2. Multer simpan di memory (Buffer)
3. ExcelJS parse workbook + extract gambar
4. Validasi tiap baris (NISN, nama, cek duplikat)
5. Upload foto ke SeaweedFS
6. Insert ke database
7. Kalo DB insert gagal, rollback (delete foto yang udah diupload)
8. Return summary (berhasil, skip, error)

---

## Struktur Project

```
src/
├── config/       # Multer, Prisma config
├── middleware/   # Express middlewares
├── routes/       # API routes
├── services/     # Business logic (storage, dll)
└── server.js     # Entry point

public/
├── js/           # Client-side JS
└── index.html    # Halaman utama

prisma/
└── schema.prisma # Database schema

docs/
└── import-flow.md # Dokumentasi teknis
```

---

## License

MIT

---

## Catatan

Ini learning project. Code mungkin belum perfect, tapi jalan dan gue belajar banyak dari sini.

Kalo nemu bug atau ada saran, feel free buat open issue.
