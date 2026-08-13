import { useEffect, useState } from "react";
import "../styles/AdminDashboard.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function AdminDashboard() {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("access_token");

      if (!token) {
        setError("Token login tidak ditemukan.");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/admin/dashboard`,
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
          data.detail || "Gagal mengambil data dashboard"
        );
      }

      setStatistics(data.statistics);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Terjadi kesalahan saat mengambil data."
      );
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");

    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          Memuat dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Panel Admin</h1>
          <p>
            Kelola data dan aktivitas absensi sekolah.
          </p>
        </div>

        <button
          className="admin-logout"
          onClick={logout}
        >
          Keluar
        </button>
      </header>

      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}

      {statistics && (
        <>
          <section className="admin-stat-grid">
            <div className="admin-stat-card">
              <span>Jumlah Siswa</span>
              <strong>
                {statistics.total_students}
              </strong>
            </div>

            <div className="admin-stat-card">
              <span>Jumlah Guru</span>
              <strong>
                {statistics.total_teachers}
              </strong>
            </div>

            <div className="admin-stat-card">
              <span>Jumlah Kelas</span>
              <strong>
                {statistics.total_classes}
              </strong>
            </div>

            <div className="admin-stat-card">
              <span>Admin</span>
              <strong>
                {statistics.total_admins}
              </strong>
            </div>

            <div className="admin-stat-card">
              <span>Absensi Hari Ini</span>
              <strong>
                {statistics.attendance_today}
              </strong>
            </div>

            <div className="admin-stat-card">
              <span>Izin Pending</span>
              <strong>
                {statistics.permissions_pending}
              </strong>
            </div>
          </section>

          <section className="admin-menu">
            <h2>Manajemen</h2>

            <div className="admin-menu-grid">
              <button
                onClick={() =>
                  alert("Menu Data Siswa belum dibuat.")
                }
              >
                <strong>Data Siswa</strong>
                <span>
                  Kelola akun dan data siswa
                </span>
              </button>

              <button
                onClick={() =>
                  alert("Menu Data Guru belum dibuat.")
                }
              >
                <strong>Data Guru</strong>
                <span>
                  Kelola akun guru
                </span>
              </button>

              <button
                onClick={() =>
                  alert("Menu Absensi belum dibuat.")
                }
              >
                <strong>Absensi</strong>
                <span>
                  Lihat seluruh riwayat absensi
                </span>
              </button>

              <button
                onClick={() =>
                  alert("Menu Izin belum dibuat.")
                }
              >
                <strong>Pengajuan Izin</strong>
                <span>
                  Lihat pengajuan izin siswa
                </span>
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;