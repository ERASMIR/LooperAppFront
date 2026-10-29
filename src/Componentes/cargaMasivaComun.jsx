import React from "react";
import Dialogo from "./Dialogo.jsx";
import { X, AlertTriangle } from "lucide-react";
import { FILAS_POR_PAGINA, inputCls } from "./cargaMasivaLectura.js";

// Ventanas y piezas de UI comunes de las cargas masivas (Matriz de Materiales y Registro de Ventas).

// ── Ventana ───────────────────────────────────────────────────────────────────
export const Ventana = ({ titulo, onCerrar, children, pie }) => (
  <Dialogo onCerrar={onCerrar} className="max-w-4xl max-h-[calc(100dvh-2rem)] flex flex-col">
    <div className="flex justify-between items-center px-6 pt-5 pb-3">
      <h2 className="text-lg font-bold text-neutral-800">{titulo}</h2>
      <button onClick={onCerrar} aria-label="Cerrar" className="p-1 rounded-full hover:bg-gray-100"><X className="w-5 h-5" aria-hidden="true" /></button>
    </div>
    <div className="px-6 overflow-y-auto flex-1 min-h-0">{children}</div>
    <div className="px-6 py-3 border-t flex flex-wrap items-center justify-end gap-3">{pie}</div>
  </Dialogo>
);

// Una fila de la asignación: nombre del campo, desplegable con las columnas del archivo y un valor de ejemplo.
export const FilaAsignacion = ({ label, obligatorio, valor, encabezados, enUso, ejemplo, aviso, onCambiar }) => (
  <div className="grid grid-cols-1 sm:grid-cols-[14rem_1fr_12rem] gap-x-3 gap-y-1 items-center py-1.5">
    <span className="text-sm font-semibold text-neutral-700">
      {label}{obligatorio && <span className="text-red-600"> *</span>}
    </span>
    <select value={valor || ""} onChange={(e) => onCambiar(e.target.value)} className={`${inputCls} ${obligatorio && !valor ? "ring-1 ring-red-300" : ""}`}>
      <option value="">{obligatorio ? "Seleccionar columna" : "No cargar"}</option>
      {encabezados.map((e) => (
        <option key={e} value={e} disabled={e !== valor && enUso.includes(e)}>
          {e}{e !== valor && enUso.includes(e) ? " (en uso)" : ""}
        </option>
      ))}
    </select>
    <span className="text-xs text-neutral-500 truncate" title={ejemplo}>{ejemplo ? `Ej.: ${ejemplo}` : ""}</span>
    {aviso && <p className="sm:col-start-2 sm:col-span-2 text-xs text-yellow-700 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />{aviso}</p>}
  </div>
);

export const Paginado = ({ total, mostradas, onMas, texto }) => (
  <div className="flex items-center justify-between gap-3 mt-2 text-sm text-neutral-500">
    <span>Mostrando {Math.min(mostradas, total)} de {total} {texto}</span>
    {mostradas < total && (
      <button onClick={onMas} className="btn-secundario btn-chico">
        Traer {FILAS_POR_PAGINA} más
      </button>
    )}
  </div>
);
