import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";

const API_URL = import.meta.env.VITE_API_URL;

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
            role,
          }),
        }
      );

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error("Server mengirim response yang tidak valid");
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
      } else {
        throw new Error("Role pengguna tidak dikenali");
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
          error.message || "Terjadi kesalahan saat login"
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
      <div className="login-container">

        <div className="login-header">

          <div className="logo">
            A
          </div>

          <h1>
            Absensi Sekolah
          </h1>

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
            onClick={() => changeRole("student")}
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
            onClick={() => changeRole("teacher")}
          >
            Guru
          </button>

        </div>


        <form
          className="login-form"
          onSubmit={handleLogin}
        >

          <label>
            {role === "student"
              ? "NIS"
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
              setIdentifier(event.target.value)
            }
            autoComplete={
              role === "student"
                ? "username"
                : "email"
            }
            disabled={loading}
            required
          />


          <label>
            Password
          </label>

          <input
            type="password"
            placeholder="Masukkan password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            autoComplete="current-password"
            disabled={loading}
            required
          />


          {error && (
            <div className="login-error">
              {error}
            </div>
          )}


          <button
            className="login-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Memproses..."
              : `Masuk sebagai ${
                  role === "student"
                    ? "Siswa"
                    : "Guru"
                }`}
          </button>

        </form>


        <p className="login-footer">
          Sistem Absensi Sekolah
        </p>

      </div>
    </div>
  );
}

export default Login;