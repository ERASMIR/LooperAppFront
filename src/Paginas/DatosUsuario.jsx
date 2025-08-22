import React, { useState, useEffect } from "react";

const DatosUsuario = ({ usuario }) => {
  const [formData, setFormData] = useState({
    nombre: usuario?.nombre || "",
    apellidos: usuario?.apellidos || "",
    empresa: usuario?.empresa || "",
    mail: usuario?.mail || "",
    url_avatar: usuario?.url_avatar || "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`https://<TUS-AZURE-FUNCTION>/api/editarUsuario/${usuario.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Error al actualizar datos.");
      alert("Datos actualizados correctamente.");
    } catch (err) {
      console.error(err);
      alert("Error al actualizar datos.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-5rem)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl space-y-8 p-12 bg-white rounded-2xl shadow-lg"
      >
        <h2 className="text-3xl font-bold mb-8 text-gray-800">Editar mis Datos</h2>

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
          type="url"
          name="url_avatar"
          placeholder="URL del avatar (opcional)"
          className="w-full bg-gray-100 text-xl p-5 rounded-2xl focus:outline-none placeholder-gray-400"
          onChange={handleChange}
          value={formData.url_avatar}
        />

        <button
          type="submit"
          className="w-full text-xl bg-primary-500 text-white py-5 rounded-2xl hover:bg-primary-600 transition-colors"
        >
          Guardar Cambios
        </button>
      </form>
    </div>
  );

};

export default DatosUsuario;
