import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Paginación de listados (auditoría UI, UX-09): "Mostrando 1–50 de 349" + Anterior / Página X de Y / Siguiente.
// pagina empieza en 1 (la calcula paginar.js). Si todo cabe en una página, solo muestra el total.

const botonCls = "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed";

const Paginacion = ({ total, pagina, paginas, porPagina, onCambiar, nombre = "filas", nombreUno = "fila" }) => {
  const desde = total ? (pagina - 1) * porPagina + 1 : 0;
  const hasta = Math.min(pagina * porPagina, total);
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 mt-3 text-sm text-neutral-600">
      <span>Mostrando {desde.toLocaleString("es-CL")}–{hasta.toLocaleString("es-CL")} de {total.toLocaleString("es-CL")} {total === 1 ? nombreUno : nombre}</span>
      {paginas > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onCambiar(pagina - 1)} disabled={pagina <= 1} className={botonCls}>
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Anterior
          </button>
          <span aria-live="polite">Página {pagina} de {paginas}</span>
          <button type="button" onClick={() => onCambiar(pagina + 1)} disabled={pagina >= paginas} className={botonCls}>
            Siguiente <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
};

export default Paginacion;
