import React, { useState, useEffect } from "react";
import bcrypt from "bcryptjs";
import { Pencil, KeyRound, X, Check, Loader2 } from "lucide-react";
import { API_USUARIOS } from "../config/api";

const PERFILES = [
  { id: "1", nombre: "dev" },
  { id: "2", nombre: "usuarioREP" },
  { id: "3", nombre: "admin" },
];

const GestionUsuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal editar usuario
  const [modalEditar, setModalEditar] = useState(null); // usuario seleccionado
  const [formEditar, setFormEditar] = useState({});
  const [guardandoEditar, setGuardandoEditar] = useState(false);

  // Modal restablecer contraseña
  const [modalPassword, setModalPassword] = useState(null); // usuario seleccionado
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    setError(null);
    try {
      const [resUsuarios, resEmpresas] = await Promise.all([
        fetch(`${API_USUARIOS}/getAllUsuarios`),
        fetch(`${API_USUARIOS}/getEmpresas`),
      ]);
      if (!resUsuarios.ok || !resEmpresas.ok) throw new Error("Error al cargar datos");
      const [dataUsuarios, dataEmpresas] = await Promise.all([
        resUsuarios.json(),
        resEmpresas.json(),
      ]);
      setUsuarios(dataUsuarios);
      setEmpresas(dataEmpresas);
    } catch (err) {
      setError("No se pudieron cargar los usuarios. Intenta de nuevo.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ── Abrir modal editar ──────────────────────────────────────────────────────
  function abrirModalEditar(usuario) {
    setFormEditar({
      id: usuario.id,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      mail: usuario.mail,
      id_perfil_usuario: PERFILES.find((p) => p.nombre === usuario.perfil)?.id || "2",
      empresa_id: "",
    });
    setModalEditar(usuario);
  }

  function cerrarModalEditar() {
    setModalEditar(null);
    setFormEditar({});
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    setGuardandoEditar(true);
    try {
      const res = await fetch(`${API_USUARIOS}/updateUsuarioAdmin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formEditar),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      cerrarModalEditar();
      await cargarDatos();
    } catch (err) {
      alert("Error al actualizar usuario.");
      console.error(err);
    } finally {
      setGuardandoEditar(false);
    }
  }

  // ── Abrir modal contraseña ──────────────────────────────────────────────────
  function abrirModalPassword(usuario) {
    setNuevaPassword("");
    setModalPassword(usuario);
  }

  function cerrarModalPassword() {
    setModalPassword(null);
    setNuevaPassword("");
  }

  async function guardarPassword(e) {
    e.preventDefault();
    if (!nuevaPassword || nuevaPassword.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setGuardandoPassword(true);
    try {
      const passwordHash = await bcrypt.hash(nuevaPassword, 10);
      const res = await fetch(`${API_USUARIOS}/resetPasswordAdmin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: modalPassword.id, passwordHash }),
      });
      if (!res.ok) throw new Error("Error al restablecer");
      cerrarModalPassword();
      alert("Contraseña restablecida correctamente.");
    } catch (err) {
      alert("Error al restablecer la contraseña.");
      console.error(err);
    } finally {
      setGuardandoPassword(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Gestión de Usuarios</h1>

      {loading && (
        <div className="flex items-center gap-3 text-gray-500 py-12 justify-center">
          <Loader2 className="animate-spin" size={24} />
          <span>Cargando usuarios...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-2xl shadow bg-white">
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
              <tr>
                <th className="px-5 py-4">Nombre</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Empresas</th>
                <th className="px-5 py-4">Fecha de Alta</th>
                <th className="px-5 py-4">Perfil</th>
                <th className="px-5 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4 font-medium">
                    {u.nombre} {u.apellidos}
                  </td>
                  <td className="px-5 py-4">{u.mail}</td>
                  <td className="px-5 py-4 text-gray-500">{u.empresas || "—"}</td>
                  <td className="px-5 py-4 text-gray-500">
                    {u.fecha_alta ? new Date(u.fecha_alta).toLocaleDateString("es-ES") : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">
                      {u.perfil || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => abrirModalEditar(u)}
                        title="Editar usuario"
                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => abrirModalPassword(u)}
                        title="Restablecer contraseña"
                        className="p-2 rounded-lg hover:bg-yellow-50 text-yellow-600 transition"
                      >
                        <KeyRound size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Editar Usuario ─────────────────────────────────────────── */}
      {modalEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-8 relative">
            <button
              onClick={cerrarModalEditar}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-6">Editar Usuario</h2>

            <form onSubmit={guardarEdicion} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Nombre</label>
                  <input
                    type="text"
                    className="w-full bg-gray-100 rounded-xl px-4 py-3 focus:outline-none"
                    value={formEditar.nombre || ""}
                    onChange={(e) => setFormEditar({ ...formEditar, nombre: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Apellidos</label>
                  <input
                    type="text"
                    className="w-full bg-gray-100 rounded-xl px-4 py-3 focus:outline-none"
                    value={formEditar.apellidos || ""}
                    onChange={(e) => setFormEditar({ ...formEditar, apellidos: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 focus:outline-none"
                  value={formEditar.mail || ""}
                  onChange={(e) => setFormEditar({ ...formEditar, mail: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Perfil</label>
                <select
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 focus:outline-none"
                  value={formEditar.id_perfil_usuario || "2"}
                  onChange={(e) => setFormEditar({ ...formEditar, id_perfil_usuario: e.target.value })}
                >
                  {PERFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Empresa principal</label>
                <select
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 focus:outline-none"
                  value={formEditar.empresa_id || ""}
                  onChange={(e) => setFormEditar({ ...formEditar, empresa_id: e.target.value })}
                >
                  <option value="">Sin cambio</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarModalEditar}
                  className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEditar}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-60"
                >
                  {guardandoEditar ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Restablecer Contraseña ────────────────────────────────────── */}
      {modalPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-8 relative">
            <button
              onClick={cerrarModalPassword}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Restablecer Contraseña</h2>
            <p className="text-sm text-gray-500 mb-6">
              Usuario: <strong>{modalPassword.nombre} {modalPassword.apellidos}</strong>
            </p>

            <form onSubmit={guardarPassword} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nueva contraseña</label>
                <input
                  type="password"
                  className="w-full bg-gray-100 rounded-xl px-4 py-3 focus:outline-none"
                  placeholder="Mínimo 6 caracteres"
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarModalPassword}
                  className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoPassword}
                  className="px-5 py-2 rounded-xl bg-yellow-500 text-white hover:bg-yellow-600 transition flex items-center gap-2 disabled:opacity-60"
                >
                  {guardandoPassword ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <KeyRound size={16} />
                  )}
                  Restablecer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionUsuarios;
