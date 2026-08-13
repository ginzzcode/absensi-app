import { useEffect, useState } from "react";
import "../styles/AdminDashboard.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function AdminDashboard() {
  const [statistics, setStatistics] = useState(null);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [activeMenu, setActiveMenu] =
    useState("dashboard");

  const [userFilter, setUserFilter] =
    useState("student");

  const [showAddForm, setShowAddForm] =
    useState(false);

  const [form, setForm] = useState({
    name: "",
    role: "student",
    nis: "",
    email: "",
    class_name: "",
    password: "",
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const token =
        localStorage.getItem("token");

      if (!token) {
        setError(
          "Token login tidak ditemukan."
        );
        return;
      }

      const response = await fetch(
        `${API_URL}/api/admin/dashboard`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal mengambil dashboard"
        );
      }

      setStatistics(data.statistics);

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal mengambil data dashboard."
      );

    } finally {
      setLoading(false);
    }
  }

  async function loadUsers(role) {
    try {
      setUsersLoading(true);
      setError("");

      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/admin/users?role=${role}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal mengambil data akun"
        );
      }

      setUsers(data.users || []);

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal mengambil data akun."
      );

    } finally {
      setUsersLoading(false);
    }
  }

  function openUsers(role) {
    setUserFilter(role);
    setActiveMenu("users");
    setShowAddForm(false);
    setMessage("");
    loadUsers(role);
  }

  function handleFormChange(event) {
    const { name, value } =
      event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm({
      name: "",
      role: userFilter,
      nis: "",
      email: "",
      class_name: "",
      password: "",
    });
  }

  async function createUser(event) {
    event.preventDefault();

    try {
      setError("");
      setMessage("");

      const token =
        localStorage.getItem("token");

      const payload = {
        name: form.name,
        role: form.role,
        password: form.password,
      };

      if (form.role === "student") {
        payload.nis = form.nis;
        payload.class_name =
          form.class_name;
      }

      if (form.role === "teacher") {
        payload.email = form.email;
      }

      const response = await fetch(
        `${API_URL}/api/admin/users`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify(
            payload
          ),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Gagal membuat akun"
        );
      }

      setMessage(
        "Akun berhasil dibuat."
      );

      setShowAddForm(false);
      resetForm();

      await loadUsers(
        userFilter
      );

      await loadDashboard();

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal membuat akun."
      );
    }
  }

  async function deleteUser(user) {
    const confirmed =
      window.confirm(
        `Hapus akun ${user.name}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/admin/users/${user.id}`,
        {
          method: "DELETE",
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
            "Gagal menghapus akun"
        );
      }

      setMessage(
        "Akun berhasil dihapus."
      );

      await loadUsers(
        userFilter
      );

      await loadDashboard();

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Gagal menghapus akun."
      );
    }
  }

  function logout() {
    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    window.location.href = "/";
  }

  function renderDashboard() {
    return (
      <>
        <section className="admin-stat-grid">

          <div className="admin-stat-card">
            <span>
              Jumlah Siswa
            </span>
            <strong>
              {statistics?.total_students ?? 0}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              Jumlah Guru
            </span>
            <strong>
              {statistics?.total_teachers ?? 0}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              Jumlah Kelas
            </span>
            <strong>
              {statistics?.total_classes ?? 0}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              Admin
            </span>
            <strong>
              {statistics?.total_admins ?? 0}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              Absensi Hari Ini
            </span>
            <strong>
              {statistics?.attendance_today ?? 0}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              Izin Pending
            </span>
            <strong>
              {statistics?.permissions_pending ?? 0}
            </strong>
          </div>

        </section>

        <section className="admin-welcome">
          <h2>
            Selamat datang di Panel Admin
          </h2>

          <p>
            Gunakan menu di samping
            untuk mengelola sistem
            absensi sekolah.
          </p>
        </section>
      </>
    );
  }

  function renderUsers() {
    return (
      <section className="admin-content-card">

        <div className="admin-content-header">

          <div>
            <h2>
              Kelola Akun
            </h2>

            <p>
              Kelola akun siswa dan guru.
            </p>
          </div>

          <button
            className="admin-primary-button"
            onClick={() => {
              setForm({
                name: "",
                role: userFilter,
                nis: "",
                email: "",
                class_name: "",
                password: "",
              });

              setShowAddForm(
                !showAddForm
              );

              setMessage("");
              setError("");
            }}
          >
            {showAddForm
              ? "Batal"
              : "Tambah Akun"}
          </button>

        </div>

        <div className="admin-filter-buttons">

          <button
            className={
              userFilter === "student"
                ? "active"
                : ""
            }
            onClick={() =>
              openUsers("student")
            }
          >
            Siswa
          </button>

          <button
            className={
              userFilter === "teacher"
                ? "active"
                : ""
            }
            onClick={() =>
              openUsers("teacher")
            }
          >
            Guru
          </button>

        </div>

        {showAddForm && (
          <form
            className="admin-user-form"
            onSubmit={createUser}
          >

            <h3>
              Tambah Akun{" "}
              {form.role === "student"
                ? "Siswa"
                : "Guru"}
            </h3>

            <label>
              Nama
            </label>

            <input
              name="name"
              value={form.name}
              onChange={handleFormChange}
              placeholder="Nama lengkap"
              required
            />

            <label>
              Jenis Akun
            </label>

            <select
              name="role"
              value={form.role}
              onChange={handleFormChange}
            >
              <option value="student">
                Siswa
              </option>

              <option value="teacher">
                Guru
              </option>
            </select>

            {form.role === "student" && (
              <>
                <label>
                  NIS
                </label>

                <input
                  name="nis"
                  value={form.nis}
                  onChange={handleFormChange}
                  placeholder="Masukkan NIS"
                  required
                />

                <label>
                  Kelas
                </label>

                <select
                  name="class_name"
                  value={form.class_name}
                  onChange={
                    handleFormChange
                  }
                  required
                >
                  <option value="">
                    Pilih kelas
                  </option>

                  {[
                    "A",
                    "B",
                    "C",
                    "D",
                    "E",
                    "F",
                    "G",
                    "H",
                    "I",
                    "J",
                    "K",
                  ].map(
                    (className) => (
                      <option
                        key={className}
                        value={
                          className
                        }
                      >
                        {className}
                      </option>
                    )
                  )}
                </select>
              </>
            )}

            {form.role === "teacher" && (
              <>
                <label>
                  Email
                </label>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={
                    handleFormChange
                  }
                  placeholder="Email guru"
                  required
                />
              </>
            )}

            <label>
              Password
            </label>

            <input
              type="password"
              name="password"
              value={form.password}
              onChange={
                handleFormChange
              }
              placeholder="Minimal 6 karakter"
              minLength={6}
              required
            />

            <button
              className="admin-primary-button"
              type="submit"
            >
              Buat Akun
            </button>

          </form>
        )}

        {usersLoading ? (
          <div className="admin-loading-small">
            Memuat akun...
          </div>
        ) : (
          <div className="admin-user-table-wrapper">

            <table className="admin-user-table">

              <thead>
                <tr>
                  <th>
                    Nama
                  </th>

                  {userFilter ===
                    "student" && (
                    <>
                      <th>
                        NIS
                      </th>

                      <th>
                        Kelas
                      </th>
                    </>
                  )}

                  {userFilter ===
                    "teacher" && (
                    <th>
                      Email
                    </th>
                  )}

                  <th>
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>

                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        userFilter ===
                        "student"
                          ? 4
                          : 3
                      }
                    >
                      Belum ada akun.
                    </td>
                  </tr>
                ) : (
                  users.map(
                    (user) => (
                      <tr
                        key={user.id}
                      >

                        <td>
                          {user.name}
                        </td>

                        {userFilter ===
                          "student" && (
                          <>
                            <td>
                              {user.nis ||
                                "-"}
                            </td>

                            <td>
                              {user.class_name ||
                                "-"}
                            </td>
                          </>
                        )}

                        {userFilter ===
                          "teacher" && (
                          <td>
                            {user.email ||
                              "-"}
                          </td>
                        )}

                        <td>
                          <button
                            className="admin-delete-button"
                            onClick={() =>
                              deleteUser(
                                user
                              )
                            }
                          >
                            Hapus
                          </button>
                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

      </section>
    );
  }

  function renderContent() {
    switch (activeMenu) {

      case "dashboard":
        return renderDashboard();

      case "users":
      case "students":
      case "teachers":
        return renderUsers();

      case "attendance":
        return (
          <section className="admin-content-card">
            <h2>
              Data Absensi
            </h2>

            <p>
              Riwayat seluruh absensi
              akan tersedia di sini.
            </p>
          </section>
        );

      case "permissions":
        return (
          <section className="admin-content-card">
            <h2>
              Pengajuan Izin
            </h2>

            <p>
              Pengajuan izin siswa
              akan tersedia di sini.
            </p>
          </section>
        );

      case "settings":
        return (
          <section className="admin-content-card">
            <h2>
              Pengaturan
            </h2>

            <p>
              Pengaturan sistem akan
              tersedia di sini.
            </p>
          </section>
        );

      default:
        return renderDashboard();
    }
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
          <h1>
            Panel Admin
          </h1>

          <p>
            Kelola data dan aktivitas
            absensi sekolah.
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

      {message && (
        <div className="admin-success">
          {message}
        </div>
      )}

      <div className="admin-layout">

        <aside className="admin-sidebar">

          <div className="admin-sidebar-title">
            Menu Admin
          </div>

          <button
            className={
              activeMenu === "dashboard"
                ? "admin-nav-button active"
                : "admin-nav-button"
            }
            onClick={() =>
              setActiveMenu(
                "dashboard"
              )
            }
          >
            Dashboard
          </button>

          <button
            className={
              [
                "users",
                "students",
                "teachers",
              ].includes(activeMenu)
                ? "admin-nav-button active"
                : "admin-nav-button"
            }
            onClick={() =>
              openUsers("student")
            }
          >
            Kelola Akun
          </button>

          <button
            className={
              activeMenu === "attendance"
                ? "admin-nav-button active"
                : "admin-nav-button"
            }
            onClick={() =>
              setActiveMenu(
                "attendance"
              )
            }
          >
            Data Absensi
          </button>

          <button
            className={
              activeMenu ===
              "permissions"
                ? "admin-nav-button active"
                : "admin-nav-button"
            }
            onClick={() =>
              setActiveMenu(
                "permissions"
              )
            }
          >
            Pengajuan Izin
          </button>

          <button
            className={
              activeMenu === "settings"
                ? "admin-nav-button active"
                : "admin-nav-button"
            }
            onClick={() =>
              setActiveMenu(
                "settings"
              )
            }
          >
            Pengaturan
          </button>

        </aside>

        <main className="admin-main">
          {renderContent()}
        </main>

      </div>
    </div>
  );
}

export default AdminDashboard;