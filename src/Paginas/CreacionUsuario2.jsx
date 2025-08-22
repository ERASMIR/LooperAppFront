import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";

const CreacionUsuario = () => {
  const [formData, setFormData] = useState({
    id: uuidv4(),
    nombre: "",
    apellidos: "",
    empresa: "",
    mail: "",
    password: "",
    url_avatar: "",
    perfil_id: "2", // Por defecto, "usuarioREP"
  });


  const [errorUsuarioExistente, setErrorUsuarioExistente] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("➡️ Enviando datos al backend:", formData);

    try {
      const res = await fetch("http://localhost:7071/api/crearUsuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const text = await res.text();
      let data;
      try {
          data = JSON.parse(text);
      } catch {
          data = {};
      }

      //const data = await res.json();
      console.log("✅ Respuesta del backend:", data);

      if (!res.ok) {
        // Detectar error de usuario existente
        if (
          data?.error?.includes("Duplicate entry") ||
          data?.error?.toLowerCase()?.includes("El correo ya se encuentra registrado")
        ) {
          setErrorUsuarioExistente(true);
          return;
        }
        throw new Error("Error al crear usuario.");
      }      


      alert("Usuario creado correctamente.");
    } catch (err) {
      console.error(err);
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
        <h2 className="text-3xl font-bold mb-8 text-gray-800">Creación de Usuario (Admin)</h2>

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

        <input
          type="text"
          name="empresa"
          placeholder="Empresa"
          className="w-full bg-gray-100 text-xl p-5 rounded-2xl focus:outline-none placeholder-gray-400"
          onChange={handleChange}
          value={formData.empresa}
        />

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
          name="perfil_id"
          className="w-full bg-gray-100 text-xl p-5 rounded-2xl focus:outline-none placeholder-gray-400"
          onChange={handleChange}
          value={formData.perfil_id}
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
