import * as XLSX from "xlsx";
import { normalizar } from "./cargaMasivaRevision.js";

// Funciones comunes de las cargas masivas (Matriz de Materiales y Registro de Ventas): lectura del archivo en el
// navegador y asignación de columnas recordada en el equipo.

export const EXTENSIONES = ".xlsx,.xls,.csv";
export const FILAS_POR_PAGINA = 10;
const TAMANO_MAX_MB = 10;

export const inputCls = "w-full bg-gray-100 p-2.5 text-sm rounded-lg disabled:text-gray-400 disabled:cursor-not-allowed";

// En la vista previa, los decimales de Excel se muestran con coma y hasta 6 decimales; el dato leído no cambia.
export const mostrarValor = (v) =>
  /^-?\d+\.\d+$/.test(v) ? Number(v).toLocaleString("es-CL", { maximumFractionDigits: 6 }) : v;

// Huella del formato: encabezados normalizados y ordenados. Mismo formato = mismos encabezados.
export const huellaDe = (encabezados) => encabezados.map(normalizar).sort().join("|");

export const leerConfig = (clave) => {
  try {
    return JSON.parse(localStorage.getItem(clave)) || { formatos: {} };
  } catch {
    return { formatos: {} };
  }
};

export const guardarConfig = (clave, huella, config) => {
  try {
    const actual = leerConfig(clave);
    actual.formatos = { ...actual.formatos, [huella]: config };
    localStorage.setItem(clave, JSON.stringify(actual));
  } catch {
    // Sin almacenamiento disponible: la asignación se pedirá de nuevo la próxima vez.
  }
};

// Texto de un archivo CSV: UTF-8 si es válido; si no, Windows-1252 (CSV guardado desde Excel en español).
const textoCsv = (buffer) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
};

// Copia el valor de cada rango de celdas combinadas a todas sus celdas (p. ej. un SKU combinado sobre varias filas).
const descombinar = (hoja) => {
  for (const { s, e } of hoja["!merges"] || []) {
    const origen = hoja[XLSX.utils.encode_cell(s)];
    if (!origen) continue;
    for (let r = s.r; r <= e.r; r++) {
      for (let c = s.c; c <= e.c; c++) {
        if (r !== s.r || c !== s.c) hoja[XLSX.utils.encode_cell({ r, c })] = { ...origen };
      }
    }
  }
};

// Lee el archivo en el navegador. Devuelve { encabezados, filas, combinadas } o lanza un Error con el motivo.
// filas: [{ fila (n.º en el archivo), valores: { encabezado: texto } }]. contenido: qué debe traer la hoja (para el mensaje).
export const leerArchivo = async (archivo, contenido) => {
  const extension = archivo.name.split(".").pop().toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(extension)) throw new Error("El archivo debe ser Excel (.xlsx, .xls) o CSV (.csv).");
  if (archivo.size > TAMANO_MAX_MB * 1024 * 1024) throw new Error(`El archivo supera ${TAMANO_MAX_MB} MB.`);

  const buffer = await archivo.arrayBuffer();
  // raw: los textos del CSV se mantienen tal cual (SKU con ceros a la izquierda, decimales con coma).
  const libro = extension === "csv"
    ? XLSX.read(textoCsv(buffer), { type: "string", raw: true })
    : XLSX.read(buffer, { type: "array" });

  if (libro.SheetNames.length !== 1) {
    throw new Error(`El archivo tiene ${libro.SheetNames.length} hojas. Deja solo la hoja con ${contenido} y vuelve a subirlo.`);
  }
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const combinadas = (hoja["!merges"] || []).length;
  descombinar(hoja);

  if (!hoja["!ref"]) throw new Error("El archivo está vacío.");
  // range: 0 → se lee desde la fila 1 aunque esté vacía (si no, la librería parte en la primera fila con datos
  // y la numeración de filas quedaría desfasada). primeraCol: la hoja puede no empezar en la columna A.
  const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "", blankrows: true, range: 0 });
  const primeraCol = XLSX.utils.decode_range(hoja["!ref"]).s.c;
  const texto = (v) => String(v ?? "").trim();
  const primera = (matriz[0] || []).map(texto);
  const ancho = Math.max(0, ...matriz.map((f) => f.length));

  // Encabezados: los vacíos toman la letra de la columna; los repetidos se numeran.
  const encabezados = [];
  const usadas = [];
  for (let c = 0; c < ancho; c++) {
    const tieneDatos = matriz.slice(1).some((f) => texto(f[c]));
    if (!primera[c] && !tieneDatos) continue;
    let nombre = primera[c] || `Columna ${XLSX.utils.encode_col(primeraCol + c)}`;
    for (let n = 2; encabezados.some((e) => normalizar(e) === normalizar(nombre)); n++) nombre = `${primera[c] || "Columna"} (${n})`;
    encabezados.push(nombre);
    usadas.push(c);
  }
  // Fila 1 vacía o con un título (una celda, o combinada sobre todas): no son los encabezados.
  if (new Set(primera.filter(Boolean).map(normalizar)).size < 3) {
    throw new Error("No se encontraron encabezados. La primera fila del archivo debe tener los nombres de las columnas (sin títulos ni filas vacías arriba).");
  }

  const filas = matriz.slice(1)
    .map((f, i) => ({ fila: i + 2, valores: Object.fromEntries(usadas.map((c, j) => [encabezados[j], texto(f[c])])) }))
    .filter((f) => Object.values(f.valores).some(Boolean));
  if (filas.length === 0) throw new Error("El archivo no tiene filas con datos bajo los encabezados.");

  return { encabezados, filas, combinadas };
};

// Descarga el reporte de errores como Excel. columnas: [[encabezado, clave, ancho]].
export const descargarErrores = (archivo, errores, columnas) => {
  const hoja = XLSX.utils.json_to_sheet(errores.map((e) => Object.fromEntries(columnas.map(([titulo, clave]) => [titulo, e[clave]]))));
  hoja["!cols"] = columnas.map(([, , wch]) => ({ wch }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Errores");
  XLSX.writeFile(libro, `errores_${archivo.replace(/\.[^.]+$/, "")}.xlsx`);
};
