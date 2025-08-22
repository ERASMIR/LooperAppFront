import React, { useState, useEffect } from "react";
import { FolderUp, SquareArrowUp, ListChecks, FileCog } from "lucide-react";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const Panel = ({ title, collapsed, setCollapsed, Icon, children }) => {
  return (
    <div
      className={`relative bg-white p-8 rounded-xl shadow transition-all duration-500 basis-0 overflow-hidden
        ${collapsed ? "grow-0 w-16 p-2" : "grow-[3] p-8"}`}
    >
      {/* ---------- Expanded: top-right small collapse button ---------- */}
      {!collapsed && (
        <button
          onClick={() => setCollapsed(true)}
          className="absolute top-2 right-2 text-green-600 hover:text-green-800 text-xs bg-white border border-green-500 rounded-full w-6 h-6 flex items-center justify-center shadow z-10"
          title="Colapsar"
          aria-label={`Colapsar ${title}`}
        >
          <span className="text-sm">{"<<"}</span>
        </button>
      )}

      {/* ---------- Collapsed controls: centrados horizontalmente pero arriba ---------- */}
      {collapsed && (
        <div
          className="absolute inset-0 flex items-start justify-center z-10 pointer-events-none"
          aria-hidden={false}
        >
          {/* contenedor interior con pointer-events-auto para permitir clicks */}
          <div className="flex flex-col items-center justify-start gap-2 pointer-events-auto mt-2">
            <button
              onClick={() => setCollapsed(false)}
              className="text-green-600 hover:text-green-800 text-xs bg-white border border-green-500 rounded-full w-6 h-6 flex items-center justify-center shadow"
              title="Expandir"
              aria-label={`Expandir ${title}`}
            >
              <span className="text-sm">{">>"}</span>
            </button>

            <div className="p-1 rounded-full bg-white shadow">
              <Icon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      )}

      {/* ---------- Contenido del panel (solo si está expandido) ---------- */}
      {!collapsed && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-green-100 text-green-600 p-2 rounded-full shadow">
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
  // --- tus estados (sin modificar)
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

  // controles de colapso/expansion - 3 paneles
  const [mostrarCargar, setMostrarCargar] = useState(true);
  const [mostrarSeleccion, setMostrarSeleccion] = useState(true);
  const [mostrarProcesar, setMostrarProcesar] = useState(true);

  const [mostrarTablaJSON, setMostrarTablaJSON] = useState(false);
  const [resultadoJSON, setResultadoJSON] = useState([]);
  const [filtroCategorias, setFiltroCategorias] = useState([]);
  const [filtroMateriales, setFiltroMateriales] = useState([]);
  const { user } = useContext(AuthContext); // ✅ ahora sí existe

  const empresaId = user?.empresaId;
  const userId = user?.id;
  //const { user } = useAuth(); // Extraemos el usuario del contexto
  //const userId = user?.id; // el ID del usuario logueado






  // ------------------ tus funciones existentes (sin cambios lógicos) ------------------
  const subirArchivoAzure = async (archivo, tipo) => {
    if (!archivo || !archivo.file) {
      alert("Archivo no seleccionado");
      return;
    }

    //const empresaId = user?.empresa_id;     // 👈 tomar empresa del contexto
    const empresaId = user?.empresaId;
    const userId = user?.id;                // 👈 tomar user id real


    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];

      //const nombreSinExtension = archivo.nombre.split(".").slice(0, -1).join(".");
      //const extension = "." + archivo.extension;

      const fileName = archivo.file.name;  
      const extension = "." + fileName.split(".").pop();  
      const nombreSinExtension = fileName.substring(0, fileName.lastIndexOf(".")) || fileName;


      const payload = {
        tipo,
        //id_usuario: "123",
        id_usuario: String(userId),
        //id_usuario: String(user.id),         // 👈 el ID del usuario logueado
        //empresa_id: Number(user.empresa),    // 👈 ID de la empresa
        empresa_id: Number(empresaId), 
        nombre_archivo: nombreSinExtension,
        extension,
        base64,
      };

      console.log("➡️ Enviando payload:", payload);

      try {
        const response = await fetch("http://localhost:7071/api/subirArchivo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),


        });

       
        let result;
        try {
          result = await response.json();
        } catch {
          result = {};
        }


        if (response.ok) {
          alert("Archivo subido correctamente");
        
        console.log("📥 Respuesta del backend:", result);


          // 🔁 refresco correcto por empresa y por tipo
          setTimeout(async () => {
            const fetchTipo = async (tipo) => {
              const params = new URLSearchParams({ tipo, empresa: String(empresaId) });
              const url = `http://localhost:7071/api/listarArchivos?${params.toString()}`;
              const res = await fetch(url);
              return res.ok ? (await res.json())[tipo] || [] : [];
            };
            const [nuevosMatriz, nuevosVentas] = await Promise.all([fetchTipo("matriz"), fetchTipo("ventas")]);
            setMatrizArchivos(nuevosMatriz);
            setVentasArchivos(nuevosVentas);
            if (tipo === "matriz") { setDestacarMatriz(true); setTimeout(() => setDestacarMatriz(false), 3000); }
            if (tipo === "ventas") { setDestacarVentas(true); setTimeout(() => setDestacarVentas(false), 3000); }
          }, 600);





          /* setTimeout(() => {
            fetch("http://localhost:7071/api/listarArchivos")
              .then((res) => res.json())
              .then((data) => {
                const nuevosMatriz = data.matriz || [];
                const nuevosVentas = data.ventas || [];
                setMatrizArchivos(nuevosMatriz);
                setVentasArchivos(nuevosVentas);
                if (tipo === "matriz") {
                  setDestacarMatriz(true);
                  setTimeout(() => setDestacarMatriz(false), 3000);
                }
                if (tipo === "ventas") {
                  setDestacarVentas(true);
                  setTimeout(() => setDestacarVentas(false), 3000);
                }
              })
              .catch((err) => console.error("❌ Error al refrescar archivos:", err));
          }, 1000);
           */





        } else {
          console.error("❌ Error del backend:", result);
          alert("Error al subir el archivo: " + (result.error || "desconocido"));
        }
      } catch (error) {
        console.error("❌ Error al conectar con Azure:", error);
        alert("Error de red al subir archivo");
      }
    };
    reader.readAsDataURL(archivo.file);
  };




  const handleFileUpload = (e, tipo) => {
    const file = e.target.files[0];
    if (!file) return;
    const id = crypto.randomUUID();
    const nombre = file.name;
    const extension = nombre.split(".").pop();
    const nuevoArchivo = {
      id,
      nombre,
      extension,
      file,
      fecha: new Date().toISOString(),
    };
    if (tipo === "matriz") {
      setArchivoMatriz(nuevoArchivo);
      setMatrizArchivos((prev) => [...prev, { id, nombre }]);
      setDestacarMatriz(true);
      setTimeout(() => setDestacarMatriz(false), 3000);
    }
    if (tipo === "ventas") {
      const periodo = mes && anio ? `${mes}/${anio}` : "";
      setArchivoVentas({ ...nuevoArchivo, periodo });
      setVentasArchivos((prev) => [...prev, { id, nombre, periodo }]);
      setDestacarVentas(true);
      setTimeout(() => setDestacarVentas(false), 3000);
    }
  };





  const handleProcesar = async () => {
    if (!archivoMatrizSeleccionado || !archivoVentasSeleccionado) {
      alert("Debes seleccionar ambos archivos para procesar.");
      return;
    }
    const matObj = matrizArchivos.find((item) => item.nombre === archivoMatrizSeleccionado);
    const venObj = ventasArchivos.find((item) => item.nombre === archivoVentasSeleccionado);
    if (!matObj?.url || !venObj?.url) {
      alert("No se encontraron las URLs de los archivos seleccionados.");
      return;
    }
    try {
      const res = await fetch("https://looperapp.azurewebsites.net/api/looperprocesfiles3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matrixUrl: matObj.url,
          salesUrl: venObj.url,
          //id_usuario: "123",
          id_usuario: String(user?.id),
          empresa_id: Number(empresaId),
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error("❌ Error de Azure: " + errText);
      }
      const result = await res.json();
      if (!result.fileUrl || !Array.isArray(result.fileUrl) || result.fileUrl.length < 2) {
        throw new Error("❌ Respuesta inválida del servidor.");
      }
      const [webViewLink, webContentLink] = result.fileUrl;
      setReporteLinks({
        ver: webViewLink,
        descargar: webContentLink,
      });
      const ls = result.logSummary || {};
      let resumen =
        `📊 Total líneas: ${ls["Total de líneas procesadas"] || 0}\n` +
        `✅ Correctas: ${ls["Líneas procesadas correctamente"] || 0}\n` +
        `⚠️ No encontradas: ${(ls["Registros no encontrados en Matriz de Materiales"]?.length ?? 0)}\n`;
      const noEncontrados = ls["Registros no encontrados en Matriz de Materiales"] || [];
      if (noEncontrados.length) {
        resumen += "🔍 Líneas no encontradas:\n";
        noEncontrados.forEach((item) => {
          resumen += `• Línea ${item["Línea del Registro de Ventas"] || item.line}: SKU "${item.SKU}", Unidad "${item.Unidad || item.unit}"\n`;
        });
      }
      setResultadoProcesamiento(resumen);
      setResultadoJSON(result.sumadores || []);
      setMostrarOpciones(true);
      setMostrarResultadoFinal(false);
    } catch (err) {
      console.error("❌ Error de red al procesar archivos:", err);
      alert("Error de red al procesar archivos");
    }
  };




  useEffect(() => {
    const obtenerArchivosSubidos = async () => {
      try {
        //const empresaId = user?.empresa_id;
        const empresaId = user?.empresaId;
        if (!empresaId) return;


        //const uid = user?.id;
        //if (!uid) return;

        const fetchTipo = async (tipo) => {
          //const params = new URLSearchParams({ usuario: String(uid), tipo });
          //const params = new URLSearchParams({ empresa: String(empresaId), tipo });

          const params = new URLSearchParams({ tipo });

          const uid = user?.id;
          if (uid && uid !== 'undefined' && uid !== 'null') {
            params.set('usuario', String(uid));
          }

          const empresaId = user?.empresaId;
          if (empresaId && empresaId !== 'undefined' && empresaId !== 'null') {
            params.set('empresa', String(empresaId));
          }


          const url = `http://localhost:7071/api/listarArchivos?${params.toString()}`;
          console.log(`[GET] listarArchivos -> ${tipo}`, url);

          const res = await fetch(url);
          if (!res.ok) {
            console.error(`[❌] Error HTTP en ${tipo}:`, res.status);
            return [];
          }

          //return res.ok ? (await res.json())[tipo] || [] : [];

          const data = await res.json();
          console.log(`[FETCH DEBUG] Respuesta cruda (${tipo}):`, data);

          let list = [];
          if (Array.isArray(data?.[tipo])) {
            list = data[tipo];
          } else if (Array.isArray(data?.archivos)) {
            list = data.archivos;
          } else {
            const firstArray = Object.values(data || {}).find((v) => Array.isArray(v));
            list = firstArray || [];
          }

          console.log(`[✔] ${tipo} normalizado ->`, list);
          return list;


        };


        const [matriz, ventas] = await Promise.all([
          fetchTipo("matriz"),
          fetchTipo("ventas")
        ]);

        console.log("📦 Matriz recibidas:", matriz);
        console.log("📦 Ventas recibidas:", ventas);

        setMatrizArchivos(matriz);
        setVentasArchivos(ventas);

      } catch (err) {
        console.error("❌ Error de red:", err);
      }
    };


    obtenerArchivosSubidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); //[user?.empresa, matrizArchivos.length, ventasArchivos.length]);
  //}, [user, matrizArchivos.length, ventasArchivos.length]); // <-- Dependencia para refrescar si cambia usuario








  

  const handleGuardarReporte = async () => {
    if (!mes || !anio) {
        alert("Selecciona mes y año para guardar el reporte.");
        return;
    }

    try {
      const empresaId = user?.empresaId;
      const userId = user?.id;


      const payload = {
        //id_usuario: "123", // Ajustar dinámicamente si tenés login
        id_usuario: String(userId),
        empresa_id: Number(empresaId), 
        //id_usuario: String(user?.id),
        //empresa_id: Number(user?.empresa),
        nombre_archivo: reporteLinks.nombre_archivo || "reporte.xlsx",
        extension: "xlsx",
        url_web: reporteLinks.ver,
        url_carga: reporteLinks.descargar,
        periodo_mes: parseInt(mes),
        periodo_anio: parseInt(anio),
        result_procesamiento: resultadoProcesamiento,
        result_reporte: resultadoJSON
        };

        console.log("➡️ Enviando payload:", payload);

        const res = await fetch("http://localhost:7071/api/guardarInforme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        });

        if (!res.ok) {
        const text = await res.text();
        throw new Error("Error al guardar: " + text);
        }

        alert("✅ Reporte guardado correctamente.");
    } catch (err) {
        console.error("❌ Error al guardar reporte:", err);
        alert("No se pudo guardar el reporte.");
    }
    };



  // ------------------ RENDER principal ------------------
  return (
    <div className="flex w-full gap-6 p-10 min-h-[calc(100vh-5rem)]">
      {/* Panel 1: Cargar Archivos */}
      <Panel
        title="Cargar Archivos"
        collapsed={!mostrarCargar ? true : false}
        setCollapsed={(v) => setMostrarCargar(!v)}
        Icon={SquareArrowUp}
      >
        <div className="space-y-4">
          <label className="block font-semibold">Matriz de Materiales:</label>
          <input
            type="file"
            onChange={(e) => handleFileUpload(e, "matriz")}
            className="w-full p-4 bg-gray-100 rounded-xl"
          />
          <button
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            onClick={() => subirArchivoAzure(archivoMatriz, "matriz")}
          >
            Subir
          </button>
        </div>

        <div className="space-y-4 mt-6">
          <label className="block font-semibold">Registro de Ventas:</label>
          <input
            type="file"
            onChange={(e) => handleFileUpload(e, "ventas")}
            className="w-full p-4 bg-gray-100 rounded-xl"
          />
          <div className="flex gap-4">
            <select onChange={(e) => setMes(e.target.value)} value={mes} className="w-full bg-gray-100 p-4 rounded-xl">
              <option value="">Seleccionar mes</option>
              <option value="01">Enero</option>
              <option value="02">Febrero</option>
              <option value="03">Marzo</option>
              <option value="04">Abril</option>
              <option value="05">Mayo</option>
              <option value="06">Junio</option>
              <option value="07">Julio</option>
              <option value="08">Agosto</option>
              <option value="09">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>
            <select onChange={(e) => setAnio(e.target.value)} value={anio} className="w-full bg-gray-100 p-4 rounded-xl">
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
          <button
            className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            onClick={() => {
              if (!mes || !anio) return alert("Selecciona el mes y el año.");
              if (!archivoVentas) return alert("Selecciona un archivo de ventas.");
              subirArchivoAzure({ ...archivoVentas, periodo: `${mes}/${anio}` }, "ventas");
            }}
          >
            Subir
          </button>
        </div>
      </Panel>

      {/* Panel 2: Seleccionar Archivos para Procesar */}
      <Panel
        title="Seleccionar Archivos para Procesar"
        collapsed={!mostrarSeleccion ? true : false}
        setCollapsed={(v) => setMostrarSeleccion(!v)}
        Icon={ListChecks}
      >
        <div className="space-y-4">
          <label className="block font-semibold">Matriz de Materiales:</label>
          <select
            onChange={(e) => setArchivoMatrizSeleccionado(e.target.value)}
            value={archivoMatrizSeleccionado}
            className={`w-full bg-gray-100 p-4 rounded-xl transition-all duration-300 ${destacarMatriz ? "border-2 border-green-500 shadow-md" : ""}`}
          >
            <option value="">Selecciona un archivo</option>
            {matrizArchivos.map((file) => (
              <option key={file.id} value={file.nombre}>
                {file.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4 mt-4">
          <label className="block font-semibold">Registro de Ventas:</label>
          <select
            onChange={(e) => setArchivoVentasSeleccionado(e.target.value)}
            value={archivoVentasSeleccionado}
            className={`w-full bg-gray-100 p-4 rounded-xl transition-all duration-300 ${destacarVentas ? "border-2 border-green-500 shadow-md" : ""}`}
          >
            <option value="">Selecciona un archivo</option>
            {ventasArchivos.map((file) => {
              console.log("🔍 Archivo ventas:", file);
              return (
                <option key={file.id || file.nombre} value={file.nombre}>
                  {file.nombre}{file.periodo ? ` - ${file.periodo}` : ""}
                </option>
              );
            })}
          </select>
        </div>
      </Panel>

      {/* Panel 3: Procesar Archivos */}
      <Panel
        title="Procesar Archivos"
        collapsed={!mostrarProcesar ? true : false}
        setCollapsed={(v) => setMostrarProcesar(!v)}
        Icon={FileCog}
      >
        <div>
          <button
            onClick={handleProcesar}
            className="w-full bg-white text-gray-700 py-3 rounded-xl hover:bg-green-50 transition-colors"
          >
            Procesar Archivos
          </button>

          {mostrarOpciones && (
            <>
              <h3 className="text-lg font-semibold mt-6">Reporte Generado:</h3>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => window.open(reporteLinks.descargar, "_blank")} className="p-2 rounded-full hover:bg-green-100" title="Descargar Reporte" style={{ border: "2px solid #00b86b" }}>
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v9m0-9l-3 3m3-3l3 3m0-12H6a2 2 0 00-2 2v1" />
                  </svg>
                </button>
                <button onClick={() => window.open(reporteLinks.ver, "_blank")} className="p-2 rounded-full hover:bg-green-100" title="Ver en nueva pestaña" style={{ border: "2px solid #00b86b" }}>
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7v7m0 0L10 21m11-11H10m4-4L3 21" />
                  </svg>
                </button>
                <button onClick={() => setMostrarTablaJSON(!mostrarTablaJSON)} className="ml-2 bg-white text-gray-700 py-3 px-4 rounded-xl hover:bg-green-50 transition-colors" style={{ border: "2px solid #00b86b" }}>
                  Ver Reporte
                </button>
              </div>

              <div className="flex items-center gap-4 my-4">
                <label className="font-semibold text-sm">Período del Reporte:</label>
                <select onChange={(e) => setMes(e.target.value)} value={mes} className="bg-gray-100 p-2 rounded-xl">
                  <option value="">Mes</option>
                  <option value="01">Enero</option>
                  <option value="02">Febrero</option>
                  <option value="03">Marzo</option>
                  <option value="04">Abril</option>
                  <option value="05">Mayo</option>
                  <option value="06">Junio</option>
                  <option value="07">Julio</option>
                  <option value="08">Agosto</option>
                  <option value="09">Septiembre</option>
                  <option value="10">Octubre</option>
                  <option value="11">Noviembre</option>
                  <option value="12">Diciembre</option>
                </select>
                <select onChange={(e) => setAnio(e.target.value)} value={anio} className="bg-gray-100 p-2 rounded-xl">
                  <option value="">Año</option>
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                </select>

                <button onClick={handleGuardarReporte} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                  Guardar Reporte
                </button>
              </div>

              <button onClick={() => setMostrarResultadoFinal(true)} className="w-full bg-white text-gray-700 py-3 rounded-xl hover:bg-green-50 transition-colors mt-2" style={{ border: "2px solid #00b86b" }}>
                Mostrar Resultados del Procesamiento
              </button>
            </>
          )}

          {mostrarResultadoFinal && (
            <textarea readOnly className="w-full h-40 bg-gray-100 p-4 rounded-xl mt-4" value={resultadoProcesamiento} />
          )}

          {mostrarTablaJSON && (
            <div className="mt-6">
              <div className="space-y-4 mb-4">
                <div className="w-64">
                  <label className="font-semibold">Filtrar Categorías:</label>
                  <select multiple className="block w-full bg-white border border-gray-300 rounded p-2" value={filtroCategorias} onChange={(e) => setFiltroCategorias([...e.target.selectedOptions].map((o) => o.value))}>
                    {Array.from(new Set(resultadoJSON.map((r) => r["categoría"]))).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold">Filtrar Materiales:</label>
                  <select multiple className="block w-full bg-white border border-gray-300 rounded p-2 min-w-[200px]" style={{ width: "100%" }} value={filtroMateriales} onChange={(e) => setFiltroMateriales([...e.target.selectedOptions].map((o) => o.value))}>
                    {Array.from(new Set(resultadoJSON.map((r) => r["material"]))).map((mat) => (
                      <option key={mat} value={mat}>
                        {mat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Categoría</th>
                      <th className="px-4 py-2 text-left">Material</th>
                      <th className="px-4 py-2 text-left">Materiales peligrosos</th>
                      <th className="px-4 py-2 text-left">Materiales no peligrosos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadoJSON
                      .filter((row) => (filtroCategorias.length === 0 || filtroCategorias.includes(row["categoría"])) && (filtroMateriales.length === 0 || filtroMateriales.includes(row["material"])))
                      .map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-4 py-2">{row["categoría"]}</td>
                          <td className="px-4 py-2">{row["material"]}</td>
                          <td className="px-4 py-2">{row["Materiales peligrosos"]}</td>
                          <td className="px-4 py-2">{row["Materiales no peligrosos"]}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
};

export default CrearReporte;
