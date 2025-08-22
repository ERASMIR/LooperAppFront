import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function LogPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth(); // 👈 usar login del contexto
  const navigate = useNavigate();

  // Si usas contexto:
  // const { setAuthData } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    console.log("🚀 Enviando login con:", { email, password });


    try {
      const res = await fetch("http://localhost:7071/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error de autenticación");
      }

      console.log("🔵 Usuario recibido del backend:", data.usuario);



      // ✅ Usar el login del contexto
      login({
        id: data.usuario.id,
        nombre: data.usuario.nombre,
        apellido: data.usuario.apellido,   // 👈 agreguemos apellido también
        email: data.usuario.email,
        empresa: data.usuario.empresa,        
        empresaId: data.usuario.empresaId, // 👈 siempre un ID real
        perfil: data.usuario.perfil,
      });

      // ✅ Guardar token también
      localStorage.setItem("token", data.token);

      // ✅ Redirigir con react-router (mejor que window.location.href)
      //window.location.href = "/inicio"; // o usa navigate("/inicio")
      navigate("/inicio", { replace: true });


      // Guardar token y usuario en localStorage
      //localStorage.setItem("token", data.token);
      //localStorage.setItem("usuario", JSON.stringify(data.usuario));



      // Si usas contexto:
      // setAuthData({ token: data.token, usuario: data.usuario });





      // Redirigir a otra página
      //window.location.href = "/dashboard";


    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };






  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Iniciar Sesión</h2>

        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}

        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 mb-4 border rounded-lg focus:outline-none focus:ring focus:border-blue-300"
          required
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 mb-4 border rounded-lg focus:outline-none focus:ring focus:border-blue-300"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
