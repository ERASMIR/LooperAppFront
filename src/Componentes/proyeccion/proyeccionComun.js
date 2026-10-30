// Proyección de materiales: funciones comunes de la pantalla (no dependen de la simulación).
import { MESES } from "../ventasRevision.js";

// Fuerza de una correlación (umbral del plan: fuerte ≥ 0,8 restringe la proyección).
export const fuerza = (r) => (Math.abs(r) >= 0.8 ? "fuerte" : Math.abs(r) >= 0.6 ? "media" : "débil");

// "no domiciliario" → "No domiciliario" (el catálogo GRANSIC viene en minúsculas).
export const capitalizar = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

export const formatoTon = (n) => (n == null ? "—" : n.toLocaleString("es-CL", { minimumFractionDigits: 3, maximumFractionDigits: 3 }));
export const formatoPct = (n) => `${n.toLocaleString("es-CL", { maximumFractionDigits: 0 })} %`;
export const mesCorto = ({ anio, mes }) => `${MESES[mes - 1].slice(0, 3)} ${anio}`;

// Totales del horizonte de una serie (valor, bajo, alto) y su sensibilidad en % sobre el valor.
export const totalSerie = (s) => {
  const suma = (k) => s.proyeccion.reduce((n, p) => n + p[k], 0);
  const valor = suma("valor");
  return { valor, bajo: suma("bajo"), alto: suma("alto"), pct: valor ? ((suma("alto") - valor) / valor) * 100 : 0 };
};

export const sumarMeses = ({ anio, mes }, n) => {
  const t = anio * 12 + (mes - 1) + n;
  return { anio: Math.floor(t / 12), mes: (t % 12) + 1 };
};
