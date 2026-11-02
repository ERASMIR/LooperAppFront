import React from "react";

// Encabezado común de las páginas (auditoría UI, 2026-10-30): caja blanca con barra verde a la izquierda,
// título y descripción. `extra`: dato discreto a la derecha (p. ej. el sistema de gestión). `className` agrega clases
// al contenedor (p. ej. ancho o flex-shrink-0).
const EncabezadoPagina = ({ titulo, descripcion, extra, className = "" }) => (
  <header
    className={`mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-2 bg-white border border-neutral-200 border-l-4 border-l-primary rounded-xl px-5 py-4 shadow-sm ${className}`}
  >
    <div>
      <h1 className="text-[1.6rem] leading-tight font-bold tracking-tight text-neutral-800">{titulo}</h1>
      {descripcion && <p className="mt-1 text-neutral-600">{descripcion}</p>}
    </div>
    {extra && <div className="text-sm text-neutral-600">{extra}</div>}
  </header>
);

export default EncabezadoPagina;
