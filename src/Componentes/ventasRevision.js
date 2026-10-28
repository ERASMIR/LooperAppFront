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

// ── Documentos de la venta (T9.7: specs/002-registro-ventas/documento-tributario.md) ──
// Factura, Guía y Boleta son folios enteros; cada línea debe traer al menos uno. El pedido es texto y opcional.
export const FOLIOS = [
  { key: "folioFactura", label: "N° Factura", corto: "FAC" },
  { key: "folioGuia", label: "N° Guía de despacho", corto: "GD" },
  { key: "folioBoleta", label: "N° Boleta", corto: "BOL" },
];
export const PEDIDO = { key: "pedido", label: "N° Pedido / ID interno", corto: "PED" };
export const DOCUMENTOS = [...FOLIOS, PEDIDO];
export const MAX_PEDIDO = 100;

// Folio del archivo o del formulario: entero > 0. Acepta 1234, "1234.0" (celda numérica de Excel) y "001234".
// Devuelve el número, null si viene vacío o undefined si no es válido.
export const leerFolio = (valor) => {
  const t = String(valor ?? "").trim();
  if (!t) return null;
  if (!/^\d+(\.0+)?$/.test(t)) return undefined;
  const n = Number(t.split(".")[0]);
  return n > 0 && Number.isSafeInteger(n) ? n : undefined;
};

// Valida los documentos de una línea: { docs: { folioFactura, folioGuia, folioBoleta, pedido }, errores: [mensaje] }.
export const validarDocumentos = (valores) => {
  const docs = {};
  const errores = [];
  for (const d of FOLIOS) {
    const n = leerFolio(valores[d.key]);
    if (n === undefined) errores.push(`El ${d.label} ${citar(valores[d.key])} no es válido: debe ser un número entero mayor que 0 (ej.: 1234).`);
    docs[d.key] = n ?? null;
  }
  const pedido = String(valores.pedido ?? "").trim();
  if (pedido.length > MAX_PEDIDO) errores.push(`El ${PEDIDO.label} supera ${MAX_PEDIDO} caracteres.`);
  docs.pedido = pedido || null;
  if (!errores.length && FOLIOS.every((d) => docs[d.key] === null)) {
    errores.push("Falta el documento: indica al menos el N° de factura, de guía de despacho o de boleta.");
  }
  return { docs, errores };
};

// "FAC 100 · GD 55 · PED A-77"
export const textoDocumentos = (v) =>
  DOCUMENTOS.filter((d) => v[d.key] !== null && v[d.key] !== undefined && v[d.key] !== "").map((d) => `${d.corto} ${v[d.key]}`).join(" · ");

// Llave de duplicidad: mismos documentos + SKU + unidad + cantidad (vacío cuenta como valor).
export const firmaVenta = (v) =>
  [...DOCUMENTOS.map((d) => llave(v[d.key])), llave(v.sku), llave(v.unidad), String(v.cantidad)].join("|");

// ¿Comparten algún número de documento del mismo tipo?
export const compartenDocumento = (a, b) =>
  DOCUMENTOS.some((d) => a[d.key] != null && b[d.key] != null && llave(a[d.key]) === llave(b[d.key]));

// Documentos de la línea que ya están registrados en otros periodos de la empresa.
// otros: [{ tipo, numero, anio, mes, skus }] (lo entrega el back; en la fase 1, simulado).
export const documentosEnOtrosPeriodos = (v, otros) =>
  otros.filter((o) => v[o.tipo] != null && llave(v[o.tipo]) === llave(o.numero));

export const textoDudosa = (coincidencias) => coincidencias
  .map((o) => `${DOCUMENTOS.find((d) => d.key === o.tipo).corto} ${o.numero} también está en ${nombrePeriodo(o)} (${o.skus.join(", ")})`)
  .join(" · ");

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

    const { docs, errores: erroresDocs } = validarDocumentos(Object.fromEntries(DOCUMENTOS.map((d) => [d.key, v(d.key)])));
    erroresDocs.forEach(error);

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
      ...docs,
      camposAdicionales: valoresCampo,
    });
  }

  // Duplicidad dentro del archivo: misma venta (documentos + SKU + unidad + cantidad) en dos filas.
  const vistas = new Map();
  const unicas = [];
  for (const l of lineas) {
    const primera = vistas.get(firmaVenta(l));
    if (primera) {
      errores.push({
        fila: l.fila, sku: l.sku,
        mensaje: `Venta repetida: la fila ${primera.fila} ya trae ${textoDocumentos(l)} con el mismo SKU, unidad y cantidad (${l.cantidad} ${l.unidad}).`,
      });
    } else {
      vistas.set(firmaVenta(l), l);
      unicas.push(l);
    }
  }
  errores.sort((a, b) => a.fila - b.fila);

  const listaExcluidos = [...excluidos.values()].sort((a, b) => a.sku.localeCompare(b.sku, "es"));
  return {
    errores,
    excluidos: listaExcluidos,
    advertencias: [...advertencias.values()],
    lineas: unicas,
    resumen: {
      filas: filas.length,
      validas: unicas.length,
      conError: new Set(errores.map((e) => e.fila)).size,
      excluidas: listaExcluidos.reduce((n, e) => n + e.filas, 0),
    },
  };
};

// ── Ingreso manual (T9.8: specs/002-registro-ventas/ingreso-manual.md) ──
/**
 * Valida una venta del formulario con las mismas reglas de la carga masiva.
 * @param valores   { fecha: "AAAA-MM-DD", hora: "hh:mm" | "", sku, unidad, cantidad, razonSocial, rut, folioFactura,
 *                    folioGuia, folioBoleta, pedido }
 * @param existentes ventas vigentes del periodo (para la duplicidad); idEditando: la venta que se edita (se excluye).
 * @returns { errores: { campo: mensaje }, venta } — venta solo si no hay errores.
 */
export const revisarVentaManual = ({ valores, periodo, productos, unidades, existentes, idEditando }) => {
  const errores = {};
  const producto = productos.find((p) => llave(p.sku) === llave(valores.sku));
  const unidadMatriz = producto?.unidades.find((u) => llave(u.unidad) === llave(valores.unidad));

  const fecha = valores.fecha ? leerFecha(`${valores.fecha}${valores.hora ? ` ${valores.hora}` : ""}`) : null;
  if (!valores.fecha) errores.fecha = "Indica la fecha de la venta.";
  else if (!fecha) errores.fecha = "La fecha no es válida.";
  else if (fecha.anio !== periodo.anio || fecha.mes !== periodo.mes) errores.fecha = `La fecha debe estar dentro de ${nombrePeriodo(periodo)}.`;

  if (!producto) errores.sku = valores.sku ? "El SKU no existe en la Matriz de Materiales." : "Elige el SKU.";
  else if (!unidadMatriz) errores.unidad = "Elige una unidad de venta del producto.";

  const cantidad = leerNumero(valores.cantidad);
  if (cantidad === null) errores.cantidad = valores.cantidad ? "Escribe solo dígitos y coma decimal (ej.: 6,28)." : "Indica la cantidad.";
  else if (!(cantidad > 0)) errores.cantidad = "Debe ser mayor que 0.";
  else if (unidadMatriz && !Number.isInteger(cantidad) && !unidades.find((u) => llave(u.nombre) === llave(unidadMatriz.unidad))?.aGranel) {
    errores.cantidad = `La unidad "${unidadMatriz.unidad}" no es a granel: usa unidades enteras.`;
  }

  if (!String(valores.razonSocial ?? "").trim()) errores.razonSocial = "Indica la razón social del cliente.";
  const rut = normalizarRut(valores.rut);
  if (!rut) errores.rut = valores.rut ? "RUT no válido (revisa el dígito verificador)." : "Indica el RUT del cliente.";

  const { docs, errores: erroresDocs } = validarDocumentos(valores);
  if (erroresDocs.length) errores.documentos = erroresDocs.join(" ");

  if (Object.keys(errores).length) return { errores, venta: null };

  const venta = {
    fecha: fechaIso(fecha),
    sku: producto.sku,
    descripcion: producto.descripcion,
    razonSocial: valores.razonSocial.trim(),
    rut,
    cantidad,
    unidad: unidadMatriz.unidad,
    ...docs,
  };
  const repetida = existentes.find((e) => e.id !== idEditando && firmaVenta(e) === firmaVenta(venta));
  if (repetida) {
    errores.general = `Venta repetida: ya existe ${textoDocumentos(venta)} con el mismo SKU, unidad y cantidad (${fechaChilena(repetida.fecha)}, ${repetida.razonSocial}).`;
    return { errores, venta: null };
  }
  return { errores, venta };
};

// Datos que se comparan entre una venta guardada y la nueva (para mostrar qué cambia).
export const CAMPOS_COMPARADOS = [
  { key: "fecha", label: "Fecha" },
  { key: "rut", label: "RUT" },
  { key: "razonSocial", label: "Razón social" },
  { key: "cantidad", label: "Cantidad" },
  ...DOCUMENTOS.map((d) => ({ key: d.key, label: d.label })),
];
export const cambiosEntre = (antes, despues) =>
  CAMPOS_COMPARADOS.filter((c) => llave(antes[c.key]) !== llave(despues[c.key])).map((c) => c.key);

/**
 * Modo "combinar" por documento: ventas guardadas del periodo que comparten algún número de documento (del mismo tipo)
 * con las líneas del archivo. Todas se reemplazan por las del archivo; se clasifican para informar y pedir confirmación.
 *   completa:   misma venta (SKU, unidad, cantidad, RUT y día) y el archivo solo agrega documentos → sin confirmación.
 *   sinCambios: misma venta con los mismos documentos → sin confirmación.
 *   modifica:   mismo documento y SKU + unidad, pero cambia otro dato → requiere confirmación (muestra antes y después).
 *   elimina:    venta de un documento del archivo que el archivo ya no trae → requiere confirmación.
 *   ajenas:     ventas de otro usuario que un REP no puede reemplazar → bloquean la carga.
 * Cada elemento: { existente, nueva?, cambios? }.
 */
export const clasificarCoincidencias = (lineas, existentes, { puedeTodo, usuarioId }) => {
  const r = { completa: [], sinCambios: [], modifica: [], elimina: [], ajenas: [] };
  const mismoProducto = (n, e) => llave(n.sku) === llave(e.sku) && llave(n.unidad) === llave(e.unidad);
  for (const e of existentes) {
    const candidatas = lineas.filter((n) => compartenDocumento(n, e));
    if (!candidatas.length) continue;
    if (!puedeTodo && e.creadoPorId !== usuarioId) {
      r.ajenas.push({ existente: e });
      continue;
    }
    const igual = candidatas.find((n) => mismoProducto(n, e) && n.cantidad === e.cantidad && n.rut === e.rut
      && n.fecha.slice(0, 10) === e.fecha.slice(0, 10)
      && DOCUMENTOS.every((d) => e[d.key] == null || llave(n[d.key]) === llave(e[d.key])));
    if (igual) {
      const agrega = DOCUMENTOS.some((d) => e[d.key] == null && igual[d.key] != null);
      r[agrega ? "completa" : "sinCambios"].push({ existente: e, nueva: igual, cambios: cambiosEntre(e, igual) });
      continue;
    }
    const par = candidatas.find((n) => mismoProducto(n, e));
    if (par) r.modifica.push({ existente: e, nueva: par, cambios: cambiosEntre(e, par) });
    else r.elimina.push({ existente: e });
  }
  return r;
};
