import React, { useRef, useState } from "react";
import { Upload, AlertTriangle, CheckCircle2, Loader2, FileSpreadsheet, Download, Info } from "lucide-react";
import { normalizar } from "./cargaMasivaRevision.js";
import {
  EXTENSIONES, FILAS_POR_PAGINA, mostrarValor, huellaDe, leerConfig, guardarConfig, leerArchivo, descargarErrores,
} from "./cargaMasivaLectura.js";
import { Ventana, FilaAsignacion, Paginado } from "./cargaMasivaComun.jsx";
import {
  revisarVentas, clasificarCoincidencias, nombrePeriodo, leerFecha, fechaIso, fechaChilena, DOCUMENTOS, CAMPOS_COMPARADOS,
  textoDocumentos, documentosEnOtrosPeriodos, textoDudosa,
} from "./ventasRevision.js";

// Carga masiva del Registro de Ventas: leer el archivo, asignar columnas, vista previa, revisar contra la Matriz y
// el periodo, elegir el modo (combinar / reemplazar todo el periodo) y guardar. Las filas con error bloquean el
// guardado. Plan: specs/002-registro-ventas/plan-trabajo.md; documentos y combinar por documento:
// documento-tributario.md; permisos del REP: ingreso-manual.md

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

// Documentos de la venta: opcionales cada uno, pero cada fila debe traer factura, guía o boleta.
const ALIAS_DOCUMENTOS = {
  folioFactura: ["factura", "n factura", "no factura", "nro factura", "numero factura", "numero de factura", "folio factura", "n de factura"],
  folioGuia: ["guia", "guia de despacho", "n guia", "no guia", "nro guia", "numero guia", "n guia de despacho", "numero guia de despacho", "folio guia", "guia despacho"],
  folioBoleta: ["boleta", "n boleta", "no boleta", "nro boleta", "numero boleta", "numero de boleta", "folio boleta"],
  pedido: ["pedido", "n pedido", "no pedido", "nro pedido", "numero pedido", "numero de pedido", "orden de compra", "id pedido", "id interno"],
};
const DOCS = DOCUMENTOS.map((d) => ({ ...d, alias: ALIAS_DOCUMENTOS[d.key] }));
const FOLIOS_ASIGNADOS = (asignacion) => ["folioFactura", "folioGuia", "folioBoleta"].some((k) => asignacion[k]);

// Asignación inicial: la guardada para este formato o, si no hay, una sugerida comparando nombres.
const asignacionInicial = (encabezados, campos, clave) => {
  const guardada = leerConfig(clave).formatos[huellaDe(encabezados)];
  const claves = [...BASE.map((b) => b.key), ...DOCS.map((d) => d.key), ...campos.map((c) => `campo:${c.id}`)];
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
  for (const b of [...BASE, ...DOCS]) {
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
        className="flex items-center gap-2 bg-white text-primary-dark border border-primary px-5 py-2 rounded-lg hover:bg-green-50 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed"
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
              <button onClick={cerrar} className="bg-white text-primary-dark border border-primary px-5 py-2 rounded-lg hover:bg-green-50">Cerrar</button>
              <button onClick={() => inputRef.current?.click()} className="bg-primary-dark text-white px-5 py-2 rounded-lg hover:bg-primary-darker">Elegir otro archivo</button>
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
              <button onClick={cerrar} className="bg-white text-primary-dark border border-primary px-5 py-2 rounded-lg hover:bg-green-50">Cancelar</button>
              <button onClick={confirmarAsignacion} className="bg-primary-dark text-white px-5 py-2 rounded-lg hover:bg-primary-darker">Confirmar asignación</button>
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
              <button onClick={() => setPaso("asignar")} className="mr-auto bg-white text-primary-dark border border-primary px-5 py-2 rounded-lg hover:bg-green-50">
                Volver a la asignación
              </button>
              <button onClick={cerrar} className="bg-white text-primary-dark border border-primary px-5 py-2 rounded-lg hover:bg-green-50">Cancelar</button>
              <button onClick={revisar} className="bg-primary-dark text-white px-5 py-2 rounded-lg hover:bg-primary-darker">Revisar contenido</button>
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
              <button onClick={() => setPaso("vista")} className="mr-auto bg-white text-primary-dark border border-primary px-5 py-2 rounded-lg hover:bg-green-50">
                Volver a la vista previa
              </button>
              {errorGuardar && <p className="basis-full text-sm text-red-600">No se pudo guardar: {errorGuardar}</p>}
              {revision.errores.length > 0 && (
                <p className="text-sm text-red-600">Corrige el archivo y vuelve a subirlo.</p>
              )}
              {bloqueaAjenas && <p className="text-sm text-red-600">Hay ventas de otros usuarios que no puedes reemplazar.</p>}
              {revision.errores.length === 0 && !bloqueaAjenas && requiereAutorizacion && !autorizado && (
                <p className="text-sm text-yellow-700">Autoriza el reemplazo para guardar.</p>
              )}
              <button onClick={cerrar} className="bg-white text-primary-dark border border-primary px-5 py-2 rounded-lg hover:bg-green-50">Cancelar</button>
              <button
                onClick={guardar}
                disabled={!puedeGuardar}
                className="bg-primary-dark text-white px-5 py-2 rounded-lg hover:bg-primary-darker disabled:bg-gray-400 disabled:cursor-not-allowed"
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

// ── Revisión: resumen, errores, excluidos, advertencias y modo de carga ──────
const Tarjeta = ({ n, texto, cls }) => (
  <div className={`rounded-xl px-3 py-2 ${cls}`}>
    <p className="text-2xl font-bold tabular-nums">{n.toLocaleString("es-CL")}</p>
    <p className="text-xs">{texto}</p>
  </div>
);

const Revision = ({
  archivo, periodo, revision, camposNuevos, existentes, modo, onModo, coincidencias, dudosas, puedeTodo, autorizado, onAutorizar,
}) => {
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
              className="flex items-center gap-1 text-sm text-primary-dark hover:text-green-800"
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

      {dudosas.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4" /> Registros dudosos: {plural(dudosas.length, "línea trae", "líneas traen")} documentos ya registrados en otro periodo
          </h3>
          <p className="text-xs text-amber-800 mb-3">
            Solo es un aviso: se guardan igual y quedan resaltadas en el listado. Revisa que no sea la misma venta registrada
            dos veces (por ejemplo, la guía en un mes y la factura en el siguiente).
          </p>
          <div className="overflow-auto max-h-[25dvh] border border-amber-100 rounded-lg bg-white">
            <table className="w-full text-sm">
              <thead className="bg-white text-left text-neutral-600 sticky top-0">
                <tr><th className="p-2 text-right">Fila</th><th className="p-2">SKU</th><th className="p-2">Documentos</th><th className="p-2">Ya registrado en</th></tr>
              </thead>
              <tbody>
                {dudosas.map(({ linea, otros }) => (
                  <tr key={linea.fila} className="border-t align-top bg-amber-50/50">
                    <td className="p-2 text-right tabular-nums text-neutral-500">{linea.fila}</td>
                    <td className="p-2 whitespace-nowrap font-semibold">{linea.sku}</td>
                    <td className="p-2 whitespace-nowrap">{textoDocumentos(linea)}</td>
                    <td className="p-2">{textoDudosa(otros)}</td>
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
              ["combinar", "Combinar con lo existente", "Reemplaza las ventas del periodo que comparten un documento (factura, guía, boleta o pedido) con el archivo. Las demás se conservan."],
              ...(puedeTodo ? [["reemplazar", "Reemplazar todo el periodo", "Elimina todas las ventas del periodo y deja solo las del archivo. Útil si el archivo viene completo desde tu ERP."]] : []),
            ].map(([valor, titulo, texto]) => (
              <label
                key={valor}
                className={`flex gap-2 rounded-xl border p-3 cursor-pointer ${modo === valor ? (valor === "reemplazar" ? "border-red-400 bg-red-50" : "border-primary bg-green-50") : "border-gray-200 hover:bg-gray-50"}`}
              >
                <input type="radio" name="modo" checked={modo === valor} onChange={() => onModo(valor)} className="mt-1 accent-primary-dark" />
                <span>
                  <span className="block text-sm font-semibold text-neutral-800">{titulo}</span>
                  <span className="block text-xs text-neutral-600">{texto}</span>
                </span>
              </label>
            ))}
          </div>

          {modo === "combinar" && <Coincidencias coincidencias={coincidencias} periodo={periodo} autorizado={autorizado} onAutorizar={onAutorizar} />}
          {modo === "reemplazar" && (existentes > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700 mb-2">
                Se eliminarán <b>todas</b> las ventas de {nombrePeriodo(periodo)} ({plural(existentes, "línea", "líneas")}) y quedarán
                solo las {plural(resumen.validas, "línea", "líneas")} del archivo. Las eliminadas quedan en el historial.
              </p>
              <Autorizar autorizado={autorizado} onAutorizar={onAutorizar}>
                Autorizo eliminar las {plural(existentes, "línea", "líneas")} de {nombrePeriodo(periodo)} y reemplazarlas por las del archivo.
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

// Valor de un dato de la venta para mostrar en la comparación antes / después.
const mostrarDato = (v, key) => {
  if (key === "fecha") return fechaChilena(v.fecha);
  if (key === "cantidad") return Number(v.cantidad).toLocaleString("es-CL", { maximumFractionDigits: 6 });
  return v[key] ?? "—";
};

// Una venta en una celda: los datos comparados, con los que cambian resaltados.
const DatosVenta = ({ venta, cambios = [], resaltar }) => (
  <span className="block text-xs leading-5">
    {CAMPOS_COMPARADOS.filter((c) => venta[c.key] != null && venta[c.key] !== "").map((c) => (
      <span key={c.key} className={`mr-2 ${cambios.includes(c.key) ? resaltar : ""}`}>
        <span className="text-neutral-500">{c.label}:</span> {mostrarDato(venta, c.key)}
      </span>
    ))}
  </span>
);

// Modo "combinar" por documento: qué pasa con las ventas guardadas que comparten un documento con el archivo.
const Coincidencias = ({ coincidencias, periodo, autorizado, onAutorizar }) => {
  const { completa, sinCambios, modifica, elimina, ajenas } = coincidencias;
  if (![completa, sinCambios, modifica, elimina, ajenas].some((l) => l.length)) {
    return <p className="text-sm text-neutral-600">Ningún documento del archivo está registrado en {nombrePeriodo(periodo)}: solo se agregan líneas.</p>;
  }
  const confirmar = modifica.length + elimina.length;
  return (
    <div className="space-y-3">
      {ajenas.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 mb-2">
            {plural(ajenas.length, "venta guardada comparte", "ventas guardadas comparten")} documento con el archivo, pero las cargó
            otro usuario: tu perfil no permite reemplazarlas. Quita esos documentos del archivo o pide a un administrador que lo cargue.
          </p>
          <ul className="text-xs text-red-800 space-y-1">
            {ajenas.map(({ existente: e }) => (
              <li key={e.id}><b>{e.sku}</b> · {textoDocumentos(e)} · cargada por {e.creadoPor || "otro usuario"}</li>
            ))}
          </ul>
        </div>
      )}
      {(completa.length > 0 || sinCambios.length > 0) && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
          {completa.length > 0 && <>Se completarán {plural(completa.length, "venta ya registrada", "ventas ya registradas")} con los documentos que agrega el archivo. </>}
          {sinCambios.length > 0 && <>{plural(sinCambios.length, "venta del archivo ya está registrada", "ventas del archivo ya están registradas")} igual: se mantienen.</>}
        </p>
      )}
      {confirmar > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          {modifica.length > 0 && (
            <>
              <p className="text-sm text-yellow-800 mb-2">
                Se <b>modificarán</b> {plural(modifica.length, "venta", "ventas")}: mismo documento y producto, pero cambian otros datos (resaltados).
              </p>
              <div className="overflow-auto max-h-[30dvh] border border-yellow-100 rounded-lg bg-white mb-3">
                <table className="w-full text-sm">
                  <thead className="bg-white text-left text-neutral-600 sticky top-0">
                    <tr><th className="p-2">SKU · unidad</th><th className="p-2">Antes</th><th className="p-2">Después (archivo, fila)</th></tr>
                  </thead>
                  <tbody>
                    {modifica.map(({ existente: e, nueva: n, cambios }) => (
                      <tr key={e.id} className="border-t align-top">
                        <td className="p-2 whitespace-nowrap font-semibold">{e.sku}<span className="block text-xs font-normal text-neutral-500">{e.unidad}</span></td>
                        <td className="p-2"><DatosVenta venta={e} cambios={cambios} resaltar="bg-red-100 rounded px-1" /></td>
                        <td className="p-2">
                          <span className="text-xs text-neutral-500">Fila {n.fila}</span>
                          <DatosVenta venta={n} cambios={cambios} resaltar="bg-green-100 rounded px-1" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {elimina.length > 0 && (
            <>
              <p className="text-sm text-yellow-800 mb-2">
                Se <b>eliminarán</b> {plural(elimina.length, "venta", "ventas")}: son de documentos que vienen en el archivo, pero el archivo ya no las trae.
              </p>
              <ul className="text-xs text-yellow-900 bg-white border border-yellow-100 rounded-lg p-2 mb-3 space-y-1 max-h-[20dvh] overflow-auto">
                {elimina.map(({ existente: e }) => (
                  <li key={e.id}><b>{e.sku}</b> · {e.unidad} · {mostrarDato(e, "cantidad")} · {textoDocumentos(e)} · {e.razonSocial}</li>
                ))}
              </ul>
            </>
          )}
          <Autorizar autorizado={autorizado} onAutorizar={onAutorizar}>
            Autorizo {[
              modifica.length ? `modificar ${plural(modifica.length, "venta", "ventas")}` : "",
              elimina.length ? `eliminar ${plural(elimina.length, "venta", "ventas")}` : "",
            ].filter(Boolean).join(" y ")} de {nombrePeriodo(periodo)}.
          </Autorizar>
        </div>
      )}
    </div>
  );
};

const Autorizar = ({ autorizado, onAutorizar, children }) => (
  <label className="flex items-start gap-2 text-sm font-semibold text-neutral-800 cursor-pointer">
    <input type="checkbox" checked={autorizado} onChange={(e) => onAutorizar(e.target.checked)} className="w-4 h-4 mt-0.5 accent-primary-dark" />
    {children}
  </label>
);

export default CargaMasivaVentas;
