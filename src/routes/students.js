import { Router } from "express";
import prisma from "../services/prisma.js";
import { uploadFile, deleteFile } from "../services/storage.js";
import { uploadPhoto } from "../config/multer.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  validateStudent,
  validateStudentId,
  validateStudentUpdate,
} from "../middleware/validation.js";

const router = Router();

/**
 * GET /api/students
 * List students with pagination and search
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    const skip = (page - 1) * limit;

    // Build where clause for search
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { nisn: { contains: search } },
          ],
        }
      : {};

    // Get students and count in parallel
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.student.count({ where }),
    ]);

    // Add photoUrl to each student
    const studentsWithPhotoUrl = students.map((student) => ({
      ...student,
      photoUrl: student.photoKey ? `/api/photos/${student.photoKey}` : null,
    }));

    res.json({
      success: true,
      data: {
        students: studentsWithPhotoUrl,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  }),
);

/**
 * GET /api/students/:id
 * Get single student by ID
 */
router.get(
  "/:id",
  validateStudentId,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: parseInt(id) },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: "Siswa tidak ditemukan",
      });
    }

    res.json({
      success: true,
      data: {
        ...student,
        photoUrl: student.photoKey ? `/api/photos/${student.photoKey}` : null,
      },
    });
  }),
);

/**
 * POST /api/students
 * Create new student
 */
router.post(
  "/",
  uploadPhoto.single("photo"),
  validateStudent,
  asyncHandler(async (req, res) => {
    const { nisn, name, email } = req.body;
    let photoKey = null;

    // Upload photo if provided
    if (req.file) {
      photoKey = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );
    }

    try {
      const student = await prisma.student.create({
        data: {
          nisn,
          name: name.trim(),
          email: email || null,
          photoKey,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          ...student,
          photoUrl: photoKey ? `/api/photos/${photoKey}` : null,
        },
        message: "Data siswa berhasil disimpan",
      });
    } catch (error) {
      // Rollback: delete uploaded photo if DB insert fails
      if (photoKey) {
        await deleteFile(photoKey);
      }
      throw error;
    }
  }),
);

/**
 * PUT /api/students/:id
 * Update student
 */
router.put(
  "/:id",
  validateStudentId,
  uploadPhoto.single("photo"),
  validateStudentUpdate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { nisn, name, email } = req.body;

    // Get existing student
    const existingStudent = await prisma.student.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        error: "Siswa tidak ditemukan",
      });
    }

    let photoKey = existingStudent.photoKey;
    let oldPhotoKey = null;

    // Upload new photo if provided
    if (req.file) {
      oldPhotoKey = existingStudent.photoKey;
      photoKey = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );
    }

    try {
      const student = await prisma.student.update({
        where: { id: parseInt(id) },
        data: {
          nisn: nisn || existingStudent.nisn,
          name: name ? name.trim() : existingStudent.name,
          email: email !== undefined ? email || null : existingStudent.email,
          photoKey,
        },
      });

      // Delete old photo after successful update
      if (oldPhotoKey) {
        await deleteFile(oldPhotoKey);
      }

      res.json({
        success: true,
        data: {
          ...student,
          photoUrl: photoKey ? `/api/photos/${photoKey}` : null,
        },
        message: "Data siswa berhasil diperbarui",
      });
    } catch (error) {
      // Rollback: delete new photo if DB update fails
      if (req.file && photoKey !== existingStudent.photoKey) {
        await deleteFile(photoKey);
      }
      throw error;
    }
  }),
);

/**
 * DELETE /api/students/:id
 * Delete student
 */
router.delete(
  "/:id",
  validateStudentId,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Get student to check if exists and get photoKey
    const student = await prisma.student.findUnique({
      where: { id: parseInt(id) },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        error: "Siswa tidak ditemukan",
      });
    }

    // Delete from database
    await prisma.student.delete({
      where: { id: parseInt(id) },
    });

    // Delete photo from S3 if exists
    if (student.photoKey) {
      await deleteFile(student.photoKey);
    }

    res.json({
      success: true,
      message: "Data siswa berhasil dihapus",
    });
  }),
);

export default router;
