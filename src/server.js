import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import studentsRoutes from "./routes/students.js";
import importRoutes from "./routes/import.js";
import photosRoutes from "./routes/photos.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { ensureBucket } from "./services/storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// API Routes
app.use("/api/students", studentsRoutes);
app.use("/api/import", importRoutes);
app.use("/api/photos", photosRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Serve index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Global error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Ensure S3 bucket exists
    await ensureBucket();

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════╗
║  Student Management System                     ║
║  Server running on http://localhost:${PORT}       ║
╚════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("[Server] Failed to start:", error.message);
    process.exit(1);
  }
}

startServer();
