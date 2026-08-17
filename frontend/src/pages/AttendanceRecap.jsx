import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/AttendanceRecap.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

function AttendanceRecap() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [selectedClass, setSelectedClass] = useState("");

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);

  const [loading, setLoading] = useState(false);
  const [classLoading, setClassLoading] = useState(false);

  const [error, setError] = useState("");

  // =========================================
  // LOAD USER
  // =========================================

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

      const role = String(
        parsedUser.role || ""
      ).toLowerCase();

      // Siswa otomatis menggunakan kelas akunnya
      if (role === "student") {
        const studentClass =
          parsedUser.class_name || "";

        setSelectedClass(studentClass);
      }

      // Guru mengambil daftar kelas
      if (role === "teacher") {
        loadTeacherClasses();
      }

      // Admin dapat menggunakan daftar seluruh kelas
      if (role === "admin") {
        loadAllClasses();
      }
    } catch (err) {
      console.error(err);

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      navigate("/");
    }
  }, [navigate]);

  // =========================================
  // LOAD TEACHER CLASSES
  // =========================================

  const loadTeacherClasses = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    try {
      setClassLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/teacher/classes`,
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
            "Gagal mengambil daftar kelas."
        );
      }

      const teacherClasses = Array.isArray(
        data.classes
      )
        ? data.classes
        : [];

      setClasses(teacherClasses);

      if (teacherClasses.length > 0) {
        setSelectedClass(
          teacherClasses[0]
        );
      }
    } catch (err) {
      console.error(err);

      setClasses([]);
      setError(
        err.message ||
          "Gagal mengambil daftar kelas."
      );
    } finally {
      setClassLoading(false);
    }
  };

  // =========================================
  // LOAD ALL CLASSES
  // =========================================

  const loadAllClasses = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    try {
      setClassLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/status`,
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
            "Gagal mengambil daftar kelas."
        );
      }

      const availableClasses = Array.isArray(
        data.classes
      )
        ? data.classes
        : [];

      setClasses(availableClasses);

      if (availableClasses.length > 0) {
        setSelectedClass(
          availableClasses[0]
        );
      }
    } catch (err) {
      console.error(err);

      setClasses([]);
      setError(
        err.message ||
          "Gagal mengambil daftar kelas."
      );
    } finally {
      setClassLoading(false);
    }
  };

  // =========================================
  // LOAD RECAP
  // =========================================

  const loadRecap = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/");
      return;
    }

    if (!selectedDate) {
      setError(
        "Silakan pilih tanggal terlebih dahulu."
      );
      return;
    }

    if (!selectedClass) {
      setError(
        "Silakan pilih kelas terlebih dahulu."
      );
      return;
    }

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        date: selectedDate,
        class_name: selectedClass,
      });

      const response = await fetch(
        `${API_URL}/api/attendance/recap?${params.toString()}`,
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
            "Gagal mengambil rekap absensi."
        );
      }

      setStudents(
        Array.isArray(data.students)
          ? data.students
          : []
      );
    } catch (err) {
      console.error(err);

      setStudents([]);

      setError(
        err.message ||
          "Gagal mengambil rekap absensi."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================
  // INITIAL RECAP
  // =========================================

  useEffect(() => {
    if (!user || !selectedClass) {
      return;
    }

    loadRecap();
  }, [user, selectedClass]);

  // =========================================
  // SUMMARY
  // =========================================

  const summary = useMemo(() => {
    const hadir = students.filter(
      (student) =>
        String(student.status || "")
          .toLowerCase() === "hadir"
    ).length;

    const izin = students.filter(
      (student) =>
        String(student.status || "")
          .toLowerCase() === "izin"
    ).length;

    const sakit = students.filter(
      (student) =>
        String(student.status || "")
          .toLowerCase() === "sakit"
    ).length;

    const alpha = students.filter(
      (student) => {
        const status = String(
          student.status || ""
        ).toLowerCase();

        return (
          status === "alpha" ||
          status === "alpa" ||
          status === "tidak hadir"
        );
      }
    ).length;

    const belumAbsen =
      students.length -
      hadir -
      izin -
      sakit -
      alpha;

    return {
      total: students.length,
      hadir,
      izin,
      sakit,
      alpha,
      belumAbsen:
        belumAbsen > 0
          ? belumAbsen
          : 0,
    };
  }, [students]);

  // =========================================
  // ROLE
  // =========================================

  const role = String(
    user?.role || ""
  ).toLowerCase();

  const isStudent = role === "student";
  const isTeacher = role === "teacher";
  const isAdmin = role === "admin";

  // =========================================
  // STATUS
  // =========================================

  const getStatus = (status) => {
    const normalized = String(
      status || ""
    ).toLowerCase();

    if (normalized === "hadir") {
      return {
        label: "Hadir",
        className: "hadir",
      };
    }

    if (normalized === "izin") {
      return {
        label: "Izin",
        className: "izin",
      };
    }

    if (normalized === "sakit") {
      return {
        label: "Sakit",
        className: "sakit",
      };
    }

    if (
      normalized === "alpha" ||
      normalized === "alpa"
    ) {
      return {
        label: "Alpha",
        className: "alpha",
      };
    }

    if (
      normalized === "tidak hadir"
    ) {
      return {
        label: "Tidak Hadir",
        className: "alpha",
      };
    }

    return {
      label: "Belum Absen",
      className: "belum",
    };
  };

  // =========================================
  // BACK
  // =========================================

  const handleBack = () => {
    if (isStudent) {
      navigate("/student/dashboard");
      return;
    }

    if (isTeacher) {
      navigate("/teacher/dashboard");
      return;
    }

    if (isAdmin) {
      navigate("/admin/dashboard");
      return;
    }

    navigate("/");
  };

  // =========================================
  // RENDER
  // =========================================

  if (!user) {
    return null;
  }

  return (
    <div className="attendance-recap-page">
      <div className="attendance-recap-container">

        {/* HEADER */}

        <section className="recap-header-card">

          <div className="recap-header-content">

            <div className="recap-brand">
              <div className="recap-brand-icon">
                A
              </div>

              <span>
                ABSENSI SEKOLAH
              </span>
            </div>

            <span className="recap-label">
              REKAP KEHADIRAN
            </span>

            <h1>
              Rekap Absensi
            </h1>

            <p>
              {isStudent
                ? `Rangkuman kehadiran kelas ${
                    user.class_name || "-"
                  } pada tanggal yang dipilih.`
                : "Lihat rangkuman kehadiran siswa berdasarkan kelas dan tanggal."}
            </p>

          </div>

          <button
            type="button"
            className="recap-back-button"
            onClick={handleBack}
          >
            Kembali
          </button>

        </section>

        {/* FILTER */}

        <section className="recap-card">

          <div className="section-header">

            <div>
              <span className="section-label">
                FILTER
              </span>

              <h2>
                Pilih Data Rekap
              </h2>

              <p>
                Tentukan tanggal dan kelas yang
                ingin ditampilkan.
              </p>
            </div>

            <div className="section-number">
              01
            </div>

          </div>

          <div className="recap-filter-grid">

            {/* TANGGAL */}

            <label className="filter-field">
              <span>
                Tanggal
              </span>

              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(
                    event.target.value
                  )
                }
              />
            </label>

            {/* KELAS */}

            <label className="filter-field">
              <span>
                Kelas
              </span>

              {isStudent ? (
                <div className="student-class-display">
                  <strong>
                    {user.class_name || "-"}
                  </strong>

                  <small>
                    Kelas akun siswa
                  </small>
                </div>
              ) : (
                <select
                  value={selectedClass}
                  onChange={(event) =>
                    setSelectedClass(
                      event.target.value
                    )
                  }
                  disabled={classLoading}
                >
                  {classLoading ? (
                    <option value="">
                      Memuat kelas...
                    </option>
                  ) : classes.length === 0 ? (
                    <option value="">
                      Tidak ada kelas
                    </option>
                  ) : (
                    classes.map(
                      (className) => (
                        <option
                          key={className}
                          value={className}
                        >
                          {className}
                        </option>
                      )
                    )
                  )}
                </select>
              )}
            </label>

          </div>

          <div className="filter-footer">

            <span>
              {isStudent
                ? `Kamu hanya dapat melihat rekap kelas ${
                    user.class_name || "-"
                  }.`
                : "Pilih kelas yang ingin diperiksa, lalu tampilkan rekap."}
            </span>

            <button
              type="button"
              className="primary-button"
              onClick={loadRecap}
              disabled={
                loading ||
                !selectedDate ||
                !selectedClass
              }
            >
              {loading
                ? "Memuat..."
                : "Tampilkan Rekap"}
            </button>

          </div>

        </section>

        {/* ERROR */}

        {error && (
          <div className="recap-alert error">

            <div className="alert-icon">
              !
            </div>

            <div>
              <strong>
                Terjadi kesalahan
              </strong>

              <span>
                {error}
              </span>
            </div>

          </div>
        )}

        {/* SUMMARY */}

        <section className="recap-stats">

          <div className="recap-stat-card">

            <div className="recap-stat-icon blue">
              {summary.total}
            </div>

            <div>
              <span>
                Total Siswa
              </span>

              <strong>
                {summary.total} siswa
              </strong>
            </div>

          </div>

          <div className="recap-stat-card">

            <div className="recap-stat-icon green">
              {summary.hadir}
            </div>

            <div>
              <span>
                Hadir
              </span>

              <strong>
                {summary.hadir} siswa
              </strong>
            </div>

          </div>

          <div className="recap-stat-card">

            <div className="recap-stat-icon orange">
              {summary.izin}
            </div>

            <div>
              <span>
                Izin
              </span>

              <strong>
                {summary.izin} siswa
              </strong>
            </div>

          </div>

          <div className="recap-stat-card">

            <div className="recap-stat-icon red">
              {summary.sakit + summary.alpha}
            </div>

            <div>
              <span>
                Sakit / Alpha
              </span>

              <strong>
                {summary.sakit + summary.alpha} siswa
              </strong>
            </div>

          </div>

        </section>

        {/* RECAP TABLE */}

        <section className="recap-card">

          <div className="section-header">

            <div>
              <span className="section-label">
                DATA
              </span>

              <h2>
                Daftar Kehadiran
              </h2>

              <p>
                {selectedClass
                  ? `Kelas ${selectedClass} • ${selectedDate}`
                  : "Pilih kelas untuk melihat data."}
              </p>
            </div>

            <div className="section-number">
              02
            </div>

          </div>

          {loading ? (
            <div className="loading-state">

              <div className="loading-spinner" />

              Memuat rekap absensi...

            </div>
          ) : students.length === 0 ? (
            <div className="empty-state">

              <div className="empty-icon">
                —
              </div>

              <strong>
                Belum ada data
              </strong>

              <span>
                Tidak ada data siswa untuk
                kelas dan tanggal tersebut.
              </span>

            </div>
          ) : (
            <div className="recap-table-wrapper">

              <table className="recap-table">

                <thead>
                  <tr>
                    <th>No</th>
                    <th>Siswa</th>
                    <th>NIS</th>
                    <th>Kelas</th>
                    <th>Waktu</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>

                  {students.map(
                    (student, index) => {
                      const status =
                        getStatus(
                          student.status
                        );

                      return (
                        <tr
                          key={
                            student.student_id ||
                            student.id ||
                            index
                          }
                        >

                          <td>
                            <span className="row-number">
                              {String(
                                index + 1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>
                          </td>

                          <td>
                            <div className="student-name-cell">

                              <strong>
                                {student.name || "-"}
                              </strong>

                              <span>
                                Siswa
                              </span>

                            </div>
                          </td>

                          <td>
                            {student.nis || "-"}
                          </td>

                          <td>
                            {student.class_name ||
                              selectedClass ||
                              "-"}
                          </td>

                          <td>
                            {student.time ||
                              "--:--"}
                          </td>

                          <td>
                            <span
                              className={`recap-status ${status.className}`}
                            >
                              <i />
                              {status.label}
                            </span>
                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* FOOTER */}

        <footer className="recap-footer">

          <div>
            <strong>
              Absensi Sekolah
            </strong>

            <span>
              Rekap Kehadiran
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

export default AttendanceRecap;