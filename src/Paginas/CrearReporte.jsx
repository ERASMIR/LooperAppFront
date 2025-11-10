import React, { useState, useEffect, useContext } from "react";
import { FolderUp, SquareArrowUp, ListChecks, FileCog } from "lucide-react";
import { FaFileDownload } from "react-icons/fa";
import { TbBrowserMaximize } from "react-icons/tb";
import { AuthContext } from "../context/AuthContext";

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

  const fetchTipo = async (tipo) => {
    const params = new URLSearchParams({ tipo });
    if (userId) params.set('usuario', String(userId));
    if (empresaId) params.set('empresa', String(empresaId));
    const url = `https://looper-gestdoc.azurewebsites.net/api/listararchivos?${params.toString()}`;
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
  }, [user, empresaId]);
  
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
        const res = await fetch('https://looper-gestreport.azurewebsites.net/api/subirarchivo', {
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
  
  // 📂 Manejo de carga de archivos
const handleFileUpload = (e, tipo) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const nuevoArchivo = { id: crypto.randomUUID(), nombre: file.name, file };

  if (tipo === "matriz") {
    setArchivoMatriz(nuevoArchivo);
  } else if (tipo === "ventas") {
    setArchivoVentas(nuevoArchivo);
  } else {
    console.warn(`Tipo de archivo no reconocido: ${tipo}`);
  }
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
      matrixUrl: matObj.url,
      salesUrl: venObj.url,
      id_usuario: String(userId),
      empresa_id: Number(empresaId),
    };

    setProcesando(true);

    const res = await fetch("https://looperapp.azurewebsites.net/api/looperprocesfiles3", {
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
      const res = await fetch(`https://looper-gestreport.azurewebsites.net/api/guardarinforme`, {
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

  return (
    <div className="p-10 w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-800">Crear Reporte</h1>
        <p className="text-neutral-600">Carga, selecciona y procesa tus archivos para generar un nuevo reporte.</p>
      </header>

      <div className="flex w-full gap-6 min-h-[calc(100vh-10rem)]">
        <Panel title="1. Cargar Archivos" collapsed={!mostrarCargar} setCollapsed={(v) => setMostrarCargar(!v)} Icon={SquareArrowUp}>
            <div className="space-y-4">
                <label className="block font-semibold text-sm">Matriz de Materiales:</label>
                <input type="file" onChange={(e) => handleFileUpload(e, "matriz")} className="w-full text-sm p-3 bg-gray-100 rounded-lg" />
                <button disabled={!archivoMatriz} className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400" onClick={() => subirArchivoAzure(archivoMatriz, "matriz")}>Subir Matriz</button>
            </div>
            <div className="space-y-4 mt-6">
                <label className="block font-semibold text-sm">Registro de Ventas:</label>
                <input type="file" onChange={(e) => handleFileUpload(e, "ventas")} className="w-full text-sm p-3 bg-gray-100 rounded-lg" />
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
            <div className="space-y-4">
                <label className="block font-semibold text-sm">Matriz de Materiales:</label>
                <select onChange={(e) => setArchivoMatrizSeleccionado(e.target.value)} value={archivoMatrizSeleccionado} className={`w-full bg-gray-100 p-3 text-sm rounded-lg transition-all ${destacarMatriz ? "border-2 border-primary" : ""}`}>
                    <option value="">Selecciona un archivo</option>
                    {matrizArchivos.map((file) => <option key={file.id || file.nombre} value={file.nombre}>{file.nombre}</option>)}
                </select>
            </div>
            <div className="space-y-4 mt-4">
                <label className="block font-semibold text-sm">Registro de Ventas:</label>
                <select onChange={(e) => setArchivoVentasSeleccionado(e.target.value)} value={archivoVentasSeleccionado} className={`w-full bg-gray-100 p-3 text-sm rounded-lg transition-all ${destacarVentas ? "border-2 border-primary" : ""}`}>
                    <option value="">Selecciona un archivo</option>
                    {ventasArchivos.map((file) => <option key={file.id || file.nombre} value={file.nombre}>{file.nombre}{file.periodo ? ` - ${file.periodo}` : ""}</option>)}
                </select>
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
                  {/* 🔘 Selector de categoría principal */}
                  <div className="flex gap-4 mb-6">
                    {["domiciliario", "no domiciliario"].map((tipo) => (
                      <button
                        key={tipo}
                        onClick={() => setFiltroCategorias([tipo])}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                          filtroCategorias.includes(tipo)
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-neutral-100"
                        }`}
                      >
                        {tipo === "domiciliario" ? "🏠 Domiciliario" : "🏢 No domiciliario"}
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

                  {/* 📊 Tabla de resultados */}
                  <div className="overflow-x-auto mt-6">
                    <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left">Categoría</th>
                          <th className="px-4 py-2 text-left">Material</th>
                          <th className="px-4 py-2 text-right">T. Peligrosos</th>
                          <th className="px-4 py-2 text-right">T. No Peligrosos</th>
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

                            const peligrosos = parseNum(
                              get([
                                "Materiales peligrosos",
                                "materiales_peligrosos",
                                "total_peligrosos",
                                "peligrosos",
                                "t_peligrosos",
                              ])
                            );
                            const noPeligrosos = parseNum(
                              get([
                                "Materiales no peligrosos",
                                "materiales_no_peligrosos",
                                "total_no_peligrosos",
                                "no_peligrosos",
                                "t_no_peligrosos",
                              ])
                            );

                            return (
                              <tr key={`${i}-${material}`} className="border-t hover:bg-neutral-50">
                                <td className="px-4 py-2">{categoria}</td>
                                <td className="px-4 py-2">{material}</td>
                                <td className="px-4 py-2 text-right tabular-nums">
                                  {peligrosos.toFixed(6)}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums">
                                  {noPeligrosos.toFixed(6)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}


            </div>
        </Panel>
      </div>
    </div>
  );
};

export default CrearReporte;