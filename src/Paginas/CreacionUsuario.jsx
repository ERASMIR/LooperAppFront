import React, { useState, useEffect, useContext } from "react";
import { v4 as uuidv4 } from "uuid";
import { API_USUARIOS } from "../config/api";
import { AuthContext } from "../context/AuthContext.jsx";

const CreacionUsuario = () => {
  const { token } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    id: uuidv4(),
    nombre: "",
    apellidos: "",
    empresa_id: "",
    mail: "",
    password: "",
    url_avatar: "",
    id_perfil_usuario: "2", // Por defecto, "usuarioREP"
  });

  const [empresas, setEmpresas] = useState([]); // 👈 listado de empresas desde la API

  // 🔹 Cargar empresas desde backend al montar el componente
  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        const res = await fetch(`${API_USUARIOS}/getempresas`);
        const data = await res.json();
        setEmpresas(data);
      } catch (err) {
        console.error("❌ Error al cargar empresas:", err);
      }
    };

    fetchEmpresas();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // crearUsuario exige la sesión (JWT) de un dev.
      const res = await fetch(
        `${API_USUARIOS}/crearUsuario`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }

      console.log("✅ Respuesta del backend:", data);

      if (!res.ok) {
        if (
          data?.error?.includes("Duplicate entry") ||
          data?.error?.toLowerCase()?.includes("el correo ya se encuentra registrado")
        ) {
          alert("El correo ya se encuentra registrado.");
          return;
        }
        throw new Error("Error al crear usuario.");
      }

      alert("Usuario creado correctamente.");
    } catch (err) {
      console.error("❌ Error durante la creación:", err);
      alert("Error al crear usuario.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-5rem)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl space-y-8 p-12 bg-white rounded-2xl shadow-lg"
      >
        <h2 className="text-3xl font-bold mb-8 text-gray-800">
          Creación de Usuario (Admin)
        </h2>

        <input
          type="text"
          name="nombre"
          placeholder="Nombre"
          className="w-full bg-gray-100 text-xl p-5 rounded-2xl focus:outline-none placeholder-gray-400"
          onChange={handleChange}
          value={formData.nombre}
          required
        />

        <input
          type="text"
          name="apellidos"
          placeholder="Apellidos"
          className="w-full bg-gray-100 text-xl p-5 rounded-2xl focus:outline-none placeholder-gray-400"
          onChange={handleChange}
          value={formData.apellidos}
          required
        />

        {/* 🔹 Select para empresas */}
        <select
          name="empresa_id"
          className="w-full bg-gray-100 text-xl p-5 rounded-2xl focus:outline-none placeholder-gray-400"
          onChange={handleChange}
          value={formData.empresa_id}
          required
        >
          <option value="">Selecciona una empresa</option>
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nombre}
            </option>
          ))}
        </select>

        <input
          type="email"
          name="mail"
          placeholder="Correo electrónico"
          className="w-full bg-gray-100 text-xl p-5 rounded-2xl focus:outline-none placeholder-gray-400"
          onChange={handleChange}
          value={formData.mail}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Contraseña"
          className="w-full bg-gray-100 text-xl p-5 rounded-2xl focus:outline-none placeholder-gray-400"
          onChange={handleChange}
          value={formData.password}
          required
        />

        <input
          type="url"
          name="url_avatar"
          placeholder="URL del avatar (opcional)"
          className="w-full bg-gray-100 text-xl p-5 rounded-2xl focus:outline-none placeholder-gray-400"
          onChange={handleChange}
          value={formData.url_avatar}
        />

        <select
          name="id_perfil_usuario"
          className="w-full bg-gray-100 text-xl p-5 rounded-2xl focus:outline-none placeholder-gray-400"
          onChange={handleChange}
          value={formData.id_perfil_usuario}
          required
        >
          <option value="1">Admin</option>
          <option value="2">Usuario REP</option>
        </select>

        <button
          type="submit"
          className="w-full text-xl bg-primary-500 text-gray300 py-5 rounded-2xl hover:bg-primary-600 transition-colors"
        >
          Crear Usuario
        </button>
      </form>
    </div>
  );
};

export default CreacionUsuario;
