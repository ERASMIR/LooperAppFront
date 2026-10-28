// Carga masiva del Registro de Ventas: revisión del archivo contra la Matriz de Materiales y el periodo elegido.
// Funciones puras (sin React). Plan: specs/002-registro-ventas/plan-trabajo.md
import { leerNumero } from "./cargaMasivaRevision.js";

const MAX_VALOR_CAMPO = 1000;
export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const nombrePeriodo = ({ anio, mes }) => `${MESES[mes - 1]} ${anio}`;

// Llave para cruzar SKU y unidades con la Matriz: sin distinguir mayúsculas, tildes ni espacios repetidos
// (igual que la collation de la BD), pero respetando guiones y otros signos del SKU.
export const llave = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const citar = (v) => {
  const t = String(v ?? "").trim();
  return `"${t.length > 60 ? `${t.slice(0, 57)}…` : t}"`;
};

// ── RUT ──────────────────────────────────────────────────────────────────────
// Acepta "76.123.456-0", "76123456-0" o "761234560". Devuelve "76123456-0" o null si el formato o el dígito
// verificador no son válidos.
export const normalizarRut = (valor) => {
  const t = String(valor ?? "").replace(/[.\s]/g, "").toUpperCase();
  const m = /^(\d{1,8})-?([\dK])$/.exec(t);
  if (!m) return null;
  const [, cuerpo, dv] = m;
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  return dv === esperado ? `${Number(cuerpo)}-${dv}` : null;
};

// ── Fechas ───────────────────────────────────────────────────────────────────
const dosDigitos = (n) => String(n).padStart(2, "0");

// Fecha del archivo → { anio, mes, dia, hora, minuto } o null. Acepta números de fecha de Excel, "dd/mm/aaaa",
// "dd-mm-aaaa" y "aaaa-mm-dd", con hora opcional ("hh:mm" o "hh:mm:ss"). Formato chileno: día antes que mes.
export const leerFecha = (valor) => {
  const t = String(valor ?? "").trim();
  let p = null;
  if (/^\d+(\.\d+)?$/.test(t) && Number(t) > 1) {
    // Excel cuenta los días desde el 30/12/1899; la parte decimal es la hora.
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(t) * 86400) * 1000);
    p = { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(), hora: d.getUTCHours(), minuto: d.getUTCMinutes() };
  } else {
    let m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(t);
    if (m) {
      const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      p = { anio, mes: Number(m[2]), dia: Number(m[1]), hora: Number(m[4] || 0), minuto: Number(m[5] || 0) };
    } else {
      m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(t);
      if (m) p = { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]), hora: Number(m[4] || 0), minuto: Number(m[5] || 0) };
    }
  }
  if (!p) return null;
  const d = new Date(Date.UTC(p.anio, p.mes - 1, p.dia));
  const existe = d.getUTCFullYear() === p.anio && d.getUTCMonth() === p.mes - 1 && d.getUTCDate() === p.dia;
  return existe && p.hora < 24 && p.minuto < 60 ? p : null;
};

// { anio, mes, dia, hora, minuto } → "2025-04-30 11:23" (formato que se guarda).
export const fechaIso = (f) => `${f.anio}-${dosDigitos(f.mes)}-${dosDigitos(f.dia)} ${dosDigitos(f.hora)}:${dosDigitos(f.minuto)}`;
// "2025-04-30 11:23" → "30/04/2025 11:23" (formato que se muestra).
export const fechaChilena = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(iso || "");
  if (!m) return iso || "";
  return m[4] === "00" && m[5] === "00" ? `${m[3]}/${m[2]}/${m[1]}` : `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
};

// ── Revisión ─────────────────────────────────────────────────────────────────
/**
 * Revisa las filas leídas del archivo.
 * @param filas      [{ fila, valores: { encabezado: texto } }]
 * @param asignacion { claveCampo: encabezado } (claves base y "campo:<id>")
 * @param crear      encabezados que se crearán como campo adicional
 * @param base       campos base (todos obligatorios): [{ key, label }]
 * @param periodo    { anio, mes } elegido para la carga
 * @param productos  Matriz vigente: [{ sku, descripcion, unidades: [{ unidad }] }]
 * @param unidades   catálogo de unidades de venta: [{ nombre, aGranel }]
 * @param campos     campos adicionales de ventas de la empresa: [{ id, nombre }]
 * @returns { errores, excluidos, advertencias, lineas, resumen }
 *   errores:      [{ fila, sku, mensaje }] — bloquean el guardado.
 *   excluidos:    [{ sku, unidad, descripcion, filas, motivo: "sku" | "unidad", unidadesMatriz }] — no están en la Matriz.
 *   advertencias: [{ sku, archivo, matriz, filas }] — la descripción no coincide con la de la Matriz.
 *   lineas:       líneas válidas a guardar.
 */
export const revisarVentas = ({ filas, asignacion, crear, base, periodo, productos, unidades, campos }) => {
  const porSku = new Map(productos.map((p) => [llave(p.sku), p]));
  const granel = new Map(unidades.map((u) => [llave(u.nombre), !!u.aGranel]));
  const columnasCampo = [
    ...campos.filter((c) => asignacion[`campo:${c.id}`]).map((c) => ({ campoId: c.id, nombre: c.nombre, col: asignacion[`campo:${c.id}`] })),
    ...crear.map((col) => ({ campoId: null, nombre: col, col })),
  ];

  const errores = [];
  const excluidos = new Map(); // "sku::unidad" → excluido
  const advertencias = new Map(); // sku → advertencia
  const lineas = [];

  for (const f of filas) {
    const v = (clave) => ((asignacion[clave] ? f.valores[asignacion[clave]] : "") || "").trim();
    const sku = v("sku");
    const erroresFila = [];
    const error = (mensaje) => erroresFila.push({ fila: f.fila, sku, mensaje });

    const faltan = base.filter((b) => !v(b.key)).map((b) => b.label);
    if (faltan.length) {
      error(faltan.length === 1 ? `Falta el dato obligatorio "${faltan[0]}".` : `Faltan los datos obligatorios: ${faltan.join(", ")}.`);
    }

    // SKU + unidad que no están en la Matriz: la línea se excluye (no es error) y se informa al usuario.
    const producto = sku ? porSku.get(llave(sku)) : null;
    const unidadArchivo = v("unidad");
    const unidadMatriz = producto && unidadArchivo ? producto.unidades.find((u) => llave(u.unidad) === llave(unidadArchivo)) : null;
    if (sku && unidadArchivo && !unidadMatriz) {
      const clave = `${llave(sku)}::${llave(unidadArchivo)}`;
      const ex = excluidos.get(clave) || {
        sku, unidad: unidadArchivo, descripcion: v("descripcion"), filas: 0,
        motivo: producto ? "unidad" : "sku", unidadesMatriz: producto ? producto.unidades.map((u) => u.unidad) : [],
      };
      ex.filas += 1;
      excluidos.set(clave, ex);
      continue;
    }
    if (faltan.length) {
      errores.push(...erroresFila);
      continue;
    }

    if (llave(v("descripcion")) !== llave(producto.descripcion)) {
      const adv = advertencias.get(producto.sku) || { sku: producto.sku, archivo: v("descripcion"), matriz: producto.descripcion, filas: 0 };
      adv.filas += 1;
      advertencias.set(producto.sku, adv);
    }

    const rut = normalizarRut(v("rut"));
    if (!rut) error(`El RUT ${citar(v("rut"))} no es válido (revisa el dígito verificador). Ej.: 76.123.456-0.`);

    const fecha = leerFecha(v("fecha"));
    if (!fecha) {
      error(`La fecha ${citar(v("fecha"))} no es válida. Usa el formato dd/mm/aaaa (opcionalmente con hora hh:mm).`);
    } else if (fecha.anio !== periodo.anio || fecha.mes !== periodo.mes) {
      error(`La fecha ${fechaChilena(fechaIso(fecha))} está fuera del periodo ${nombrePeriodo(periodo)}. Ajústala o cárgala en el periodo que corresponde.`);
    }

    const cantidad = leerNumero(v("cantidad"));
    if (cantidad === null) {
      error(`La cantidad ${citar(v("cantidad"))} no es un número. Escríbela solo con dígitos y coma o punto decimal (ej.: 2 o 6,28).`);
    } else if (!(cantidad > 0)) {
      error(`La cantidad ${citar(v("cantidad"))} debe ser mayor que 0.`);
    } else if (!Number.isInteger(cantidad) && !granel.get(llave(unidadMatriz.unidad))) {
      error(`La cantidad ${citar(v("cantidad"))} tiene decimales, pero la unidad "${unidadMatriz.unidad}" no es a granel: se vende en unidades enteras.`);
    }

    const valoresCampo = [];
    for (const c of columnasCampo) {
      const valor = (f.valores[c.col] || "").trim();
      if (!valor) continue;
      if (valor.length > MAX_VALOR_CAMPO) error(`El campo "${c.nombre}" supera ${MAX_VALOR_CAMPO} caracteres.`);
      valoresCampo.push({ campoId: c.campoId, nombre: c.nombre, valor });
    }

    if (erroresFila.length) {
      errores.push(...erroresFila);
      continue;
    }
    lineas.push({
      fila: f.fila,
      sku: producto.sku, // como está escrito en la Matriz
      descripcion: v("descripcion"),
      razonSocial: v("razonSocial"),
      rut,
      fecha: fechaIso(fecha),
      cantidad,
      unidad: unidadMatriz.unidad,
      camposAdicionales: valoresCampo,
    });
  }

  const listaExcluidos = [...excluidos.values()].sort((a, b) => a.sku.localeCompare(b.sku, "es"));
  return {
    errores,
    excluidos: listaExcluidos,
    advertencias: [...advertencias.values()],
    lineas,
    resumen: {
      filas: filas.length,
      validas: lineas.length,
      conError: new Set(errores.map((e) => e.fila)).size,
      excluidas: listaExcluidos.reduce((n, e) => n + e.filas, 0),
    },
  };
};

// Modo "combinar": SKU del archivo que ya tienen líneas en el periodo (se reemplazarán todas) → [{ sku, existentes, nuevas }].
export const reemplazosPorSku = (lineas, existentes) => {
  const nuevas = new Map();
  for (const l of lineas) nuevas.set(llave(l.sku), { sku: l.sku, nuevas: (nuevas.get(llave(l.sku))?.nuevas || 0) + 1 });
  const conteo = new Map();
  for (const l of existentes) {
    const k = llave(l.sku);
    if (nuevas.has(k)) conteo.set(k, (conteo.get(k) || 0) + 1);
  }
  return [...conteo.entries()]
    .map(([k, n]) => ({ sku: nuevas.get(k).sku, existentes: n, nuevas: nuevas.get(k).nuevas }))
    .sort((a, b) => a.sku.localeCompare(b.sku, "es"));
};
