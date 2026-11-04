// Matriz de Materiales: constantes y funciones (separado de Paginas/MatrizMateriales.jsx, auditoría UI RC-05; mismo comportamiento).

// ── Constantes ────────────────────────────────────────────────────────────────
export const TIPOS_ADJUNTO = [
  { value: "ficha_tecnica", label: "Ficha técnica" },
  { value: "informe_segregacion", label: "Informe de segregación" },
];
export const EXTENSIONES_ADJUNTO = ".pdf,.jpg,.jpeg,.png,.xlsx,.xls";
export const TAMANO_MAX_MB = 10;
export const MAX_NOMBRE_CAMPO = 100;
export const MAX_VALOR_CAMPO = 1000;

// Comparación de nombres sin distinguir mayúsculas ni tildes (igual que la collation de la BD).
export const mismoNombre = (a, b) => a.trim().localeCompare(b.trim(), "es", { sensitivity: "base" }) === 0;

// Número → texto para un <input type="number">: punto decimal y sin notación científica (8.7e-7 → "0.00000087").
export const aTextoNumero = (n) =>
  n === null || n === undefined || n === "" ? "" : Number(n).toLocaleString("en-US", { useGrouping: false, maximumSignificantDigits: 15 });

export const filaVacia = () => ({ componenteId: "", categoria: "", material: "", caracteristicaId: "", cantidad: "", pesoKg: "", campos: {} });
// Sub Categoría del material (informativa, no se usa en el cálculo): { categoria: { material: subcategoria } }.
// Viene en el catálogo GRANSIC (hoy solo ReSimple, desde su plantilla oficial).
export const subcategoriasDe = (gransic) => gransic.subcategorias || null;

// Última actualización de un producto: fecha de su versión vigente, usuario y origen (formulario o carga masiva).
export const ORIGENES = { manual: "formulario", carga_masiva: "carga masiva" };
export const formatoFecha = (f) => (f
  ? new Date(f).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "—");

// Nivel de un campo adicional: "producto" (un valor por producto) o "componente" (un valor por fila de la composición).
export const esDeComponente = (c) => c.nivel === "componente";
export const unidadVacia = () => ({ unidadVentaId: "", filas: [filaVacia()] });
export const productoVacio = () => ({
  sku: "", descripcion: "",
  categoria: "", peligrosidad: "", unidades: [unidadVacia()], adjunto: null, camposAdicionales: {},
});

// Producto del listado → estado del formulario (edición).
export const desdeProducto = (p) => ({
  id: p.id,
  version: p.version,
  actualizadoFecha: p.actualizadoFecha,
  sku: p.sku,
  descripcion: p.descripcion,
  categoria: p.categoria || "",
  peligrosidad: p.peligrosidad || "",
  unidades: p.unidades.map((u) => ({
    unidadVentaId: u.unidadVentaId,
    filas: u.filas.map((f) => ({
      componenteId: f.componenteId, categoria: f.categoria || "", material: f.material,
      caracteristicaId: f.caracteristicaId || "", cantidad: aTextoNumero(f.cantidad), pesoKg: aTextoNumero(f.pesoKg),
      campos: Object.fromEntries((f.camposAdicionales || []).map((c) => [c.campoId, c.valor])),
    })),
  })),
  adjunto: p.adjunto ? { nombre: p.adjunto.nombre, tipo: p.adjunto.tipo, urlWeb: p.adjunto.urlWeb, existente: true } : null,
  camposAdicionales: Object.fromEntries((p.camposAdicionales || []).map((c) => [c.campoId, c.valor])),
});

// Estado del formulario → body de POST/PUT /api/productos.
export const aPayload = (producto, empresaId, tienePeligrosidad) => ({
  empresaId,
  sku: producto.sku.trim(),
  descripcion: producto.descripcion.trim(),
  categoria: tienePeligrosidad ? producto.categoria : null,
  peligrosidad: tienePeligrosidad ? producto.peligrosidad : null,
  unidades: producto.unidades.map((u) => ({
    unidadVentaId: u.unidadVentaId,
    filas: u.filas.map((f) => ({
      componenteId: f.componenteId, cantidad: Number(f.cantidad), pesoKg: Number(f.pesoKg),
      categoria: tienePeligrosidad ? null : f.categoria, material: f.material, caracteristicaId: f.caracteristicaId || null,
      camposAdicionales: Object.entries(f.campos || {}).map(([campoId, valor]) => ({ campoId, valor: valor.trim() })).filter((c) => c.valor),
    })),
  })),
  // Solo se envían los campos adicionales con contenido.
  camposAdicionales: Object.entries(producto.camposAdicionales || {})
    .map(([campoId, valor]) => ({ campoId, valor: valor.trim() }))
    .filter((c) => c.valor),
});

// Peso por unidad de venta (kg) = cantidad × peso (kg); TON = peso por unidad de venta / 1000
export const pesoFila = (f) => (Number(f.cantidad) || 0) * (Number(f.pesoKg) || 0);
export const tonFila = (f) => pesoFila(f) / 1000;
export const pesoUnidad = (u) => u.filas.reduce((acc, f) => acc + pesoFila(f), 0);
export const tonUnidad = (u) => pesoUnidad(u) / 1000;
// Pesos y cantidades con todos sus decimales (componentes muy livianos: 0,0000025 kg → 0,0000000000025 t), sin notación
// científica y sin el ruido de la coma flotante (15 cifras significativas). specs/008-precision-pesos
export const formatoNumero = (n) => Number(n || 0).toLocaleString("es-CL", { maximumSignificantDigits: 15 });
export const formatoKg = formatoNumero;
export const formatoTon = formatoNumero;

// Misma escala que la BD y el back (looper-materiales/sql/008_precision_pesos.sql, utils/producto.js).
export const DECIMALES_CANTIDAD = 10;
export const DECIMALES_PESO = 15;
export const VALOR_MAXIMO = 1e9;
export const aEscala = (n, decimales) => Number(Number(n).toFixed(decimales));
// Problema del valor (ya leído como número) o null: fuera de rango o tan chico que se guardaría como 0.
export const problemaValor = (n, tipo) => {
  const decimales = tipo === "peso" ? DECIMALES_PESO : DECIMALES_CANTIDAD;
  if (n >= VALOR_MAXIMO) return "debe ser menor que 1.000.000.000";
  if (n > 0 && !(aEscala(n, decimales) > 0)) return `es menor que 0,${"0".repeat(decimales - 1)}1, el mínimo que se puede guardar`;
  return null;
};
export const etiquetaTipo = (tipo) => TIPOS_ADJUNTO.find((t) => t.value === tipo)?.label || tipo;

export const inputCls = "w-full campo";
export const labelCls = "block font-semibold text-sm mb-1";

export const aBase64 = (archivo) =>
  new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(",")[1]);
    lector.onerror = () => reject(new Error("No se pudo leer el archivo"));
    lector.readAsDataURL(archivo);
  });
