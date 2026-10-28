import React, { useRef, useState } from "react";
import { Upload, AlertTriangle, CheckCircle2, Loader2, FileSpreadsheet, Download, Info } from "lucide-react";
import { normalizar } from "./cargaMasivaRevision.js";
import {
  EXTENSIONES, FILAS_POR_PAGINA, mostrarValor, huellaDe, leerConfig, guardarConfig, leerArchivo, descargarErrores,
} from "./cargaMasivaLectura.js";
import { Ventana, FilaAsignacion, Paginado } from "./cargaMasivaComun.jsx";
import { revisarVentas, reemplazosPorSku, nombrePeriodo, leerFecha, fechaIso, fechaChilena } from "./ventasRevision.js";

// Carga masiva del Registro de Ventas: leer el archivo, asignar columnas, vista previa, revisar contra la Matriz y
// el periodo, elegir el modo (combinar / reemplazar todo el periodo) y guardar. Las filas con error bloquean el
// guardado. Plan: specs/002-registro-ventas/plan-trabajo.md

const MAX_NOMBRE_CAMPO = 100;

// Campos mínimos, todos obligatorios. alias: nombres de columna que se reconocen al sugerir la asignación.
const BASE = [
  { key: "sku", label: "SKU", alias: ["sku", "codigo", "codigo producto"] },
  { key: "descripcion", label: "Descripción", alias: ["descripcion", "descripcion del producto", "producto", "nombre del producto", "nombre producto"] },
  { key: "razonSocial", label: "Razón social (cliente)", alias: ["razon social", "razon social cliente", "razon social del cliente", "cliente", "nombre cliente"] },
  { key: "rut", label: "RUT (cliente)", alias: ["rut", "rut cliente", "rut del cliente"] },
  { key: "fecha", label: "Fecha de transacción", alias: ["fecha de transaccion", "fecha transaccion", "fecha", "fecha de venta", "fecha venta"] },
  { key: "cantidad", label: "Cantidad", alias: ["cantidad", "cantidad vendida", "unidades vendidas"] },
  { key: "unidad", label: "Unidad de venta", alias: ["unidad de venta", "unidad", "unidades de venta"] },
];

// Asignación inicial: la guardada para este formato o, si no hay, una sugerida comparando nombres.
const asignacionInicial = (encabezados, campos, clave) => {
  const guardada = leerConfig(clave).formatos[huellaDe(encabezados)];
  const claves = [...BASE.map((b) => b.key), ...campos.map((c) => `campo:${c.id}`)];
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
  for (const b of BASE) {
    const col = encabezados.find((e) => libre(e) && b.alias.includes(normalizar(e)));
    if (col) asignacion[b.key] = col;
  }
  for (const c of campos) {
    const col = encabezados.find((e) => libre(e) && normalizar(e) === normalizar(c.nombre));
    if (col) asignacion[`campo:${c.id}`] = col;
  }
  return { asignacion, crear: [], recordada: false };
};

const plural = (n, uno, varios) => `${n.toLocaleString("es-CL")} ${n === 1 ? uno : varios}`;

// Valor de una celda en la vista previa: las fechas (también las de tipo fecha de Excel, que llegan como número) se
// muestran como dd/mm/aaaa; si no se reconocen, tal cual (la revisión las marcará).
const valorVista = (clave, v) => {
  if (clave !== "fecha" || !v) return mostrarValor(v);
  const f = leerFecha(v);
  return f ? fechaChilena(fechaIso(f)) : v;
};

// periodo: { anio, mes }. productos: Matriz vigente. unidades: catálogo con aGranel. campos: campos adicionales de ventas.
// existentes: ventas vigentes del periodo. onGuardar(payload): async, puede lanzar el error del back.
const CargaMasivaVentas = ({ periodo, productos, unidades, campos, existentes, puedeEditar, claveConfig, onGuardar }) => {
  const inputRef = useRef(null);
  const [paso, setPaso] = useState(null); // null | "leyendo" | "error" | "asignar" | "vista" | "revision"
  const [error, setError] = useState("");
  const [archivo, setArchivo] = useState(null); // { nombre, encabezados, filas, combinadas }
  const [asignacion, setAsignacion] = useState({});
  const [crear, setCrear] = useState([]);
  const [recordada, setRecordada] = useState(false);
  const [intento, setIntento] = useState(false);
  const [mostradas, setMostradas] = useState(FILAS_POR_PAGINA);
  const [revision, setRevision] = useState(null);
  const [modo, setModo] = useState("combinar");
  const [autorizado, setAutorizado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");

  const cerrar = () => {
    setPaso(null);
    setArchivo(null);
    setError("");
  };

  const elegir = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPaso("leyendo");
    try {
      const leido = await leerArchivo(f, "las ventas");
      const inicial = asignacionInicial(leido.encabezados, campos, claveConfig);
      setArchivo({ nombre: f.name, ...leido });
      setAsignacion(inicial.asignacion);
      setCrear(inicial.crear);
      setRecordada(inicial.recordada);
      setIntento(false);
      setMostradas(FILAS_POR_PAGINA);
      setPaso("asignar");
    } catch (err) {
      setError(err.message || "No se pudo leer el archivo.");
      setPaso("error");
    }
  };

  const enUso = Object.values(asignacion).filter(Boolean);
  const sinAsignar = archivo ? archivo.encabezados.filter((e) => !enUso.includes(e)) : [];
  const ejemplo = (col) => col && mostrarValor(archivo.filas.find((f) => f.valores[col])?.valores[col]);
  const faltantes = BASE.filter((b) => !asignacion[b.key]);

  const asignar = (clave, col) => {
    setAsignacion((a) => ({ ...a, [clave]: col }));
    if (col) setCrear((c) => c.filter((x) => x !== col));
  };

  const motivoNoCrear = (col) => {
    const existente = campos.find((c) => normalizar(c.nombre) === normalizar(col));
    if (existente) return `Ya existe el campo "${existente.nombre}": asígnalo arriba.`;
    if (BASE.some((b) => normalizar(b.label) === normalizar(col))) return "Es un campo obligatorio: asígnalo arriba.";
    if (col.length > MAX_NOMBRE_CAMPO) return `El nombre supera ${MAX_NOMBRE_CAMPO} caracteres.`;
    return "";
  };

  const confirmarAsignacion = () => {
    setIntento(true);
    if (faltantes.length) return;
    const crearValidas = crear.filter((c) => !motivoNoCrear(c));
    setCrear(crearValidas);
    guardarConfig(claveConfig, huellaDe(archivo.encabezados), { asignacion, crear: crearValidas });
    setMostradas(FILAS_POR_PAGINA);
    setPaso("vista");
  };

  const columnasVista = archivo ? [
    ...BASE.filter((b) => asignacion[b.key]).map((b) => ({ id: b.key, label: b.label, col: asignacion[b.key], obligatorio: true })),
    ...campos.filter((c) => asignacion[`campo:${c.id}`]).map((c) => ({ id: c.id, label: c.nombre, col: asignacion[`campo:${c.id}`] })),
    ...crear.map((col) => ({ id: `nuevo:${col}`, label: col, col, nuevo: true })),
  ] : [];

  const revisar = () => {
    setRevision(revisarVentas({ filas: archivo.filas, asignacion, crear, base: BASE, periodo, productos, unidades, campos }));
    setModo("combinar");
    setAutorizado(false);
    setErrorGuardar("");
    setPaso("revision");
  };

  // Qué se reemplaza según el modo: en "combinar", las líneas del periodo de los SKU del archivo; en "reemplazar", todas.
  const reemplazos = revision ? reemplazosPorSku(revision.lineas, existentes) : [];
  const aReemplazar = modo === "reemplazar" ? existentes.length : reemplazos.reduce((n, r) => n + r.existentes, 0);
  const requiereAutorizacion = aReemplazar > 0;
  const puedeGuardar = revision && revision.errores.length === 0 && revision.lineas.length > 0
    && (!requiereAutorizacion || autorizado) && !guardando;

  const guardar = async () => {
    setGuardando(true);
    setErrorGuardar("");
    try {
      await onGuardar({
        anio: periodo.anio,
        mes: periodo.mes,
        modo,
        archivo: archivo.nombre,
        filas: archivo.filas.length,
        camposNuevos: crear,
        excluidos: revision.excluidos.map(({ sku, unidad, filas, motivo }) => ({ sku, unidad, filas, motivo })),
        lineas: revision.lineas,
      });
      cerrar();
    } catch (err) {
      setErrorGuardar([err.message, ...(err.errores || [])].join(" · "));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={!puedeEditar || paso === "leyendo"}
        title={puedeEditar ? `Cargar las ventas de ${nombrePeriodo(periodo)} desde un archivo Excel o CSV` : "Tu perfil solo permite consultar las ventas"}
        className="flex items-center gap-2 bg-white text-primary border border-primary px-5 py-2 rounded-lg hover:bg-green-50 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
      >
        {paso === "leyendo" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Carga masiva
      </button>
      <input ref={inputRef} type="file" accept={EXTENSIONES} onChange={elegir} className="hidden" />

      {paso === "error" && (
        <Ventana
          titulo="Carga masiva de ventas"
          onCerrar={cerrar}
          pie={(
            <>
              <button onClick={cerrar} className="bg-white text-primary border border-primary px-5 py-2 rounded-lg hover:bg-green-50">Cerrar</button>
              <button onClick={() => inputRef.current?.click()} className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-green-700">Elegir otro archivo</button>
            </>
          )}
        >
          <div className="flex gap-3 text-sm text-neutral-700 pb-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <div className="space-y-2">
              <p>{error}</p>
              <p className="text-neutral-500">
                Requisitos: Excel o CSV con <b>una sola hoja</b>, los nombres de las columnas en la <b>primera fila</b> y una
                fila por línea de venta.
              </p>
            </div>
          </div>
        </Ventana>
      )}

      {paso === "asignar" && archivo && (
        <Ventana
          titulo={`Asignar columnas · Ventas de ${nombrePeriodo(periodo)}`}
          onCerrar={cerrar}
          pie={(
            <>
              {intento && faltantes.length > 0 && (
                <p className="mr-auto self-center text-sm text-red-600">Falta asignar: {faltantes.map((b) => b.label).join(", ")}.</p>
              )}
              <button onClick={cerrar} className="bg-white text-primary border border-primary px-5 py-2 rounded-lg hover:bg-green-50">Cancelar</button>
              <button onClick={confirmarAsignacion} className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-green-700">Confirmar asignación</button>
            </>
          )}
        >
          <p className="flex items-center gap-2 text-sm text-neutral-700 mb-1">
            <FileSpreadsheet className="w-4 h-4 text-primary" /> <b>{archivo.nombre}</b> · {archivo.filas.length} filas · {archivo.encabezados.length} columnas
          </p>
          {archivo.combinadas > 0 && (
            <p className="text-xs text-neutral-500 mb-1">Se encontraron {archivo.combinadas} rangos de celdas combinadas: su valor se copió a cada fila.</p>
          )}
          <div className={`mt-2 mb-4 flex items-center gap-2 text-sm rounded-xl px-4 py-2 border ${recordada ? "text-green-800 bg-green-50 border-green-200" : "text-neutral-700 bg-gray-50 border-gray-200"}`}>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {recordada
              ? "Este formato ya se cargó antes en este equipo: se aplicó la asignación guardada. Revísala y confirma."
              : "Sugerimos una asignación según los nombres de las columnas. Revísala: para cada campo elige la columna del archivo que le corresponde."}
          </div>

          <h3 className="font-semibold text-neutral-800">Datos de la venta</h3>
          <p className="text-xs text-neutral-500 mb-1">Todos son obligatorios. SKU, descripción y unidad de venta se cruzan con la Matriz de Materiales.</p>
          <div className="divide-y">
            {BASE.map((b) => (
              <FilaAsignacion
                key={b.key}
                label={b.label}
                obligatorio
                valor={asignacion[b.key]}
                encabezados={archivo.encabezados}
                enUso={enUso}
                ejemplo={ejemplo(asignacion[b.key])}
                onCambiar={(col) => asignar(b.key, col)}
              />
            ))}
          </div>

          <h3 className="font-semibold text-neutral-800 mt-5">Información adicional</h3>
          <p className="text-xs text-neutral-500 mb-1">Campos propios de tu empresa (N° de factura, guía de despacho, etc.). Son opcionales.</p>
          {campos.length === 0 ? (
            <p className="text-sm text-neutral-500 py-1.5">La empresa aún no tiene campos adicionales de ventas.</p>
          ) : (
            <div className="divide-y">
              {campos.map((c) => (
                <FilaAsignacion
                  key={c.id}
                  label={c.nombre}
                  valor={asignacion[`campo:${c.id}`]}
                  encabezados={archivo.encabezados}
                  enUso={enUso}
                  ejemplo={ejemplo(asignacion[`campo:${c.id}`])}
                  onCambiar={(col) => asignar(`campo:${c.id}`, col)}
                />
              ))}
            </div>
          )}

          <h3 className="font-semibold text-neutral-800 mt-5">Columnas del archivo sin asignar</h3>
          <p className="text-xs text-neutral-500 mb-1">
            Marca las que quieras guardar como un campo adicional nuevo (con el nombre de la columna). Las demás no se cargan.
          </p>
          {sinAsignar.length === 0 ? (
            <p className="text-sm text-neutral-500 py-1.5 mb-4">Todas las columnas están asignadas.</p>
          ) : (
            <div className="divide-y mb-4">
              {sinAsignar.map((col) => {
                const motivo = motivoNoCrear(col);
                return (
                  <div key={col} className={`grid grid-cols-1 sm:grid-cols-[14rem_1fr_12rem] gap-x-3 items-center py-2 text-sm ${motivo ? "text-neutral-500" : ""}`}>
                    <span className="font-semibold text-neutral-700 truncate" title={col}>{col}</span>
                    <label className={`flex items-center gap-2 ${motivo ? "" : "cursor-pointer"}`}>
                      <input
                        type="checkbox"
                        checked={crear.includes(col)}
                        disabled={!!motivo}
                        onChange={(e) => setCrear((c) => (e.target.checked ? [...c, col] : c.filter((x) => x !== col)))}
                        className="w-4 h-4 accent-primary"
                      />
                      {motivo || "Crear como campo adicional"}
                    </label>
                    <span className="text-xs text-neutral-500 truncate" title={ejemplo(col)}>{ejemplo(col) ? `Ej.: ${ejemplo(col)}` : ""}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Ventana>
      )}

      {paso === "vista" && archivo && (
        <Ventana
          titulo={`Vista previa · Ventas de ${nombrePeriodo(periodo)}`}
          onCerrar={cerrar}
          pie={(
            <>
              <button onClick={() => setPaso("asignar")} className="mr-auto bg-white text-primary border border-primary px-5 py-2 rounded-lg hover:bg-green-50">
                Volver a la asignación
              </button>
              <button onClick={cerrar} className="bg-white text-primary border border-primary px-5 py-2 rounded-lg hover:bg-green-50">Cancelar</button>
              <button onClick={revisar} className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-green-700">Revisar contenido</button>
            </>
          )}
        >
          <p className="text-sm text-neutral-700 mb-1">
            <b>{archivo.nombre}</b> · {plural(archivo.filas.length, "fila", "filas")}
            {crear.length > 0 && <> · {plural(crear.length, "campo adicional nuevo", "campos adicionales nuevos")}</>}
          </p>
          <p className="text-xs text-neutral-500 mb-3">
            Así se leerán los datos con la asignación elegida. Aún no se guarda nada: el siguiente paso revisa el contenido
            contra la Matriz de Materiales y el periodo.
          </p>
          <div className="overflow-auto max-h-[45dvh] border rounded-xl mb-3">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-neutral-600 sticky top-0 z-10">
                <tr>
                  <th className="p-2 text-right" title="N.º de fila en el archivo">Fila</th>
                  {columnasVista.map((c) => (
                    <th key={c.id} className="p-2 whitespace-nowrap">
                      {c.label}
                      {c.nuevo && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-green-50 text-green-800 text-xs font-normal">nuevo</span>}
                      {c.label !== c.col && <span className="block text-xs font-normal text-neutral-400">{c.col}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {archivo.filas.slice(0, mostradas).map((f) => (
                  <tr key={f.fila} className="align-top border-t">
                    <td className="p-2 text-right text-neutral-400 tabular-nums">{f.fila}</td>
                    {columnasVista.map((c) => (
                      <td key={c.id} className="p-2 max-w-[16rem] truncate" title={f.valores[c.col]}>
                        {valorVista(c.id, f.valores[c.col]) || (c.obligatorio ? <span className="text-red-500 italic text-xs">vacío</span> : "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mb-4">
            <Paginado total={archivo.filas.length} mostradas={mostradas} onMas={() => setMostradas((m) => m + FILAS_POR_PAGINA)} texto="filas" />
          </div>
        </Ventana>
      )}

      {paso === "revision" && revision && (
        <Ventana
          titulo={`Revisión · Ventas de ${nombrePeriodo(periodo)}`}
          onCerrar={cerrar}
          pie={(
            <>
              <button onClick={() => setPaso("vista")} className="mr-auto bg-white text-primary border border-primary px-5 py-2 rounded-lg hover:bg-green-50">
                Volver a la vista previa
              </button>
              {errorGuardar && <p className="basis-full text-sm text-red-600">No se pudo guardar: {errorGuardar}</p>}
              {revision.errores.length > 0 && (
                <p className="text-sm text-red-600">Corrige el archivo y vuelve a subirlo.</p>
              )}
              {revision.errores.length === 0 && requiereAutorizacion && !autorizado && (
                <p className="text-sm text-yellow-700">Autoriza el reemplazo para guardar.</p>
              )}
              <button onClick={cerrar} className="bg-white text-primary border border-primary px-5 py-2 rounded-lg hover:bg-green-50">Cancelar</button>
              <button
                onClick={guardar}
                disabled={!puedeGuardar}
                className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {guardando ? "Guardando…" : `Guardar ${plural(revision.lineas.length, "línea", "líneas")}`}
              </button>
            </>
          )}
        >
          <Revision
            archivo={archivo.nombre}
            periodo={periodo}
            revision={revision}
            camposNuevos={crear}
            existentes={existentes.length}
            modo={modo}
            onModo={(m) => { setModo(m); setAutorizado(false); }}
            reemplazos={reemplazos}
            aReemplazar={aReemplazar}
            autorizado={autorizado}
            onAutorizar={setAutorizado}
          />
        </Ventana>
      )}
    </>
  );
};

// ── Revisión: resumen, errores, excluidos, advertencias y modo de carga ──────
const Tarjeta = ({ n, texto, cls }) => (
  <div className={`rounded-xl px-3 py-2 ${cls}`}>
    <p className="text-2xl font-bold tabular-nums">{n.toLocaleString("es-CL")}</p>
    <p className="text-xs">{texto}</p>
  </div>
);

const Revision = ({ archivo, periodo, revision, camposNuevos, existentes, modo, onModo, reemplazos, aReemplazar, autorizado, onAutorizar }) => {
  const [verErrores, setVerErrores] = useState(FILAS_POR_PAGINA);
  const { errores, excluidos, advertencias, resumen } = revision;
  const hayErrores = errores.length > 0;

  return (
    <div className="pb-4 space-y-5">
      <div>
        <p className="text-sm text-neutral-700 mb-2"><b>{archivo}</b> · {plural(resumen.filas, "fila revisada", "filas revisadas")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Tarjeta n={resumen.validas} texto="Líneas válidas" cls="bg-green-50 text-green-800" />
          <Tarjeta n={resumen.conError} texto="Filas con error (bloquean)" cls="bg-red-50 text-red-700" />
          <Tarjeta n={resumen.excluidas} texto="No están en la Matriz (no se guardan)" cls="bg-yellow-50 text-yellow-800" />
          <Tarjeta n={advertencias.length} texto="Descripciones distintas (aviso)" cls="bg-gray-100 text-neutral-600" />
        </div>
      </div>

      {hayErrores && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 className="font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Errores: {plural(errores.length, "error", "errores")} en {plural(resumen.conError, "fila", "filas")}
            </h3>
            <button
              onClick={() => descargarErrores(archivo, errores, [["Fila", "fila", 6], ["SKU", "sku", 24], ["Error", "mensaje", 100]])}
              className="flex items-center gap-1 text-sm text-primary hover:text-green-800"
            >
              <Download className="w-4 h-4" /> Descargar errores (Excel)
            </button>
          </div>
          <p className="text-xs text-neutral-500 mb-2">
            <b>No se guarda nada</b> mientras el archivo tenga errores: una venta mal cargada cambia lo que se declara.
            Corrígelos en el archivo y vuelve a subirlo.
          </p>
          <div className="overflow-auto max-h-[35dvh] border border-red-200 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-red-50 text-left text-red-800 sticky top-0">
                <tr><th className="p-2 text-right">Fila</th><th className="p-2">SKU</th><th className="p-2">Error</th></tr>
              </thead>
              <tbody>
                {errores.slice(0, verErrores).map((e, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="p-2 text-right tabular-nums text-neutral-500">{e.fila}</td>
                    <td className="p-2 whitespace-nowrap">{e.sku || <span className="italic text-neutral-400">sin SKU</span>}</td>
                    <td className="p-2">{e.mensaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginado total={errores.length} mostradas={verErrores} onMas={() => setVerErrores((n) => n + FILAS_POR_PAGINA)} texto="errores" />
        </section>
      )}

      {excluidos.length > 0 && (
        <section className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="font-semibold text-yellow-800 flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4" /> No están en la Matriz de Materiales: {plural(excluidos.length, "producto", "productos")} ({plural(resumen.excluidas, "fila", "filas")})
          </h3>
          <p className="text-xs text-yellow-800 mb-3">
            Estas ventas <b>no se guardarán</b>. Puede ser correcto (por ejemplo, envases reciclados o reventas declaradas por
            otra empresa); si deben contabilizarse, créalos primero en la Matriz de Materiales y vuelve a cargar el archivo.
          </p>
          <div className="overflow-auto max-h-[30dvh] border border-yellow-100 rounded-lg bg-white">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-neutral-600 sticky top-0">
                <tr><th className="p-2">SKU</th><th className="p-2">Unidad de venta</th><th className="p-2 text-right">Filas</th><th className="p-2">Motivo</th></tr>
              </thead>
              <tbody>
                {excluidos.map((e) => (
                  <tr key={`${e.sku}::${e.unidad}`} className="border-t align-top">
                    <td className="p-2 whitespace-nowrap font-semibold">{e.sku}<span className="block text-xs font-normal text-neutral-500">{e.descripcion}</span></td>
                    <td className="p-2 whitespace-nowrap">{e.unidad}</td>
                    <td className="p-2 text-right tabular-nums">{e.filas}</td>
                    <td className="p-2 text-neutral-700">
                      {e.motivo === "sku"
                        ? "El SKU no existe en la Matriz."
                        : `El SKU existe, pero no con esta unidad (en la Matriz: ${e.unidadesMatriz.join(", ")}).`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {advertencias.length > 0 && (
        <section>
          <h3 className="font-semibold text-neutral-800 flex items-center gap-2 mb-1">
            <Info className="w-4 h-4" /> Descripción distinta a la de la Matriz: {plural(advertencias.length, "SKU", "SKU")}
          </h3>
          <p className="text-xs text-neutral-500 mb-2">Solo es un aviso: las ventas se guardan igual (el cruce se hace por SKU y unidad de venta).</p>
          <div className="overflow-auto max-h-[25dvh] border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-neutral-600 sticky top-0">
                <tr><th className="p-2">SKU</th><th className="p-2">En el archivo</th><th className="p-2">En la Matriz</th><th className="p-2 text-right">Filas</th></tr>
              </thead>
              <tbody>
                {advertencias.map((a) => (
                  <tr key={a.sku} className="border-t align-top">
                    <td className="p-2 whitespace-nowrap font-semibold">{a.sku}</td>
                    <td className="p-2">{a.archivo}</td>
                    <td className="p-2">{a.matriz}</td>
                    <td className="p-2 text-right tabular-nums">{a.filas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {camposNuevos.length > 0 && (
        <p className="text-sm text-neutral-700">
          Se crearán los campos adicionales: {camposNuevos.map((c) => <b key={c} className="mr-1">"{c}"</b>)}
        </p>
      )}

      {!hayErrores && resumen.validas > 0 && (
        <section>
          <h3 className="font-semibold text-neutral-800 mb-1">¿Cómo se guarda?</h3>
          <p className="text-xs text-neutral-500 mb-2">
            {nombrePeriodo(periodo)} tiene hoy {plural(existentes, "línea de venta", "líneas de venta")}.
          </p>
          <div className="grid sm:grid-cols-2 gap-2 mb-3">
            {[
              ["combinar", "Combinar con lo existente", "Reemplaza las ventas del periodo de los SKU que vienen en el archivo. Las de los demás SKU se conservan."],
              ["reemplazar", "Reemplazar todo el periodo", "Elimina todas las ventas del periodo y deja solo las del archivo. Útil si el archivo viene completo desde tu ERP."],
            ].map(([valor, titulo, texto]) => (
              <label
                key={valor}
                className={`flex gap-2 rounded-xl border p-3 cursor-pointer ${modo === valor ? (valor === "reemplazar" ? "border-red-400 bg-red-50" : "border-primary bg-green-50") : "border-gray-200 hover:bg-gray-50"}`}
              >
                <input type="radio" name="modo" checked={modo === valor} onChange={() => onModo(valor)} className="mt-1 accent-primary" />
                <span>
                  <span className="block text-sm font-semibold text-neutral-800">{titulo}</span>
                  <span className="block text-xs text-neutral-600">{texto}</span>
                </span>
              </label>
            ))}
          </div>

          {modo === "combinar" && reemplazos.length > 0 && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800 mb-2">
                {plural(reemplazos.length, "SKU del archivo ya tiene", "SKU del archivo ya tienen")} ventas en {nombrePeriodo(periodo)}.
                Se reemplazarán <b>todas</b> sus líneas (de todos los clientes y documentos) por las del archivo:
              </p>
              <div className="overflow-auto max-h-[25dvh] border border-yellow-100 rounded-lg bg-white mb-3">
                <table className="w-full text-sm">
                  <thead className="bg-white text-left text-neutral-600 sticky top-0">
                    <tr><th className="p-2">SKU</th><th className="p-2 text-right">Líneas actuales (se reemplazan)</th><th className="p-2 text-right">Líneas del archivo</th></tr>
                  </thead>
                  <tbody>
                    {reemplazos.map((r) => (
                      <tr key={r.sku} className="border-t">
                        <td className="p-2 font-semibold">{r.sku}</td>
                        <td className="p-2 text-right tabular-nums">{r.existentes}</td>
                        <td className="p-2 text-right tabular-nums">{r.nuevas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Autorizar autorizado={autorizado} onAutorizar={onAutorizar}>
                Autorizo reemplazar {plural(aReemplazar, "línea existente", "líneas existentes")} de {plural(reemplazos.length, "SKU", "SKU")}.
              </Autorizar>
            </div>
          )}
          {modo === "combinar" && reemplazos.length === 0 && (
            <p className="text-sm text-neutral-600">Ningún SKU del archivo tiene ventas en el periodo: solo se agregan líneas.</p>
          )}
          {modo === "reemplazar" && (aReemplazar > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700 mb-2">
                Se eliminarán <b>todas</b> las ventas de {nombrePeriodo(periodo)} ({plural(aReemplazar, "línea", "líneas")}) y quedarán
                solo las {plural(resumen.validas, "línea", "líneas")} del archivo. Las eliminadas quedan en el historial.
              </p>
              <Autorizar autorizado={autorizado} onAutorizar={onAutorizar}>
                Autorizo eliminar las {plural(aReemplazar, "línea", "líneas")} de {nombrePeriodo(periodo)} y reemplazarlas por las del archivo.
              </Autorizar>
            </div>
          ) : (
            <p className="text-sm text-neutral-600">El periodo no tiene ventas: solo se agregan líneas.</p>
          ))}
        </section>
      )}
    </div>
  );
};

const Autorizar = ({ autorizado, onAutorizar, children }) => (
  <label className="flex items-start gap-2 text-sm font-semibold text-neutral-800 cursor-pointer">
    <input type="checkbox" checked={autorizado} onChange={(e) => onAutorizar(e.target.checked)} className="w-4 h-4 mt-0.5 accent-primary" />
    {children}
  </label>
);

export default CargaMasivaVentas;
