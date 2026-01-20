import { Router } from "express";
import ExcelJS from "exceljs";
import crypto from "crypto";
import prisma from "../services/prisma.js";
import { uploadFile, deleteFile } from "../services/storage.js";
import { uploadExcel } from "../config/multer.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

/**
 * GET /api/import/template
 * Generate and download Excel template with photo column
 */
router.get(
  "/template",
  asyncHandler(async (req, res) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Student Management System";
    workbook.created = new Date();

    // Main data worksheet
    const worksheet = workbook.addWorksheet("Data Siswa");

    // Define columns with photo column
    // Define columns with photo column
    // Define columns with photo column
    worksheet.columns = [
      { header: "Foto", key: "foto", width: 16 },
      { header: "NISN", key: "nisn", width: 15 },
      { header: "Name", key: "name", width: 30 },
      { header: "Email", key: "email", width: 30 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF144576" }, // Secondary color #144576
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 30;

    // Add borders - REMOVED per request
    // headerRow.eachCell((cell) => { ... });

    // Add example rows with placeholder for photo
    const exampleData = [
      {
        foto: "← Sisipkan gambar di cell ini",
        nisn: "0000000001",
        name: "Siswa 1",
        email: "siswa1@gmail.com",
      },
      {
        foto: "← Sisipkan gambar di cell ini",
        nisn: "0000000002",
        name: "Siswa 2",
        email: "siswa2@gmail.com",
      },
      {
        foto: "← Sisipkan gambar di cell ini",
        nisn: "0000000003",
        name: "Siswa 3",
        email: "siswa3@gmail.com",
      },
    ];

    exampleData.forEach((data) => {
      worksheet.addRow(data);
    });

    // Pre-format rows 2 to 101 (100 rows) with 3:4 aspect ratio
    // Column Width 16 approx 112px. Row Height 120 approx 160px. Ratio ~0.7 (3:4 is 0.75)
    for (let i = 2; i <= 101; i++) {
      const row = worksheet.getRow(i);
      row.height = 120;

      // Apply style per cell
      for (let col = 1; col <= 4; col++) {
        const cell = row.getCell(col);
        const alignment = { vertical: "middle", wrapText: true };

        if (col === 1) {
          // Photo column: Center alignment, no indent
          alignment.horizontal = "center";
        } else {
          // Other columns (Text): Left alignment
          alignment.horizontal = "left";
        }

        cell.alignment = alignment;
      }
    }

    // Add instructions worksheet
    const instructionSheet = workbook.addWorksheet("Petunjuk");
    instructionSheet.columns = [
      { header: "Petunjuk Import Data Siswa", key: "instruction", width: 80 },
    ];

    const instructions = [
      "",
      "CARA MENGGUNAKAN TEMPLATE INI:",
      "",
      "1. Isi data siswa di sheet 'Data Siswa'",
      "2. Kolom NISN: Wajib diisi, harus 10 digit angka",
      "3. Kolom Name: Wajib diisi, minimal 3 karakter",
      "4. Kolom Email: Opsional, format email valid",
      "5. Kolom Foto: Opsional, sisipkan gambar langsung",
      "",
      "CARA MENYISIPKAN FOTO:",
      "",
      "1. Klik cell di kolom 'foto' pada baris siswa",
      "2. Pilih menu Insert > Pictures > This Device",
      "3. Pilih file gambar (JPG/PNG, maks 2MB)",
      "4. Sesuaikan ukuran gambar agar pas di cell",
      "5. PENTING: Gambar harus berada di dalam cell, bukan floating",
      "",
      "TIPS:",
      "- Ukuran foto yang disarankan: 100x100 pixel",
      "- Format yang didukung: JPG, JPEG, PNG",
      "- Jika foto tidak muncul, pastikan gambar tidak floating",
      "",
      "CATATAN:",
      "- NISN yang sudah ada di database akan dilewati",
      "- Baris dengan data tidak valid akan ditampilkan di hasil import",
    ];

    // Style instruction header
    const instHeaderRow = instructionSheet.getRow(1);
    instHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
    instHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Slate 900
    };
    instHeaderRow.alignment = { horizontal: "center", vertical: "middle" };
    instHeaderRow.height = 40;

    instructions.forEach((text, index) => {
      const row = instructionSheet.addRow({ instruction: text });

      // Styling for Headers inside instructions
      if (
        text.includes("CARA") ||
        text.includes("TIPS") ||
        text.includes("CATATAN")
      ) {
        row.font = { bold: true, size: 12, color: { argb: "FF1E293B" } }; // Slate 800
        row.getCell(1).border = {
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        }; // Slate 300
      } else {
        row.font = { size: 11, color: { argb: "FF475569" } }; // Slate 600
        row.alignment = { wrapText: true };
      }
    });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=template_import_siswa.xlsx",
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  }),
);

/**
 * Extract images from worksheet/workbook and map to rows
 * Uses multiple strategies:
 * 1. Try worksheet.getImages() (proper anchored images)
 * 2. Fallback to workbook.model.media (images without proper anchoring)
 *
 * @param {ExcelJS.Worksheet} worksheet
 * @param {ExcelJS.Workbook} workbook
 * @param {number} photoCol - Column index for photos (1-based from headers array)
 * @param {number} dataRowCount - Number of data rows (excluding header)
 * @returns {Map<number, {buffer: Buffer, extension: string}>} - Map of row number to image data
 */
function extractImagesFromWorkbook(
  worksheet,
  workbook,
  photoCol,
  dataRowCount,
) {
  const imageMap = new Map();

  // Strategy 1: Try worksheet.getImages() first (properly anchored images)
  const worksheetImages = worksheet.getImages();
  console.log(
    `[Import] Strategy 1 - worksheet.getImages(): ${worksheetImages.length} images`,
  );

  if (worksheetImages.length > 0) {
    for (const image of worksheetImages) {
      try {
        const { tl } = image.range;
        if (!tl) continue;

        const rowNumber = Math.round(tl.row) + 1;
        const workbookImage = workbook.getImage(image.imageId);

        if (workbookImage && workbookImage.buffer) {
          console.log(`[Import] Mapping anchored image to row ${rowNumber}`);
          imageMap.set(rowNumber, {
            buffer: workbookImage.buffer,
            extension: workbookImage.extension || "png",
          });
        }
      } catch (err) {
        console.error("[Import] Error with anchored image:", err.message);
      }
    }
  }

  // Strategy 2: Fallback to workbook.model.media if no anchored images found
  if (imageMap.size === 0 && workbook.model?.media?.length > 0) {
    console.log(
      `[Import] Strategy 2 - workbook.model.media: ${workbook.model.media.length} images`,
    );

    // Map images to rows in order (image1 -> row2, image2 -> row3, etc.)
    // This assumes images are added in the same order as the data rows
    const mediaImages = workbook.model.media.filter(
      (m) => m.type === "image" && m.buffer,
    );

    for (let i = 0; i < mediaImages.length && i < dataRowCount; i++) {
      const media = mediaImages[i];
      const rowNumber = i + 2; // Row 2 is first data row (row 1 is header)

      console.log(
        `[Import] Mapping media image ${i} to row ${rowNumber}, extension: ${media.extension}`,
      );
      imageMap.set(rowNumber, {
        buffer: media.buffer,
        extension: media.extension || "png",
      });
    }
  }

  console.log(`[Import] Total images mapped to rows: ${imageMap.size}`);
  return imageMap;
}

/**
 * POST /api/import
 * Import students from Excel file with embedded photos
 */
router.post(
  "/",
  uploadExcel.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "File Excel tidak ditemukan",
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return res.status(400).json({
        success: false,
        error: "File Excel tidak memiliki worksheet",
      });
    }

    // Debug: Check workbook media
    console.log(
      `[Import] Workbook media count: ${workbook.model?.media?.length || 0}`,
    );
    if (workbook.model?.media) {
      workbook.model.media.forEach((media, index) => {
        console.log(`[Import] Media ${index}:`, {
          type: media.type,
          name: media.name,
          extension: media.extension,
          hasBuffer: !!media.buffer,
          bufferLength: media.buffer?.length,
        });
      });
    }

    // Debug: Check worksheet drawings
    console.log(`[Import] Worksheet drawings:`, {
      hasDrawing: !!worksheet._media,
      drawingCount: worksheet._media?.length || 0,
    });

    // Validate header row
    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value?.toString().toLowerCase().trim();
    });

    const requiredColumns = ["nisn", "name"];
    const missingColumns = requiredColumns.filter(
      (col) => !headers.includes(col),
    );

    if (missingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Kolom yang diperlukan tidak ditemukan: ${missingColumns.join(", ")}`,
      });
    }

    // Find column indices (1-based for ExcelJS)
    const nisnCol = headers.indexOf("nisn");
    const nameCol = headers.indexOf("name");
    const emailCol = headers.indexOf("email");
    const fotoCol = headers.indexOf("foto");

    // Count data rows (for image mapping)
    const dataRowCount = worksheet.rowCount - 1; // Exclude header row
    console.log(`[Import] Data row count: ${dataRowCount}`);

    // Extract embedded images using new strategy
    const imageMap = extractImagesFromWorkbook(
      worksheet,
      workbook,
      fotoCol,
      dataRowCount,
    );

    console.log(`[Import] Found ${imageMap.size} embedded images`);

    const imported = [];
    const skipped = [];
    const errors = [];
    const uploadedPhotos = []; // For rollback if needed

    // Process each row (skip header)
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      // Get cell values
      const nisn = row.getCell(nisnCol)?.value?.toString().trim();
      const name = row.getCell(nameCol)?.value?.toString().trim();
      const email =
        emailCol !== -1
          ? row.getCell(emailCol)?.value?.toString().trim()
          : null;

      // Skip empty rows
      if (!nisn && !name) {
        continue;
      }

      // Validate NISN
      if (!nisn || nisn.length !== 10 || !/^\d+$/.test(nisn)) {
        errors.push({
          row: rowNumber,
          nisn: nisn || "(kosong)",
          reason: "NISN harus 10 digit angka",
        });
        continue;
      }

      // Validate name
      if (!name || name.length < 3) {
        errors.push({
          row: rowNumber,
          nisn,
          reason: "Nama minimal 3 karakter",
        });
        continue;
      }

      // Check for duplicate NISN in database
      const existingStudent = await prisma.student.findUnique({
        where: { nisn },
      });

      if (existingStudent) {
        skipped.push({
          row: rowNumber,
          nisn,
          reason: "NISN sudah terdaftar sebelumnya",
        });
        continue;
      }

      // Upload photo if available
      let photoKey = null;
      const imageData = imageMap.get(rowNumber);

      if (imageData) {
        try {
          const filename = `${Date.now()}-${crypto.randomUUID()}.${imageData.extension}`;
          const mimeType =
            imageData.extension === "png" ? "image/png" : "image/jpeg";

          photoKey = await uploadFile(imageData.buffer, filename, mimeType);
          uploadedPhotos.push(photoKey);

          console.log(
            `[Import] Uploaded photo for row ${rowNumber}: ${photoKey}`,
          );
        } catch (uploadErr) {
          console.error(
            `[Import] Failed to upload photo for row ${rowNumber}:`,
            uploadErr.message,
          );
          // Continue without photo
        }
      }

      // Insert student
      try {
        const student = await prisma.student.create({
          data: {
            nisn,
            name,
            email: email || null,
            photoKey,
          },
        });
        imported.push({
          ...student,
          hasPhoto: !!photoKey,
        });
      } catch (error) {
        // Rollback: delete uploaded photo if DB insert fails
        if (photoKey) {
          await deleteFile(photoKey);
          uploadedPhotos.pop();
        }

        errors.push({
          row: rowNumber,
          nisn,
          reason: error.message,
        });
      }
    }

    const photosImported = imported.filter((s) => s.hasPhoto).length;
    const summary = `Import selesai: ${imported.length} berhasil (${photosImported} dengan foto), ${skipped.length} dilewati, ${errors.length} error`;

    res.json({
      success: true,
      data: {
        imported: imported.length,
        photosImported,
        skipped: skipped.length,
        errors: [...skipped, ...errors],
      },
      message: summary,
    });
  }),
);

export default router;
