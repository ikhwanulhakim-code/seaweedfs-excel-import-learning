# Student Management System

> A web app for managing student data with bulk Excel import (including photos).

[🇬🇧 English](./README.md) | [🇮🇩 Bahasa Indonesia](./README.id.md)

---

## Why This Project Exists

Honestly? I wanted to learn two things:

1. **SeaweedFS** - A distributed file storage that's S3-compatible. I was curious about how object storage works beyond AWS S3.

2. **Import Excel with Photos** - Turns out extracting images from Excel is tricky. There are anchored images and floating images. ExcelJS has 2 different APIs to handle this. Interesting stuff to learn.

So instead of building the 1000th todo app, might as well build something with a bit of challenge.

---

## Tech Stack

**Backend:**

- Node.js + Express (standard stuff)
- Prisma ORM (type-safe, easy migrations)
- PostgreSQL (production database)
- ExcelJS (for parsing Excel)
- AWS SDK v3 (S3-compatible API)

**Frontend:**

- Vanilla JS (no framework, keep it simple)
- Tailwind CSS + DaisyUI
- Notyf (toast notifications)

**Storage:**

- SeaweedFS (distributed object storage, S3-compatible)

---

## What I Learned

### SeaweedFS

- Setup master + volume + S3 server
- S3 API operations (PutObject, DeleteObject)
- `forcePathStyle: true` is required for non-AWS S3
- Trade-offs between object storage vs database storage

### Excel Import

- Excel stores images in 2 ways: anchored (has cell reference) and floating (just floats there)
- ExcelJS has `worksheet.getImages()` and `workbook.model.media` - different use cases
- Memory buffer > disk I/O for small-medium files
- Rollback pattern: upload photo first, if DB insert fails, delete the photo

> I wrote a detailed explanation of the implementation here: [docs/import-flow.md](./docs/import-flow.md)

### General

- Prisma migration workflow
- Multer memory storage
- Debouncing search input (500ms)
- Inline validation > toast spam
- Skeleton loading states

---

## Features

**Student CRUD**

- Create, read, update, delete student data
- Upload profile photo (max 2MB)
- Search by name or NISN
- Pagination

**Bulk Import**

- Upload Excel file (.xlsx)
- Auto-extract embedded images
- Row-by-row validation
- Detailed error reporting
- Rollback on failure

**UI/UX**

- Responsive design
- Skeleton loading
- Debounced search
- Inline form validation
- Smooth transitions

---

## Getting Started

### Prerequisites

- Node.js >= 20
- PostgreSQL
- SeaweedFS (or other S3-compatible storage)

### Installation

```bash
# Clone repo
git clone <repo-url>
cd seaweedfs-excel-import-learning

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env as needed

# Run migrations
npx prisma migrate dev

# Start server
npm run dev
```

Server running at `http://localhost:3002`

### SeaweedFS Setup (Local)

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

### Docker Setup (Alternative)

If you prefer using Docker:

```bash
# Start PostgreSQL and SeaweedFS
docker-compose up -d

# Check services are running
docker-compose ps

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The `docker-compose.yml` includes:

- PostgreSQL on port 5432
- SeaweedFS master on port 9333
- SeaweedFS volume on port 8080
- SeaweedFS S3 API on port 8333

---

## API Endpoints

### Students

**GET** `/api/students?page=1&limit=10&search=john`

- Get paginated students with optional search

**POST** `/api/students`

- Create student (multipart/form-data)
- Fields: nisn, name, email (optional), photo (optional)

**PUT** `/api/students/:id`

- Update student

**DELETE** `/api/students/:id`

- Delete student (also deletes photo from storage)

### Import

**GET** `/api/import/template`

- Download Excel template

**POST** `/api/import`

- Bulk import from Excel file
- Returns: imported count, skipped count, error details

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

## Import Flow

Detailed flow diagram available at [docs/import-flow.md](./docs/import-flow.md)

**TL;DR:**

1. User upload Excel
2. Multer stores in memory (Buffer)
3. ExcelJS parse workbook + extract images
4. Validate each row (NISN, name, duplicate check)
5. Upload photos to SeaweedFS
6. Insert to database
7. If DB insert fails, rollback (delete uploaded photo)
8. Return summary (success, skipped, errors)

---

## Project Structure

```
src/
├── config/       # Multer, Prisma config
├── middleware/   # Express middlewares
├── routes/       # API routes
├── services/     # Business logic (storage, etc)
└── server.js     # Entry point

public/
├── js/           # Client-side JS
└── index.html    # Main page

prisma/
└── schema.prisma # Database schema

docs/
└── import-flow.md # Technical docs
```

---

## License

MIT

---

## Notes

This is a learning project. Code might not be perfect, but it works and I learned a lot from it.

If you find bugs or have suggestions, feel free to open an issue.
