import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";

import "../styles/TeacherDashboard.css";

import schoolHero from "../assets/school-hero.png";
import logoApp from "../assets/logo-app.png";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

const classes = [
  "7A", "7B", "7C", "7D", "7E", "7F", "7G", "7H", "7I", "7J", "7K",
  "8A", "8B", "8C", "8D", "8E", "8F", "8G", "8H", "8I", "8J", "8K",
  "9A", "9B", "9C", "9D", "9E", "9F", "9G", "9H", "9I", "9J", "9K",
];

function TeacherDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const [selectedClass, setSelectedClass] =
    useState("7A");

  const [students, setStudents] = useState([]);

  const [sessionCode, setSessionCode] =
    useState("");

  const [sessionActive, setSessionActive] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [attendanceLoading, setAttendanceLoading] =
    useState(false);

  const [error, setError] = useState("");

  const [permissions, setPermissions] =
    useState([]);

  const [permissionLoading, setPermissionLoading] =
    useState(false);

  const [permissionError, setPermissionError] =
    useState("");

  const [processingPermission, setProcessingPermission] =
    useState(null);

  const [replyInputs, setReplyInputs] =
    useState({});

  // =========================================
  // CHANGE PASSWORD
  // =========================================

  const [passwordModalOpen, setPasswordModalOpen] =
    useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordChanging, setPasswordChanging] =
    useState(false);

  const [passwordError, setPasswordError] =
    useState("");

  const [passwordSuccess, setPasswordSuccess] =
    useState("");

  // =========================================
  // LOAD USER
  // =========================================

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (!token) {
      navigate("/");
      return;
    }

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }

    loadUser(token);
  }, [navigate]);

  const loadUser = async (token) => {
    try {
      const response = await fetch(
        `${API_URL}/api/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Session tidak valid."
        );
      }

      const data = await response.json();

      setUser(data);
      localStorage.setItem(
        "user",
        JSON.stringify(data)
      );
    } catch (err) {
      console.error(err);

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      navigate("/");
    }
  };

  // =========================================
  // LOAD DATA
  // =========================================

  useEffect(() => {
    if (!user) return;

    loadAttendance();
    loadPermissions();
  }, [user, selectedClass]);

  // =========================================
  // LOAD ATTENDANCE
  // =========================================

  const loadAttendance = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    try {
      setAttendanceLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/teacher/attendance/today?class_name=${encodeURIComponent(
          selectedClass
        )}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal mengambil absensi."
        );
      }

      setStudents(data.students || []);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal mengambil absensi."
      );
    } finally {
      setAttendanceLoading(false);
    }
  };

  // =========================================
  // LOAD PERMISSIONS
  // =========================================

  const loadPermissions = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    try {
      setPermissionLoading(true);
      setPermissionError("");

      const response = await fetch(
        `${API_URL}/api/teacher/permissions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal mengambil pengajuan izin."
        );
      }

      setPermissions(
        Array.isArray(data)
          ? data
          : data.permissions ||
            data.data ||
            []
      );
    } catch (err) {
      console.error(err);

      setPermissionError(
        err.message ||
          "Gagal mengambil pengajuan izin."
      );
    } finally {
      setPermissionLoading(false);
    }
  };

  // =========================================
  // PROCESS PERMISSION
  // =========================================

  const processPermission = async (permission) => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    const permissionId =
      permission.id || permission._id;

    if (!permissionId) {
      setPermissionError(
        "ID pengajuan izin tidak ditemukan."
      );
      return;
    }

    const status =
      permission.actionStatus;

    if (
      status !== "approved" &&
      status !== "rejected"
    ) {
      return;
    }

    try {
      setProcessingPermission(
        permissionId
      );

      setPermissionError("");

      const teacherReply =
        replyInputs[permissionId] || "";

      const response = await fetch(
        `${API_URL}/api/teacher/permissions/${encodeURIComponent(
          permissionId
        )}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            teacher_reply:
              teacherReply.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal memproses izin."
        );
      }

      setReplyInputs((current) => {
        const updated = {
          ...current,
        };

        delete updated[permissionId];

        return updated;
      });

      await loadPermissions();
    } catch (err) {
      console.error(err);

      setPermissionError(
        err.message ||
          "Gagal memproses izin."
      );
    } finally {
      setProcessingPermission(null);
    }
  };

  // =========================================
  // START SESSION
  // =========================================

  const startSession = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/teacher/attendance/session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            class_name: selectedClass,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal membuat sesi absensi."
        );
      }

      setSessionCode(data.session_code);
      setSessionActive(true);

      await loadAttendance();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal membuat sesi absensi."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================
  // STOP SESSION
  // =========================================

  const stopSession = async () => {
    const token = localStorage.getItem("token");

    if (!token || !sessionCode) return;

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/teacher/attendance/session/${encodeURIComponent(
          sessionCode
        )}/stop`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal menghentikan sesi."
        );
      }

      setSessionActive(false);
      setSessionCode("");

      await loadAttendance();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal menghentikan sesi."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================
  // CHANGE PASSWORD
  // =========================================

  const openPasswordModal = () => {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    setPasswordError("");
    setPasswordSuccess("");
    setPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (passwordChanging) return;

    setPasswordModalOpen(false);

    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    setPasswordError("");
    setPasswordSuccess("");
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    setPasswordError("");
    setPasswordSuccess("");

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    const currentPassword =
      passwordForm.currentPassword.trim();

    const newPassword =
      passwordForm.newPassword;

    const confirmPassword =
      passwordForm.confirmPassword;

    if (!currentPassword) {
      setPasswordError(
        "Password saat ini wajib diisi."
      );
      return;
    }

    if (!newPassword) {
      setPasswordError(
        "Password baru wajib diisi."
      );
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(
        "Password baru minimal 6 karakter."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        "Konfirmasi password tidak cocok."
      );
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        "Password baru harus berbeda dari password saat ini."
      );
      return;
    }

    try {
      setPasswordChanging(true);

      const response = await fetch(
        `${API_URL}/api/auth/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            current_password:
              currentPassword,
            new_password: newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal mengganti password."
        );
      }

      setPasswordSuccess(
        "Password berhasil diganti."
      );

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      console.error(err);

      setPasswordError(
        err.message ||
          "Gagal mengganti password."
      );
    } finally {
      setPasswordChanging(false);
    }
  };

  // =========================================
  // NAVIGATION
  // =========================================

  const openAttendanceRecap = () => {
    navigate("/attendance-recap");
  };

  // =========================================
  // LOGOUT
  // =========================================

  const handleLogout = async () => {
    if (sessionActive) {
      try {
        await stopSession();
      } catch (err) {
        console.error(err);
      }
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/");
  };

  // =========================================
  // LOADING
  // =========================================

  if (!user) {
    return (
      <div className="teacher-page">
        <div className="teacher-loading-screen">
          <div className="teacher-loading-spinner" />
          <span>Memuat dashboard...</span>
        </div>
      </div>
    );
  }

  // =========================================
  // STATS
  // =========================================

  const hadirCount =
    students.filter(
      (student) =>
        student.status === "hadir"
    ).length;

  const belumAbsenCount =
    students.length - hadirCount;

  const pendingPermissions =
    permissions.filter(
      (permission) =>
        String(
          permission.status || "pending"
        ).toLowerCase() === "pending"
    ).length;

  const attendancePercentage =
    students.length > 0
      ? Math.round(
          (hadirCount / students.length) *
            100
        )
      : 0;

  const qrValue = JSON.stringify({
    type: "attendance",
    session_code: sessionCode,
  });

  return (
    <div className="teacher-page">
      <div className="teacher-container">

        {/* HERO */}

        <section className="teacher-hero">

          <img
            src={schoolHero}
            alt=""
            className="teacher-hero-image"
          />

          <div className="teacher-hero-overlay" />

          <div className="teacher-hero-content">

            <div className="teacher-brand">

              <div className="teacher-brand-logo">
                <img
                  src={logoApp}
                  alt="Logo"
                />
              </div>

              <span>
                ABSENSI SEKOLAH
              </span>

            </div>

            <span className="teacher-hero-badge">
              <i />
              TEACHER DASHBOARD
            </span>

            <p className="teacher-hero-greeting">
              Selamat datang kembali
            </p>

            <h1>
              {user.name || "Guru"}
            </h1>

            <p className="teacher-hero-description">
              Kelola sesi absensi, kehadiran siswa,
              dan pengajuan izin dari satu tempat.
            </p>

            <div className="teacher-hero-meta">

              <div>
                <span>Role</span>
                <strong>Guru</strong>
              </div>

              <div className="teacher-meta-divider" />

              <div>
                <span>Kelas Aktif</span>
                <strong>
                  {selectedClass}
                </strong>
              </div>

            </div>

          </div>

          <div className="teacher-hero-status">

            <span>
              Status Sesi
            </span>

            <strong
              className={
                sessionActive
                  ? "active"
                  : "inactive"
              }
            >
              <i />
              {sessionActive
                ? "Absensi Aktif"
                : "Tidak Aktif"}
            </strong>

            <small>
              {sessionActive
                ? `Kelas ${selectedClass}`
                : `Kehadiran ${attendancePercentage}%`}
            </small>

          </div>

          <button
            type="button"
            className="teacher-hero-logout"
            onClick={handleLogout}
          >
            Keluar
          </button>

        </section>

        {/* STATS */}

        <section className="teacher-stats">

          <div className="teacher-stat-card">

            <div className="teacher-stat-icon">
              {students.length}
            </div>

            <div>
              <span>Total Siswa</span>
              <strong>
                {students.length} siswa
              </strong>
            </div>

          </div>

          <div className="teacher-stat-card">

            <div className="teacher-stat-icon blue">
              {hadirCount}
            </div>

            <div>
              <span>Sudah Hadir</span>
              <strong>
                {hadirCount} siswa
              </strong>
            </div>

          </div>

          <div className="teacher-stat-card">

            <div className="teacher-stat-icon orange">
              {belumAbsenCount}
            </div>

            <div>
              <span>Belum Absen</span>
              <strong>
                {belumAbsenCount} siswa
              </strong>
            </div>

          </div>

          <div className="teacher-stat-card">

            <div className="teacher-stat-icon purple">
              {pendingPermissions}
            </div>

            <div>
              <span>Izin Menunggu</span>
              <strong>
                {pendingPermissions} pengajuan
              </strong>
            </div>

          </div>

        </section>

        {/* ERROR */}

        {(error || permissionError) && (
          <div className="teacher-alert">

            <div className="teacher-alert-icon">
              !
            </div>

            <div>
              <strong>
                Terjadi kesalahan
              </strong>

              <span>
                {error || permissionError}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setError("");
                setPermissionError("");
              }}
            >
              ×
            </button>

          </div>
        )}

        {/* QR ATTENDANCE */}

        <section className="teacher-card">

          <div className="teacher-section-header">

            <div>
              <span className="teacher-section-label">
                ABSENSI
              </span>

              <h2>
                QR Absensi
              </h2>

              <p>
                Pilih kelas dan mulai sesi absensi
                untuk siswa.
              </p>
            </div>

            <span className="teacher-section-number">
              01
            </span>

          </div>

          <div className="teacher-class-selector">

            <label>
              <span>Kelas</span>

              <select
                value={selectedClass}
                onChange={(event) => {
                  if (sessionActive) return;

                  setSelectedClass(
                    event.target.value
                  );
                }}
                disabled={sessionActive}
              >
                {classes.map((className) => (
                  <option
                    key={className}
                    value={className}
                  >
                    Kelas {className}
                  </option>
                ))}
              </select>
            </label>

            <span>
              {sessionActive
                ? "Kelas tidak dapat diubah selama sesi aktif."
                : "Pilih kelas sebelum membuat sesi."}
            </span>

          </div>

          {!sessionActive ? (
            <div className="teacher-qr-start">

              <div className="teacher-qr-placeholder">

                <div className="teacher-qr-icon">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <strong>
                  Siap membuat QR
                </strong>

                <p>
                  QR akan digunakan siswa untuk
                  melakukan absensi.
                </p>

              </div>

              <button
                type="button"
                className="teacher-primary-button"
                onClick={startSession}
                disabled={loading}
              >
                {loading
                  ? "Membuat sesi..."
                  : `Mulai Absensi Kelas ${selectedClass}`}
              </button>

            </div>
          ) : (
            <div className="teacher-qr-active">

              <div className="teacher-qr-box">
                <QRCodeSVG
                  value={qrValue}
                  size={260}
                  level="M"
                />
              </div>

              <div className="teacher-qr-info">

                <span className="teacher-active-badge">
                  <i />
                  Sesi aktif
                </span>

                <strong>
                  Kelas {selectedClass}
                </strong>

                <p>
                  Tampilkan QR ini kepada siswa
                  untuk melakukan absensi.
                </p>

                <button
                  type="button"
                  className="teacher-stop-button"
                  onClick={stopSession}
                  disabled={loading}
                >
                  {loading
                    ? "Menghentikan..."
                    : "Hentikan Sesi"}
                </button>

              </div>

            </div>
          )}

        </section>

        {/* ATTENDANCE */}

        <section className="teacher-card">

          <div className="teacher-section-header">

            <div>
              <span className="teacher-section-label">
                KEHADIRAN
              </span>

              <h2>
                Absensi Hari Ini
              </h2>

              <p>
                Rekap kehadiran siswa kelas{" "}
                {selectedClass}.
              </p>
            </div>

            <span className="teacher-section-number">
              02
            </span>

          </div>

          <div className="teacher-attendance-summary">

            <div>
              <span>Total Siswa</span>
              <strong>
                {students.length}
              </strong>
            </div>

            <div className="present">
              <span>Hadir</span>
              <strong>
                {hadirCount}
              </strong>
            </div>

            <div className="absent">
              <span>Belum Absen</span>
              <strong>
                {belumAbsenCount}
              </strong>
            </div>

          </div>

          <div className="teacher-list-header">

            <span>
              Daftar siswa
            </span>

            <button
              type="button"
              onClick={loadAttendance}
              disabled={attendanceLoading}
            >
              {attendanceLoading
                ? "Memuat..."
                : "Refresh"}
            </button>

          </div>

          {attendanceLoading ? (
            <div className="teacher-loading-box">
              <div className="teacher-loading-spinner" />
              Memuat data siswa...
            </div>
          ) : students.length === 0 ? (
            <div className="teacher-empty">
              <strong>
                Belum ada data siswa
              </strong>

              <span>
                Belum ada siswa di kelas{" "}
                {selectedClass}.
              </span>
            </div>
          ) : (
            <div className="teacher-table-wrapper">

              <table className="teacher-table">

                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama</th>
                    <th>NIS</th>
                    <th>Status</th>
                    <th>Waktu</th>
                  </tr>
                </thead>

                <tbody>
                  {students.map(
                    (student, index) => (
                      <tr
                        key={
                          student.student_id ||
                          student.id ||
                          index
                        }
                      >

                        <td>
                          {String(
                            index + 1
                          ).padStart(2, "0")}
                        </td>

                        <td>
                          <strong>
                            {student.name}
                          </strong>
                        </td>

                        <td>
                          {student.nis}
                        </td>

                        <td>
                          <span
                            className={`teacher-status ${student.status}`}
                          >
                            <i />

                            {student.status ===
                            "hadir"
                              ? "Hadir"
                              : "Belum Absen"}
                          </span>
                        </td>

                        <td>
                          {student.time || "-"}
                        </td>

                      </tr>
                    )
                  )}
                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* PERMISSION */}

        <section className="teacher-card">

          <div className="teacher-section-header">

            <div>
              <span className="teacher-section-label">
                PERIZINAN
              </span>

              <h2>
                Pengajuan Izin Siswa
              </h2>

              <p>
                Periksa dan kelola pengajuan izin
                dari siswa.
              </p>
            </div>

            <span className="teacher-section-number">
              03
            </span>

          </div>

          <div className="teacher-list-header">

            <span>
              Daftar pengajuan
            </span>

            <button
              type="button"
              onClick={loadPermissions}
              disabled={permissionLoading}
            >
              {permissionLoading
                ? "Memuat..."
                : "Refresh"}
            </button>

          </div>

          {permissionLoading ? (
            <div className="teacher-loading-box">
              <div className="teacher-loading-spinner" />
              Memuat pengajuan izin...
            </div>
          ) : permissions.length === 0 ? (
            <div className="teacher-empty">
              <strong>
                Belum ada pengajuan izin
              </strong>

              <span>
                Pengajuan izin siswa akan muncul
                di sini.
              </span>
            </div>
          ) : (
            <div className="teacher-permission-list">

              {permissions.map(
                (permission, index) => {
                  const permissionId =
                    permission.id ||
                    permission._id ||
                    index;

                  const status =
                    String(
                      permission.status ||
                        "pending"
                    ).toLowerCase();

                  const reply =
                    replyInputs[
                      permissionId
                    ] ?? "";

                  const isProcessing =
                    processingPermission ===
                    permissionId;

                  return (
                    <article
                      className="teacher-permission-item"
                      key={permissionId}
                    >

                      <div className="teacher-permission-top">

                        <div>
                          <span>
                            PENGAJUAN{" "}
                            {String(
                              index + 1
                            ).padStart(2, "0")}
                          </span>

                          <h3>
                            {permission.student_name ||
                              permission.name ||
                              "Siswa"}
                          </h3>

                          <p>
                            NIS{" "}
                            {permission.nis ||
                              "-"}
                            {" · "}
                            Kelas{" "}
                            {permission.class_name ||
                              "-"}
                          </p>
                        </div>

                        <span
                          className={`teacher-permission-status ${status}`}
                        >
                          <i />

                          {status ===
                          "approved"
                            ? "Disetujui"
                            : status ===
                              "rejected"
                            ? "Ditolak"
                            : "Menunggu"}
                        </span>

                      </div>

                      <div className="teacher-permission-detail">

                        <div>
                          <span>Tanggal</span>
                          <strong>
                            {permission.date ||
                              "-"}
                          </strong>
                        </div>

                        <div>
                          <span>Alasan</span>
                          <strong>
                            {permission.reason ||
                              "-"}
                          </strong>
                        </div>

                        <div className="full">
                          <span>
                            Keterangan
                          </span>

                          <p>
                            {permission.description ||
                              "-"}
                          </p>
                        </div>

                      </div>

                      {status === "pending" ? (
                        <div className="teacher-permission-action">

                          <label>
                            Balasan Guru
                          </label>

                          <textarea
                            rows={3}
                            placeholder="Tulis balasan untuk siswa..."
                            value={reply}
                            onChange={(event) =>
                              setReplyInputs(
                                (current) => ({
                                  ...current,
                                  [permissionId]:
                                    event.target
                                      .value,
                                })
                              )
                            }
                          />

                          <div>

                            <button
                              type="button"
                              className="teacher-approve-button"
                              disabled={
                                isProcessing
                              }
                              onClick={() =>
                                processPermission({
                                  ...permission,
                                  actionStatus:
                                    "approved",
                                })
                              }
                            >
                              {isProcessing
                                ? "Memproses..."
                                : "Setujui"}
                            </button>

                            <button
                              type="button"
                              className="teacher-reject-button"
                              disabled={
                                isProcessing
                              }
                              onClick={() =>
                                processPermission({
                                  ...permission,
                                  actionStatus:
                                    "rejected",
                                })
                              }
                            >
                              {isProcessing
                                ? "Memproses..."
                                : "Tolak"}
                            </button>

                          </div>

                        </div>
                      ) : (
                        <div className="teacher-permission-reply">

                          <strong>
                            Balasan Guru
                          </strong>

                          <p>
                            {permission.teacher_reply ||
                              "Tidak ada balasan."}
                          </p>

                        </div>
                      )}

                    </article>
                  );
                }
              )}

            </div>
          )}

        </section>

        {/* RECAP */}

        <section className="teacher-card">

          <div className="teacher-section-header">

            <div>
              <span className="teacher-section-label">
                REKAP
              </span>

              <h2>
                Rekap Absensi
              </h2>

              <p>
                Lihat rangkuman data kehadiran
                secara lebih lengkap.
              </p>
            </div>

            <span className="teacher-section-number">
              04
            </span>

          </div>

          <button
            type="button"
            className="teacher-primary-button"
            onClick={openAttendanceRecap}
          >
            Lihat Rekap Absensi
          </button>

        </section>

        {/* SECURITY */}

        <section className="teacher-card">

          <div className="teacher-section-header">

            <div>
              <span className="teacher-section-label">
                KEAMANAN
              </span>

              <h2>
                Keamanan Akun
              </h2>

              <p>
                Ganti password secara berkala untuk
                menjaga keamanan akun guru.
              </p>
            </div>

            <span className="teacher-section-number">
              05
            </span>

          </div>

          <button
            type="button"
            className="teacher-primary-button"
            onClick={openPasswordModal}
          >
            Ganti Password
          </button>

        </section>

        {/* PASSWORD MODAL */}

        {passwordModalOpen && (
          <div
            className="teacher-modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                  event.currentTarget &&
                !passwordChanging
              ) {
                closePasswordModal();
              }
            }}
          >

            <div className="teacher-modal">

              <div className="teacher-modal-header">

                <div>
                  <span>
                    KEAMANAN AKUN
                  </span>

                  <h2>
                    Ganti Password
                  </h2>

                  <p>
                    Masukkan password lama dan
                    password baru kamu.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closePasswordModal}
                  disabled={passwordChanging}
                  aria-label="Tutup"
                >
                  ×
                </button>

              </div>

              <form
                className="teacher-password-form"
                onSubmit={handleChangePassword}
              >

                <label>
                  <span>
                    Password Saat Ini
                  </span>

                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Masukkan password saat ini"
                    value={
                      passwordForm.currentPassword
                    }
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        currentPassword:
                          event.target.value,
                      })
                    }
                    disabled={passwordChanging}
                  />
                </label>

                <label>
                  <span>
                    Password Baru
                  </span>

                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Minimal 6 karakter"
                    value={
                      passwordForm.newPassword
                    }
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPassword:
                          event.target.value,
                      })
                    }
                    disabled={passwordChanging}
                  />
                </label>

                <label>
                  <span>
                    Konfirmasi Password Baru
                  </span>

                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Ulangi password baru"
                    value={
                      passwordForm.confirmPassword
                    }
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmPassword:
                          event.target.value,
                      })
                    }
                    disabled={passwordChanging}
                  />
                </label>

                {passwordError && (
                  <div className="teacher-password-message error">

                    <strong>
                      Gagal mengganti password
                    </strong>

                    <span>
                      {passwordError}
                    </span>

                  </div>
                )}

                {passwordSuccess && (
                  <div className="teacher-password-message success">

                    <strong>
                      Berhasil
                    </strong>

                    <span>
                      {passwordSuccess}
                    </span>

                  </div>
                )}

                <div className="teacher-modal-footer">

                  <span>
                    Gunakan password yang sulit ditebak.
                  </span>

                  <div>

                    <button
                      type="button"
                      className="teacher-secondary-button"
                      onClick={closePasswordModal}
                      disabled={passwordChanging}
                    >
                      Batal
                    </button>

                    <button
                      type="submit"
                      className="teacher-primary-button"
                      disabled={passwordChanging}
                    >
                      {passwordChanging
                        ? "Menyimpan..."
                        : "Simpan Password"}
                    </button>

                  </div>

                </div>

              </form>

            </div>

          </div>
        )}

        {/* FOOTER */}

        <footer className="teacher-footer">

          <div>
            <strong>
              Absensi Sekolah
            </strong>

            <span>
              Teacher Dashboard
            </span>
          </div>

          <span>
            Sistem Kehadiran Digital
          </span>

        </footer>

      </div>
    </div>
  );
}

export default TeacherDashboard;