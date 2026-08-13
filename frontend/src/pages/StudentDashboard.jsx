import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import "../styles/StudentDashboard.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

function StudentDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [attendanceHistory, setAttendanceHistory] =
    useState([]);

  const [historyLoading, setHistoryLoading] =
    useState(true);

  const [permissions, setPermissions] =
    useState([]);

  const [permissionLoading, setPermissionLoading] =
    useState(true);

  const [permissionForm, setPermissionForm] =
    useState({
      date: "",
      reason: "",
      description: "",
    });

  const [permissionSubmitting, setPermissionSubmitting] =
    useState(false);

  const scannerRef = useRef(null);
  const processingQrRef = useRef(false);

  // =========================
  // LOAD USER
  // =========================

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (!token || !savedUser) {
      navigate("/");
      return;
    }

    try {
      const parsedUser = JSON.parse(savedUser);

      setUser(parsedUser);

      loadAttendanceHistory();
      loadPermissions();
    } catch (err) {
      console.error(err);

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      navigate("/");
    }

    return () => {
      stopScanner();
    };
  }, [navigate]);

  // =========================
  // LOAD ABSENSI
  // =========================

  const loadAttendanceHistory = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    try {
      setHistoryLoading(true);

      const response = await fetch(
        `${API_URL}/api/student/attendance/history`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal mengambil riwayat absensi"
        );
      }

      setAttendanceHistory(data.history || []);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal mengambil riwayat absensi."
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  // =========================
  // LOAD IZIN
  // =========================

  const loadPermissions = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    try {
      setPermissionLoading(true);

      const response = await fetch(
        `${API_URL}/api/student/permissions`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal mengambil data izin"
        );
      }

      setPermissions(
        data.permissions || []
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal mengambil data izin."
      );
    } finally {
      setPermissionLoading(false);
    }
  };

  // =========================
  // AJUKAN IZIN
  // =========================

  const submitPermission = async (event) => {
    event.preventDefault();

    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    if (
      !permissionForm.date ||
      !permissionForm.reason ||
      !permissionForm.description.trim()
    ) {
      setError(
        "Tanggal, alasan, dan deskripsi wajib diisi."
      );
      return;
    }

    try {
      setPermissionSubmitting(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/student/permissions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(
            permissionForm
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal mengajukan izin"
        );
      }

      setPermissionForm({
        date: "",
        reason: "",
        description: "",
      });

      setMessage(
        "Pengajuan izin berhasil dikirim."
      );

      await loadPermissions();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal mengajukan izin."
      );
    } finally {
      setPermissionSubmitting(false);
    }
  };

  // =========================
  // START SCANNER
  // =========================

  const startScanner = async () => {
    setError("");
    setMessage("");

    if (scanning) {
      return;
    }

    try {
      // Kamera pada browser HP membutuhkan HTTPS.
      if (!window.isSecureContext) {
        throw new Error(
          "Kamera membutuhkan HTTPS. Pastikan membuka website dari alamat HTTPS."
        );
      }

      // Pastikan API kamera tersedia.
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Browser ini tidak mendukung akses kamera."
        );
      }

      // Bersihkan scanner sebelumnya jika ada.
      if (scannerRef.current) {
        await stopScanner();
      }

      processingQrRef.current = false;

      const scanner = new Html5Qrcode(
        "student-qr-reader"
      );

      scannerRef.current = scanner;

      // Tampilkan area scanner sebelum meminta kamera.
      setScanning(true);

      // Html5Qrcode sekarang menjadi satu-satunya
      // yang meminta dan mengelola kamera.
      await scanner.start(
        {
          facingMode: {
            ideal: "environment",
          },
        },
        {
          fps: 10,
          qrbox: {
            width: 240,
            height: 240,
          },
          aspectRatio: 1,
        },
        async (decodedText) => {
          if (processingQrRef.current) {
            return;
          }

          processingQrRef.current = true;

          await handleQrResult(decodedText);
        },
        () => {
          // QR belum ditemukan.
          // Tidak perlu menampilkan error setiap frame.
        }
      );
    } catch (err) {
      console.error(
        "Camera error:",
        err
      );

      scannerRef.current = null;
      processingQrRef.current = false;

      setScanning(false);

      let errorMessage =
        "Tidak dapat membuka kamera.";

      if (
        err.name === "NotAllowedError"
      ) {
        errorMessage =
          "Izin kamera ditolak. Izinkan kamera untuk situs ini melalui pengaturan izin kamera browser.";
      } else if (
        err.name === "PermissionDeniedError"
      ) {
        errorMessage =
          "Izin kamera ditolak. Izinkan kamera untuk situs ini melalui pengaturan browser.";
      } else if (
        err.name === "NotFoundError"
      ) {
        errorMessage =
          "Kamera tidak ditemukan di perangkat.";
      } else if (
        err.name === "NotReadableError"
      ) {
        errorMessage =
          "Kamera sedang digunakan oleh aplikasi lain.";
      } else if (
        err.name === "SecurityError"
      ) {
        errorMessage =
          "Browser memblokir akses kamera.";
      } else if (
        err.name === "OverconstrainedError"
      ) {
        errorMessage =
          "Kamera belakang tidak dapat digunakan. Coba gunakan kamera lain.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    }
  };

  // =========================
  // STOP SCANNER
  // =========================

  const stopScanner = async () => {
    const scanner = scannerRef.current;

    processingQrRef.current = false;

    if (!scanner) {
      setScanning(false);
      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (err) {
      console.error(
        "Scanner stop error:",
        err
      );
    }

    try {
      await scanner.clear();
    } catch (err) {
      console.error(
        "Scanner clear error:",
        err
      );
    }

    scannerRef.current = null;
    setScanning(false);
  };

  // =========================
  // HANDLE QR
  // =========================

  const handleQrResult = async (decodedText) => {
    try {
      setError("");
      setMessage("");

      let qrData;

      try {
        qrData = JSON.parse(decodedText);
      } catch {
        processingQrRef.current = false;
        return;
      }

      if (
        !qrData ||
        qrData.type !== "attendance" ||
        !qrData.session_code
      ) {
        processingQrRef.current = false;

        setError(
          "QR tersebut bukan QR absensi sekolah."
        );

        return;
      }

      const token =
        localStorage.getItem("token");

      if (!token) {
        await stopScanner();
        navigate("/");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/student/attendance/scan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            session_code:
              qrData.session_code,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Absensi gagal."
        );
      }

      await stopScanner();

      setMessage(
        "Absensi berhasil! Kamu tercatat hadir."
      );

      await loadAttendanceHistory();
    } catch (err) {
      console.error(
        "Attendance error:",
        err
      );

      setError(
        err.message ||
          "Absensi gagal."
      );

      processingQrRef.current = false;
    }
  };

  // =========================
  // LOGOUT
  // =========================

  const handleLogout = async () => {
    await stopScanner();

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/");
  };

  // =========================
  // STATUS IZIN
  // =========================

  const getPermissionStatus = (status) => {
    const normalized =
      String(status || "").toLowerCase();

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

  // =========================
  // RENDER
  // =========================

  if (!user) {
    return null;
  }

  return (
    <div className="student-page">
      <div className="student-container">

        {/* HEADER */}

        <header className="student-header">
          <div>
            <p className="student-label">
              Dashboard Siswa
            </p>

            <h1>
              Halo, {user.name}
            </h1>

            <p className="student-class">
              Kelas{" "}
              {user.class_name || "-"}
            </p>
          </div>

          <button
            type="button"
            className="student-logout"
            onClick={handleLogout}
          >
            Keluar
          </button>
        </header>

        {/* GLOBAL MESSAGE */}

        {message && (
          <div className="student-success">
            {message}
          </div>
        )}

        {error && (
          <div className="student-error">
            {error}
          </div>
        )}

        {/* SCANNER */}

        <section className="student-card scanner-card">
          <div className="card-heading">
            <div>
              <span className="card-eyebrow">
                KEHADIRAN
              </span>

              <h2>
                Absensi Hari Ini
              </h2>

              <p>
                Scan QR yang ditampilkan
                oleh guru untuk mencatat
                kehadiran.
              </p>
            </div>
          </div>

          <div
            id="student-qr-reader"
            className="student-qr-reader"
          />

          {!scanning && (
            <button
              type="button"
              className="student-scan-button"
              onClick={startScanner}
            >
              Scan QR Absensi
            </button>
          )}

          {scanning && (
            <button
              type="button"
              className="student-stop-button"
              onClick={stopScanner}
            >
              Tutup Kamera
            </button>
          )}
        </section>

        {/* INFORMASI AKUN */}

        <section className="student-card">
          <div className="card-heading">
            <div>
              <span className="card-eyebrow">
                PROFIL
              </span>

              <h2>
                Informasi Akun
              </h2>
            </div>
          </div>

          <div className="student-info-grid">
            <div className="info-item">
              <span>Nama</span>

              <strong>
                {user.name}
              </strong>
            </div>

            <div className="info-item">
              <span>NIS</span>

              <strong>
                {user.nis || "-"}
              </strong>
            </div>

            <div className="info-item">
              <span>Kelas</span>

              <strong>
                {user.class_name || "-"}
              </strong>
            </div>

            <div className="info-item">
              <span>Status</span>

              <strong>
                {attendanceHistory.some(
                  (item) =>
                    item.date ===
                      new Date()
                        .toISOString()
                        .split("T")[0] &&
                    item.status === "hadir"
                )
                  ? "Hadir"
                  : "Belum Absen"}
              </strong>
            </div>
          </div>
        </section>

        {/* AJUKAN IZIN */}

        <section className="student-card permission-card">
          <div className="card-heading">
            <div>
              <span className="card-eyebrow">
                IZIN
              </span>

              <h2>
                Ajukan Izin
              </h2>

              <p>
                Tidak dapat masuk sekolah?
                Kirim pengajuan izin kepada
                guru.
              </p>
            </div>
          </div>

          <form
            className="permission-form"
            onSubmit={submitPermission}
          >
            <div className="form-row">
              <label>
                Tanggal

                <input
                  type="date"
                  value={
                    permissionForm.date
                  }
                  onChange={(event) =>
                    setPermissionForm({
                      ...permissionForm,
                      date:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Alasan

                <select
                  value={
                    permissionForm.reason
                  }
                  onChange={(event) =>
                    setPermissionForm({
                      ...permissionForm,
                      reason:
                        event.target.value,
                    })
                  }
                >
                  <option value="">
                    Pilih alasan
                  </option>

                  <option value="Sakit">
                    Sakit
                  </option>

                  <option value="Izin">
                    Keperluan keluarga
                  </option>

                  <option value="Acara">
                    Acara keluarga
                  </option>

                  <option value="Lainnya">
                    Lainnya
                  </option>
                </select>
              </label>
            </div>

            <label>
              Deskripsi

              <textarea
                rows="4"
                placeholder="Jelaskan alasan izin kamu..."
                value={
                  permissionForm.description
                }
                onChange={(event) =>
                  setPermissionForm({
                    ...permissionForm,
                    description:
                      event.target.value,
                  })
                }
              />
            </label>

            <button
              type="submit"
              className="permission-submit-button"
              disabled={
                permissionSubmitting
              }
            >
              {permissionSubmitting
                ? "Mengirim..."
                : "Kirim Pengajuan Izin"}
            </button>
          </form>
        </section>

        {/* RIWAYAT IZIN */}

        <section className="student-card">
          <div className="card-heading">
            <div>
              <span className="card-eyebrow">
                RIWAYAT
              </span>

              <h2>
                Pengajuan Izin
              </h2>

              <p>
                Pantau status pengajuan
                izin kamu.
              </p>
            </div>
          </div>

          {permissionLoading ? (
            <div className="history-loading">
              Memuat pengajuan izin...
            </div>
          ) : permissions.length === 0 ? (
            <div className="history-empty">
              Belum ada pengajuan izin.
            </div>
          ) : (
            <div className="permission-list">
              {permissions.map(
                (permission) => {
                  const status =
                    getPermissionStatus(
                      permission.status
                    );

                  return (
                    <div
                      className="permission-item"
                      key={
                        permission.id ||
                        permission._id
                      }
                    >
                      <div className="permission-top">
                        <div>
                          <strong>
                            {permission.date}
                          </strong>

                          <span>
                            {permission.reason}
                          </span>
                        </div>

                        <span
                          className={`permission-status ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <p>
                        {permission.description}
                      </p>

                      {permission.teacher_reply && (
                        <div className="teacher-reply">
                          <span>
                            Balasan Guru
                          </span>

                          <p>
                            {
                              permission.teacher_reply
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* RIWAYAT ABSENSI */}

        <section className="student-card">
          <div className="card-heading">
            <div>
              <span className="card-eyebrow">
                RIWAYAT
              </span>

              <h2>
                Riwayat Absensi
              </h2>

              <p>
                Daftar kehadiran kamu.
              </p>
            </div>
          </div>

          {historyLoading ? (
            <div className="history-loading">
              Memuat riwayat...
            </div>
          ) : attendanceHistory.length ===
            0 ? (
            <div className="history-empty">
              Belum ada riwayat absensi.
            </div>
          ) : (
            <div className="attendance-history">
              {attendanceHistory.map(
                (item) => (
                  <div
                    className="attendance-item"
                    key={item.id}
                  >
                    <div className="attendance-date">
                      <strong>
                        {item.date}
                      </strong>

                      <span>
                        {item.time}
                      </span>
                    </div>

                    <div className="attendance-detail">
                      <strong>
                        Kelas{" "}
                        {item.class_name}
                      </strong>

                      <span>
                        {item.teacher_name ||
                          "Guru"}
                      </span>
                    </div>

                    <span
                      className={`attendance-status ${item.status}`}
                    >
                      {item.status ===
                      "hadir"
                        ? "Hadir"
                        : item.status}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

export default StudentDashboard;