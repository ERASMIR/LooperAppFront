import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function LogPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const fondo = "/imagenes/fondo-login.png";
  const logoColor = "/imagenes/Logo-color.png";
  const logoBN = "/imagenes/Logo-bn.png";
  const logoSN = "/imagenes/Logo-sn.png";

  // 🔑 Iniciar sesión
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api-usuarios/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error de autenticación");

      login(data.usuario, data.token);
      navigate("/inicio", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  // 🔄 Recuperar contraseña
  const handleRecover = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await fetch(`/api-usuarios/recuperarcontrasena`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      setMessage("Solicitud enviada. Te contactaremos pronto para restablecer tu contraseña.");
    } catch (err) {
      setError("No se pudo enviar la solicitud. Intenta más tarde.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex items-center justify-center relative"
      style={{ backgroundImage: `url(${fondo})` }}
    >
      {/* 🔲 Capa oscura para contraste */}
      <div className="absolute inset-0 bg-black bg-opacity-60"></div>

      <div className="relative z-10 flex flex-col items-center bg-white bg-opacity-75 rounded-2xl shadow-2xl p-8 w-11/12 sm:w-96 transition-all duration-500">
        <img
          src={logoSN}
          alt="Looper Logo"
          className="w-40 mb-6 object-contain"
        />

        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          {isRecovering ? "Recuperar Contraseña" : "Iniciar Sesión"}
        </h2>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        {message && <p className="text-green-600 text-sm mb-4">{message}</p>}

        {!isRecovering ? (
          // 🔹 Formulario de Login
          <form onSubmit={handleSubmit} className="w-full">
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />

            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 mb-6 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold p-3 rounded-lg hover:bg-blue-700 transition duration-300"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>

            <p className="text-gray-600 text-sm mt-6 text-center">
              ¿Olvidaste tu contraseña?
              <button
                type="button"
                onClick={() => {
                  setIsRecovering(true);
                  setError("");
                  setMessage("");
                }}
                className="text-blue-500 hover:underline ml-1"
              >
                Recuperar
              </button>
            </p>
          </form>
        ) : (
          // 🔹 Formulario de Recuperación
          <form onSubmit={handleRecover} className="w-full">
            <input
              type="email"
              placeholder="Ingresa tu correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold p-3 rounded-lg hover:bg-blue-700 transition duration-300"
            >
              {loading ? "Enviando..." : "Enviar solicitud"}
            </button>

            <p className="text-gray-600 text-sm mt-6 text-center">
              ¿Recordaste tu contraseña?
              <button
                type="button"
                onClick={() => {
                  setIsRecovering(false);
                  setError("");
                  setMessage("");
                }}
                className="text-blue-500 hover:underline ml-1"
              >
                Volver al inicio
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
