// Initialize Notyf
const notyf = new Notyf({
  duration: 4000,
  position: {
    x: "center",
    y: "top",
  },
  ripple: false,
  dismissible: true,
  types: [
    {
      type: "success",
      background: "#0f172a",
      icon: {
        className: "fas fa-check-circle text-green-500 text-xl",
        tagName: "i",
        color: false,
      },
    },
    {
      type: "error",
      background: "#0f172a",
      icon: {
        className: "fas fa-times-circle text-red-500 text-xl",
        tagName: "i",
        color: false,
      },
    },
    {
      type: "warning",
      background: "#0f172a",
      icon: {
        className: "fas fa-exclamation-triangle text-amber-500 text-xl",
        tagName: "i",
        color: false,
      },
    },
  ],
});

// State management
const state = {
  students: [],
  currentPage: 1,
  totalPages: 1,
  total: 0,
  searchQuery: "",
  isLoading: false,
  editingId: null,
};

// DOM Elements
const studentModal = document.getElementById("studentModal");
const importModal = document.getElementById("importModal");
const confirmDeleteModal = document.getElementById("confirmDeleteModal");
const importResultModal = document.getElementById("importResultModal");

// --------------------------
// Loading States
// --------------------------

function showLoadingSkeleton() {
  const tbody = document.getElementById("studentTableBody");
  const totalCard = document.getElementById("totalStatsCard");

  // Show skeleton for total stats as a whole card block
  if (totalCard) {
    // Save original classes if needed, but we hardcode restoration so it's fine.
    // Replace valid classes with skeleton classes
    totalCard.className =
      "hidden md:block h-10 w-32 bg-slate-200 rounded-lg animate-pulse";
    totalCard.innerHTML = "";
  }

  const paginationText = document.getElementById("paginationText");
  const paginationInfoContainer = document.getElementById(
    "paginationInfoContainer",
  );

  // Show skeleton for pagination info
  if (paginationText) {
    paginationText.innerHTML =
      '<span class="inline-block h-4 w-32 bg-slate-200 rounded animate-pulse"></span>';
    if (paginationInfoContainer) {
      paginationInfoContainer.style.visibility = "visible";
    }
  }

  const skeletonRow = `
    <tr class="border-b border-slate-100">
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex items-center">
          <div class="h-10 w-10 flex-shrink-0">
            <div class="h-10 w-10 rounded-full bg-slate-200 animate-pulse"></div>
          </div>
          <div class="ml-4 space-y-2">
            <div class="h-3 w-32 bg-slate-200 rounded animate-pulse"></div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="h-3 w-24 bg-slate-200 rounded animate-pulse"></div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="h-3 w-40 bg-slate-200 rounded animate-pulse"></div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-right">
        <div class="flex justify-end gap-2">
          <div class="h-8 w-8 bg-slate-200 rounded animate-pulse"></div>
          <div class="h-8 w-8 bg-slate-200 rounded animate-pulse"></div>
        </div>
      </td>
    </tr>
  `;
  tbody.innerHTML = skeletonRow.repeat(5);
}

function setButtonLoading(button, isLoading, originalText = "Simpan") {
  if (isLoading) {
    button.disabled = true;
    button.innerHTML =
      '<span class="loading loading-spinner loading-sm"></span> Proses...';
  } else {
    button.disabled = false;
    button.innerHTML = `<i class="fas fa-save mr-1"></i> ${originalText}`;
  }
}

// --------------------------
// Render Functions
// --------------------------

function renderTable(students) {
  const tbody = document.getElementById("studentTableBody");

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-20">
          <div class="flex flex-col items-center justify-center text-slate-400">
            <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                <i class="fas fa-search text-2xl text-slate-300"></i>
            </div>
            <p class="text-sm font-medium text-slate-600">Tidak ada data ditemukan</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = students
    .map(
      (student) => `
    <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-none group">
      <td class="px-6 py-4 whitespace-nowrap">
        <div class="flex items-center">
            <div class="h-10 w-10 flex-shrink-0">
                <img class="h-10 w-10 rounded-full object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity" 
                     src="${student.photoUrl || "/assets/placeholder.svg"}" 
                     alt="${student.name}"
                     onclick="openPhotoModal(this.src); event.stopPropagation();"
                     onerror="this.src='/assets/placeholder.svg'"
                     loading="lazy">
            </div>
            <div class="ml-4">
                <div class="text-sm font-medium text-slate-900">${escapeHtml(student.name)}</div>
            </div>
        </div>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="text-sm text-slate-600 font-mono">
          ${student.nisn}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        ${
          student.email
            ? `<div class="text-sm text-slate-600 hover:text-indigo-600 transition-colors font-medium">
                <a href="mailto:${student.email}" class="flex items-center gap-1">
                  <i class="far fa-envelope text-xs"></i>
                  ${escapeHtml(student.email)}
                </a>
               </div>`
            : '<span class="text-slate-400 text-xs italic">Tidak ada email</span>'
        }
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            class="text-indigo-600 hover:text-indigo-900 p-1.5 rounded hover:bg-indigo-50 transition-colors" 
            onclick="openEditModal(${student.id})"
            title="Edit"
          >
            <i class="fas fa-pencil-alt"></i>
          </button>
          <button 
            class="text-red-600 hover:text-red-900 p-1.5 rounded hover:bg-red-50 transition-colors" 
            onclick="confirmDelete(${student.id}, '${escapeHtml(student.name).replace(/'/g, "\\'")}', '${student.photoUrl || ""}')"
            title="Hapus"
          >
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

function renderPagination(currentPage, totalPages) {
  const container = document.getElementById("paginationContainer");

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let buttons = "";

  // Previous button
  buttons += `
    <button 
      class="join-item btn btn-sm bg-white border-slate-200 hover:bg-slate-50 text-slate-600 ${currentPage === 1 ? "btn-disabled opacity-50" : ""}" 
      onclick="goToPage(${currentPage - 1})"
      ${currentPage === 1 ? "disabled" : ""}
    >
      <i class="fas fa-chevron-left text-[10px]"></i>
    </button>
  `;

  // Page numbers logic matches previous implementation
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    buttons += `<button class="join-item btn btn-sm bg-white border-slate-200 hover:bg-slate-50 text-slate-600 font-medium" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) {
      buttons += `<button class="join-item btn btn-sm bg-white border-slate-200 btn-disabled text-slate-400">...</button>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const activeClass =
      i === currentPage
        ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50";

    buttons += `
      <button 
        class="join-item btn btn-sm ${activeClass} font-medium" 
        onclick="goToPage(${i})"
      >
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      buttons += `<button class="join-item btn btn-sm bg-white border-slate-200 btn-disabled text-slate-400">...</button>`;
    }
    buttons += `<button class="join-item btn btn-sm bg-white border-slate-200 hover:bg-slate-50 text-slate-600 font-medium" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }

  // Next button
  buttons += `
    <button 
      class="join-item btn btn-sm bg-white border-slate-200 hover:bg-slate-50 text-slate-600 ${currentPage === totalPages ? "btn-disabled opacity-50" : ""}" 
      onclick="goToPage(${currentPage + 1})"
      ${currentPage === totalPages ? "disabled" : ""}
    >
      <i class="fas fa-chevron-right text-[10px]"></i>
    </button>
  `;

  container.innerHTML = buttons;
}

function updateStats() {
  const totalCard = document.getElementById("totalStatsCard");

  // Restore Total card structure
  if (totalCard) {
    totalCard.className =
      "hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm";
    totalCard.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-green-500"></span>
      <span class="text-sm text-slate-600 font-medium">Total: <strong class="text-slate-900" id="totalStudents">0</strong></span>
    `;
  }

  if (document.getElementById("totalStudents")) {
    document.getElementById("totalStudents").textContent = state.total;
  }

  const paginationInfoContainer = document.getElementById(
    "paginationInfoContainer",
  );
  const paginationText = document.getElementById("paginationText");

  // Handle pagination info visibility and content
  if (state.total === 0) {
    // Hide entire container if no data
    if (paginationInfoContainer)
      paginationInfoContainer.style.visibility = "hidden";
  } else {
    // Show and restore content if data exists
    if (paginationInfoContainer)
      paginationInfoContainer.style.visibility = "visible";

    if (paginationText) {
      paginationText.innerHTML = `
        Halaman
        <span class="font-medium" id="currentPageStat">${state.currentPage}</span> dari
        <span class="font-medium" id="totalPagesStat">${state.totalPages}</span>
       `;
    }
  }
}

// --------------------------
// Data Loading
// --------------------------

async function loadStudents(page = 1, search = "") {
  state.isLoading = true;
  showLoadingSkeleton();

  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "10",
    });

    if (search) {
      params.append("search", search);
    }

    const response = await fetch(`/api/students?${params}`);
    const result = await response.json();

    if (result.success) {
      state.students = result.data.students;
      state.currentPage = result.data.pagination.page;
      state.totalPages = result.data.pagination.totalPages;
      state.total = result.data.pagination.total;

      renderTable(state.students);
      renderPagination(state.currentPage, state.totalPages);
      updateStats();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error("Error loading students:", error);
    notyf.error(error.message || "Gagal memuat data siswa");

    // Show error state
    document.getElementById("studentTableBody").innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-12">
          <div class="text-error">
            <i class="fas fa-exclamation-circle fa-4x mb-4"></i>
            <p class="text-lg">Gagal memuat data</p>
            <button class="btn btn-primary btn-sm mt-4" onclick="loadStudents()">
              <i class="fas fa-refresh mr-1"></i> Coba Lagi
            </button>
          </div>
        </td>
      </tr>
    `;
  } finally {
    state.isLoading = false;
  }
}

function goToPage(page) {
  if (page < 1 || page > state.totalPages) return;
  loadStudents(page, state.searchQuery);
}

// --------------------------
// Modal Functions
// --------------------------

function openAddModal() {
  state.editingId = null;
  clearFieldErrors(); // Reset validation errors
  document.getElementById("modalTitle").textContent = "Tambah Siswa";
  document.getElementById("studentForm").reset();
  document.getElementById("studentId").value = "";
  document.getElementById("photoPreview").src = "/assets/placeholder.svg";
  document.getElementById("nisnInput").disabled = false;
  studentModal.showModal();
}

async function openEditModal(id) {
  state.editingId = id;
  clearFieldErrors(); // Reset validation errors
  document.getElementById("modalTitle").textContent = "Edit Siswa";

  try {
    const response = await fetch(`/api/students/${id}`);
    const result = await response.json();

    if (result.success) {
      const student = result.data;
      document.getElementById("studentId").value = student.id;
      document.getElementById("nisnInput").value = student.nisn;
      document.getElementById("nisnInput").disabled = true; // NISN cannot be changed
      document.getElementById("nameInput").value = student.name;
      document.getElementById("emailInput").value = student.email || "";
      document.getElementById("photoPreview").src =
        student.photoUrl || "/assets/placeholder.svg";

      studentModal.showModal();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    notyf.error(error.message || "Gagal memuat data siswa");
  }
}

function closeStudentModal() {
  studentModal.close();
  state.editingId = null;
}

function openImportModal() {
  const fileInput = document.getElementById("importFileInput");
  const fileNameDisplay = document.getElementById("fileNameDisplay");

  if (fileInput) fileInput.value = "";
  if (fileNameDisplay) fileNameDisplay.textContent = "Format .xlsx atau .xls";

  importModal.showModal();
}

function closeImportModal() {
  importModal.close();
}

function closeDeleteModal() {
  confirmDeleteModal.close();
}

function closeImportResultModal() {
  importResultModal.close();
}

// --------------------------
// CRUD Operations
// --------------------------

// Helper functions for inline validation
function showFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(fieldId.replace("Input", "Error"));
  if (input && errorEl) {
    input.classList.add(
      "border-red-500",
      "focus:border-red-500",
      "focus:ring-red-500",
    );
    input.classList.remove(
      "border-slate-300",
      "focus:border-indigo-500",
      "focus:ring-indigo-100",
    );
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }
}

function clearFieldErrors() {
  ["nisnInput", "nameInput", "emailInput"].forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(fieldId.replace("Input", "Error"));
    if (input && errorEl) {
      input.classList.remove(
        "border-red-500",
        "focus:border-red-500",
        "focus:ring-red-500",
      );
      // Note: Original input styles (input-bordered) handle the default state
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
    }
  });
}

function setupInputValidationClear() {
  ["nisnInput", "nameInput", "emailInput"].forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    if (input) {
      input.addEventListener("input", function () {
        const errorEl = document.getElementById(
          fieldId.replace("Input", "Error"),
        );
        // Remove error styles
        this.classList.remove(
          "border-red-500",
          "focus:border-red-500",
          "focus:ring-red-500",
        );
        this.classList.add("border-slate-300");

        // Hide error message
        if (errorEl) {
          errorEl.classList.add("hidden");
          errorEl.textContent = "";
        }
      });
    }
  });
}

async function submitStudent() {
  const submitBtn = document.getElementById("submitBtn");

  // Clear previous errors
  clearFieldErrors();

  // Client-side validation
  const nisn = document.getElementById("nisnInput").value.trim();
  const name = document.getElementById("nameInput").value.trim();
  const email = document.getElementById("emailInput").value.trim();
  let isValid = true;

  if (!nisn || nisn.length !== 10 || !/^\d+$/.test(nisn)) {
    showFieldError("nisnInput", "NISN harus 10 digit angka");
    isValid = false;
  }

  if (!name || name.length < 3) {
    showFieldError("nameInput", "Nama minimal 3 karakter");
    isValid = false;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError("emailInput", "Format email tidak valid");
    isValid = false;
  }

  if (!isValid) return;

  const formData = new FormData();
  formData.append("nisn", nisn);
  formData.append("name", name);
  if (email) formData.append("email", email);

  const photoInput = document.getElementById("photoInput");
  if (photoInput.files[0]) {
    formData.append("photo", photoInput.files[0]);
  }

  setButtonLoading(submitBtn, true);

  try {
    const isEdit = state.editingId !== null;
    const url = isEdit ? `/api/students/${state.editingId}` : "/api/students";
    const method = isEdit ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      notyf.success(
        result.message ||
          (isEdit
            ? "Data siswa berhasil diperbarui"
            : "Data siswa berhasil disimpan"),
      );
      closeStudentModal();
      loadStudents(state.currentPage, state.searchQuery);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    notyf.error(error.message || "Gagal menyimpan data siswa");
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

function confirmDelete(studentId, studentName, photoUrl) {
  const modal = confirmDeleteModal;
  modal.querySelector(".student-name").textContent = studentName;

  const confirmBtn = modal.querySelector(".btn-confirm-delete");
  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML =
      '<span class="loading loading-spinner loading-sm"></span> Hapus...';

    await deleteStudent(studentId);

    confirmBtn.disabled = false; // Note: Modal closes, so this reset is for next time
    confirmBtn.innerHTML = "Hapus";
    modal.close();
  };

  modal.showModal();
}

async function deleteStudent(id) {
  try {
    const response = await fetch(`/api/students/${id}`, {
      method: "DELETE",
    });
    const result = await response.json();

    if (result.success) {
      notyf.success(result.message || "Data siswa berhasil dihapus");

      // Check current students count to handle pagination adjustment
      const currentRows = document.querySelectorAll(
        "#studentTableBody tr",
      ).length;

      if (currentRows === 1 && state.currentPage > 1) {
        loadStudents(state.currentPage - 1, state.searchQuery);
      } else {
        loadStudents(state.currentPage, state.searchQuery);
      }
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    notyf.error(error.message || "Gagal menghapus data siswa");
  }
}

// --------------------------
// Import/Export
// --------------------------

function downloadTemplate() {
  window.location.href = "/api/import/template";
}

async function importExcel() {
  const importBtn = document.getElementById("importBtn");
  const fileInput = document.getElementById("importFileInput");

  if (!fileInput.files[0]) {
    notyf.error("Pilih file Excel terlebih dahulu");
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  importBtn.disabled = true;
  importBtn.innerHTML =
    '<span class="loading loading-spinner loading-sm"></span> Proses...';

  try {
    const response = await fetch("/api/import", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      closeImportModal();
      loadStudents(1, ""); // Refresh to first page

      // Show import result
      showImportResult(result.data);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    notyf.error(error.message || "Gagal mengimport data");
  } finally {
    importBtn.disabled = false;
    importBtn.innerHTML = "Mulai Import";
  }
}

function showImportResult(data) {
  const content = document.getElementById("importResultContent");

  let html = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <!-- Success Card -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="flex items-center gap-3 mb-1">
            <div class="text-green-600">
                <i class="fas fa-check-circle"></i>
            </div>
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Berhasil</span>
        </div>
        <div class="text-2xl font-bold text-slate-900 mt-2">${data.imported}</div>
        <div class="text-xs text-slate-400 mt-1">Siswa ditambahkan</div>
      </div>

      <!-- Photo Card -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="flex items-center gap-3 mb-1">
            <div class="text-indigo-600">
                <i class="fas fa-camera"></i>
            </div>
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Foto</span>
        </div>
        <div class="text-2xl font-bold text-slate-900 mt-2">${data.photosImported || 0}</div>
        <div class="text-xs text-slate-400 mt-1">Gambar diproses</div>
      </div>

      <!-- Skipped/Error Card -->
      <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div class="flex items-center gap-3 mb-1">
            <div class="text-orange-500">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Dilewati</span>
        </div>
        <div class="text-2xl font-bold text-slate-900 mt-2">${data.errors?.length || 0}</div>
        <div class="text-xs text-slate-400 mt-1">Duplikat / Error</div>
      </div>
    </div>
  `;

  if (data.errors && data.errors.length > 0) {
    html += `
      <div class="border border-slate-200 rounded-lg overflow-hidden">
        <div class="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
            <i class="fas fa-list text-slate-400 text-xs"></i>
            <span class="text-xs font-semibold text-slate-700">Detail Error</span>
        </div>
        <div class="overflow-x-auto max-h-48 overflow-y-auto bg-white">
          <table class="w-full text-left border-collapse">
            <thead class="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th class="py-2 px-4 text-xs font-medium text-slate-500 border-b border-slate-100">Baris</th>
                <th class="py-2 px-4 text-xs font-medium text-slate-500 border-b border-slate-100">NISN</th>
                <th class="py-2 px-4 text-xs font-medium text-slate-500 border-b border-slate-100">Alasan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${data.errors
                .map(
                  (err) => `
                <tr>
                  <td class="py-2 px-4 text-xs text-slate-500 font-mono">${err.row}</td>
                  <td class="py-2 px-4 text-xs"><code class="bg-slate-100 px-1 py-0.5 rounded text-slate-700">${err.nisn}</code></td>
                  <td class="py-2 px-4 text-xs text-red-600">${escapeHtml(err.reason)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  content.innerHTML = html;
  importResultModal.showModal();
}

// --------------------------
// Photo Preview
// --------------------------

function setupPhotoPreview() {
  const photoInput = document.getElementById("photoInput");
  const photoPreview = document.getElementById("photoPreview");

  photoInput.addEventListener("change", function (e) {
    const file = e.target.files[0];

    if (!file) return;

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      notyf.error("Ukuran file terlalu besar. Maksimal 2MB");
      photoInput.value = "";
      return;
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      notyf.error("Format file tidak didukung. Gunakan JPG, JPEG, atau PNG");
      photoInput.value = "";
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = function (e) {
      photoPreview.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// --------------------------
// Search with Debounce
// --------------------------

function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  let searchTimeout;

  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    state.searchQuery = e.target.value;

    // Show skeleton immediately for better UX
    showLoadingSkeleton();

    searchTimeout = setTimeout(() => {
      loadStudents(1, state.searchQuery);
    }, 500);
  });
}

// --------------------------
// Offline Detection
// --------------------------

function setupOfflineDetection() {
  window.addEventListener("offline", () => {
    notyf.open({
      type: "warning",
      message: "Koneksi internet terputus",
    });
  });

  window.addEventListener("online", () => {
    notyf.success("Koneksi internet kembali");
    loadStudents(state.currentPage, state.searchQuery);
  });
}

// --------------------------
// Utility Functions
// --------------------------

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// --------------------------
// Photo Viewer Modal
// --------------------------
const photoModal = document.getElementById("photoModal");
const viewerImage = document.getElementById("viewerImage");

function openPhotoModal(src) {
  // Check if src is valid and not placeholder if desired, but user might want to view placeholder too?
  // Let's allow everything for now, or maybe block placeholder.svg
  if (!src) return;
  viewerImage.src = src;
  photoModal.showModal();
}

function closePhotoModal() {
  photoModal.close();
  setTimeout(() => {
    viewerImage.src = "";
  }, 200);
}

// --------------------------
// Date Widget
// --------------------------

function updateDateWidget() {
  const dayEl = document.getElementById("currentDay");
  const dateEl = document.getElementById("currentDate");

  if (!dayEl || !dateEl) return;

  const now = new Date();
  const days = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];

  dayEl.textContent = days[now.getDay()];
  dateEl.textContent = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

// --------------------------
// Initialization
// --------------------------

document.addEventListener("DOMContentLoaded", () => {
  // Initial load
  loadStudents();
  setupPhotoPreview();
  setupSearch();
  setupOfflineDetection();
  setupInputValidationClear();
  updateDateWidget();
});
