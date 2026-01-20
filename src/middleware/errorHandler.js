import multer from "multer";

/**
 * Async handler wrapper to catch errors
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error("[ERROR]", {
    endpoint: req.path,
    method: req.method,
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  // Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error:
          "Ukuran file terlalu besar. Maksimal 2MB untuk foto, 5MB untuk Excel.",
      });
    }
    return res.status(400).json({
      success: false,
      error: `Error upload file: ${err.message}`,
    });
  }

  // Multer filter error (invalid file type)
  if (err.message && err.message.includes("Format file tidak didukung")) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  // Prisma errors
  if (err.code === "P2002") {
    return res.status(400).json({
      success: false,
      error: "NISN sudah terdaftar",
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      success: false,
      error: "Data tidak ditemukan",
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Terjadi kesalahan server",
  });
};
