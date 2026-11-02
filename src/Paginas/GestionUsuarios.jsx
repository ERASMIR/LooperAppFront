import React, { useState, useEffect, useContext } from "react";
import bcrypt from "bcryptjs";
import { Pencil, KeyRound, X, Check, Loader2 } from "lucide-react";
import { API_USUARIOS } from "../config/api";
import { AuthContext } from "../context/AuthContext.jsx";
import EncabezadoPagina from "../Componentes/EncabezadoPagina";

// Ids de perfil_usuario: 1 admin, 2 usuarioREP, 3 dev (antes estaban 1 y 3 invertidos y editar cambiaba el perfil).
const PERFILES = [
  { id: "1", nombre: "admin" },
  { id: "2", nombre: "usuarioREP" },
  { id: "3", nombre: "dev" },
];
const esDev = (idPerfil) => String(idPerfil) === "3";

const GestionUsuarios = () => {
  const { token } = useContext(AuthContext);
  // Los endpoints de gestión de usuarios exigen la sesión (JWT) de un dev.
  const conSesion = { Authorization: `Bearer ${token}` };
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
        fetch(`${API_USUARIOS}/getAllUsuarios`, { headers: conSesion }),
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
      empresa_id: usuario.empresa_id ? String(usuario.empresa_id) : "",
      // Empresas con acceso además de la principal (tabla usuario_empresa); la principal siempre tiene acceso.
      empresasAcceso: (usuario.empresas_ids || []).map(String),
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
      const { empresasAcceso, ...datos } = formEditar;
      const res = await fetch(`${API_USUARIOS}/updateUsuarioAdmin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...conSesion },
        body: JSON.stringify(datos),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      // El dev ve todas las empresas: no se le asignan.
      if (!esDev(datos.id_perfil_usuario)) {
        const resEmpresas = await fetch(`${API_USUARIOS}/usuarioEmpresas`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...conSesion },
          body: JSON.stringify({ usuarioId: datos.id, empresaIds: empresasAcceso.map(Number) }),
        });
        if (!resEmpresas.ok) throw new Error("Error al asignar empresas");
      }
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
        headers: { "Content-Type": "application/json", ...conSesion },
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
    <div className="p-4 w-full">
      <EncabezadoPagina
        titulo="Gestión de Usuarios"
        descripcion="Administra los usuarios, sus perfiles, contraseñas y las empresas a las que tienen acceso."
      />

      {loading && (
        <div className="flex items-center gap-3 text-neutral-500 py-12 justify-center">
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
        <div className="overflow-x-auto tarjeta">
          <table className="w-full text-sm text-left text-neutral-700">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500 border-b">
              <tr>
                <th className="px-5 py-4">Nombre</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Empresas</th>
                <th className="px-5 py-4">Fecha de Alta</th>
                <th className="px-5 py-4">Perfil</th>
                <th className="px-5 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-neutral-50 transition">
                  <td className="px-5 py-4 font-medium">
                    {u.nombre} {u.apellidos}
                  </td>
                  <td className="px-5 py-4">{u.mail}</td>
                  <td className="px-5 py-4 text-neutral-500">{u.empresas || "—"}</td>
                  <td className="px-5 py-4 text-neutral-500">
                    {u.fecha_alta ? new Date(u.fecha_alta).toLocaleDateString("es-ES") : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-block bg-primary-light text-primary-dark text-xs font-semibold px-2 py-1 rounded-full">
                      {u.perfil || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => abrirModalEditar(u)}
                        title="Editar usuario"
                        className="p-2 rounded-lg hover:bg-primary-light text-primary-dark transition-colors"
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
                  <td colSpan={6} className="text-center py-12 text-neutral-500">
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
              aria-label="Cerrar"
              className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              <X size={20} aria-hidden="true" />
            </button>
            <h2 className="text-xl font-bold text-neutral-800 mb-6">Editar Usuario</h2>

            <form onSubmit={guardarEdicion} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">Nombre</label>
                  <input
                    type="text"
                    className="w-full campo"
                    value={formEditar.nombre || ""}
                    onChange={(e) => setFormEditar({ ...formEditar, nombre: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-600 mb-1">Apellidos</label>
                  <input
                    type="text"
                    className="w-full campo"
                    value={formEditar.apellidos || ""}
                    onChange={(e) => setFormEditar({ ...formEditar, apellidos: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full campo"
                  value={formEditar.mail || ""}
                  onChange={(e) => setFormEditar({ ...formEditar, mail: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-600 mb-1">Perfil</label>
                <select
                  className="w-full campo"
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
                <label className="block text-sm text-neutral-600 mb-1">Empresa principal</label>
                <select
                  className="w-full campo"
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

              <fieldset>
                <legend className="block text-sm text-neutral-600 mb-1">Otras empresas con acceso</legend>
                {esDev(formEditar.id_perfil_usuario) ? (
                  <p className="text-sm text-neutral-500">Un usuario dev tiene acceso a todas las empresas.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-neutral-300 px-3 py-2 space-y-1">
                    {empresas.map((emp) => {
                      const id = String(emp.id);
                      const principal = id === formEditar.empresa_id;
                      const marcada = principal || (formEditar.empresasAcceso || []).includes(id);
                      return (
                        <label key={emp.id} className="flex items-center gap-2 text-sm text-neutral-700">
                          <input
                            type="checkbox"
                            checked={marcada}
                            disabled={principal}
                            onChange={(e) => {
                              const actuales = (formEditar.empresasAcceso || []).filter((x) => x !== id);
                              setFormEditar({ ...formEditar, empresasAcceso: e.target.checked ? [...actuales, id] : actuales });
                            }}
                          />
                          {emp.nombre}
                          {principal && <span className="text-neutral-500">(principal)</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarModalEditar}
                  className="btn-secundario"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEditar}
                  className="btn-principal"
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
              aria-label="Cerrar"
              className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              <X size={20} aria-hidden="true" />
            </button>
            <h2 className="text-xl font-bold text-neutral-800 mb-2">Restablecer Contraseña</h2>
            <p className="text-sm text-neutral-500 mb-6">
              Usuario: <strong>{modalPassword.nombre} {modalPassword.apellidos}</strong>
            </p>

            <form onSubmit={guardarPassword} className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-600 mb-1">Nueva contraseña</label>
                <input
                  type="password"
                  className="w-full campo"
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
                  className="btn-secundario"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoPassword}
                  className="btn-principal"
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
