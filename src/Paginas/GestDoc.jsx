import React, { useState, useEffect, useRef } from "react";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import { API_GESTDOC } from "../config/api";


// Encabezado de columna con handle de redimensionado
const Th = ({ colKey, width, onResize, children }) => {
  const thRef = React.useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const thEl = thRef.current;
    if (!thEl) return;
    const startX = e.clientX;
    const startWidth = thEl.getBoundingClientRect().width;
    onResize(colKey, startX, startWidth);
  };

  return (
    <th ref={thRef} style={{ width }} className="p-3 relative select-none group">
      {children}
      <div
        onMouseDown={handleMouseDown}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover:opacity-100 bg-gray-300 hover:bg-primary transition-all"
        title="Arrastrar para redimensionar"
      />
    </th>
  );
};

const GestDoc = ({ sidebarCollapsed }) => {
  const [tipoArchivo, setTipoArchivo] = useState("matriz"); // 'matriz' | 'ventas' | 'reportes'
  const [archivos, setArchivos] = useState([]);
  const [urlPreview, setUrlPreview] = useState("");
  const [tablaColapsada, setTablaColapsada] = useState(false);
  const [colWidths, setColWidths] = useState({});  // anchos de columna en px (override del % por defecto)
  const resizeState = useRef(null);

  // Devuelve el ancho de la columna: px si fue redimensionada, % por defecto
  const getW = (key, defaultPct) =>
    colWidths[key] != null ? `${colWidths[key]}px` : defaultPct;

  // Inicia el arrastre para redimensionar una columna
  const startResize = (colKey, startX, startWidth) => {
    resizeState.current = { colKey, startX, startWidth };

    const onMove = (mv) => {
      if (!resizeState.current) return;
      const { colKey, startX, startWidth } = resizeState.current;
      const newWidth = Math.max(48, startWidth + (mv.clientX - startX));
      setColWidths((prev) => ({ ...prev, [colKey]: newWidth }));
    };
    const onUp = () => {
      resizeState.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  const { user } = useContext(AuthContext);
  const userId = user?.id; // el ID del usuario logueado
  const rol = user?.perfil; // el rol del usuario logueado

  
  const fetchArchivos = async (tipo) => {
    try {
      const params = new URLSearchParams({ tipo });

      // Solo agrega el usuario si existe y es válido
      const uid = user?.id;
      if (uid && uid !== 'undefined' && uid !== 'null') {
        params.set('usuario', String(uid));
      }

      const empresaId = user?.empresaId;
      if (empresaId && empresaId !== 'undefined' && empresaId !== 'null') {
        params.set('empresa', String(empresaId));
      }

      const url = `${API_GESTDOC}/listarArchivos?${params.toString()}`;


      console.log('[GET] listarArchivos ->', url);
      console.log('[FETCH DEBUG] tipo:', tipo, '| user.id:', uid, '| user.empresa:', empresaId);

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      console.log('[FETCH DEBUG] Respuesta cruda:', data);

      // data viene como { matriz: [...], ventas: [...] }
      let list = [];
      if (Array.isArray(data?.[tipo])) {
        list = data[tipo];
      } else if (Array.isArray(data?.archivos)) {
        list = data.archivos;
      } else {
        const firstArray = Object.values(data || {}).find((v) => Array.isArray(v));
        list = firstArray || [];
      }

      
      console.log('listarArchivos: lista normalizada ->', list);
      setArchivos(list);
      setUrlPreview('');
    } catch (error) {
      console.error('Error obteniendo archivos:', error);
      setArchivos([]);
      setUrlPreview('');
    }
  };



  useEffect(() => {
    if (tipoArchivo !== 'reportes') {
      fetchArchivos(tipoArchivo);
    } else {
      fetchReportesRep();
    }
  }, [tipoArchivo, user?.empresaId]); // re-fetch al cambiar empresa o tipo




  const fetchReportesRep = async () => {
    try {
      // 👇 ahora enviamos usuario y empresa
      const res = await fetch(

        `${API_GESTDOC}/listarReportesRep?usuario=${user.id}&empresa=${user.empresaId}`

      );

      const data = await res.json();

      let list = Array.isArray(data)
        ? data
        : Object.values(data).find((v) => Array.isArray(v)) || [];

      setArchivos(list);
      setUrlPreview("");
    } catch (error) {
      console.error("Error obteniendo reportes:", error);
      setArchivos([]);
      setUrlPreview("");
    }
  };


  

  const handleEliminar = async (id) => {
    // Mensaje de confirmación
    const confirmar = window.confirm(
      "⚠️ ¿Estás seguro que deseas eliminar este registro? Esta acción no se puede deshacer."
    );
    if (!confirmar) return;

    try {
      const res = await fetch(

        `${API_GESTDOC}/eliminarArchivo?id=${id}&tipo=${tipoArchivo}&usuario=${user.id}&empresa=${user.empresaId}`,

        
        { method: "DELETE" }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Error HTTP: ${res.status}`);

      alert("✅ Archivo eliminado correctamente.");

      // Refrescar lista
      await (tipoArchivo === "reportes"
        ? fetchReportesRep()
        : fetchArchivos(tipoArchivo));
    } catch (error) {
      console.error("Error al eliminar archivo:", error);
      alert("❌ No se pudo eliminar el archivo.");
    }
  };



  // ---------- helper para extraer periodo (mes + año) ----------
  const parsePeriodo = (archivo) => {
    // Intentar campos explícitos
    const mesFieldCandidates = ["periodo_mes", "mes", "periodoMonth", "periodo_mes_num"];
    const anioFieldCandidates = ["periodo_anio", "anio", "periodoYear", "periodo_anio_num"];

    let mes = null;
    let anio = null;

    for (const k of mesFieldCandidates) {
      if (archivo[k] !== undefined && archivo[k] !== null && archivo[k] !== "") {
        mes = String(archivo[k]);
        break;
      }
    }
    for (const k of anioFieldCandidates) {
      if (archivo[k] !== undefined && archivo[k] !== null && archivo[k] !== "") {
        anio = String(archivo[k]);
        break;
      }
    }

    // Si ya tenemos mes y anio explícitos, devolverlos
    if (mes && anio) {
      // normalizar a dos dígitos para mes
      const mesPad = mes.length === 1 ? mes.padStart(2, "0") : mes;
      return { mes: mesPad, anio };
    }

    // Si existe campo 'periodo' intentar parsearlo:
    if (archivo.periodo) {
      const p = String(archivo.periodo).trim();
      // patrones comunes:
      // YYYY-MM or YYYYMM or YYYY-MM-DD
      let m;
      let y;
      let match = p.match(/^(\d{4})[-/](\d{2})(?:[-/]\d{2})?/); // 2025-07 or 202507 or 2025/07
      if (match) {
        y = match[1];
        m = match[2];
        return { mes: m.padStart(2, "0"), anio: y };
      }
      // MM-YYYY or MMYYYY
      match = p.match(/^(\d{2})[-/](\d{4})$/);
      if (match) {
        m = match[1];
        y = match[2];
        return { mes: m.padStart(2, "0"), anio: y };
      }
      // YYYYMM (no separador)
      match = p.match(/^(\d{4})(\d{2})$/);
      if (match) {
        y = match[1];
        m = match[2];
        return { mes: m, anio: y };
      }
    }

    // fallback desde fecha_carga
    if (archivo.fecha_carga) {
      const d = new Date(archivo.fecha_carga);
      if (!isNaN(d.getTime())) {
        const m = (d.getMonth() + 1).toString().padStart(2, "0");
        const y = d.getFullYear().toString();
        return { mes: m, anio: y };
      }
    }

    // no disponible
    return { mes: "-", anio: "-" };
  };

  // ---------- función para construir preview url (Drive / Docs / fallback) ----------
  const handleVerArchivo = (archivo) => {
    const fileUrl =
      archivo.url ??
      archivo.url_web ??
      archivo.downloadUrl ??
      archivo.url_carga;

    if (!fileUrl) {
      console.warn("No se encontró una URL válida para el archivo.");
      return;
    }

    let previewUrl = "";
    let fileId = "";

    // extraer ID con patrones usuales
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/,  // /file/d/ID
      /\/d\/([a-zA-Z0-9_-]+)/,       // /d/ID
      /[?&]id=([a-zA-Z0-9_-]+)/      // ?id=ID
    ];

    for (const pattern of patterns) {
      const match = fileUrl.match(pattern);
      if (match?.[1]) {
        fileId = match[1];
        break;
      }
    }

    // Si encontramos ID → usar preview de drive
    if (fileId) {
      previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    } else if (fileUrl.includes("docs.google.com/spreadsheets")) {
      const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        previewUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/preview`;
      }
    } else if (fileUrl.includes("docs.google.com/document")) {
      const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        previewUrl = `https://docs.google.com/document/d/${match[1]}/preview`;
      }
    } else if (fileUrl.includes("docs.google.com/presentation")) {
      const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        previewUrl = `https://docs.google.com/presentation/d/${match[1]}/preview`;
      }
    }

    if (!previewUrl) {
      previewUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
    }

    setUrlPreview(previewUrl);
  };

  // ---------- Render ----------
  // calcular colSpan dinámico según tipo
  const getColsCount = () => {
    if (tipoArchivo === "matriz") return 5;
    return 7; // ventas y reportes usan 7 columnas
  };

  return (
    <div className="flex w-full h-full overflow-hidden gap-4 px-2">

      {/* ── Panel izquierdo: tabla (flex-1, toma todo el espacio sobrante) ──── */}
      <div
        className={`flex flex-col bg-white transition-all duration-300 overflow-hidden
          ${tablaColapsada ? "w-0" : "flex-1 min-w-0 px-10 py-6"}`}
      >
        <header className="mb-6 flex-shrink-0">
          <h1 className="text-2xl font-bold text-neutral-800">Gestión Documental</h1>
          <p className="text-neutral-600">Explora, visualiza y gestiona tus archivos.</p>
        </header>

        <div className="flex gap-4 mb-6 flex-shrink-0">
          {["matriz", "ventas", "reportes"].map((tipo) => (
            <button
              key={tipo}
              onClick={() => {
                setTipoArchivo(tipo);
                if (tipo === "reportes") fetchReportesRep();
                else fetchArchivos(tipo);
              }}
              className={`px-4 py-2 text-sm rounded-xl transition ${
                tipoArchivo === tipo ? "bg-primary text-white" : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
            </button>
          ))}
        </div>

        {/* table-fixed + w-full: la tabla nunca supera el ancho del panel → sin scroll horizontal */}
        <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
          <table className="w-full table-fixed bg-white rounded-2xl shadow overflow-hidden text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr className="text-left">
                {tipoArchivo === "reportes" ? (
                  <>
                    <Th colKey="nombre"    width={getW("nombre",    "24%")} onResize={startResize}>Nombre</Th>
                    <Th colKey="fecha"     width={getW("fecha",     "16%")} onResize={startResize}>Fecha</Th>
                    <Th colKey="anio"      width={getW("anio",      "6%")}  onResize={startResize}>Año</Th>
                    <Th colKey="mes"       width={getW("mes",       "6%")}  onResize={startResize}>Mes</Th>
                    {(rol === "admin" || rol === "dev") && <Th colKey="usuario" width={getW("usuario", "12%")} onResize={startResize}>Usuario</Th>}
                    <Th colKey="ver"       width={getW("ver",       "7%")}  onResize={startResize}>Ver</Th>
                    <Th colKey="descargar" width={getW("descargar", "14%")} onResize={startResize}>Descargar</Th>
                    <Th colKey="eliminar"  width={getW("eliminar",  "14%")} onResize={startResize}>Eliminar</Th>
                  </>
                ) : tipoArchivo === "ventas" ? (
                  <>
                    <Th colKey="nombre"    width={getW("nombre",    "24%")} onResize={startResize}>Nombre</Th>
                    <Th colKey="fecha"     width={getW("fecha",     "16%")} onResize={startResize}>Fecha</Th>
                    <Th colKey="mes"       width={getW("mes",       "6%")}  onResize={startResize}>Mes</Th>
                    <Th colKey="anio"      width={getW("anio",      "6%")}  onResize={startResize}>Año</Th>
                    {(rol === "admin" || rol === "dev") && <Th colKey="usuario" width={getW("usuario", "12%")} onResize={startResize}>Usuario</Th>}
                    <Th colKey="ver"       width={getW("ver",       "7%")}  onResize={startResize}>Ver</Th>
                    <Th colKey="descargar" width={getW("descargar", "14%")} onResize={startResize}>Descargar</Th>
                    <Th colKey="eliminar"  width={getW("eliminar",  "14%")} onResize={startResize}>Eliminar</Th>
                  </>
                ) : (
                  <>
                    <Th colKey="nombre"    width={getW("nombre",    "30%")} onResize={startResize}>Nombre</Th>
                    <Th colKey="fecha"     width={getW("fecha",     "20%")} onResize={startResize}>Fecha</Th>
                    {(rol === "admin" || rol === "dev") && <Th colKey="usuario" width={getW("usuario", "12%")} onResize={startResize}>Usuario</Th>}
                    <Th colKey="ver"       width={getW("ver",       "8%")}  onResize={startResize}>Ver</Th>
                    <Th colKey="descargar" width={getW("descargar", "15%")} onResize={startResize}>Descargar</Th>
                    <Th colKey="eliminar"  width={getW("eliminar",  "15%")} onResize={startResize}>Eliminar</Th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {!Array.isArray(archivos) || archivos.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-400" colSpan={getColsCount()}>
                    No hay archivos registrados.
                  </td>
                </tr>
              ) : tipoArchivo === "reportes" ? (
                archivos.map((archivo) => (
                  <tr key={archivo.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 truncate" title={archivo.nombre_archivo ?? archivo.nombre}>{archivo.nombre_archivo ?? archivo.nombre ?? "Sin nombre"}</td>
                    <td className="p-3 truncate">{archivo.fecha_carga ? new Date(archivo.fecha_carga).toLocaleString() : "-"}</td>
                    <td className="p-3">{archivo.periodo_anio ?? archivo.anio ?? "-"}</td>
                    <td className="p-3">{archivo.periodo_mes ?? archivo.mes ?? "-"}</td>
                    {(rol === "admin" || rol === "dev") && <td className="p-3 truncate">{archivo.usuario_nombre ?? "-"}</td>}
                    <td className="p-3"><button onClick={() => handleVerArchivo(archivo)} className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-light">Ver</button></td>
                    <td className="p-3"><a href={archivo.url_web ?? archivo.url_carga ?? archivo.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-light">Descargar</a></td>
                    <td className="p-3"><button onClick={() => handleEliminar(archivo.id)} className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">Eliminar</button></td>
                  </tr>
                ))
              ) : tipoArchivo === "ventas" ? (
                archivos.map((archivo) => {
                  const { mes, anio } = parsePeriodo(archivo);
                  return (
                    <tr key={archivo.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 truncate" title={archivo.nombre ?? archivo.name}>{archivo.nombre ?? archivo.name ?? "Sin nombre"}</td>
                      <td className="p-3 truncate">{archivo.fecha_carga ? new Date(archivo.fecha_carga).toLocaleString() : "-"}</td>
                      <td className="p-3">{mes ?? "-"}</td>
                      <td className="p-3">{anio ?? "-"}</td>
                      {(rol === "admin" || rol === "dev") && <td className="p-3 truncate">{archivo.usuario_nombre ?? "-"}</td>}
                      <td className="p-3"><button onClick={() => handleVerArchivo(archivo)} className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-light">Ver</button></td>
                      <td className="p-3"><a href={archivo.url ?? archivo.url_web ?? archivo.downloadUrl ?? archivo.url_carga} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-light">Descargar</a></td>
                      <td className="p-3"><button onClick={() => handleEliminar(archivo.id)} className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">Eliminar</button></td>
                    </tr>
                  );
                })
              ) : (
                archivos.map((archivo) => (
                  <tr key={archivo.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 truncate" title={archivo.nombre ?? archivo.name}>{archivo.nombre ?? archivo.name ?? "Sin nombre"}</td>
                    <td className="p-3 truncate">{archivo.fecha_carga ? new Date(archivo.fecha_carga).toLocaleString() : "-"}</td>
                    {(rol === "admin" || rol === "dev") && <td className="p-3 truncate">{archivo.usuario_nombre ?? "-"}</td>}
                    <td className="p-3"><button onClick={() => handleVerArchivo(archivo)} className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-light">Ver</button></td>
                    <td className="p-3"><a href={archivo.url ?? archivo.url_web ?? archivo.downloadUrl ?? archivo.url_carga} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-light">Descargar</a></td>
                    <td className="p-3"><button onClick={() => handleEliminar(archivo.id)} className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">Eliminar</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Panel derecho: vista previa (siempre visible, ancho fijo pequeño) ─ */}
      <div className={`flex-shrink-0 flex flex-col bg-white border-l border-gray-200 p-4 overflow-hidden transition-all duration-300
        ${tablaColapsada ? "flex-1" : "w-72"}`}>

        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          <button
            onClick={() => setTablaColapsada((v) => !v)}
            className="text-primary hover:text-green-800 text-xs bg-white border border-primary rounded-full w-7 h-7 flex items-center justify-center shadow flex-shrink-0"
            title={tablaColapsada ? "Mostrar listado" : "Ampliar vista previa"}
          >
            <span className="text-sm font-bold">{tablaColapsada ? ">>" : "<<"}</span>
          </button>
          <h2 className="text-base font-bold text-neutral-800 truncate">Vista Previa</h2>
        </div>

        <div className="flex-1 min-h-0 w-full overflow-hidden">
          {urlPreview ? (
            <iframe
              src={urlPreview}
              title="Vista previa del archivo"
              className="w-full h-full rounded-xl border"
            />
          ) : (
            <div className="w-full h-full rounded-xl border bg-gray-100 flex items-center justify-center text-gray-400 text-xs text-center px-2">
              Selecciona "Ver" en un archivo para previsualizarlo.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default GestDoc;
