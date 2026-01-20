# Alur Import Data Siswa dengan Foto (Backend)

## 📊 Overview Alur Sistem

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         IMPORT FLOW DIAGRAM                              │
└─────────────────────────────────────────────────────────────────────────┘

    [User Upload Excel File]
              │
              ↓
    ┌─────────────────────┐
    │   Multer Receive    │ ← File disimpan di memory (Buffer)
    │   (Memory Storage)  │
    └──────────┬──────────┘
               │
               ↓
    ┌─────────────────────┐
    │  ExcelJS Parse      │ ← Load workbook dari buffer
    │  Workbook           │
    └──────────┬──────────┘
               │
               ↓
    ┌─────────────────────┐
    │  Validate Headers   │ ← Cek kolom NISN, Name ada
    └──────────┬──────────┘
               │
               ↓
    ┌─────────────────────────────────────────┐
    │  Extract Images (Dual Strategy)         │
    │  ┌─────────────────┐  ┌───────────────┐ │
    │  │ Strategy 1:     │  │ Strategy 2:   │ │
    │  │ Anchored Images │→ │ Floating      │ │
    │  │ (getImages())   │  │ (model.media) │ │
    │  └─────────────────┘  └───────────────┘ │
    └──────────────────┬──────────────────────┘
                       │
                       ↓
    ┌──────────────────────────────────────────┐
    │  Loop Each Row (2 → rowCount)            │
    └──────────────────┬───────────────────────┘
                       │
                       ↓
         ┌─────────────────────────┐
         │  Get Cell Values        │
         │  (NISN, Name, Email)    │
         └────────┬────────────────┘
                  │
                  ↓
         ┌────────────────┐
         │  Skip Empty?   │ ─Yes→ [Continue to Next Row]
         └────────┬───────┘
                  │ No
                  ↓
         ┌────────────────────┐
         │  Validate NISN     │ ─Fail→ [Push to errors[]]
         │  (10 digits)       │
         └────────┬───────────┘
                  │ Pass
                  ↓
         ┌────────────────────┐
         │  Validate Name     │ ─Fail→ [Push to errors[]]
         │  (min 3 chars)     │
         └────────┬───────────┘
                  │ Pass
                  ↓
         ┌────────────────────┐
         │  Check Duplicate   │ ─Found→ [Push to skipped[]]
         │  (Prisma Query)    │
         └────────┬───────────┘
                  │ Not Found
                  ↓
         ┌────────────────────────────┐
         │  Image for this row?       │
         │  (Check imageMap)          │
         └────────┬───────────────────┘
                  │
         ┌────────┴──────────────────┐
         │ Yes                       │ No
         ↓                           ↓
    ┌─────────────┐             [photoKey = null]
    │ Upload to   │                  │
    │ SeaweedFS   │                  │
    │ (AWS SDK)   │                  │
    └──────┬──────┘                  │
           │                         │
           ↓                         │
    [photoKey = "uploads/..."]       │
           │                         │
           └──────────┬──────────────┘
                      ↓
         ┌─────────────────────┐
         │  Prisma Insert      │
         │  student.create()   │
         └────────┬────────────┘
                  │
         ┌────────┴─────────┐
         │ Success          │ Fail
         ↓                  ↓
    [Push to imported[]]  ┌──────────────────┐
                          │ Rollback Photo   │
                          │ deleteFile()     │
                          └────────┬─────────┘
                                   ↓
                          [Push to errors[]]

    [Loop continues until last row...]
                   │
                   ↓
         ┌─────────────────────┐
         │  Generate Response  │
         │  - imported count   │
         │  - skipped count    │
         │  - errors array     │
         └─────────┬───────────┘
                   │
                   ↓
         ┌─────────────────────┐
         │  Send JSON to       │
         │  Frontend           │
         └─────────────────────┘
```

---

## Library yang Digunakan

| Library                          | Fungsi                                           |
| -------------------------------- | ------------------------------------------------ |
| **ExcelJS**                      | Parsing file Excel dan ekstraksi gambar embedded |
| **Multer**                       | Middleware Express untuk handle file upload      |
| **Prisma**                       | ORM untuk operasi database                       |
| **AWS SDK (@aws-sdk/client-s3)** | Upload foto ke SeaweedFS (S3-compatible storage) |
| **Crypto (Node.js)**             | Generate unique filename                         |

---

## Alur Proses Import

### 1. File Upload & Validation

```javascript
// src/routes/import.js
router.post("/", uploadExcel.single("file"), asyncHandler(async (req, res) => {
```

**Multer Configuration** (`src/config/multer.js`):

- **Storage**: `memoryStorage()` - File disimpan di memory sebagai Buffer, bukan disk
- **Limit**: Max 5MB
- **Filter**: Hanya accept `.xlsx` dan `.xls` (MIME type validation)

**Mengapa Memory Storage?**

- File Excel langsung di-parse tanpa perlu write/read dari disk
- Lebih cepat untuk file kecil-menengah
- Otomatis cleanup setelah request selesai

---

### 2. Excel Parsing

```javascript
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(req.file.buffer);
const worksheet = workbook.worksheets[0];
```

**ExcelJS** mem-parse binary Excel file menjadi object JavaScript yang bisa dimanipulasi.

#### Header Validation

```javascript
const headerRow = worksheet.getRow(1);
const headers = [];
headerRow.eachCell((cell, colNumber) => {
  headers[colNumber] = cell.value?.toString().toLowerCase().trim();
});

const requiredColumns = ["nisn", "name"];
const missingColumns = requiredColumns.filter((col) => !headers.includes(col));
```

**Mengapa Dynamic Column Mapping?**

- User bisa mengubah urutan kolom di template
- Sistem mencari kolom berdasarkan **nama header**, bukan posisi
- Lebih flexible dan user-friendly

---

### 3. Image Extraction (Dual Strategy)

```javascript
const imageMap = extractImagesFromWorkbook(
  worksheet,
  workbook,
  fotoCol,
  dataRowCount,
);
```

#### Strategy 1: Anchored Images

```javascript
const worksheetImages = worksheet.getImages();

for (const image of worksheetImages) {
  const { tl } = image.range; // top-left anchor point
  const rowNumber = Math.round(tl.row) + 1;
  const workbookImage = workbook.getImage(image.imageId);

  imageMap.set(rowNumber, {
    buffer: workbookImage.buffer,
    extension: workbookImage.extension || "png",
  });
}
```

**Anchored Images**: Gambar yang di-insert dengan "Place in Cell" di Excel, memiliki anchor point ke cell tertentu.

#### Strategy 2: Floating Images (Fallback)

```javascript
if (imageMap.size === 0 && workbook.model?.media?.length > 0) {
  const mediaImages = workbook.model.media.filter(
    (m) => m.type === "image" && m.buffer,
  );

  for (let i = 0; i < mediaImages.length && i < dataRowCount; i++) {
    const rowNumber = i + 2; // Row 2 = first data row
    imageMap.set(rowNumber, {
      buffer: media.buffer,
      extension: media.extension || "png",
    });
  }
}
```

**Floating Images**: Gambar yang "mengambang" di atas worksheet tanpa anchor. Sistem mapping berdasarkan **urutan** (gambar ke-1 → row 2, gambar ke-2 → row 3, dst).

**Mengapa Dual Strategy?**

- Excel memiliki 2 cara berbeda menyimpan gambar
- ExcelJS API berbeda untuk masing-masing jenis
- Fallback memastikan gambar tetap terbaca apapun cara user insert

**Output**: `Map<rowNumber, {buffer, extension}>`

---

### 4. Data Iteration & Validation

```javascript
for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
  const row = worksheet.getRow(rowNumber);
  const nisn = row.getCell(nisnCol)?.value?.toString().trim();
  const name = row.getCell(nameCol)?.value?.toString().trim();
  const email = emailCol !== -1 ? row.getCell(emailCol)?.value?.toString().trim() : null;
```

#### Skip Empty Rows

```javascript
if (!nisn && !name) continue;
```

#### Validation Rules

1. **NISN**: Harus 10 digit angka

   ```javascript
   if (!nisn || nisn.length !== 10 || !/^\d+$/.test(nisn)) {
     errors.push({ row: rowNumber, nisn, reason: "NISN harus 10 digit angka" });
     continue;
   }
   ```

2. **Name**: Minimal 3 karakter

   ```javascript
   if (!name || name.length < 3) {
     errors.push({ row: rowNumber, nisn, reason: "Nama minimal 3 karakter" });
     continue;
   }
   ```

3. **Duplicate Check**: Query database
   ```javascript
   const existingStudent = await prisma.student.findUnique({ where: { nisn } });
   if (existingStudent) {
     skipped.push({ row: rowNumber, nisn, reason: "NISN sudah terdaftar sebelumnya" });
     continue;
   }
   ```

**Mengapa Validasi di Backend?**

- Frontend validation bisa di-bypass
- Data integrity harus dijaga di server
- Batch validation lebih efisien di backend

---

### 5. Photo Upload to SeaweedFS

```javascript
const imageData = imageMap.get(rowNumber);

if (imageData) {
  const filename = `${Date.now()}-${crypto.randomUUID()}.${imageData.extension}`;
  const mimeType = imageData.extension === "png" ? "image/png" : "image/jpeg";

  photoKey = await uploadFile(imageData.buffer, filename, mimeType);
  uploadedPhotos.push(photoKey); // Track for rollback
}
```

#### Upload Implementation (`src/services/storage.js`)

```javascript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for SeaweedFS
});

export async function uploadFile(buffer, filename, mimeType) {
  const key = `uploads/${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
  return key;
}
```

**Filename Strategy**: `timestamp-uuid.extension`

- **Timestamp**: Sortable, debugging friendly
- **UUID**: Garanteed unique, prevent collision
- **Extension**: Preserve original format

**Mengapa SeaweedFS?**

- **Distributed & Scalable**: SeaweedFS adalah distributed file system yang bisa scale horizontal
- **S3-Compatible API**: Menggunakan AWS SDK tanpa vendor lock-in
- **Fast**: Optimized untuk small files (foto profil)
- **Cost-effective**: Open source, bisa self-hosted
- **CDN-ready**: Bisa dikasih CloudFront/CloudFlare di depannya

---

### 6. Database Insert with Transaction Safety

```javascript
try {
  const student = await prisma.student.create({
    data: {
      nisn,
      name,
      email: email || null,
      photoKey, // Can be null
    },
  });

  imported.push({ ...student, hasPhoto: !!photoKey });
} catch (error) {
  // ROLLBACK: Delete uploaded photo if DB insert fails
  if (photoKey) {
    await deleteFile(photoKey);
    uploadedPhotos.pop();
  }

  errors.push({ row: rowNumber, nisn, reason: error.message });
}
```

**Rollback Mechanism**:

1. Foto di-upload dulu ke SeaweedFS
2. Jika insert DB gagal (misal: constraint violation), foto di-delete dari SeaweedFS
3. Mencegah orphaned files di storage

**Mengapa Upload Foto Sebelum DB Insert?**

- Validasi file (corrupt, format) terjadi saat upload
- Jika upload gagal, tidak perlu insert DB
- Lebih mudah rollback file daripada rollback DB transaction

---

### 7. Response Generation

```javascript
const photosImported = imported.filter((s) => s.hasPhoto).length;

res.json({
  success: true,
  data: {
    imported: imported.length,
    photosImported,
    skipped: skipped.length,
    errors: [...skipped, ...errors], // Merged array
  },
  message: `Import selesai: ${imported.length} berhasil (${photosImported} dengan foto), ${skipped.length} dilewati, ${errors.length} error`,
});
```

**Error Array Structure**:

```javascript
[
  { row: 2, nisn: "0000000001", reason: "NISN sudah terdaftar sebelumnya" },
  { row: 5, nisn: "123", reason: "NISN harus 10 digit angka" },
];
```

---

## Key Design Decisions

### 1. Memory vs Disk Storage

**Choice**: Memory Storage (Multer)

- **Pro**: Faster, no disk I/O, auto cleanup
- **Con**: Limited by RAM (mitigated by 5MB limit)

### 2. Dual Image Extraction Strategy

**Choice**: Try anchored first, fallback to floating

- **Pro**: Maximum compatibility dengan berbagai cara user insert gambar
- **Con**: Sedikit lebih kompleks

### 3. Upload Before Insert

**Choice**: Upload foto ke SeaweedFS sebelum insert DB

- **Pro**: Validasi file lebih awal, rollback lebih mudah
- **Con**: Possible orphaned files jika server crash (mitigated by error handling)

### 4. Dynamic Column Mapping

**Choice**: Cari kolom by header name, bukan index

- **Pro**: Flexible, user bisa ubah urutan kolom
- **Con**: Header name harus exact match (case-insensitive handled)

### 5. Row-by-Row Processing

**Choice**: Loop sequential, bukan batch insert

- **Pro**: Granular error handling per row, rollback per row
- **Con**: Slower untuk dataset besar (acceptable untuk <1000 rows)

---

## Error Handling Strategy

1. **Validation Errors**: Dikumpulkan di array, tidak stop proses
2. **Duplicate NISN**: Di-skip, masuk array `skipped`
3. **Upload Failures**: Log error, continue tanpa foto
4. **DB Insert Failures**: Rollback foto, masuk array `errors`

**Prinsip**: **Fail gracefully** - Satu row error tidak menghentikan seluruh import.

---

## Performance Considerations

- **Batch Size**: Tidak ada batasan row, tapi file max 5MB
- **Database Queries**: 1 query per row untuk duplicate check (bisa dioptimasi dengan `findMany` + Set)
- **SeaweedFS Upload**: Parallel possible, tapi saat ini sequential untuk simplicity
- **Memory Usage**: Proportional to file size + image buffers

**Potential Optimization**:

- Batch duplicate check dengan `findMany`
- Parallel SeaweedFS uploads dengan `Promise.all`
- Stream processing untuk file besar
