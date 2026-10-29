import React from "react";
import Dialogo from "./Dialogo.jsx";
import { X, Lock, RotateCcw } from "lucide-react";

// Piezas de la tabla con columnas configurables (ver useVistaTabla.js).

// Encabezado con el control para cambiar el ancho arrastrando su borde derecho.
export const EncabezadoAjustable = ({ columna, vistaTabla, className = "p-3" }) => (
  <th className={`${className} relative align-bottom`}>
    <span className="block break-words">{columna.label}</span>
    <span
      onMouseDown={(e) => vistaTabla.iniciarAjuste(e, columna)}
      onDoubleClick={() => vistaTabla.anchoPorDefecto(columna)}
      title="Arrastra para cambiar el ancho (doble clic: ancho original)"
      className="absolute right-0 top-0 h-full w-2 cursor-col-resize border-r border-gray-300 hover:bg-green-200"
    />
  </th>
);

// Ventana para elegir las columnas visibles. Las fijas aparecen marcadas y bloqueadas.
// tituloDatos: título del grupo de columnas base (los campos adicionales van en "Información adicional").
export const ModalColumnas = ({ columnas, vistaTabla, tituloDatos, onCerrar }) => {
  const grupos = [
    [tituloDatos, columnas.filter((c) => !c.campo)],
    ["Información adicional", columnas.filter((c) => c.campo)],
  ];
  return (
    <Dialogo onCerrar={onCerrar} className="max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-neutral-800">Columnas de la tabla</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-1 rounded-full hover:bg-gray-100"><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>
        <p className="text-sm text-neutral-500 mb-3">Elige qué columnas ver. Para cambiar el ancho, arrastra el borde derecho del encabezado.</p>
        <div className="max-h-96 overflow-y-auto space-y-4">
          {grupos.map(([titulo, lista]) => (
            <div key={titulo}>
              <p className="font-semibold text-sm text-neutral-700 mb-1">{titulo}</p>
              {lista.length === 0 && <p className="text-sm text-neutral-500">La empresa no tiene campos adicionales.</p>}
              {lista.map((c) => (
                <label key={c.id} className={`flex items-center gap-2 py-1 text-sm ${c.fija ? "text-neutral-500" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={vistaTabla.esVisible(c)}
                    disabled={c.fija}
                    onChange={(e) => vistaTabla.cambiarVisible(c.id, e.target.checked)}
                    className="w-4 h-4 accent-primary-dark"
                  />
                  <span className="flex-1">{c.label}</span>
                  {c.fija && <Lock className="w-3.5 h-3.5" aria-label="Columna fija" />}
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="flex justify-between gap-3 mt-6">
          <button onClick={vistaTabla.restablecer} className="flex items-center gap-1 text-sm text-primary-dark hover:text-green-800">
            <RotateCcw className="w-4 h-4" /> Restablecer vista
          </button>
          <button onClick={onCerrar} className="bg-primary-dark text-white px-5 py-2 rounded-lg hover:bg-primary-darker">Listo</button>
        </div>
    </Dialogo>
  );
};
