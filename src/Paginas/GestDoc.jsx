import React, { useState, useEffect } from "react";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";


const GestDoc = ({ sidebarCollapsed }) => {
  const [tipoArchivo, setTipoArchivo] = useState("matriz"); // 'matriz' | 'ventas' | 'reportes'
  const [archivos, setArchivos] = useState([]);
  const [urlPreview, setUrlPreview] = useState("");
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

      const url = `https://looper-gestdoc.azurewebsites.net/api/listararchivos?${params.toString()}`;

      //const url = `http://localhost:7071/api/listarArchivos?${params.toString()}`;
      


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
    }
  }, [tipoArchivo, user]); // 👈 agrega user como dependencia




  const fetchReportesRep = async () => {
    try {
      // 👇 ahora enviamos usuario y empresa
      const res = await fetch(

        `https://looper-gestdoc.azurewebsites.net/api/listarreportesrep?usuario=${user.id}&empresa=${user.empresaId}`

        //`http://localhost:7071/api/listarReportesRep?usuario=${user.id}&empresa=${user.empresaId}`
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

        `https://looper-gestdoc.azurewebsites.net/api/eliminararchivo?id=${id}&tipo=${tipoArchivo}&usuario=${user.id}&empresa=${user.empresaId}`,

        //`http://localhost:7071/api/eliminarArchivo?id=${id}&tipo=${tipoArchivo}&usuario=${user.id}&empresa=${user.empresaId}`,
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
    <div className="flex w-screen h-screen min-h-screen min-w-0">
      {/* Panel izquierdo */}
      <div className="flex-1 w-full max-w-[760px] bg-white px-10 py-6 overflow-auto min-h-0">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-800">Gestión Documental</h1>
          <p className="text-neutral-600">Explora, visualiza y gestiona tus archivos.</p>
        </header>

        <div className="flex gap-4 mb-6">
          {["matriz", "ventas", "reportes"].map((tipo) => (
            <button
              key={tipo}
              onClick={() => {
                setTipoArchivo(tipo);
                if (tipo === "reportes") {
                  fetchReportesRep();
                } else {
                  fetchArchivos(tipo);
                }
              }}
              className={`px-4 py-2 text-sm rounded-xl transition ${
                tipoArchivo === tipo ? "bg-primary text-white" : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
            </button>
          ))}
        </div>



        <div className="overflow-auto max-h-[calc(100vh-200px)]">
          <table className="w-full bg-white rounded-2xl shadow overflow-hidden text-sm">
            <thead className="bg-gray-100">
              <tr className="text-left">
                {tipoArchivo === "reportes" ? (
                  <>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Año</th>
                    <th className="p-3">Mes</th>
                    {(rol === "admin" || rol === "dev") && <th className="p-3">Usuario</th>}
                    <th className="p-3">Ver</th>
                    <th className="p-3">Descargar</th>
                    <th className="p-3">Eliminar</th>
                  </>
                ) : tipoArchivo === "ventas" ? (
                  <>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Mes</th>
                    <th className="p-3">Año</th>
                    {(rol === "admin" || rol === "dev") && <th className="p-3">Usuario</th>}
                    <th className="p-3">Ver</th>
                    <th className="p-3">Descargar</th>
                    <th className="p-3">Eliminar</th>
                  </>
                ) : (
                  // matriz
                  <>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Fecha</th>
                    {(rol === "admin" || rol === "dev") && <th className="p-3">Usuario</th>}
                    <th className="p-3">Ver</th>
                    <th className="p-3">Descargar</th>
                    <th className="p-3">Eliminar</th>
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
                  <tr key={archivo.id} className="border-t">
                    <td className="p-3">{archivo.nombre_archivo ?? archivo.nombre ?? "Sin nombre"}</td>
                    <td className="p-3">{archivo.fecha_carga ? new Date(archivo.fecha_carga).toLocaleString() : "-"}</td>
                    <td className="p-3">{archivo.periodo_anio ?? archivo.anio ?? "-"}</td>
                    <td className="p-3">{archivo.periodo_mes ?? archivo.mes ?? "-"}</td>
                    {(rol === "admin" || rol === "dev") && <td className="p-3">{archivo.usuario_nombre ?? "-"}</td>}
                    <td className="p-3">
                      <button
                        onClick={() => handleVerArchivo(archivo)}
                        className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-light"
                      >
                        Ver
                      </button>
                    </td>
                    <td className="p-3">
                      <a
                        href={archivo.url_web ?? archivo.url_carga ?? archivo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-light"
                      >
                        Descargar
                      </a>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleEliminar(archivo.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              ) : tipoArchivo === "ventas" ? (
                archivos.map((archivo) => {
                  const { mes, anio } = parsePeriodo(archivo);
                  return (
                    <tr key={archivo.id} className="border-t">
                      <td className="p-3">{archivo.nombre ?? archivo.name ?? "Sin nombre"}</td>
                      <td className="p-3">{archivo.fecha_carga ? new Date(archivo.fecha_carga).toLocaleString() : "-"}</td>
                      <td className="p-3">{mes ?? "-"}</td>
                      <td className="p-3">{anio ?? "-"}</td>
                      {(rol === "admin" || rol === "dev") && <td className="p-3">{archivo.usuario_nombre ?? "-"}</td>}
                      <td className="p-3">
                        <button
                          onClick={() => handleVerArchivo(archivo)}
                          className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-light"
                        >
                          Ver
                        </button>
                      </td>
                      <td className="p-3">
                        <a
                          href={archivo.url ?? archivo.url_web ?? archivo.downloadUrl ?? archivo.url_carga}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-light"
                        >
                          Descargar
                        </a>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleEliminar(archivo.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                // matriz
                archivos.map((archivo) => (
                  <tr key={archivo.id} className="border-t">
                    <td className="p-3">{archivo.nombre ?? archivo.name ?? "Sin nombre"}</td>
                    <td className="p-3">{archivo.fecha_carga ? new Date(archivo.fecha_carga).toLocaleString() : "-"}</td>
                    {(rol === "admin" || rol === "dev") && <td className="p-3">{archivo.usuario_nombre ?? "-"}</td>}
                    <td className="p-3">
                      <button
                        onClick={() => handleVerArchivo(archivo)}
                        className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-light"
                      >
                        Ver
                      </button>
                    </td>
                    <td className="p-3">
                      <a
                        href={archivo.url ?? archivo.url_web ?? archivo.downloadUrl ?? archivo.url_carga}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-primary text-white rounded hover:bg-primary-light"
                      >
                        Descargar
                      </a>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleEliminar(archivo.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>        
      </div>       


      

      {/* Vista previa */}
      <div className="flex-1 w-full max-w-[600px] bg-white p-6 flex flex-col min-h-0">
        <h2 className="text-3xl font-bold mb-4 flex-shrink-0">Vista Previa</h2>
        <div className="flex-1 w-full min-h-0">
          {urlPreview ? (
            <iframe
              src={urlPreview}
              title="Vista previa del archivo"
              className="w-full h-full rounded-xl border"
            />
          ) : (
            <div className="w-full h-full rounded-xl border bg-gray-100 flex-1 items-center justify-center text-gray-400">
              No hay archivo seleccionado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GestDoc;
