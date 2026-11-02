// Carga masiva de ventas: campos y funciones de apoyo (separado de Componentes/CargaMasivaVentas.jsx, auditoría UI RC-05; mismo comportamiento).
import { normalizar } from "./cargaMasivaRevision.js";
import { mostrarValor, huellaDe, leerConfig } from "./cargaMasivaLectura.js";
import { leerFecha, fechaIso, fechaChilena, DOCUMENTOS } from "./ventasRevision.js";

export const MAX_NOMBRE_CAMPO = 100;

// Campos mínimos, todos obligatorios. alias: nombres de columna que se reconocen al sugerir la asignación.
export const BASE = [
  { key: "sku", label: "SKU", alias: ["sku", "codigo", "codigo producto"] },
  { key: "descripcion", label: "Descripción", alias: ["descripcion", "descripcion del producto", "producto", "nombre del producto", "nombre producto"] },
  { key: "razonSocial", label: "Razón social (cliente)", alias: ["razon social", "razon social cliente", "razon social del cliente", "cliente", "nombre cliente"] },
  { key: "rut", label: "RUT (cliente)", alias: ["rut", "rut cliente", "rut del cliente"] },
  { key: "fecha", label: "Fecha de transacción", alias: ["fecha de transaccion", "fecha transaccion", "fecha", "fecha de venta", "fecha venta"] },
  { key: "cantidad", label: "Cantidad", alias: ["cantidad", "cantidad vendida", "unidades vendidas"] },
  { key: "unidad", label: "Unidad de venta", alias: ["unidad de venta", "unidad", "unidades de venta"] },
];

// Documentos de la venta: opcionales cada uno, pero cada fila debe traer factura, guía o boleta.
export const ALIAS_DOCUMENTOS = {
  folioFactura: ["factura", "n factura", "no factura", "nro factura", "numero factura", "numero de factura", "folio factura", "n de factura"],
  folioGuia: ["guia", "guia de despacho", "n guia", "no guia", "nro guia", "numero guia", "n guia de despacho", "numero guia de despacho", "folio guia", "guia despacho"],
  folioBoleta: ["boleta", "n boleta", "no boleta", "nro boleta", "numero boleta", "numero de boleta", "folio boleta"],
  pedido: ["pedido", "n pedido", "no pedido", "nro pedido", "numero pedido", "numero de pedido", "orden de compra", "id pedido", "id interno"],
};
export const DOCS = DOCUMENTOS.map((d) => ({ ...d, alias: ALIAS_DOCUMENTOS[d.key] }));
export const FOLIOS_ASIGNADOS = (asignacion) => ["folioFactura", "folioGuia", "folioBoleta"].some((k) => asignacion[k]);

// Asignación inicial: la guardada para este formato o, si no hay, una sugerida comparando nombres.
export const asignacionInicial = (encabezados, campos, clave) => {
  const guardada = leerConfig(clave).formatos[huellaDe(encabezados)];
  const claves = [...BASE.map((b) => b.key), ...DOCS.map((d) => d.key), ...campos.map((c) => `campo:${c.id}`)];
  if (guardada) {
    const asignacion = Object.fromEntries(
      Object.entries(guardada.asignacion).filter(([k, col]) => claves.includes(k) && encabezados.includes(col)),
    );
    // Una columna marcada para crear cuyo campo ya existe (se creó en otra carga) se asigna a ese campo. Una columna que
    // estaba asignada a un campo que ya no existe (eliminado) vuelve a proponerse: al campo con su nombre o para crearlo.
    const perdidas = Object.entries(guardada.asignacion)
      .filter(([k, col]) => k.startsWith("campo:") && !claves.includes(k) && encabezados.includes(col))
      .map(([, col]) => col);
    const crear = [];
    for (const col of [...(guardada.crear || []), ...perdidas]) {
      if (!encabezados.includes(col) || Object.values(asignacion).includes(col)) continue;
      const existente = campos.find((c) => normalizar(c.nombre) === normalizar(col));
      if (existente) asignacion[`campo:${existente.id}`] ??= col;
      else crear.push(col);
    }
    return { asignacion, crear, recordada: true };
  }

  const asignacion = {};
  const libre = (col) => !Object.values(asignacion).includes(col);
  for (const b of [...BASE, ...DOCS]) {
    const col = encabezados.find((e) => libre(e) && b.alias.includes(normalizar(e)));
    if (col) asignacion[b.key] = col;
  }
  for (const c of campos) {
    const col = encabezados.find((e) => libre(e) && normalizar(e) === normalizar(c.nombre));
    if (col) asignacion[`campo:${c.id}`] = col;
  }
  return { asignacion, crear: [], recordada: false };
};

export const plural = (n, uno, varios) => `${n.toLocaleString("es-CL")} ${n === 1 ? uno : varios}`;

// Valor de una celda en la vista previa: las fechas (también las de tipo fecha de Excel, que llegan como número) se
// muestran como dd/mm/aaaa; si no se reconocen, tal cual (la revisión las marcará).
export const valorVista = (clave, v) => {
  if (clave !== "fecha" || !v) return mostrarValor(v);
  const f = leerFecha(v);
  return f ? fechaChilena(fechaIso(f)) : v;
};
