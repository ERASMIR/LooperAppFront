// Carga masiva de la Matriz: campos y funciones de apoyo (separado de Componentes/CargaMasivaMatriz.jsx, auditoría UI RC-05; mismo comportamiento).
import { normalizar } from "./cargaMasivaRevision.js";
import { huellaDe, leerConfig } from "./cargaMasivaLectura.js";

export const MAX_NOMBRE_CAMPO = 100;
// Columnas que la app calcula (o deduce del material): no se cargan ni se crean como campo adicional.
export const CALCULADAS = ["peso por unidad de venta kg", "peso por unidad de venta", "ton", "toneladas", "sub categoria", "subcategoria"];

// Campos base según el GRANSIC (ReSimple: categoría y peligrosidad por producto; PROREP: categoría por componente).
// alias: nombres de columna que se reconocen al sugerir la asignación.
export const camposBase = (tienePeligrosidad) => [
  { key: "sku", label: "SKU", alias: ["sku", "codigo", "codigo producto"] },
  { key: "descripcion", label: "Descripción", alias: ["descripcion", "descripcion del producto", "producto"] },
  { key: "unidad", label: "Unidad de venta", alias: ["unidad de venta", "unidad", "unidades de venta"] },
  { key: "componente", label: "Componente", alias: ["componente", "componentes"] },
  { key: "cantidad", label: "Cantidad", alias: ["cantidad", "cantidades"] },
  { key: "pesoKg", label: "Peso (kg)", alias: ["peso kg", "peso", "peso unitario kg"] },
  { key: "categoria", label: tienePeligrosidad ? "Categoría (del producto)" : "Categoría (del componente)", alias: ["categoria", "categorias"] },
  { key: "material", label: "Material", alias: ["material", "materiales"] },
  { key: "caracteristica", label: "Característica", alias: ["caracteristica", "caracteristicas"], opcional: !tienePeligrosidad },
  ...(tienePeligrosidad ? [{ key: "peligrosidad", label: "Peligrosidad", alias: ["peligrosidad"] }] : []),
];

// Asignación inicial: la guardada para este formato o, si no hay, una sugerida comparando nombres.
export const asignacionInicial = (encabezados, base, campos, clave) => {
  const guardada = leerConfig(clave).formatos[huellaDe(encabezados)];
  const claves = [...base.map((b) => b.key), ...campos.map((c) => `campo:${c.id}`)];
  if (guardada) {
    const asignacion = Object.fromEntries(
      Object.entries(guardada.asignacion).filter(([k, col]) => claves.includes(k) && encabezados.includes(col)),
    );
    // Una columna marcada para crear cuyo campo ya existe (se creó en otra carga) se asigna a ese campo.
    const crear = [];
    for (const col of guardada.crear || []) {
      if (!encabezados.includes(col) || Object.values(asignacion).includes(col)) continue;
      const existente = campos.find((c) => normalizar(c.nombre) === normalizar(col));
      if (existente) asignacion[`campo:${existente.id}`] ??= col;
      else crear.push(col);
    }
    const niveles = Object.fromEntries(crear.map((col) => [col, guardada.niveles?.[col] || "producto"]));
    return { asignacion, crear, niveles, recordada: true };
  }

  const asignacion = {};
  const libre = (col) => !Object.values(asignacion).includes(col);
  for (const b of base) {
    const col = encabezados.find((e) => libre(e) && b.alias.includes(normalizar(e)));
    if (col) asignacion[b.key] = col;
  }
  for (const c of campos) {
    const col = encabezados.find((e) => libre(e) && normalizar(e) === normalizar(c.nombre));
    if (col) asignacion[`campo:${c.id}`] = col;
  }
  return { asignacion, crear: [], niveles: {}, recordada: false };
};
