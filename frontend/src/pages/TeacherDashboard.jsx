import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import "../styles/TeacherDashboard.css";

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

  // =========================
  // ABSENSI
  // =========================

  const [selectedClass, setSelectedClass] =
  useState("7A");

  const [students, setStudents] =
    useState([]);

  const [sessionCode, setSessionCode] =
    useState("");

  const [sessionActive, setSessionActive] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [attendanceLoading, setAttendanceLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  // =========================
  // IZIN
  // =========================

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
      setUser(JSON.parse(savedUser));
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/");
    }
  }, [navigate]);

  // =========================
  // LOAD ABSENSI
  // =========================

  const loadAttendance = async () => {
    const token =
      localStorage.getItem("token");

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
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal mengambil absensi"
        );
      }

      setStudents(
        data.students || []
      );
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal mengambil absensi"
      );
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadAttendance();
      loadPermissions();
    }
  }, [user, selectedClass]);

  // =========================
  // LOAD IZIN
  // =========================

  const loadPermissions = async () => {
    const token =
      localStorage.getItem("token");

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
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal mengambil pengajuan izin"
        );
      }

      const permissionData =
        Array.isArray(data)
          ? data
          : data.permissions ||
            data.data ||
            [];

      setPermissions(permissionData);
    } catch (err) {
      console.error(err);

      setPermissionError(
        err.message ||
          "Gagal mengambil pengajuan izin"
      );
    } finally {
      setPermissionLoading(false);
    }
  };

  // =========================
  // PROSES IZIN
  // =========================

  const processPermission = async (
    permission
  ) => {
    const token =
      localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    const permissionId =
      permission.id ||
      permission._id;

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
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            teacher_reply:
              teacherReply.trim(),
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal memproses izin"
        );
      }

      setPermissions((current) =>
        current.map((item) => {
          const itemId =
            item.id ||
            item._id;

          if (
            String(itemId) !==
            String(permissionId)
          ) {
            return item;
          }

          return {
            ...item,
            status,
            teacher_reply:
              teacherReply.trim(),
          };
        })
      );

      setReplyInputs((current) => {
        const updated = {
          ...current,
        };

        delete updated[permissionId];

        return updated;
      });

      /*
       * Ambil ulang data dari backend
       * supaya UI benar-benar sesuai database.
       */
      await loadPermissions();
    } catch (err) {
      console.error(err);

      setPermissionError(
        err.message ||
          "Gagal memproses izin"
      );
    } finally {
      setProcessingPermission(null);
    }
  };

  // =========================
  // GENERATE QR
  // =========================

  const startSession = async () => {
    const token =
      localStorage.getItem("token");

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
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            class_name:
              selectedClass,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal membuat sesi absensi"
        );
      }

      setSessionCode(
        data.session_code
      );

      setSessionActive(true);

      await loadAttendance();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal membuat QR"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // STOP SESSION
  // =========================

  const stopSession = async () => {
    const token =
      localStorage.getItem("token");

    if (!token || !sessionCode) {
      return;
    }

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
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal menghentikan sesi"
        );
      }

      setSessionActive(false);
      setSessionCode("");

      await loadAttendance();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal menghentikan sesi"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // LOGOUT
  // =========================

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/");
  };

  if (!user) {
    return null;
  }

  const hadirCount =
    students.filter(
      (student) =>
        student.status === "hadir"
    ).length;

  const belumAbsenCount =
    students.length - hadirCount;

  const qrValue = JSON.stringify({
    type: "attendance",
    session_code: sessionCode,
  });

  // =========================
  // UI
  // =========================

  return (
    <div className="teacher-page">
      <div className="teacher-container">

        {/* HEADER */}

        <header className="teacher-header">
          <div>
            <p className="teacher-label">
              Dashboard Guru
            </p>

            <h1>
              Halo, {user.name}
            </h1>

            <p>
              Kelola absensi siswa.
            </p>
          </div>

          <button
            type="button"
            className="teacher-logout"
            onClick={handleLogout}
          >
            Keluar
          </button>
        </header>


        {/* QR SECTION */}

        <section className="teacher-card qr-card">

          <div className="teacher-section-header">

            <div>
              <h2>
                QR Absensi
              </h2>

              <p>
                Pilih kelas lalu mulai
                sesi absensi.
              </p>
            </div>

            <select
              value={selectedClass}
              onChange={(event) => {
                if (sessionActive) {
                  return;
                }

                setSelectedClass(
                  event.target.value
                );
              }}
              disabled={sessionActive}
            >
              {classes.map(
                (className) => (
                  <option
                    key={className}
                    value={className}
                  >
                    Kelas {className}
                  </option>
                )
              )}
            </select>

          </div>


          {!sessionActive ? (
            <div className="qr-start-area">

              <div className="qr-placeholder">
                <span>
                  QR
                </span>
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
            <div className="qr-active-area">

              <div className="qr-code-box">
                <QRCodeSVG
                  value={qrValue}
                  size={280}
                  level="M"
                />
              </div>

              <div className="qr-session-info">

                <span>
                  Sesi aktif
                </span>

                <strong>
                  Kelas {selectedClass}
                </strong>

                <p>
                  Tampilkan QR ini kepada
                  siswa untuk melakukan
                  absensi.
                </p>

              </div>

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
          )}

        </section>


        {/* ERROR */}

        {error && (
          <div className="teacher-error">
            {error}
          </div>
        )}


        {/* ABSENSI */}

        <section className="teacher-card">

          <div className="teacher-section-header">

            <div>
              <h2>
                Absensi Hari Ini
              </h2>

              <p>
                Kelas {selectedClass}
              </p>
            </div>

            <button
              type="button"
              className="teacher-refresh-button"
              onClick={loadAttendance}
              disabled={
                attendanceLoading
              }
            >
              {attendanceLoading
                ? "Memuat..."
                : "Refresh"}
            </button>

          </div>


          <div className="attendance-summary">

            <div className="summary-box">
              <span>
                Total Siswa
              </span>

              <strong>
                {students.length}
              </strong>
            </div>

            <div className="summary-box">
              <span>
                Hadir
              </span>

              <strong>
                {hadirCount}
              </strong>
            </div>

            <div className="summary-box">
              <span>
                Belum Absen
              </span>

              <strong>
                {belumAbsenCount}
              </strong>
            </div>

          </div>


          {attendanceLoading ? (
            <div className="teacher-loading">
              Memuat data siswa...
            </div>
          ) : students.length === 0 ? (
            <div className="teacher-empty">
              Belum ada siswa di kelas{" "}
              {selectedClass}.
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
                          student.student_id
                        }
                      >
                        <td>
                          {index + 1}
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
                            {student.status ===
                            "hadir"
                              ? "Hadir"
                              : "Belum Absen"}
                          </span>
                        </td>

                        <td>
                          {student.time ||
                            "-"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>

              </table>

            </div>
          )}

        </section>


        {/* IZIN SISWA */}

        <section className="teacher-card">

          <div className="teacher-section-header">

            <div>
              <h2>
                Pengajuan Izin Siswa
              </h2>

              <p>
                Kelola pengajuan izin siswa.
              </p>
            </div>

            <button
              type="button"
              className="teacher-refresh-button"
              onClick={loadPermissions}
              disabled={
                permissionLoading
              }
            >
              {permissionLoading
                ? "Memuat..."
                : "Refresh"}
            </button>

          </div>


          {permissionError && (
            <div className="teacher-error">
              {permissionError}
            </div>
          )}


          {permissionLoading ? (
            <div className="teacher-loading">
              Memuat pengajuan izin...
            </div>
          ) : permissions.length === 0 ? (
            <div className="teacher-empty">
              Belum ada pengajuan izin.
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
                    <div
                      className="teacher-permission-item"
                      key={permissionId}
                    >

                      <div className="permission-header">

                        <div>
                          <h3>
                            {permission.student_name ||
                              permission.name ||
                              "Siswa"}
                          </h3>

                          <p>
                            NIS:{" "}
                            {permission.nis ||
                              "-"}
                            {" • "}
                            Kelas:{" "}
                            {permission.class_name ||
                              "-"}
                          </p>
                        </div>

                        <span
                          className={`permission-status ${status}`}
                        >
                          {status ===
                          "approved"
                            ? "Disetujui"
                            : status ===
                              "rejected"
                            ? "Ditolak"
                            : "Menunggu"}
                        </span>

                      </div>


                      <div className="permission-detail">

                        <p>
                          <strong>
                            Tanggal:
                          </strong>{" "}
                          {permission.date ||
                            "-"}
                        </p>

                        <p>
                          <strong>
                            Alasan:
                          </strong>{" "}
                          {permission.reason ||
                            "-"}
                        </p>

                        <p>
                          <strong>
                            Keterangan:
                          </strong>{" "}
                          {permission.description ||
                            "-"}
                        </p>

                      </div>


                      {status ===
                      "pending" ? (
                        <div className="permission-action">

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

                          <div className="permission-buttons">

                            <button
                              type="button"
                              className="permission-approve-button"
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
                              className="permission-reject-button"
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
                        <div className="permission-reply">

                          <strong>
                            Balasan Guru
                          </strong>

                          <p>
                            {permission.teacher_reply ||
                              "Tidak ada balasan."}
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

      </div>
    </div>
  );
}

export default TeacherDashboard;