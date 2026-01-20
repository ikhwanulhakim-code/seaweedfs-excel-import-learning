/**
 * Validate student input (for POST and PUT)
 */
export const validateStudent = (req, res, next) => {
  const { nisn, name, email } = req.body;
  const errors = [];

  // NISN validation
  if (!nisn || nisn.length !== 10 || !/^\d+$/.test(nisn)) {
    errors.push("NISN harus 10 digit angka");
  }

  // Name validation
  if (!name || name.trim().length < 3) {
    errors.push("Nama minimal 3 karakter");
  }

  if (name && name.length > 255) {
    errors.push("Nama maksimal 255 karakter");
  }

  // Email validation (optional but must be valid if provided)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Format email tidak valid");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: errors.join(", "),
    });
  }

  next();
};

/**
 * Validate student ID parameter
 */
export const validateStudentId = (req, res, next) => {
  const { id } = req.params;

  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({
      success: false,
      error: "ID siswa tidak valid",
    });
  }

  next();
};

/**
 * Validate student update input (partial validation)
 */
export const validateStudentUpdate = (req, res, next) => {
  const { nisn, name, email } = req.body;
  const errors = [];

  // NISN validation (if provided)
  if (nisn !== undefined) {
    if (nisn.length !== 10 || !/^\d+$/.test(nisn)) {
      errors.push("NISN harus 10 digit angka");
    }
  }

  // Name validation (if provided)
  if (name !== undefined) {
    if (name.trim().length < 3) {
      errors.push("Nama minimal 3 karakter");
    }
    if (name.length > 255) {
      errors.push("Nama maksimal 255 karakter");
    }
  }

  // Email validation (if provided)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Format email tidak valid");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: errors.join(", "),
    });
  }

  next();
};
