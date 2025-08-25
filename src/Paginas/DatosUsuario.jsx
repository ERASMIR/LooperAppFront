import React, { useState, useEffect } from "react";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
//import { useAuth } from "./context/AuthContext";

const DatosUsuario = ({ usuario }) => {

  const { user } = useContext(AuthContext);

  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const userId = user?.id; // el ID del usuario logueado
  

  const [usuarioData, setUsuarioData] = useState(null);



  // 🔹 Traer datos del usuario al montar
  useEffect(() => {

    if (!user?.id) return; // si todavía no hay user cargado, no disparamos la consulta

    //const [usuarioData, setUsuarioData] = useState(null);

    const fetchUsuario = async () => {
      try {
        const res = await fetch(
          `http://localhost:7071/api/getUsuarioById?id=${user.id}`
        );
        if (!res.ok) throw new Error("Error al obtener usuario");
        const data = await res.json();
        setFormData(data); // data viene con id, nombre, apellidos, empresa, mail, url_avatar, id_perfil_usuario
      } catch (err) {
        console.error("❌ Error cargando usuario:", err);
        alert("Error al cargar datos del usuario");
      } finally {
        setLoading(false);
      }
    };

    fetchUsuario();
  }, [usuario?.id]); // ✅ se dispara cuando el id ya esté definido  //[usuarioId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:7071/api/updateUsuario`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Error al actualizar datos.");
      alert("✅ Datos actualizados correctamente.");
    } catch (err) {
      console.error(err);
      alert("❌ Error al actualizar datos.");
    }
  };

  if (loading) return <p className="text-center text-xl">⏳ Cargando datos...</p>;
  if (!formData) return <p className="text-center text-xl">❌ No se encontró el usuario</p>;

  //if (!usuarioData) return <p>Cargando usuario...</p>;




return (
  <div className="flex items-center justify-center min-h-[calc(100vh-5rem)]">
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl space-y-8 p-12 bg-white rounded-2xl shadow-lg"
    >
      <h2 className="text-3xl font-bold mb-8 text-gray-800">Editar mis Datos</h2>

      {/* Nombre editable */}
      <input
        type="text"
        name="nombre"
        placeholder="Nombre"
        className="w-full bg-gray-100 text-xl p-5 rounded-2xl"
        onChange={handleChange}
        value={formData.nombre || ""}
        required
      />

      {/* Apellidos editable */}
      <input
        type="text"
        name="apellidos"
        placeholder="Apellidos"
        className="w-full bg-gray-100 text-xl p-5 rounded-2xl"
        onChange={handleChange}
        value={formData.apellidos || ""}
        required
      />

      {/* Empresa bloqueada */}
      <input
        type="text"
        name="empresa"
        placeholder="ID Empresa"
        className="w-full bg-gray-200 text-xl p-5 rounded-2xl cursor-not-allowed"
        value={formData.empresa || ""}
        disabled
      />

      {/* Email bloqueado */}
      <input
        type="email"
        name="mail"
        placeholder="Correo electrónico"
        className="w-full bg-gray-200 text-xl p-5 rounded-2xl cursor-not-allowed"
        value={formData.mail || ""}
        disabled
      />

      {/* Avatar editable */}
      <input
        type="url"
        name="url_avatar"
        placeholder="URL del avatar (opcional)"
        className="w-full bg-gray-100 text-xl p-5 rounded-2xl"
        onChange={handleChange}
        value={formData.url_avatar || ""}
      />

      {/* Perfil bloqueado */}
      <select
        name="id_perfil_usuario"
        className="w-full bg-gray-200 text-xl p-5 rounded-2xl cursor-not-allowed"
        value={formData.id_perfil_usuario || ""}
        disabled
      >
        <option value="1">Admin</option>
        <option value="2">Usuario REP</option>
        <option value="3">Dev</option>
      </select>

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
