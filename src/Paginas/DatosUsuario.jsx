import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";

const DatosUsuario = () => {
  const { user } = useContext(AuthContext);

  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changePassword, setChangePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!user?.id) return;

    const fetchUsuario = async () => {
      try {
        const res = await fetch(
          `/api-usuarios/getusuariobyid?id=${user.id}`
        );
        if (!res.ok) throw new Error("Error al obtener usuario");
        const data = await res.json();
        setFormData(data);
      } catch (err) {
        console.error("❌ Error cargando usuario:", err);
        alert("Error al cargar datos del usuario");
      } finally {
        setLoading(false);
      }
    };

    fetchUsuario();
  }, [user?.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "password") {
      setPassword(value);
    } else if (name === "confirmPassword") {
      setConfirmPassword(value);
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (changePassword) {
      if (!password || !confirmPassword) {
        setPasswordError("Por favor, rellena ambos campos de contraseña.");
        return;
      }
      if (password !== confirmPassword) {
        setPasswordError("Las contraseñas no coinciden.");
        return;
      }
    }

    const dataToUpdate = { ...formData };
    if (changePassword) {
      dataToUpdate.password = password;
    }
 
    try {
      const res = await fetch(
        `/api-usuarios/updateusuario`, {
       
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToUpdate),
      });
      if (!res.ok) throw new Error("Error al actualizar datos.");
      alert("✅ Datos actualizados correctamente.");
      if (changePassword) {
        setChangePassword(false);
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error al actualizar datos.");
    }
  };

  if (loading) return <p className="text-center text-xl">⏳ Cargando datos...</p>;
  if (!formData) return <p className="text-center text-xl">❌ No se encontró el usuario</p>;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-5rem)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl space-y-6 p-12 bg-white rounded-2xl shadow-lg"
      >
        <h2 className="text-3xl font-bold mb-6 text-gray-800">Editar mis Datos</h2>
        
        <div className="text-left">
            <p className="text-sm font-medium text-gray-600">Correo Electrónico</p>
            <p className="text-lg text-gray-500">{formData.mail || ""}</p>
        </div>

        <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">Nombre</label>
            <input
                type="text"
                name="nombre"
                id="nombre"
                className="w-full bg-gray-100 text-xl p-4 rounded-xl mt-1"
                onChange={handleChange}
                value={formData.nombre || ""}
                required
            />
        </div>

        <div>
            <label htmlFor="apellidos" className="block text-sm font-medium text-gray-700">Apellidos</label>
            <input
                type="text"
                name="apellidos"
                id="apellidos"
                className="w-full bg-gray-100 text-xl p-4 rounded-xl mt-1"
                onChange={handleChange}
                value={formData.apellidos || ""}
                required
            />
        </div>

        <div>
            <label htmlFor="empresa" className="block text-sm font-medium text-gray-700">Empresa</label>
            <input
                type="text"
                name="empresa"
                id="empresa"
                className="w-full bg-gray-200 text-xl p-4 rounded-xl mt-1 cursor-not-allowed"
                value={formData.empresa_nombre || ""}
                disabled
            />
        </div>
        


        <div>
            <label htmlFor="id_perfil_usuario" className="block text-sm font-medium text-gray-700">Perfil</label>
            <select
                name="id_perfil_usuario"
                id="id_perfil_usuario"
                className="w-full bg-gray-200 text-xl p-4 rounded-xl mt-1 cursor-not-allowed"
                value={formData.id_perfil_usuario || ""}
                disabled
            >
                <option value="1">Admin</option>
                <option value="2">Usuario REP</option>
                <option value="3">Dev</option>
            </select>
        </div>

        <div className="pt-4">
          <div className="flex items-center">
            <input
              id="change-password-checkbox"
              type="checkbox"
              checked={changePassword}
              onChange={() => setChangePassword(!changePassword)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="change-password-checkbox" className="ml-2 block text-sm text-gray-900">
              Cambiar contraseña
            </label>
          </div>

          {changePassword && (
            <div className="space-y-4 mt-4">
              <div>
                  <label htmlFor="password" class="block text-sm font-medium text-gray-700">Nueva Contraseña</label>
                  <input
                      type="password"
                      name="password"
                      id="password"
                      placeholder="••••••••"
                      className="w-full bg-gray-100 text-xl p-4 rounded-xl mt-1"
                      onChange={handleChange}
                      value={password}
                  />
              </div>
              <div>
                  <label htmlFor="confirmPassword" class="block text-sm font-medium text-gray-700">Confirmar Contraseña</label>
                  <input
                      type="password"
                      name="confirmPassword"
                      id="confirmPassword"
                      placeholder="••••••••"
                      className="w-full bg-gray-100 text-xl p-4 rounded-xl mt-1"
                      onChange={handleChange}
                      value={confirmPassword}
                  />
              </div>
            </div>
          )}
        </div>

        {passwordError && <p className="text-red-500 text-center text-sm">{passwordError}</p>}

        <button
          type="submit"
          className="w-full text-xl bg-blue-500 text-white py-4 rounded-xl hover:bg-blue-600 transition-colors mt-6"
        >
          Guardar Cambios
        </button>
      </form>
    </div>
  );
};

export default DatosUsuario;
