// Matriz de Materiales: ventanas y piezas comunes (separado de Paginas/MatrizMateriales.jsx, auditoría UI RC-05; mismo comportamiento).
import React, { useState } from "react";
import Dialogo from "../Dialogo.jsx";
import { MAX_NOMBRE_CAMPO, mismoNombre, esDeComponente, inputCls, labelCls } from "./utilidades.js";
import { Plus, X, Trash2, AlertTriangle, Pencil } from "lucide-react";

// ── Piezas comunes ────────────────────────────────────────────────────────────
// Desplegable con botón "+" para crear un valor nuevo (solo admin/dev). opciones: [{ value, label }].
export const SelectConMas = ({ id, value, onChange, opciones, placeholder, onMas, puedeCrear, disabled, tituloMas }) => (
  <div className="flex gap-1.5">
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={inputCls}>
      <option value="">{placeholder}</option>
      {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {puedeCrear && (
      <button
        type="button"
        onClick={onMas}
        disabled={disabled}
        title={tituloMas}
        aria-label={tituloMas}
        className="flex-shrink-0 w-9 rounded-lg bg-primary-dark text-white flex items-center justify-center hover:bg-primary-darker disabled:bg-gray-300"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
      </button>
    )}
  </div>
);

export const Modal = ({ titulo, onCerrar, children }) => (
  <Dialogo onCerrar={onCerrar} className="max-w-md p-6">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-lg font-bold text-neutral-800">{titulo}</h2>
      <button onClick={onCerrar} aria-label="Cerrar" className="p-1 rounded-full hover:bg-gray-100"><X className="w-5 h-5" aria-hidden="true" /></button>
    </div>
    {children}
  </Dialogo>
);

// Modal genérico para crear un elemento de catálogo. onGuardar es async y puede lanzar el error del back.
export const ModalNuevo = ({ titulo, campos, onGuardar, onCerrar, existentes }) => {
  const [valores, setValores] = useState(Object.fromEntries(campos.map((c) => [c.key, ""])));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const nombre = (valores.nombre || "").trim();
    if (!nombre) return setError("El nombre es obligatorio.");
    if (existentes.some((e) => mismoNombre(e, nombre))) return setError("Ya existe un elemento con ese nombre.");
    const falta = campos.find((c) => c.requerido && !valores[c.key]);
    if (falta) return setError(`Indica: ${falta.label.toLowerCase()}.`);
    setGuardando(true);
    try {
      await onGuardar({ ...valores, nombre });
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  };

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <div className="space-y-3">
        {campos.map((c) => (
          <div key={c.key}>
            <label htmlFor={`nuevo-${c.key}`} className={labelCls}>{c.label}</label>
            {c.opciones ? (
              <select id={`nuevo-${c.key}`} value={valores[c.key]} onChange={(e) => setValores({ ...valores, [c.key]: e.target.value })} className={inputCls}>
                <option value="">Seleccionar</option>
                {c.opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                type={c.type || "text"}
                maxLength={c.maxLength}
                min={c.type === "number" ? 0 : undefined}
                step="any"
                value={valores[c.key]}
                onChange={(e) => setValores({ ...valores, [c.key]: e.target.value })}
                className={inputCls}
                autoFocus={c.key === "nombre"}
              />
            )}
          </div>
        ))}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onCerrar} className="btn-secundario">Cancelar</button>
        <button onClick={guardar} disabled={guardando} className="btn-principal">
          {guardando ? "Guardando…" : "Agregar"}
        </button>
      </div>
    </Modal>
  );
};

// Confirmación de acciones delicadas (eliminar, cambiar SKU). onConfirmar puede ser async.
export const ModalConfirmar = ({ titulo, children, textoConfirmar, peligro, onConfirmar, onCerrar }) => {
  const [error, setError] = useState("");
  const [enCurso, setEnCurso] = useState(false);

  const confirmar = async () => {
    setEnCurso(true);
    try {
      await onConfirmar();
    } catch (err) {
      setError(err.message);
      setEnCurso(false);
    }
  };

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <div className="flex gap-3 text-sm text-neutral-700">
        <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${peligro ? "text-red-600" : "text-yellow-600"}`} />
        <div className="space-y-2">{children}</div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onCerrar} className="btn-secundario">Cancelar</button>
        <button
          onClick={confirmar}
          disabled={enCurso}
          className={`text-white px-5 py-2 rounded-lg disabled:bg-gray-400 ${peligro ? "bg-red-600 hover:bg-red-700" : "bg-primary-dark hover:bg-primary-darker"}`}
        >
          {enCurso ? "Procesando…" : textoConfirmar}
        </button>
      </div>
    </Modal>
  );
};

// Lista de campos adicionales de la empresa: renombrar y eliminar (soft delete; los valores se conservan).
// onRenombrar(id, nombre) y onEliminar(id) son async y pueden lanzar el error del back.
export const ModalGestionarCampos = ({ campos, onRenombrar, onEliminar, onCerrar }) => {
  const [editandoId, setEditandoId] = useState(null);
  const [nombre, setNombre] = useState("");
  const [eliminandoId, setEliminandoId] = useState(null);
  const [error, setError] = useState("");
  const [enCurso, setEnCurso] = useState(false);

  const ejecutar = async (accion) => {
    setEnCurso(true);
    setError("");
    try {
      await accion();
      setEditandoId(null);
      setEliminandoId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnCurso(false);
    }
  };

  const guardarNombre = (campo) => {
    const nuevo = nombre.trim();
    if (!nuevo) return setError("El nombre es obligatorio.");
    if (nuevo === campo.nombre) return setEditandoId(null);
    if (campos.some((c) => c.id !== campo.id && mismoNombre(c.nombre, nuevo))) return setError("Ya existe un campo con ese nombre.");
    ejecutar(() => onRenombrar(campo.id, nuevo));
  };

  return (
    <Modal titulo="Campos adicionales" onCerrar={onCerrar}>
      <p className="text-sm text-neutral-500 mb-3">
        Los campos son de toda la empresa. Al eliminar uno se oculta en todos los productos; sus valores no se borran y
        vuelven a aparecer si creas otro campo con el mismo nombre.
      </p>
      {campos.length === 0 && <p className="text-sm text-neutral-600">La empresa no tiene campos adicionales.</p>}
      <ul className="divide-y max-h-80 overflow-y-auto">
        {[...campos].sort((a, b) => esDeComponente(a) - esDeComponente(b)).map((c, i, lista) => (
          <li key={c.id} className="py-2">
            {(i === 0 || esDeComponente(c) !== esDeComponente(lista[i - 1])) && (
              <p className="text-xs font-semibold uppercase text-neutral-500 mb-1">{esDeComponente(c) ? "Del componente" : "Del producto"}</p>
            )}
            {editandoId === c.id ? (
              <div className="flex gap-1.5">
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && guardarNombre(c)}
                  maxLength={MAX_NOMBRE_CAMPO}
                  autoFocus
                  className={inputCls}
                />
                <button onClick={() => guardarNombre(c)} disabled={enCurso} className="btn-principal">
                  Guardar
                </button>
                <button onClick={() => { setEditandoId(null); setError(""); }} title="Cancelar" className="p-1.5 rounded-full hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : eliminandoId === c.id ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1">¿Eliminar <b>{c.nombre}</b>?</span>
                <button onClick={() => setEliminandoId(null)} className="px-3 py-1 rounded-lg border border-primary text-primary-dark hover:bg-green-50">Cancelar</button>
                <button onClick={() => ejecutar(() => onEliminar(c.id))} disabled={enCurso} className="btn-peligro btn-chico">
                  Eliminar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1">{c.nombre}</span>
                <button
                  title="Renombrar"
                  onClick={() => { setEditandoId(c.id); setNombre(c.nombre); setEliminandoId(null); setError(""); }}
                  className="p-1.5 rounded-full hover:bg-green-50 text-primary-dark"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  title="Eliminar"
                  onClick={() => { setEliminandoId(c.id); setEditandoId(null); setError(""); }}
                  className="p-1.5 rounded-full hover:bg-red-50 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex justify-end mt-6">
        <button onClick={onCerrar} className="btn-secundario">Cerrar</button>
      </div>
    </Modal>
  );
};
