
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";
import schoolHero2 from "../assets/school-hero2.png";
import logoApp from "../assets/logo-app.png";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

function Login() {
  const [role, setRole] = useState("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    console.log("API_URL:", API_URL);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identifier: identifier.trim(),
            password,
            role:
              role === "teacher" &&
              identifier.trim().toLowerCase() ===
                "ginzz@absensi.app"
                ? "admin"
                : role,
          }),
        }
      );

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "Server mengirim response yang tidak valid"
        );
      }

      if (!response.ok) {
        throw new Error(
          data.detail || "Login gagal"
        );
      }

      if (!data.access_token || !data.user) {
        throw new Error(
          "Response login dari server tidak lengkap"
        );
      }

      localStorage.setItem(
        "token",
        data.access_token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      if (data.user.role === "student") {
        navigate("/student/dashboard");
      } else if (data.user.role === "teacher") {
        navigate("/teacher/dashboard");
      } else if (data.user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        throw new Error(
          "Role pengguna tidak dikenali"
        );
      }
    } catch (error) {
      console.error("Login error:", error);

      if (
        error instanceof TypeError &&
        error.message.toLowerCase().includes("fetch")
      ) {
        setError(
          "Tidak dapat terhubung ke server. Pastikan backend aktif dan alamat API benar."
        );
      } else {
        setError(
          error.message ||
            "Terjadi kesalahan saat login"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const changeRole = (newRole) => {
    setRole(newRole);
    setIdentifier("");
    setPassword("");
    setError("");
  };

  return (
    <div className="login-page">
      <div className="login-background-shape shape-one" />
      <div className="login-background-shape shape-two" />

      <div className="login-layout">
        <div className="login-visual">
          <div className="visual-overlay" />

          <img
            src={schoolHero2}
            alt="Lingkungan sekolah"
            className="login-hero-image"
          />

          <div className="visual-content">
            <span className="visual-badge">
              SISTEM ABSENSI
            </span>

            <h2>
              Kelola kehadiran
              <br />
              dengan lebih mudah.
            </h2>

            <p>
              Platform absensi sekolah untuk
              siswa, guru, dan pengelola.
            </p>
          </div>
        </div>

        <div className="login-container">
          <div className="login-header">

  <div className="login-brand">
    <div className="logo">
      <img src={logoApp} alt="Logo Absensi Sekolah" />
    </div>

    <h1>
      Absensi Sekolah
    </h1>
  </div>

  <p>
    Masuk untuk melanjutkan
  </p>

</div>

          <div className="role-switcher">
            <button
              type="button"
              className={
                role === "student"
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeRole("student")
              }
              disabled={loading}
            >
              Siswa
            </button>

            <button
              type="button"
              className={
                role === "teacher"
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeRole("teacher")
              }
              disabled={loading}
            >
              Guru
            </button>
          </div>

          <form
            className="login-form"
            onSubmit={handleLogin}
          >
            <div className="form-field">
              <label>
                {role === "student"
                  ? "Nomor Induk Siswa"
                  : "Email"}
              </label>

              <input
                type={
                  role === "student"
                    ? "text"
                    : "email"
                }
                placeholder={
                  role === "student"
                    ? "Masukkan NIS"
                    : "Masukkan email"
                }
                value={identifier}
                onChange={(event) =>
                  setIdentifier(
                    event.target.value
                  )
                }
                autoComplete={
                  role === "student"
                    ? "username"
                    : "email"
                }
                disabled={loading}
                required
              />
            </div>

            <div className="form-field">
              <label>
                Password
              </label>

              <input
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                autoComplete="current-password"
                disabled={loading}
                required
              />
            </div>

            {error && (
              <div className="login-error">
                <span className="error-icon">
                  !
                </span>

                <span>
                  {error}
                </span>
              </div>
            )}

            <button
              className="login-button"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="button-spinner" />
                  Memproses...
                </>
              ) : (
                <>
                  Masuk sebagai{" "}
                  {role === "student"
                    ? "Siswa"
                    : "Guru"}
                  <span className="button-arrow">
                    →
                  </span>
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <span className="footer-line" />

            <p>
              Sistem Absensi Sekolah
            </p>

            <span className="footer-line" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

