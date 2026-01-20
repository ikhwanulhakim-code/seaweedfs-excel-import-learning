import { Router } from "express";
import { getFile } from "../services/storage.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

/**
 * GET /api/photos/:key(*)
 * Serve photo from S3
 */
router.get(
  "/*",
  asyncHandler(async (req, res) => {
    // Get the full path after /api/photos/
    const key = req.params[0];

    if (!key) {
      return res.status(400).json({
        success: false,
        error: "Photo key tidak ditemukan",
      });
    }

    try {
      const { stream, contentType } = await getFile(key);

      // Set content type
      res.setHeader("Content-Type", contentType || "image/jpeg");

      // Cache for 1 hour
      res.setHeader("Cache-Control", "public, max-age=3600");

      // Pipe the stream to response
      stream.pipe(res);
    } catch (error) {
      console.error(`[Photos] Error getting ${key}:`, error.message);

      // Redirect to placeholder on error
      return res.redirect("/assets/placeholder.png");
    }
  }),
);

export default router;
