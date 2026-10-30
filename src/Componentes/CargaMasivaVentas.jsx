import React, { useRef, useState } from "react";
import { Upload, AlertTriangle, CheckCircle2, Loader2, FileSpreadsheet } from "lucide-react";
import { normalizar } from "./cargaMasivaRevision.js";
import { EXTENSIONES, FILAS_POR_PAGINA, mostrarValor, huellaDe, guardarConfig, leerArchivo } from "./cargaMasivaLectura.js";
import { Ventana, FilaAsignacion, Paginado } from "./cargaMasivaComun.jsx";
import { revisarVentas, clasificarCoincidencias, nombrePeriodo, documentosEnOtrosPeriodos } from "./ventasRevision.js";
import { MAX_NOMBRE_CAMPO, BASE, DOCS, FOLIOS_ASIGNADOS, asignacionInicial, plural, valorVista } from "./cargaMasivaVentasComun.js";
import { Revision } from "./CargaMasivaVentasRevision.jsx";

// Carga masiva del Registro de Ventas: leer el archivo, asignar columnas, vista previa, revisar contra la Matriz y
// el periodo, elegir el modo (combinar / reemplazar todo el periodo) y guardar. Las filas con error bloquean el
// guardado. Plan: specs/002-registro-ventas/plan-trabajo.md; documentos y combinar por documento:
// documento-tributario.md; permisos del REP: ingreso-manual.md


// periodo: { anio, mes }. productos: Matriz vigente. unidades: catálogo con aGranel. campos: campos adicionales de ventas.
// existentes: ventas vigentes del periodo. onGuardar(payload): async, puede lanzar el error del back.
// puedeCargar: si el periodo admite cargas (no bloqueado). puedeTodo: admin/dev (reemplazan ventas de otros usuarios y
// todo el periodo); el REP solo reemplaza las suyas. revisarDocumentos(lineas): async → documentos ya registrados en
// otros periodos (registros dudosos).
const CargaMasivaVentas = ({
  periodo, productos, unidades, campos, existentes, puedeCargar, motivoNoCargar, puedeTodo, usuarioId, revisarDocumentos, claveConfig, onGuardar,
}) => {
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
  const [otrosPeriodos, setOtrosPeriodos] = useState([]); // documentos del archivo ya registrados en otros periodos
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
    if (DOCS.some((d) => normalizar(d.label) === normalizar(col) || d.alias.includes(normalizar(col)))) return "Es un documento de la venta: asígnalo arriba.";
    if (col.length > MAX_NOMBRE_CAMPO) return `El nombre supera ${MAX_NOMBRE_CAMPO} caracteres.`;
    return "";
  };

  const confirmarAsignacion = () => {
    setIntento(true);
    if (faltantes.length || !FOLIOS_ASIGNADOS(asignacion)) return;
    const crearValidas = crear.filter((c) => !motivoNoCrear(c));
    setCrear(crearValidas);
    guardarConfig(claveConfig, huellaDe(archivo.encabezados), { asignacion, crear: crearValidas });
    setMostradas(FILAS_POR_PAGINA);
    setPaso("vista");
  };

  const columnasVista = archivo ? [
    ...BASE.filter((b) => asignacion[b.key]).map((b) => ({ id: b.key, label: b.label, col: asignacion[b.key], obligatorio: true })),
    ...DOCS.filter((d) => asignacion[d.key]).map((d) => ({ id: d.key, label: d.label, col: asignacion[d.key] })),
    ...campos.filter((c) => asignacion[`campo:${c.id}`]).map((c) => ({ id: c.id, label: c.nombre, col: asignacion[`campo:${c.id}`] })),
    ...crear.map((col) => ({ id: `nuevo:${col}`, label: col, col, nuevo: true })),
  ] : [];

  // Revisa el archivo y consulta qué documentos de sus líneas ya están en otros periodos (registros dudosos: solo aviso;
  // si la consulta falla, se revisa igual sin ese aviso).
  const revisar = async () => {
    const r = revisarVentas({ filas: archivo.filas, asignacion, crear, base: BASE, periodo, productos, unidades, campos });
    setRevision(r);
    setModo("combinar");
    setAutorizado(false);
    setErrorGuardar("");
    setOtrosPeriodos([]);
    setPaso("revision");
    if (r.lineas.length) revisarDocumentos(r.lineas).then(setOtrosPeriodos).catch(() => {});
  };

  // Qué se reemplaza según el modo: en "combinar", las ventas del periodo que comparten un documento con el archivo;
  // en "reemplazar", todas. Completar o dejar igual no pide confirmación; modificar o eliminar sí.
  const coincidencias = revision
    ? clasificarCoincidencias(revision.lineas, existentes, { puedeTodo, usuarioId })
    : { completa: [], sinCambios: [], modifica: [], elimina: [], ajenas: [] };
  const requiereAutorizacion = modo === "reemplazar"
    ? existentes.length > 0
    : coincidencias.modifica.length + coincidencias.elimina.length > 0;
  const bloqueaAjenas = modo === "combinar" && coincidencias.ajenas.length > 0;
  const dudosas = revision
    ? revision.lineas.map((l) => ({ linea: l, otros: documentosEnOtrosPeriodos(l, otrosPeriodos) })).filter((d) => d.otros.length)
    : [];
  const puedeGuardar = revision && revision.errores.length === 0 && revision.lineas.length > 0 && !bloqueaAjenas
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
        disabled={!puedeCargar || paso === "leyendo"}
        title={puedeCargar ? `Cargar las ventas de ${nombrePeriodo(periodo)} desde un archivo Excel o CSV` : motivoNoCargar}
        className="btn-secundario"
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
              <button onClick={cerrar} className="btn-secundario">Cerrar</button>
              <button onClick={() => inputRef.current?.click()} className="btn-principal">Elegir otro archivo</button>
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
              {intento && (faltantes.length > 0 || !FOLIOS_ASIGNADOS(asignacion)) && (
                <p className="mr-auto self-center text-sm text-red-600">
                  Falta asignar: {[...faltantes.map((b) => b.label), ...(FOLIOS_ASIGNADOS(asignacion) ? [] : ["un documento (factura, guía o boleta)"])].join(", ")}.
                </p>
              )}
              <button onClick={cerrar} className="btn-secundario">Cancelar</button>
              <button onClick={confirmarAsignacion} className="btn-principal">Confirmar asignación</button>
            </>
          )}
        >
          <p className="flex items-center gap-2 text-sm text-neutral-700 mb-1">
            <FileSpreadsheet className="w-4 h-4 text-primary-dark" /> <b>{archivo.nombre}</b> · {archivo.filas.length} filas · {archivo.encabezados.length} columnas
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

          <h3 className="font-semibold text-neutral-800 mt-5">Documentos de la venta</h3>
          <p className="text-xs text-neutral-500 mb-1">Cada uno es opcional, pero cada fila debe traer al menos la factura, la guía de despacho o la boleta.</p>
          <div className="divide-y">
            {DOCS.map((d) => (
              <FilaAsignacion
                key={d.key}
                label={d.label}
                valor={asignacion[d.key]}
                encabezados={archivo.encabezados}
                enUso={enUso}
                ejemplo={ejemplo(asignacion[d.key])}
                onCambiar={(col) => asignar(d.key, col)}
              />
            ))}
          </div>
          {intento && !FOLIOS_ASIGNADOS(asignacion) && (
            <p className="text-sm text-red-600 mt-1">Asigna al menos la columna de factura, guía de despacho o boleta.</p>
          )}

          <h3 className="font-semibold text-neutral-800 mt-5">Información adicional</h3>
          <p className="text-xs text-neutral-500 mb-1">Campos propios de tu empresa. Son opcionales.</p>
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
                        className="w-4 h-4 accent-primary-dark"
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
              <button onClick={() => setPaso("asignar")} className="btn-secundario mr-auto">
                Volver a la asignación
              </button>
              <button onClick={cerrar} className="btn-secundario">Cancelar</button>
              <button onClick={revisar} className="btn-principal">Revisar contenido</button>
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
                      {c.label !== c.col && <span className="block text-xs font-normal text-neutral-500">{c.col}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {archivo.filas.slice(0, mostradas).map((f) => (
                  <tr key={f.fila} className="align-top border-t">
                    <td className="p-2 text-right text-neutral-500 tabular-nums">{f.fila}</td>
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
              <button onClick={() => setPaso("vista")} className="btn-secundario mr-auto">
                Volver a la vista previa
              </button>
              {errorGuardar && <p role="alert" className="basis-full text-sm text-red-600">No se pudo guardar: {errorGuardar}</p>}
              {revision.errores.length > 0 && (
                <p className="text-sm text-red-600">Corrige el archivo y vuelve a subirlo.</p>
              )}
              {bloqueaAjenas && <p className="text-sm text-red-600">Hay ventas de otros usuarios que no puedes reemplazar.</p>}
              {revision.errores.length === 0 && !bloqueaAjenas && requiereAutorizacion && !autorizado && (
                <p className="text-sm text-yellow-700">Autoriza el reemplazo para guardar.</p>
              )}
              <button onClick={cerrar} className="btn-secundario">Cancelar</button>
              <button
                onClick={guardar}
                disabled={!puedeGuardar}
                className="btn-principal"
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
            coincidencias={coincidencias}
            dudosas={dudosas}
            puedeTodo={puedeTodo}
            autorizado={autorizado}
            onAutorizar={setAutorizado}
          />
        </Ventana>
      )}
    </>
  );
};

export default CargaMasivaVentas;
