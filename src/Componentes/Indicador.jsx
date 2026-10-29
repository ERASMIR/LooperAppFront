import React from "react";

// Cuadros de resumen (cantidades de un listado, una carga o un reporte), iguales en todos los módulos.
// Un color por significado, el mismo en toda la app (decisión 2026-10-29):
//   neutro   → totales y contexto (líneas, SKU, clientes, última carga, sin cambios, periodos)
//   correcto → lo que se procesó o se guarda (procesadas, válidas, nuevos)
//   cambio   → lo que se modifica (modificados)
//   atencion → lo que no cuenta o hay que revisar (no encontradas, excluidas, avisos, periodos sin reporte)
//   error    → lo que bloquea (con errores)
// "atencion" y "error" solo se colorean si el número es mayor que 0: un 0 no alarma.
const TONOS = {
  neutro: "bg-white border-neutral-200 text-neutral-800",
  correcto: "bg-green-50 border-green-200 text-green-800",
  cambio: "bg-blue-50 border-blue-200 text-blue-800",
  atencion: "bg-yellow-50 border-yellow-200 text-yellow-900",
  error: "bg-red-50 border-red-200 text-red-700",
};
const SOLO_SI_HAY = new Set(["atencion", "error"]);

// valor: número (se muestra grande, con separador de miles) o texto (fecha, nombre: tamaño normal).
export const Indicador = ({ etiqueta, valor, tono = "neutro", ayuda }) => {
  const esNumero = typeof valor === "number";
  const tonoFinal = SOLO_SI_HAY.has(tono) && esNumero && valor === 0 ? "neutro" : tono;
  return (
    <div className={`rounded-xl border px-4 py-3 min-w-0 ${TONOS[tonoFinal] || TONOS.neutro}`} title={ayuda}>
      <p className={`text-xs ${tonoFinal === "neutro" ? "text-neutral-500" : ""}`}>{etiqueta}</p>
      {esNumero
        ? <p className="text-2xl font-bold tabular-nums leading-tight">{valor.toLocaleString("es-CL")}</p>
        : <p className="mt-1 font-semibold leading-tight truncate">{valor ?? "—"}</p>}
    </div>
  );
};

// Fila de cuadros: 2 por fila en pantallas chicas, hasta 4 en anchas.
export const Indicadores = ({ children, className = "" }) => (
  <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>{children}</div>
);
