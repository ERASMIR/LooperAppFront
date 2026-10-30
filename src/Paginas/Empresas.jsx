import React, { useCallback, useContext, useEffect, useState } from "react";
import Dialogo from "../Componentes/Dialogo.jsx";
import { AuthContext } from "../context/AuthContext.jsx";
import { API_USUARIOS } from "../config/api";
import { llamarApi as llamarApiBase, textoError } from "../config/apiCliente.js";
import { normalizarRut } from "../Componentes/ventasRevision.js";
import { Loader2, Pencil, Plus, X, CheckCircle2, AlertTriangle } from "lucide-react";

import EncabezadoPagina from "../Componentes/EncabezadoPagina";
// Empresas: datos de la empresa que pide la declaración (plantilla oficial de ReSimple: razón social, responsable, RUT y
// representante legal) más el ID RETC del MMA. Dev crea y edita todas; el admin edita solo la suya (sin el GRANSIC, que
// define el cálculo). API: /empresas de looper-usuarios (GET/POST/PUT, con sesión). Plan: specs/003-reporte/plantilla-resimple.md

// Cliente común (config/apiCliente.js); el mensaje incluye la lista de errores del back para mostrarlo en el formulario.
const llamarApi = (token, metodo, body) =>
  llamarApiBase(token, API_USUARIOS, "empresas", { metodo, body }).catch((err) => { throw new Error(textoError(err)); });

const VACIA = {
  nombre: "", rut: "", representante_legal: "", responsable: "", correo_responsable: "",
  direccion: "", telefono: "", id_retc: "", gransic_id: "",
};
// Obligatorios: los que pide la plantilla de ReSimple, más el sistema de gestión (GRANSIC).
const OBLIGATORIOS = [
  ["nombre", "Razón social"], ["rut", "RUT"], ["representante_legal", "Representante legal"],
  ["responsable", "Responsable"], ["gransic_id", "Sistema de gestión (GRANSIC)"],
];

const inputCls = "w-full campo";

// Empresa → datos que faltan para declarar (nombres de campo legibles).
const faltantesDeclaracion = (e) => OBLIGATORIOS.filter(([k]) => !String(e?.[k] ?? "").trim()).map(([, n]) => n);

const validar = (datos) => {
  const errores = {};
  for (const [k, n] of OBLIGATORIOS) if (!String(datos[k] ?? "").trim()) errores[k] = `${n} es obligatorio.`;
  if (datos.rut && !normalizarRut(datos.rut)) errores.rut = "El RUT no es válido (revisa el dígito verificador).";
  if (datos.correo_responsable && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.correo_responsable)) {
    errores.correo_responsable = "El correo no es válido.";
  }
  return errores;
};

const Campo = ({ id, label, obligatorio, error, children, ayuda }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-semibold text-neutral-700 mb-1">
      {label} {obligatorio && <span className="text-red-600">*</span>}
    </label>
    {children}
    {ayuda && !error && <p className="text-xs text-neutral-500 mt-1">{ayuda}</p>}
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
);

const FormularioEmpresa = ({ inicial, gransicList, puedeGransic, onGuardar, onCerrar }) => {
  const [datos, setDatos] = useState({ ...VACIA, ...inicial });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState("");
  const editando = Boolean(inicial?.id);

  const cambiar = (e) => setDatos((d) => ({ ...d, [e.target.name]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    const encontrados = validar(datos);
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;
    setGuardando(true);
    setErrorGeneral("");
    try {
      await onGuardar({ ...datos, rut: normalizarRut(datos.rut) });
    } catch (err) {
      setErrorGeneral(err.message);
      setGuardando(false);
    }
  };

  const input = (name, props = {}) => (
    <input id={`empresa-${name}`} name={name} value={datos[name] ?? ""} onChange={cambiar} className={inputCls} {...props} />
  );

  return (
    <Dialogo como="form" onSubmit={guardar} noValidate onCerrar={guardando ? undefined : onCerrar} className="max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col">
        <div className="flex justify-between items-center px-6 pt-5 pb-3 border-b">
          <h2 className="text-lg font-bold text-neutral-800">{editando ? `Editar ${inicial.nombre}` : "Nueva empresa"}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="p-1 rounded-full hover:bg-gray-100"><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          <section>
            <h3 className="font-semibold text-neutral-800 mb-1">Datos para la declaración</h3>
            <p className="text-xs text-neutral-500 mb-3">Se usan para completar la planilla oficial del sistema de gestión.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo id="empresa-nombre" label="Razón social" obligatorio error={errores.nombre}>{input("nombre", { maxLength: 255 })}</Campo>
              <Campo id="empresa-rut" label="RUT" obligatorio error={errores.rut} ayuda="Ej.: 76.123.456-0">{input("rut", { maxLength: 12, spellCheck: false, autoComplete: "off" })}</Campo>
              <Campo id="empresa-representante_legal" label="Representante legal" obligatorio error={errores.representante_legal}>
                {input("representante_legal", { maxLength: 150 })}
              </Campo>
              <Campo id="empresa-responsable" label="Responsable" obligatorio error={errores.responsable}>{input("responsable", { maxLength: 255 })}</Campo>
              <Campo id="empresa-id_retc" label="ID RETC" error={errores.id_retc} ayuda="N° de la empresa para declarar al MMA (opcional).">
                {input("id_retc", { maxLength: 30 })}
              </Campo>
              <Campo id="empresa-gransic_id" label="Sistema de gestión (GRANSIC)" obligatorio error={errores.gransic_id}
                ayuda={puedeGransic ? null : "Solo lo cambia un usuario dev: define el cálculo del reporte."}>
                <select id="empresa-gransic_id" name="gransic_id" value={datos.gransic_id ?? ""} onChange={cambiar} disabled={!puedeGransic} className={`${inputCls} disabled:opacity-60`}>
                  <option value="">Seleccionar</option>
                  {gransicList.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </Campo>
            </div>
          </section>
          <section>
            <h3 className="font-semibold text-neutral-800 mb-3">Contacto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo id="empresa-correo_responsable" label="Correo del responsable" error={errores.correo_responsable}>
                {input("correo_responsable", { type: "email", maxLength: 255, autoComplete: "email", spellCheck: false })}
              </Campo>
              <Campo id="empresa-telefono" label="Teléfono" error={errores.telefono}>{input("telefono", { type: "tel", inputMode: "tel", maxLength: 50, autoComplete: "tel" })}</Campo>
              <div className="sm:col-span-2">
                <Campo id="empresa-direccion" label="Dirección" error={errores.direccion}>{input("direccion", { maxLength: 255 })}</Campo>
              </div>
            </div>
          </section>
          {errorGeneral && <p role="alert" className="text-sm text-red-600">{errorGeneral}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button type="button" onClick={onCerrar} disabled={guardando} className="btn-secundario">Cancelar</button>
          <button type="submit" disabled={guardando} className="btn-principal">
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />} {editando ? "Guardar cambios" : "Crear empresa"}
          </button>
        </div>
    </Dialogo>
  );
};

const Empresas = () => {
  const { user, token } = useContext(AuthContext);
  const esDev = user?.perfil === "dev";

  const [empresas, setEmpresas] = useState(null);
  const [gransicList, setGransicList] = useState([]);
  const [editando, setEditando] = useState(null); // empresa en el formulario ({} = nueva)
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    fetch(`${API_USUARIOS}/getGransic`).then((r) => r.json()).then(setGransicList).catch((err) => setError(err.message));
  }, []);

  // Dev: todas las empresas (el back las entrega todas). Admin: solo la empresa seleccionada.
  const cargar = useCallback(async () => {
    try {
      const { empresas: lista } = await llamarApi(token, "GET");
      const propias = esDev ? lista : lista.filter((e) => e.id === user.empresaId);
      setEmpresas(propias.map((e) => ({ ...VACIA, ...Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v ?? ""])) })));
    } catch (err) {
      setError(err.message);
    }
  }, [esDev, token, user?.empresaId]);
  useEffect(() => { if (token) cargar(); }, [cargar, token]);

  // Lanza el error del back para que el formulario lo muestre.
  const guardar = async (datos) => {
    await llamarApi(token, datos.id ? "PUT" : "POST", datos);
    setAviso(datos.id ? `Datos de ${datos.nombre} guardados.` : `Empresa ${datos.nombre} creada.`);
    setEditando(null);
    cargar();
  };

  const nombreGransic = (id) => gransicList.find((g) => String(g.id) === String(id))?.nombre || "—";

  return (
    <div className="p-4 w-full">
      <EncabezadoPagina
        titulo={esDev ? "Empresas" : "Datos de la empresa"}
        descripcion="Datos de la empresa para las declaraciones ante el sistema de gestión y el MMA."
      />

      <div className="tarjeta p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {esDev && (
            <button onClick={() => setEditando({})} className="btn-principal">
              <Plus className="w-4 h-4" /> Nueva empresa
            </button>
          )}
        </div>

        {aviso && (
          <div role="status" className="mb-4 flex items-center gap-2 text-sm rounded-xl px-4 py-2 border text-green-800 bg-green-50 border-green-200">
            <CheckCircle2 className="w-4 h-4" /><span className="flex-1">{aviso}</span>
            <button onClick={() => setAviso("")} className="p-0.5 rounded-full hover:bg-black/5"><X className="w-4 h-4" /></button>
          </div>
        )}
        {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}

        {!empresas ? (
          <p className="flex items-center gap-2 text-neutral-600"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>
        ) : (
          <div className="overflow-auto border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-neutral-600">
                <tr>
                  <th className="p-3">Razón social</th>
                  <th className="p-3">RUT</th>
                  <th className="p-3">Representante legal</th>
                  <th className="p-3">Responsable</th>
                  <th className="p-3">ID RETC</th>
                  <th className="p-3">GRANSIC</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {empresas.length === 0 && (
                  <tr><td colSpan={7} className="p-4 text-center text-neutral-500">No hay empresas.</td></tr>
                )}
                {empresas.map((e) => {
                  const faltan = faltantesDeclaracion(e);
                  return (
                    <tr key={e.id} className="border-t align-top">
                      <td className="p-3 font-semibold">
                        {e.nombre}
                        {faltan.length > 0 && (
                          <p className="mt-1 flex items-center gap-1 text-xs font-normal text-yellow-800">
                            <AlertTriangle className="w-3.5 h-3.5" /> Faltan: {faltan.join(", ")}
                          </p>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">{e.rut || "—"}</td>
                      <td className="p-3">{e.representante_legal || "—"}</td>
                      <td className="p-3">{e.responsable || "—"}</td>
                      <td className="p-3">{e.id_retc || "—"}</td>
                      <td className="p-3">{nombreGransic(e.gransic_id)}</td>
                      <td className="p-3 text-right">
                        <button title="Editar" onClick={() => setEditando(e)} className="p-1.5 rounded-full hover:bg-gray-100 text-primary-dark">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <FormularioEmpresa
          inicial={editando}
          gransicList={gransicList}
          puedeGransic={esDev}
          onGuardar={guardar}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
};

export default Empresas;
