// Crear Reporte: funciones de apoyo (separado de Paginas/ReportePeriodo.jsx, auditoría UI RC-05; mismo comportamiento).


// (specs/003-reporte/plantilla-resimple.md).
export const esReSimple = (gransic) => /resimple/i.test(gransic?.nombre || "");

export const inputCls = "campo";
// 8 decimales: el corte de ReSimple y la precisión con que se guarda el reporte (specs/008-precision-pesos).
export const formatoTon = (n) => (n ? n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : "—");
export const formatoFechaHora = (f) => new Date(f).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const plural = (n, uno, varios) => `${n.toLocaleString("es-CL")} ${n === 1 ? uno : varios}`;

export const periodoAnterior = () => {
  const hoy = new Date();
  return hoy.getMonth() === 0 ? { anio: hoy.getFullYear() - 1, mes: 12 } : { anio: hoy.getFullYear(), mes: hoy.getMonth() };
};

export const toneladasTotales = (r) =>
  r.toneladasTotal ?? r.materiales.reduce((n, m) => n + (m.toneladasPeligroso || 0) + (m.toneladasNoPeligroso || 0) + (m.toneladasTotal || 0), 0);
export const clavePeriodo = ({ anio, mes }) => `${anio}-${mes}`;

// Reportes agrupados por periodo (el más reciente primero): { anio, mes, vigente, versiones (la más reciente primero) }.
export const agruparPorPeriodo = (reportes) => {
  const grupos = new Map();
  for (const r of reportes) {
    const g = grupos.get(clavePeriodo(r)) || { anio: r.anio, mes: r.mes, vigente: null, versiones: [] };
    g.versiones.push(r);
    if (!r.eliminado) g.vigente = r;
    grupos.set(clavePeriodo(r), g);
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, versiones: g.versiones.sort((a, b) => b.creadoFecha.localeCompare(a.creadoFecha)) }))
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes);
};
