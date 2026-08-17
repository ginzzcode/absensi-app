import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import "../styles/StudentDashboard.css";

import schoolHero from "../assets/school-hero.png";
import logoApp from "../assets/logo-app.png";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function StudentDashboard() {
  const navigate = useNavigate();
  const openAttendanceRecap = () => {
  navigate("/attendance-recap");
};
  const scannerRef = useRef(null);

  const [user, setUser] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [scanning, setScanning] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [permissions, setPermissions] = useState([]);
  const [permissionLoading, setPermissionLoading] = useState(true);

  const [permissionForm, setPermissionForm] = useState({
    date: "",
    reason: "Sakit",
    description: "",
  });

  const [permissionSubmitting, setPermissionSubmitting] =
    useState(false);

  const [permissionModalOpen, setPermissionModalOpen] =
    useState(false);

  const [showPasswordModal, setShowPasswordModal] =
    useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // =========================================================
  // AUTH
  // =========================================================

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    loadUser(token);
  }, [navigate]);

  const loadUser = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Session tidak valid.");
      }

      const data = await response.json();

      setUser(data);
      localStorage.setItem("user", JSON.stringify(data));
    } catch (err) {
      console.error(err);

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      navigate("/login");
    }
  };

  // =========================================================
  // LOAD DATA
  // =========================================================

  useEffect(() => {
    if (!user) return;

    loadAttendanceHistory();
    loadPermissions();
  }, [user]);

  const loadAttendanceHistory = async () => {
    setHistoryLoading(true);

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/student/attendance/history`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Gagal mengambil riwayat absensi."
        );
      }

      setAttendanceHistory(
        Array.isArray(data) ? data : data.history || []
      );
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadPermissions = async () => {
    setPermissionLoading(true);

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/student/permissions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Gagal mengambil data izin."
        );
      }

      setPermissions(
        Array.isArray(data) ? data : data.permissions || []
      );
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setPermissionLoading(false);
    }
  };

  // =========================================================
  // PERMISSION
  // =========================================================

  const submitPermission = async (event) => {
    event.preventDefault();

    setPermissionSubmitting(true);
    setMessage("");
    setError("");

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/student/permissions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(permissionForm),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Gagal mengajukan izin."
        );
      }

      setMessage("Pengajuan izin berhasil dikirim.");

      setPermissionForm({
        date: "",
        reason: "Sakit",
        description: "",
      });

      setPermissionModalOpen(false);

      await loadPermissions();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setPermissionSubmitting(false);
    }
  };

  // =========================================================
  // QR SCANNER
  // =========================================================

  const startScanner = async () => {
    setMessage("");
    setError("");

    try {
      const scanner = new Html5Qrcode("student-qr-reader");

      scannerRef.current = scanner;

      await scanner.start(
        {
          facingMode: "environment",
        },
        {
          fps: 10,
          qrbox: {
            width: 220,
            height: 220,
          },
        },
        handleQrResult,
        () => {}
      );

      setScanning(true);
    } catch (err) {
      console.error(err);

      scannerRef.current = null;

      setError(
        "Kamera tidak dapat digunakan. Pastikan izin kamera sudah diberikan."
      );
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();

        scannerRef.current = null;
      }
    } catch (err) {
      console.error(err);
    }

    setScanning(false);
  };

  const handleQrResult = async (decodedText) => {
    if (!decodedText) return;

    await stopScanner();

    setMessage("QR berhasil dipindai.");
    setError("");

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/student/attendance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            qr_token: decodedText,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Gagal melakukan absensi."
        );
      }

      setMessage(data.message || "Absensi berhasil.");

      await loadAttendanceHistory();
    } catch (err) {
      console.error(err);

      setMessage("");
      setError(err.message);
    }
  };

  // =========================================================
  // PASSWORD
  // =========================================================

  const openPasswordModal = () => {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    setPasswordError("");
    setPasswordSuccess("");
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    if (passwordChanging) return;

    setShowPasswordModal(false);

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

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    setPasswordError("");
    setPasswordSuccess("");

    const currentPassword =
      passwordForm.currentPassword.trim();

    const newPassword = passwordForm.newPassword;
    const confirmPassword = passwordForm.confirmPassword;

    if (!currentPassword) {
      setPasswordError("Password saat ini wajib diisi.");
      return;
    }

    if (!newPassword) {
      setPasswordError("Password baru wajib diisi.");
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
            current_password: currentPassword,
            new_password: newPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Gagal mengganti password."
        );
      }

      setPasswordSuccess("Password berhasil diganti.");

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      console.error(err);

      setPasswordError(
        err.message || "Gagal mengganti password."
      );
    } finally {
      setPasswordChanging(false);
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    await stopScanner();

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login");
  };

  // =========================================================
  // HELPERS
  // =========================================================

  const getPermissionStatus = (status) => {
    const normalized = String(
      status || "pending"
    ).toLowerCase();

    if (
      normalized === "approved" ||
      normalized === "disetujui"
    ) {
      return {
        label: "Disetujui",
        className: "approved",
      };
    }

    if (
      normalized === "rejected" ||
      normalized === "ditolak"
    ) {
      return {
        label: "Ditolak",
        className: "rejected",
      };
    }

    return {
      label: "Menunggu",
      className: "pending",
    };
  };

  const presentCount = attendanceHistory.filter((item) => {
    const status = String(
      item.status || item.attendance_status || ""
    ).toLowerCase();

    return status === "hadir";
  }).length;

  const totalAttendance = attendanceHistory.length;

  const attendancePercentage =
    totalAttendance > 0
      ? Math.round(
          (presentCount / totalAttendance) * 100
        )
      : 0;

  // =========================================================
  // LOADING
  // =========================================================

  if (!user) {
    return (
      <div className="student-page">
        <div className="student-container">
          <div className="loading-state">
            <div className="loading-spinner" />
            <span>Memuat dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="student-page">
      <div className="student-container">

        {/* HERO */}
        <section className="student-hero">
          <div
            className="hero-background"
            style={{
              backgroundImage: `url(${schoolHero})`,
            }}
          />

          <div className="hero-overlay" />

          <button
            type="button"
            className="hero-logout"
            onClick={handleLogout}
          >
            Keluar
          </button>

          <div className="hero-content">
            <div className="hero-brand">
              <img
                src={logoApp}
                alt="Logo aplikasi"
                className="hero-logo"
              />

              <span className="hero-brand-text">
                ABSENSI SEKOLAH
              </span>
            </div>

            <div className="hero-badge">
              <span className="hero-badge-dot" />
              STUDENT DASHBOARD
            </div>

            <p className="hero-greeting">
              Selamat datang kembali,
            </p>

            <h1>
              {user.name ||
                user.full_name ||
                "Siswa"}
            </h1>

            <p className="hero-description">
              Kelola absensi, lihat riwayat kehadiran,
              ajukan izin, dan kelola keamanan akun kamu.
            </p>

            <div className="hero-meta">
              <div className="hero-meta-item">
                <span>NIS</span>
                <strong>{user.nis || "-"}</strong>
              </div>

              <div className="hero-meta-divider" />

              <div className="hero-meta-item">
                <span>Kelas</span>
                <strong>
                  {user.class_name ||
                    user.className ||
                    "-"}
                </strong>
              </div>
            </div>
          </div>

          <div className="hero-status-card">
            <span className="hero-status-label">
              Status Kehadiran
            </span>

            <strong className="hero-status-value">
              <i className="status-dot" />

              {presentCount > 0
                ? "Aktif"
                : "Belum Ada Data"}
            </strong>

            <span className="hero-status-time">
              Kehadiran: {attendancePercentage}%
            </span>
          </div>
        </section>

        {/* STATS */}
        <section className="student-stats">
          <div className="stat-card">
            <div className="stat-icon">✓</div>

            <div className="stat-content">
              <span>Total Hadir</span>
              <strong>{presentCount}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-blue">#</div>

            <div className="stat-content">
              <span>Total Absensi</span>
              <strong>{totalAttendance}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-orange">%</div>

            <div className="stat-content">
              <span>Persentase</span>
              <strong>{attendancePercentage}%</strong>
            </div>
          </div>
        </section>

        {/* ALERT */}
        {message && (
          <div className="student-alert success">
            <div className="alert-icon">✓</div>

            <div>
              <strong>Berhasil</strong>
              <span>{message}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="student-alert error">
            <div className="alert-icon">!</div>

            <div>
              <strong>Terjadi kesalahan</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* QR SCANNER */}
        <section className="student-card scanner-card">
          <div className="section-header">
            <div>
              <span className="section-label">
                ABSENSI
              </span>

              <h2>Scan QR Kehadiran</h2>

              <p>
                Scan QR yang diberikan guru untuk
                mencatat kehadiran kamu.
              </p>
            </div>

            <span className="section-number">01</span>
          </div>

          <div
            className={`scanner-wrapper ${
              scanning ? "active" : ""
            }`}
          >
            {!scanning && (
              <div className="scanner-placeholder">
                <div className="scanner-placeholder-icon">
                  <div className="scanner-corners">
                    <span />
                    <span />
                    <span />
                    <span />

                    <div className="scanner-center-dot" />
                  </div>
                </div>

                <strong>
                  Kamera siap digunakan
                </strong>

                <p>
                  Tekan tombol di bawah untuk
                  membuka kamera dan scan QR.
                </p>
              </div>
            )}

            <div
              id="student-qr-reader"
              className="student-qr-reader"
            />
          </div>

          <div className="scanner-footer">
            <div className="scanner-tip">
              <span className="tip-dot" />
              Pastikan QR terlihat jelas di kamera.
            </div>

            {!scanning ? (
              <button
                type="button"
                className="primary-button"
                onClick={startScanner}
              >
                <span className="button-icon">
                  QR
                </span>

                Mulai Scan
              </button>
            ) : (
              <button
                type="button"
                className="secondary-button"
                onClick={stopScanner}
              >
                Berhenti Scan
              </button>
            )}
          </div>
        </section>

        {/* PROFILE */}
        <section className="student-card">
          <div className="section-header">
            <div>
              <span className="section-label">
                PROFIL
              </span>

              <h2>Informasi Siswa</h2>

              <p>
                Informasi akun siswa yang sedang
                digunakan.
              </p>
            </div>

            <span className="section-number">02</span>
          </div>

          <div className="student-info-grid">
            <div className="info-item">
              <span>Nama</span>

              <strong>
                {user.name ||
                  user.full_name ||
                  "-"}
              </strong>
            </div>

            <div className="info-item">
              <span>NIS</span>

              <strong>{user.nis || "-"}</strong>
            </div>

            <div className="info-item">
              <span>Kelas</span>

              <strong>
                {user.class_name ||
                  user.className ||
                  "-"}
              </strong>
            </div>

            <div className="info-item status-info is-present">
              <span>Status</span>

              <strong>
                <i />
                Aktif
              </strong>
            </div>
          </div>
        </section>

        {/* PERMISSION HISTORY */}
        <section className="student-card">
          <div className="section-header">
            <div>
              <span className="section-label">
                PERIZINAN
              </span>

              <h2>Riwayat Izin</h2>

              <p>
                Pantau pengajuan izin yang pernah
                kamu kirim.
              </p>
            </div>

            <span className="section-number">03</span>
          </div>

          {permissionLoading ? (
            <div className="loading-state">
              <div className="loading-spinner" />

              <span>
                Memuat riwayat izin...
              </span>
            </div>
          ) : permissions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">—</div>

              <strong>
                Belum ada pengajuan izin
              </strong>

              <span>
                Pengajuan izin kamu akan muncul
                di sini.
              </span>
            </div>
          ) : (
            <div className="permission-list">
              {permissions.map(
                (permission, index) => {
                  const status =
                    getPermissionStatus(
                      permission.status
                    );

                  return (
                    <div
                      className="permission-item"
                      key={
                        permission.id ||
                        permission._id ||
                        index
                      }
                    >
                      <div className="permission-top">
                        <div className="permission-date">
                          <strong>
                            {permission.date || "-"}
                          </strong>

                          <span>
                            {permission.reason ||
                              "Pengajuan izin"}
                          </span>
                        </div>

                        <span
                          className={`permission-status ${status.className}`}
                        >
                          <i />
                          {status.label}
                        </span>
                      </div>

                      <p>
                        {permission.description ||
                          "Tidak ada keterangan."}
                      </p>

                      {permission.teacher_reply && (
                        <div className="teacher-reply">
                          <div className="reply-heading">
                            <span>
                              Balasan Guru
                            </span>
                          </div>

                          <p>
                            {permission.teacher_reply}
                          </p>

                          {permission.replied_at && (
                            <small>
                              {permission.replied_at}
                            </small>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* ATTENDANCE HISTORY */}
        <section className="student-card">
          <div className="section-header">
            <div>
              <span className="section-label">
                RIWAYAT
              </span>

              <h2>Riwayat Kehadiran</h2>

              <p>
                Daftar kehadiran yang tercatat pada
                akun kamu.
              </p>
            </div>

            <span className="section-number">04</span>
          </div>

          {historyLoading ? (
            <div className="loading-state">
              <div className="loading-spinner" />

              <span>
                Memuat riwayat kehadiran...
              </span>
            </div>
          ) : attendanceHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">—</div>

              <strong>Belum ada riwayat</strong>

              <span>
                Data kehadiran akan muncul setelah
                kamu melakukan absensi.
              </span>
            </div>
          ) : (
            <div className="attendance-history">
              {attendanceHistory.map(
                (item, index) => (
                  <div
                    className="attendance-item"
                    key={
                      item.id ||
                      item._id ||
                      index
                    }
                  >
                    <div className="attendance-date">
                      <strong>
                        {item.date ||
                          item.attendance_date ||
                          "-"}
                      </strong>

                      <span>
                        {item.time ||
                          item.attendance_time ||
                          "-"}
                      </span>
                    </div>

                    <div className="attendance-detail">
                      <strong>
                        Kehadiran
                      </strong>

                      <span>
                        {item.class_name ||
                          user.class_name ||
                          "-"}
                      </span>
                    </div>

                    <span className="attendance-status hadir">
                      <i />

                      {item.status ||
                        item.attendance_status ||
                        "Hadir"}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* PERMISSION ACTION */}
        <section className="permission-action-card">
          <div className="permission-action-content">
            <div>
              <span className="permission-action-label">
                BUTUH IZIN?
              </span>

              <h2>
                Ajukan izin ketidakhadiran
              </h2>

              <p>
                Isi formulir pengajuan izin dan
                tunggu persetujuan dari guru.
              </p>
            </div>

            <button
              type="button"
              className="permission-open-button"
              onClick={() =>
                setPermissionModalOpen(true)
              }
            >
              Ajukan Izin
            </button>
          </div>
        </section>

        {/* ATTENDANCE RECAP */}

<section className="student-card">

  <div className="section-header">

    <div>
      <span className="section-label">
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

    <span className="section-number">
      05
    </span>

  </div>

  <button
    type="button"
    className="primary-button"
    onClick={openAttendanceRecap}
  >
    Lihat Rekap Absensi
  </button>

</section>

        {/* ACCOUNT SECURITY */}
        <section className="student-card account-security-card">
          <div className="section-header">
            <div>
              <span className="section-label">
                AKUN
              </span>

              <h2>Keamanan Akun</h2>

              <p>
                Kelola password untuk menjaga
                keamanan akun siswa kamu.
              </p>
            </div>

            <span className="section-number">05</span>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={openPasswordModal}
          >
            Ganti Password
          </button>
        </section>

        {/* PERMISSION MODAL */}
        {permissionModalOpen && (
          <div
            className="permission-modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                !permissionSubmitting
              ) {
                setPermissionModalOpen(false);
              }
            }}
          >
            <div
              className="permission-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="permission-modal-title"
            >
              <div className="permission-modal-header">
                <div>
                  <span className="permission-modal-label">
                    PENGAJUAN
                  </span>

                  <h2 id="permission-modal-title">
                    Ajukan Izin
                  </h2>

                  <p>
                    Lengkapi informasi berikut
                    untuk mengajukan izin
                    ketidakhadiran.
                  </p>
                </div>

                <button
                  type="button"
                  className="permission-modal-close"
                  onClick={() =>
                    !permissionSubmitting &&
                    setPermissionModalOpen(false)
                  }
                  disabled={permissionSubmitting}
                  aria-label="Tutup"
                >
                  ×
                </button>
              </div>

              <form
                className="permission-form"
                onSubmit={submitPermission}
              >
                <div className="form-row">
                  <label>
                    <span>Tanggal</span>

                    <input
                      type="date"
                      value={permissionForm.date}
                      onChange={(event) =>
                        setPermissionForm(
                          (current) => ({
                            ...current,
                            date: event.target.value,
                          })
                        )
                      }
                      required
                    />
                  </label>

                  <label>
                    <span>Alasan</span>

                    <select
                      value={permissionForm.reason}
                      onChange={(event) =>
                        setPermissionForm(
                          (current) => ({
                            ...current,
                            reason:
                              event.target.value,
                          })
                        )
                      }
                      required
                    >
                      <option value="Sakit">
                        Sakit
                      </option>

                      <option value="Izin">
                        Izin
                      </option>

                      <option value="Acara">
                        Acara
                      </option>

                      <option value="Lainnya">
                        Lainnya
                      </option>
                    </select>
                  </label>
                </div>

                <label>
                  <span>Keterangan</span>

                  <textarea
                    value={
                      permissionForm.description
                    }
                    onChange={(event) =>
                      setPermissionForm(
                        (current) => ({
                          ...current,
                          description:
                            event.target.value,
                        })
                      )
                    }
                    placeholder="Tuliskan keterangan izin..."
                    required
                  />
                </label>

                <div className="form-footer">
                  <span>
                    Pengajuan akan dikirim kepada
                    guru untuk diperiksa.
                  </span>

                  <div className="permission-modal-buttons">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        setPermissionModalOpen(false)
                      }
                      disabled={
                        permissionSubmitting
                      }
                    >
                      Batal
                    </button>

                    <button
                      type="submit"
                      className="primary-button"
                      disabled={
                        permissionSubmitting
                      }
                    >
                      {permissionSubmitting
                        ? "Mengirim..."
                        : "Kirim Pengajuan"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CHANGE PASSWORD MODAL */}
        {showPasswordModal && (
          <div
            className="password-modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget
              ) {
                closePasswordModal();
              }
            }}
          >
            <div
              className="password-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="student-password-title"
            >
              <div className="password-modal-header">
                <div>
                  <span className="section-label">
                    KEAMANAN AKUN
                  </span>

                  <h2 id="student-password-title">
                    Ganti Password
                  </h2>

                  <p>
                    Masukkan password lama dan
                    password baru kamu.
                  </p>
                </div>

                <button
                  type="button"
                  className="password-modal-close"
                  onClick={closePasswordModal}
                  disabled={passwordChanging}
                  aria-label="Tutup"
                >
                  ×
                </button>
              </div>

              <form
                className="password-form"
                onSubmit={handleChangePassword}
              >
                <label>
                  <span>Password Saat Ini</span>

                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Masukkan password saat ini"
                    value={
                      passwordForm.currentPassword
                    }
                    onChange={(event) =>
                      setPasswordForm(
                        (current) => ({
                          ...current,
                          currentPassword:
                            event.target.value,
                        })
                      )
                    }
                    disabled={passwordChanging}
                    required
                  />
                </label>

                <label>
                  <span>Password Baru</span>

                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Minimal 6 karakter"
                    value={
                      passwordForm.newPassword
                    }
                    onChange={(event) =>
                      setPasswordForm(
                        (current) => ({
                          ...current,
                          newPassword:
                            event.target.value,
                        })
                      )
                    }
                    disabled={passwordChanging}
                    required
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
                      setPasswordForm(
                        (current) => ({
                          ...current,
                          confirmPassword:
                            event.target.value,
                        })
                      )
                    }
                    disabled={passwordChanging}
                    required
                  />
                </label>

                {passwordError && (
                  <div className="password-form-message error">
                    <strong>
                      Gagal mengganti password
                    </strong>

                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="password-form-message success">
                    <strong>Berhasil</strong>

                    <span>{passwordSuccess}</span>
                  </div>
                )}

                <div className="password-form-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closePasswordModal}
                    disabled={passwordChanging}
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={passwordChanging}
                  >
                    {passwordChanging
                      ? "Menyimpan..."
                      : "Simpan Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer className="student-footer">
          <div>
            <strong>
              Sistem Absensi Sekolah
            </strong>

            <span>Student Dashboard</span>
          </div>

          <span>
            © {new Date().getFullYear()}
          </span>
        </footer>
      </div>
    </div>
  );
}

export default StudentDashboard;