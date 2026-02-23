import React, { useState, useEffect, useContext } from "react";
import { FolderUp, SquareArrowUp, ListChecks, FileCog } from "lucide-react";
import { FaFileDownload } from "react-icons/fa";
import { TbBrowserMaximize } from "react-icons/tb";
import { AuthContext } from "../context/AuthContext";
import { API_USUARIOS, API_GESTDOC, API_GESTREPORT, API_PROCESAR } from "../config/api";
import * as XLSX from "xlsx";

// ─── Definición de campos requeridos para cada tipo de archivo ───────────────
const MATRIZ_FIELDS = [
  { key: "SKU",            label: "SKU / Código de producto",      required: true  },
  { key: "Unidad de venta",label: "Unidad de venta",               required: true  },
  { key: "TON",            label: "Peso por unidad (TON)",          required: true  },
  { key: "Materiales",     label: "Material reciclado",             required: true  },
  { key: "Categoria",      label: "Categoría del material",         required: true  },
  { key: "Peligrosidad",   label: "Peligrosidad (opcional)",        required: false },
];

const VENTAS_FIELDS = [
  { key: "SKU",            label: "SKU / Código de producto",      required: true },
  { key: "Unidad de venta",label: "Unidad de venta",               required: true },
  { key: "Cantidad",       label: "Cantidad vendida",               required: true },
];

// ─── Modal de mapeo de columnas ───────────────────────────────────────────────
const ColumnMapperModal = ({ tipo, columns, onConfirm, onCancel }) => {
  const fields = tipo === "matriz" ? MATRIZ_FIELDS : VENTAS_FIELDS;
  const title  = tipo === "matriz" ? "Matriz de Materiales" : "Registro de Ventas";

  // Intenta pre-seleccionar columnas que coincidan por nombre
  const autoMatch = (key) => {
    const lower = key.toLowerCase();
    return (
      columns.find((c) => c.toLowerCase() === lower) ||
      columns.find((c) => c.toLowerCase().includes(lower.split(" ")[0])) ||
      ""
    );
  };

  const [mapping, setMapping] = useState(() => {
    const initial = {};
    fields.forEach((f) => { initial[f.key] = autoMatch(f.key); });
    return initial;
  });

  const handleConfirm = () => {
    // Si no hay columnas disponibles, confirmar vacío (sin mapeo)
    if (columns.length === 0) {
      onConfirm({});
      return;
    }
    const missing = fields.filter((f) => f.required && !mapping[f.key]);
    if (missing.length > 0) {
      alert(`Por favor asigna las columnas requeridas:\n• ${missing.map((f) => f.label).join("\n• ")}`);
      return;
    }
    onConfirm(mapping);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="px-6 pt-6 pb-2 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">Mapear columnas del archivo</h3>
          <p className="text-sm text-gray-500 mt-1">
            Indica qué columna del archivo <span className="font-semibold">{title}</span> corresponde a cada campo requerido.
          </p>
        </div>
        <div className="px-6 py-4 space-y-3 max-h-96 overflow-y-auto">
          {columns.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                ⚠ No se pudieron detectar columnas en este archivo.
              </p>
              <p className="text-xs text-gray-500">
                El archivo puede tener un formato no estándar o la primera fila no contiene encabezados.
                Puedes continuar sin mapeo (se usarán los nombres de columna exactos del archivo).
              </p>
            </div>
          ) : (
            fields.map((field) => (
              <div key={field.key} className="flex items-center gap-3">
                <label className="w-44 text-sm font-medium text-gray-700 flex-shrink-0">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <select
                  value={mapping[field.key] || ""}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="flex-1 bg-gray-100 border border-gray-200 rounded-lg p-2 text-sm"
                >
                  {!field.required && <option value="">— No aplica —</option>}
                  {field.required && <option value="">Selecciona una columna</option>}
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            {columns.length === 0 ? "Continuar sin mapeo" : "Confirmar columnas"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Panel = ({ title, collapsed, setCollapsed, Icon, children }) => {
  return (
    <div
      className={`relative bg-white p-8 rounded-xl shadow transition-all duration-500 basis-0 overflow-hidden
        ${collapsed ? "grow-0 w-16 p-2" : "grow-[3] p-8"}`}
    >
      {!collapsed && (
        <button
          onClick={() => setCollapsed(true)}
          className="absolute top-2 right-2 text-primary hover:text-green-800 text-xs bg-white border border-primary rounded-full w-6 h-6 flex items-center justify-center shadow z-10"
          title="Colapsar"
        >
          <span className="text-sm">{"<<"}</span>
        </button>
      )}
      {collapsed && (
        <div className="absolute inset-0 flex items-start justify-center z-10 pointer-events-none">
          <div className="flex flex-col items-center justify-start gap-2 pointer-events-auto mt-2">
            <button
              onClick={() => setCollapsed(false)}
              className="text-primary hover:text-green-800 text-xs bg-white border border-primary rounded-full w-6 h-6 flex items-center justify-center shadow"
              title="Expandir"
            >
              <span className="text-sm">{">>"}</span>
            </button>
            <div className="p-1 rounded-full bg-white shadow">
              <Icon className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>
      )}
      {!collapsed && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-primary-light text-primary p-2 rounded-full shadow">
              <Icon className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          </div>
          {children}
        </div>
      )}
    </div>
  );
};

const CrearReporte = () => {
  const [matrizArchivos, setMatrizArchivos] = useState([]);
  const [ventasArchivos, setVentasArchivos] = useState([]);
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState("2024");
  const [archivoMatrizSeleccionado, setArchivoMatrizSeleccionado] = useState("");
  const [archivoVentasSeleccionado, setArchivoVentasSeleccionado] = useState("");
  const [resultadoProcesamiento, setResultadoProcesamiento] = useState("");
  const [mostrarOpciones, setMostrarOpciones] = useState(false);
  const [reporteLinks, setReporteLinks] = useState({ descargar: "", ver: "" });
  const [mostrarResultadoFinal, setMostrarResultadoFinal] = useState(false);
  const [archivoMatriz, setArchivoMatriz] = useState(null);
  const [archivoVentas, setArchivoVentas] = useState(null);
  const [destacarMatriz, setDestacarMatriz] = useState(false);
  const [destacarVentas, setDestacarVentas] = useState(false);
  const [mostrarCargar, setMostrarCargar] = useState(true);
  const [mostrarSeleccion, setMostrarSeleccion] = useState(true);
  const [mostrarProcesar, setMostrarProcesar] = useState(true);
  const [mostrarTablaJSON, setMostrarTablaJSON] = useState(false);
  const [resultadoJSON, setResultadoJSON] = useState([]);
  const [filtroCategorias, setFiltroCategorias] = useState([]);
  const [filtroMateriales, setFiltroMateriales] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [materialSeleccionado, setMaterialSeleccionado] = useState('');
  const { user } = useContext(AuthContext);
  const empresaId = user?.empresaId;
  const userId = user?.id;
  const [procesando, setProcesando] = useState(false);
  const [gransicId, setGransicId] = useState(null);

  // ─── Mapeo de columnas ───────────────────────────────────────────────────────
  const [matrizColumns,   setMatrizColumns]   = useState([]);   // columnas leídas del Excel
  const [ventasColumns,   setVentasColumns]   = useState([]);
  const [showMapModal,    setShowMapModal]     = useState(null); // null | 'matriz' | 'ventas'
  const [matrizColumnMap, setMatrizColumnMap] = useState({});   // {campo_esperado: col_real}
  const [ventasColumnMap, setVentasColumnMap] = useState({});

  const fetchTipo = async (tipo) => {
    const params = new URLSearchParams({ tipo });
    if (userId) params.set('usuario', String(userId));
    if (empresaId) params.set('empresa', String(empresaId));
    const url = `${API_GESTDOC}/listarArchivos?${params.toString()}`; // looper-gestDoc
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    let list = Array.isArray(data?.[tipo]) ? data[tipo] : (Array.isArray(data?.archivos) ? data.archivos : (Object.values(data || {}).find(Array.isArray) || []));
    return list;
  };

  //useEffect que construye filtros a partir de resultadoJSON
  useEffect(() => {
    if (!Array.isArray(resultadoJSON) || resultadoJSON.length === 0) {
      setFiltroCategorias([]);
      setFiltroMateriales([]);
      return;
    }

    // helper para extraer valor con varias posibles keys
    const get = (obj, keys) => {
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) return obj[k];
      }
      return undefined;
    };

    const cats = new Set();
    const mats = new Set();

    resultadoJSON.forEach(item => {
      const cat = get(item, ['categoría', 'categoria', 'categoria_producto', 'categoriaProducto', 'categoria_producto']);
      const mat = get(item, ['material', 'material_reciclado', 'nombre_material', 'material_nombre', 'materialName']);
      if (cat) cats.add(String(cat));
      if (mat) mats.add(String(mat));
    });

    setFiltroCategorias([...cats]);
    setFiltroMateriales([...mats]);
  }, [resultadoJSON]);


  useEffect(() => {
    const obtenerArchivosSubidos = async () => {
      if (!empresaId) return;
      const [matriz, ventas] = await Promise.all([fetchTipo("matriz"), fetchTipo("ventas")]);
      setMatrizArchivos(matriz);
      setVentasArchivos(ventas);
    };
    obtenerArchivosSubidos();
  }, [user?.empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    fetch(`${API_USUARIOS}/getEmpresas`)
      .then((res) => res.json())
      .then((empresas) => {
        const actual = empresas.find((e) => String(e.id) === String(empresaId));
        if (actual) setGransicId(actual.gransic_id);
      })
      .catch((err) => console.error("Error al obtener gransic_id:", err));
  }, [empresaId]);
  
  const subirArchivoAzure = async (archivo, tipo) => {
    if (!archivo || !archivo.file) return alert("Archivo no seleccionado");
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      const fileName = archivo.file.name;
      const payload = {
        tipo,
        id_usuario: String(userId),
        empresa_id: Number(empresaId),
        nombre_archivo: fileName.substring(0, fileName.lastIndexOf(".")) || fileName,
        extension: "." + fileName.split(".").pop(),
        base64,
      };
      try {
        const res = await fetch(`${API_GESTREPORT}/subirArchivo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await res.json();
        if (res.ok) {
          alert("Archivo subido correctamente");
          const [matriz, ventas] = await Promise.all([fetchTipo("matriz"), fetchTipo("ventas")]);
          setMatrizArchivos(matriz);
          setVentasArchivos(ventas);
          if (tipo === "matriz") setDestacarMatriz(true);
          if (tipo === "ventas") setDestacarVentas(true);
          setTimeout(() => { setDestacarMatriz(false); setDestacarVentas(false); }, 3000);
        } else {
          alert("Error al subir: " + (result.error || "desconocido"));
        }
      } catch (err) {
        alert("Error de red al subir archivo");
      }
    };
    reader.readAsDataURL(archivo.file);
  };
  
  // 📂 Lee las columnas (primera fila) de un archivo Excel usando SheetJS
  const readExcelColumns = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb   = XLSX.read(data, { type: "array" });
          const ws   = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
          resolve((rows[0] || []).map(String).filter(Boolean));
        } catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

  // 📂 Manejo de carga de archivos (lee columnas y abre modal de mapeo)
  const handleFileUpload = async (e, tipo) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const nuevoArchivo = { id: crypto.randomUUID(), nombre: file.name, file };

    if (tipo === "matriz") {
      setArchivoMatriz(nuevoArchivo);
      // Intentar cargar mapeo previo guardado en localStorage
      const saved = localStorage.getItem(`looper_colmap_${file.name}`);
      if (saved) {
        try { setMatrizColumnMap(JSON.parse(saved)); } catch (_) { /* ignora */ }
      } else {
        setMatrizColumnMap({});
      }
      // Leer columnas del Excel (si falla, se abre igual la modal con lista vacía)
      let cols = [];
      try { cols = await readExcelColumns(file); } catch {
        console.warn("No se pudieron leer columnas del archivo de Matriz.");
      }
      setMatrizColumns(cols);
      setShowMapModal("matriz");  // siempre abrir modal
    } else if (tipo === "ventas") {
      setArchivoVentas(nuevoArchivo);
      const saved = localStorage.getItem(`looper_colmap_${file.name}`);
      if (saved) {
        try { setVentasColumnMap(JSON.parse(saved)); } catch (_) { /* ignora */ }
      } else {
        setVentasColumnMap({});
      }
      let cols = [];
      try { cols = await readExcelColumns(file); } catch {
        console.warn("No se pudieron leer columnas del archivo de Ventas.");
      }
      setVentasColumns(cols);
      setShowMapModal("ventas");  // siempre abrir modal
    }
  };

  // ✅ Confirma el mapeo y lo persiste en localStorage
  const handleConfirmMapping = (tipo, mapping) => {
    if (tipo === "matriz") {
      setMatrizColumnMap(mapping);
      if (archivoMatriz) localStorage.setItem(`looper_colmap_${archivoMatriz.nombre}`, JSON.stringify(mapping));
    } else {
      setVentasColumnMap(mapping);
      if (archivoVentas) localStorage.setItem(`looper_colmap_${archivoVentas.nombre}`, JSON.stringify(mapping));
    }
    setShowMapModal(null);
  };

// ⚙️ Manejo de procesamiento de archivos
const handleProcesar = async () => {
  if (!archivoMatrizSeleccionado || !archivoVentasSeleccionado) {
    alert("⚠️ Debes seleccionar ambos archivos para procesar.");
    return;
  }

  const matObj = matrizArchivos.find((item) => item.nombre === archivoMatrizSeleccionado);
  const venObj = ventasArchivos.find((item) => item.nombre === archivoVentasSeleccionado);

  if (!matObj?.url || !venObj?.url) {
    alert("🚫 No se encontraron las URLs. Asegúrate de que los archivos están correctamente subidos.");
    return;
  }



  try {
    const payload = {
      matrixUrl:      matObj.url,
      salesUrl:       venObj.url,
      id_usuario:     String(userId),
      empresa_id:     Number(empresaId),
      gransic_id:     gransicId,
      // Mapeos de columnas (solo si el usuario los configuró)
      ...(Object.keys(matrizColumnMap).length > 0 && { matrixColumnMap: matrizColumnMap }),
      ...(Object.keys(ventasColumnMap).length > 0  && { salesColumnMap:  ventasColumnMap  }),
    };

    setProcesando(true);

    const res = await fetch(`${API_PROCESAR}/LooperProcesFiles4`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error HTTP ${res.status}: ${errorText}`);
    }

    const result = await res.json();

    // ✅ Manejo flexible de fileUrl (puede ser objeto o array)
    let webViewLink = "", webContentLink = "";

    if (Array.isArray(result.fileUrl)) {
      [webViewLink, webContentLink] = result.fileUrl;
    } else if (result.fileUrl) {
      webViewLink = result.fileUrl.webViewLink || "";
      webContentLink = result.fileUrl.webContentLink || "";
    }

    setReporteLinks({ ver: webViewLink, descargar: webContentLink });

    // 🧮 Procesar resumen de log
    const ls = result.logSummary || {};
    const total = ls["Total de líneas procesadas"] || 0;
    const correctas = ls["Líneas procesadas correctamente"] || 0;
    const noEncontradasArr = ls["Registros no encontrados en Matriz de Materiales"] || [];
    const noEncontradasCount = noEncontradasArr.length;

    let resumen = `📊 Total líneas: ${total}\n` +
                  `✅ Correctas: ${correctas}\n` +
                  `⚠️ No encontradas: ${noEncontradasCount}\n`;

    if (noEncontradasCount > 0) {
      resumen += "🔍 Líneas no encontradas:\n";
      noEncontradasArr.forEach((item) => {
        resumen += `• Línea ${item["Línea del Registro de Ventas"] || item.line || "?"} → SKU "${item.SKU}" | Unidad "${item.Unidad || item.unit || "-"}"\n`;
      });
    }

    setResultadoProcesamiento(resumen);
    setResultadoJSON(result.sumadores || []);
    setMostrarOpciones(true);
    setMostrarResultadoFinal(false);

  } catch (err) {
    console.error("❌ Error al procesar archivos:", err);
    alert(`Error al procesar: ${err.message}`);
  }
  setProcesando(false);

  };

  const handleGuardarReporte = async () => {
    if (!mes || !anio) return alert("Selecciona mes y año para guardar.");
    try {
      const payload = {
        id_usuario: String(userId),
        empresa_id: Number(empresaId),
        nombre_archivo: "reporte.xlsx",
        extension: "xlsx",
        url_web: reporteLinks.ver,
        url_carga: reporteLinks.descargar,
        periodo_mes: parseInt(mes),
        periodo_anio: parseInt(anio),
        result_procesamiento: resultadoProcesamiento,
        result_reporte: resultadoJSON,
      };
      const res = await fetch(`${API_GESTREPORT}/guardarInforme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      alert("✅ Reporte guardado correctamente.");
    } catch (err) {
      console.error("Error al guardar reporte:", err);
      alert(`No se pudo guardar: ${err.message}`);
    }
  };

  const filteredData = resultadoJSON.filter(item => {
    return (categoriaSeleccionada ? item.categoria_producto === categoriaSeleccionada : true) &&
           (materialSeleccionado ? item.material_reciclado === materialSeleccionado : true);
  });

  // Al seleccionar un archivo del dropdown, intenta cargar su mapeo guardado
  const handleSelectMatriz = (nombre) => {
    setArchivoMatrizSeleccionado(nombre);
    const saved = localStorage.getItem(`looper_colmap_${nombre}`);
    if (saved) {
      try { setMatrizColumnMap(JSON.parse(saved)); } catch (_) { /* ignora */ }
    }
  };

  const handleSelectVentas = (nombre) => {
    setArchivoVentasSeleccionado(nombre);
    const saved = localStorage.getItem(`looper_colmap_${nombre}`);
    if (saved) {
      try { setVentasColumnMap(JSON.parse(saved)); } catch (_) { /* ignora */ }
    }
  };

  return (
    <>
    <div className="p-10 w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-800">Crear Reporte</h1>
        <p className="text-neutral-600">Carga, selecciona y procesa tus archivos para generar un nuevo reporte.</p>
      </header>

      <div className="flex w-full gap-6 min-h-[calc(100vh-10rem)]">
        <Panel title="1. Cargar Archivos" collapsed={!mostrarCargar} setCollapsed={(v) => setMostrarCargar(!v)} Icon={SquareArrowUp}>
            <div className="space-y-3">
                <label className="block font-semibold text-sm">Matriz de Materiales:</label>
                <input type="file" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, "matriz")} className="w-full text-sm p-3 bg-gray-100 rounded-lg" />
                {archivoMatriz && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.keys(matrizColumnMap).length > 0 ? (
                      <span className="text-xs text-green-600 font-medium">✓ Columnas configuradas</span>
                    ) : (
                      <span className="text-xs text-yellow-600 font-medium">⚠ Sin configurar columnas</span>
                    )}
                    <button
                      onClick={() => setShowMapModal("matriz")}
                      className="text-xs text-primary underline hover:text-green-800"
                    >
                      {Object.keys(matrizColumnMap).length > 0 ? "Editar mapeo" : "Configurar columnas"}
                    </button>
                  </div>
                )}
                <button disabled={!archivoMatriz} className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400" onClick={() => subirArchivoAzure(archivoMatriz, "matriz")}>Subir Matriz</button>
            </div>
            <div className="space-y-3 mt-6">
                <label className="block font-semibold text-sm">Registro de Ventas:</label>
                <input type="file" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, "ventas")} className="w-full text-sm p-3 bg-gray-100 rounded-lg" />
                {archivoVentas && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.keys(ventasColumnMap).length > 0 ? (
                      <span className="text-xs text-green-600 font-medium">✓ Columnas configuradas</span>
                    ) : (
                      <span className="text-xs text-yellow-600 font-medium">⚠ Sin configurar columnas</span>
                    )}
                    <button
                      onClick={() => setShowMapModal("ventas")}
                      className="text-xs text-primary underline hover:text-green-800"
                    >
                      {Object.keys(ventasColumnMap).length > 0 ? "Editar mapeo" : "Configurar columnas"}
                    </button>
                  </div>
                )}
                <div className="flex gap-4">
                    <select onChange={(e) => setMes(e.target.value)} value={mes} className="w-full bg-gray-100 p-3 text-sm rounded-lg">
                        <option value="">Mes</option>
                        {[...Array(12).keys()].map(i => <option key={i+1} value={String(i+1).padStart(2, '0')}>{new Date(0, i).toLocaleString('es', { month: 'long' })}</option>)}
                    </select>
                    <select onChange={(e) => setAnio(e.target.value)} value={anio} className="w-full bg-gray-100 p-3 text-sm rounded-lg">
                        <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
                    </select>
                </div>
                <button disabled={!archivoVentas || !mes || !anio} className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400" onClick={() => subirArchivoAzure(archivoVentas, "ventas")}>Subir Ventas</button>
            </div>
        </Panel>

        <Panel title="2. Seleccionar Archivos" collapsed={!mostrarSeleccion} setCollapsed={(v) => setMostrarSeleccion(!v)} Icon={ListChecks}>
            <div className="space-y-2">
                <label className="block font-semibold text-sm">Matriz de Materiales:</label>
                <select onChange={(e) => handleSelectMatriz(e.target.value)} value={archivoMatrizSeleccionado} className={`w-full bg-gray-100 p-3 text-sm rounded-lg transition-all ${destacarMatriz ? "border-2 border-primary" : ""}`}>
                    <option value="">Selecciona un archivo</option>
                    {matrizArchivos.map((file) => <option key={file.id || file.nombre} value={file.nombre}>{file.nombre}</option>)}
                </select>
                {archivoMatrizSeleccionado && (
                  <p className={`text-xs font-medium ${Object.keys(matrizColumnMap).length > 0 ? "text-green-600" : "text-yellow-600"}`}>
                    {Object.keys(matrizColumnMap).length > 0 ? "✓ Mapeo de columnas cargado" : "⚠ Sin mapeo (se usarán nombres de columna exactos)"}
                  </p>
                )}
            </div>
            <div className="space-y-2 mt-4">
                <label className="block font-semibold text-sm">Registro de Ventas:</label>
                <select onChange={(e) => handleSelectVentas(e.target.value)} value={archivoVentasSeleccionado} className={`w-full bg-gray-100 p-3 text-sm rounded-lg transition-all ${destacarVentas ? "border-2 border-primary" : ""}`}>
                    <option value="">Selecciona un archivo</option>
                    {ventasArchivos.map((file) => <option key={file.id || file.nombre} value={file.nombre}>{file.nombre}{file.periodo ? ` - ${file.periodo}` : ""}</option>)}
                </select>
                {archivoVentasSeleccionado && (
                  <p className={`text-xs font-medium ${Object.keys(ventasColumnMap).length > 0 ? "text-green-600" : "text-yellow-600"}`}>
                    {Object.keys(ventasColumnMap).length > 0 ? "✓ Mapeo de columnas cargado" : "⚠ Sin mapeo (se usarán nombres de columna exactos)"}
                  </p>
                )}
            </div>
        </Panel>

        <Panel title="3. Procesar y Guardar" collapsed={!mostrarProcesar} setCollapsed={(v) => setMostrarProcesar(!v)} Icon={FileCog}>
            <div>
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleProcesar}
                disabled={!archivoMatrizSeleccionado || !archivoVentasSeleccionado || procesando}
                className={`bg-primary text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-all ${
                  procesando ? "opacity-70 cursor-wait" : ""
                }`}
                style={{ maxWidth: "280px" }}
              >
                {procesando ? "Procesando archivos..." : "Procesar Archivos"}
              </button>

              {procesando && (
                <div className="w-full max-w-sm bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-primary h-2.5 rounded-full animate-[progress_2s_ease-in-out_infinite]" />
                  <style>
                    {`@keyframes progress {
                      0% { width: 10%; opacity: 0.5; }
                      50% { width: 90%; opacity: 1; }
                      100% { width: 10%; opacity: 0.5; }
                    }`}
                  </style>
                </div>
              )}
            </div>


              {mostrarOpciones && (
                <>
                  <h3 className="text-lg font-semibold mt-6">Reporte Generado:</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => window.open(reporteLinks.descargar, "_blank")} className="p-2 rounded-full hover:bg-green-100 border-2 border-primary" title="Descargar Reporte">
                      <FaFileDownload className="w-5 h-5 text-gray-700" />
                    </button>
                    <button onClick={() => window.open(reporteLinks.ver, "_blank")} className="p-2 rounded-full hover:bg-green-100 border-2 border-primary" title="Ver en nueva pestaña">
                      <TbBrowserMaximize className="w-5 h-5 text-gray-700" />
                    </button>
                    <button onClick={() => setMostrarTablaJSON(!mostrarTablaJSON)} className="ml-2 bg-primary text-white py-2 px-4 rounded-lg hover:bg-green-700">
                      Ver Reporte
                    </button>
                  </div>


                  <div className="flex flex-wrap items-center gap-4 my-4">
                    <label className="font-semibold text-sm">Período:</label>
                    <select
                      onChange={(e) => setMes(e.target.value)}
                      value={mes}
                      className="bg-gray-100 p-2 rounded-xl text-sm"
                    >
                      <option value="">Mes</option>
                      {[...Array(12).keys()].map((i) => (
                        <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                          {new Date(0, i).toLocaleString("es", { month: "long" })}
                        </option>
                      ))}
                    </select>
                    <select
                      onChange={(e) => setAnio(e.target.value)}
                      value={anio}
                      className="bg-gray-100 p-2 rounded-xl text-sm"
                    >
                      <option value="">Año</option>
                      <option value="2024">2024</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                    </select>

                    {/* 🔽 Alineado al mismo nivel que los selects */}
                    <button
                      onClick={handleGuardarReporte}
                      className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-green-700 text-sm"
                    >
                      Guardar Reporte
                    </button>
                  </div>



                  <div className="mt-2">
                    <button
                      onClick={() => setMostrarResultadoFinal(!mostrarResultadoFinal)}
                      className="bg-white text-primary border border-primary px-5 py-2 rounded-lg hover:bg-green-50 transition-colors"
                      style={{ maxWidth: "250px" }}
                    >
                      {mostrarResultadoFinal ? "Ocultar resultados del procesamiento" : "Mostrar resumen del procesamiento"}
                    </button>

                    {mostrarResultadoFinal && (
                      <textarea
                        readOnly
                        className="w-full h-40 bg-gray-100 p-4 rounded-xl mt-4 text-xs"
                        value={resultadoProcesamiento}
                      />
                    )}
                  </div>

                  

                </>
              )}


              {mostrarTablaJSON && (
                <div className="mt-6">
                  {/* 🔘 Selector de categoría principal (dinámico) */}
                  <div className="flex gap-4 mb-6">
                    {Array.from(new Set(resultadoJSON.map((r) => r["categoría"] ?? r["categoria"]))).filter(Boolean).map((tipo) => (
                      <button
                        key={tipo}
                        onClick={() => setFiltroCategorias([tipo])}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          filtroCategorias.includes(tipo)
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-neutral-100"
                        }`}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>

                  {/* 🔍 Filtro de materiales */}
                  <div className="space-y-4 mb-4">
                    <div>
                      <label className="font-semibold">Filtrar Materiales:</label>
                      <select
                        multiple
                        className="block w-full bg-white border border-gray-300 rounded p-2 text-sm min-w-[200px]"
                        value={filtroMateriales}
                        onChange={(e) =>
                          setFiltroMateriales([...e.target.selectedOptions].map((o) => o.value))
                        }
                      >
                        {Array.from(
                          new Set(resultadoJSON.map((r) => r["material"] ?? r["material_reciclado"]))
                        ).map((mat) => (
                          <option key={mat} value={mat}>
                            {mat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 📊 Tabla de resultados (dinámica según GRANSIC) */}
                  {(() => {
                    const tienePeligrosidad = resultadoJSON.length > 0 && resultadoJSON[0].hasOwnProperty("Materiales peligrosos");
                    return (
                      <div className="overflow-x-auto mt-6">
                        <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-2 text-left">Categoría</th>
                              <th className="px-4 py-2 text-left">Material</th>
                              {tienePeligrosidad ? (
                                <>
                                  <th className="px-4 py-2 text-right">T. Peligrosos</th>
                                  <th className="px-4 py-2 text-right">T. No Peligrosos</th>
                                </>
                              ) : (
                                <th className="px-4 py-2 text-right">Total</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {resultadoJSON
                              .filter((row) => {
                                const categoriaVal =
                                  row["categoría"] ??
                                  row["categoria"] ??
                                  row["categoria_producto"] ??
                                  row["categoriaProducto"];
                                const materialVal =
                                  row["material"] ??
                                  row["material_reciclado"] ??
                                  row["nombre_material"] ??
                                  row["materialNombre"];
                                const catOk =
                                  filtroCategorias.length === 0 ||
                                  (categoriaVal && filtroCategorias.includes(String(categoriaVal)));
                                const matOk =
                                  filtroMateriales.length === 0 ||
                                  (materialVal && filtroMateriales.includes(String(materialVal)));
                                return catOk && matOk;
                              })
                              .map((row, i) => {
                                const get = (keys) => {
                                  for (const k of keys) {
                                    if (row[k] !== undefined && row[k] !== null) return row[k];
                                  }
                                  return undefined;
                                };

                                const categoria =
                                  get(["categoría", "categoria", "categoria_producto", "categoriaProducto"]) ||
                                  "—";
                                const material =
                                  get(["material", "material_reciclado", "nombre_material", "materialNombre"]) ||
                                  "—";

                                const parseNum = (val) => {
                                  if (val === undefined || val === null || val === "") return 0;
                                  if (typeof val === "number") return val;
                                  const s = String(val).trim().replace(/\s/g, "").replace(",", ".");
                                  const n = Number(s);
                                  return Number.isFinite(n) ? n : 0;
                                };

                                if (tienePeligrosidad) {
                                  const peligrosos = parseNum(
                                    get(["Materiales peligrosos", "materiales_peligrosos", "total_peligrosos", "peligrosos", "t_peligrosos"])
                                  );
                                  const noPeligrosos = parseNum(
                                    get(["Materiales no peligrosos", "materiales_no_peligrosos", "total_no_peligrosos", "no_peligrosos", "t_no_peligrosos"])
                                  );
                                  return (
                                    <tr key={`${i}-${material}`} className="border-t hover:bg-neutral-50">
                                      <td className="px-4 py-2">{categoria}</td>
                                      <td className="px-4 py-2">{material}</td>
                                      <td className="px-4 py-2 text-right tabular-nums">{peligrosos.toFixed(6)}</td>
                                      <td className="px-4 py-2 text-right tabular-nums">{noPeligrosos.toFixed(6)}</td>
                                    </tr>
                                  );
                                } else {
                                  const total = parseNum(get(["Total", "total"]));
                                  return (
                                    <tr key={`${i}-${material}`} className="border-t hover:bg-neutral-50">
                                      <td className="px-4 py-2">{categoria}</td>
                                      <td className="px-4 py-2">{material}</td>
                                      <td className="px-4 py-2 text-right tabular-nums">{total.toFixed(6)}</td>
                                    </tr>
                                  );
                                }
                              })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}


            </div>
        </Panel>
      </div>
    </div>

    {/* ─── Modal de mapeo de columnas ───────────────────────────────────────── */}
    {showMapModal === "matriz" && (
      <ColumnMapperModal
        tipo="matriz"
        columns={matrizColumns}
        onConfirm={(mapping) => handleConfirmMapping("matriz", mapping)}
        onCancel={() => setShowMapModal(null)}
      />
    )}
    {showMapModal === "ventas" && (
      <ColumnMapperModal
        tipo="ventas"
        columns={ventasColumns}
        onConfirm={(mapping) => handleConfirmMapping("ventas", mapping)}
        onCancel={() => setShowMapModal(null)}
      />
    )}
    </>
  );
};

export default CrearReporte;