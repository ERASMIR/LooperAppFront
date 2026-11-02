import React, { useRef, useState } from "react";
import { Upload, AlertTriangle, CheckCircle2, Loader2, FileSpreadsheet } from "lucide-react";
import { normalizar, revisarCarga, aplicarDecisiones } from "./cargaMasivaRevision.js";
import { EXTENSIONES, FILAS_POR_PAGINA, mostrarValor, huellaDe, guardarConfig, leerArchivo } from "./cargaMasivaLectura.js";
import { Ventana, FilaAsignacion } from "./cargaMasivaComun.jsx";
import { MAX_NOMBRE_CAMPO, CALCULADAS, camposBase, asignacionInicial } from "./cargaMasivaMatrizComun.js";
import { Revision, ValoresNuevos } from "./CargaMasivaMatrizRevision.jsx";

// Carga masiva de la Matriz de Materiales: leer el archivo, asignar columnas, vista previa (parte A),
// revisar el contenido, autorizar valores nuevos y guardar (parte B; lógica en cargaMasivaRevision.js).
// Plan: specs/001-matriz-materiales/carga-masiva.md

// ── Componente ────────────────────────────────────────────────────────────────
// catalogos: { unidades, componentes, caracteristicas, campos } de la empresa. productos: matriz actual.
// claveConfig: clave de localStorage (por usuario y empresa). onGuardar(payload): async, puede lanzar el error del back.
const CargaMasivaMatriz = ({ gransic, catalogos, productos, puedeEditar, claveConfig, onGuardar }) => {
  const { campos } = catalogos;
  const inputRef = useRef(null);
  const [paso, setPaso] = useState(null); // null | "leyendo" | "error" | "asignar" | "vista" | "revision" | "nuevos"
  const [error, setError] = useState("");
  const [archivo, setArchivo] = useState(null); // { nombre, encabezados, filas, combinadas }
  const [asignacion, setAsignacion] = useState({}); // { claveCampo: encabezado }
  const [crear, setCrear] = useState([]); // encabezados que se crearán como campo adicional
  const [niveles, setNiveles] = useState({}); // { encabezado: "producto" | "componente" } de los campos a crear
  const [recordada, setRecordada] = useState(false);
  const [intento, setIntento] = useState(false);
  const [mostradas, setMostradas] = useState(FILAS_POR_PAGINA);
  const [revision, setRevision] = useState(null); // resultado de revisarCarga
  const [decisiones, setDecisiones] = useState({}); // { "sku::idQuitado": "conservar" | "eliminar" }
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");

  const base = camposBase(gransic.tiene_peligrosidad);

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
      const leido = await leerArchivo(f, "la matriz");
      const inicial = asignacionInicial(leido.encabezados, base, campos, claveConfig);
      setArchivo({ nombre: f.name, ...leido });
      setAsignacion(inicial.asignacion);
      setCrear(inicial.crear);
      setNiveles(inicial.niveles);
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
  // ¿La columna trae valores distintos en filas de un mismo SKU? (p. ej. "Peso por unidad de venta").
  const variaEnSku = (col) => {
    if (!col || !asignacion.sku) return false;
    const vistos = new Map();
    return archivo.filas.some((f) => {
      const sku = normalizar(f.valores[asignacion.sku]);
      const valor = f.valores[col];
      if (!sku || !valor) return false;
      if (!vistos.has(sku)) vistos.set(sku, valor);
      return vistos.get(sku) !== valor;
    });
  };
  const faltantes = base.filter((b) => !b.opcional && !asignacion[b.key]);

  const asignar = (clave, col) => {
    setAsignacion((a) => ({ ...a, [clave]: col }));
    if (col) setCrear((c) => c.filter((x) => x !== col));
  };

  // Al marcar una columna para crear se sugiere el nivel: "componente" si cambia entre filas de un mismo SKU.
  const marcarCrear = (col, marcada) => {
    setCrear((c) => (marcada ? [...c, col] : c.filter((x) => x !== col)));
    if (marcada && !niveles[col]) setNiveles((n) => ({ ...n, [col]: variaEnSku(col) ? "componente" : "producto" }));
  };

  // Una columna no se puede crear como campo si ya existe uno con ese nombre o si el nombre es muy largo.
  const motivoNoCrear = (col) => {
    if (CALCULADAS.includes(normalizar(col))) return "La app lo calcula sola: no se carga.";
    const existente = campos.find((c) => normalizar(c.nombre) === normalizar(col));
    if (existente) return `Ya existe el campo "${existente.nombre}": asígnalo arriba.`;
    if (col.length > MAX_NOMBRE_CAMPO) return `El nombre supera ${MAX_NOMBRE_CAMPO} caracteres.`;
    return "";
  };

  const confirmarAsignacion = () => {
    setIntento(true);
    if (faltantes.length) return;
    const crearValidas = crear.filter((c) => !motivoNoCrear(c));
    setCrear(crearValidas);
    guardarConfig(claveConfig, huellaDe(archivo.encabezados), { asignacion, crear: crearValidas, niveles });
    setMostradas(FILAS_POR_PAGINA);
    setPaso("vista");
  };

  // Columnas de la vista previa, en el orden de la ventana de asignación.
  const columnasVista = archivo ? [
    ...base.filter((b) => asignacion[b.key]).map((b) => ({ id: b.key, label: b.label, col: asignacion[b.key], obligatorio: !b.opcional })),
    ...campos.filter((c) => asignacion[`campo:${c.id}`]).map((c) => ({ id: c.id, label: c.nombre, col: asignacion[`campo:${c.id}`] })),
    ...crear.map((col) => ({ id: `nuevo:${col}`, label: col, col, nuevo: niveles[col] === "componente" ? "nuevo · componente" : "nuevo · producto" })),
  ] : [];
  const revisar = () => {
    setRevision(revisarCarga({ filas: archivo.filas, asignacion, crear, niveles, base, gransic, catalogos, productos }));
    setDecisiones({});
    setErrorGuardar("");
    setPaso("revision");
  };

  // Productos con las decisiones aplicadas sobre los componentes que no vienen en el archivo.
  const claveDecision = (r, q) => `${r.sku}::${q.id}`;
  const productosFinal = revision ? revision.productos.map((r) => (r.quitados?.length
    ? aplicarDecisiones(r, Object.fromEntries(r.quitados.map((q) => [q.id, decisiones[claveDecision(r, q)]])))
    : r)) : [];
  const conQuitados = revision ? revision.productos.filter((r) => r.quitados?.length) : [];
  const pendientes = conQuitados.reduce((n, r) => n + r.quitados.filter((q) => !decisiones[claveDecision(r, q)]).length, 0);
  const decidir = (cambios) => setDecisiones((d) => ({ ...d, ...cambios }));
  const decidirTodos = (valor) => decidir(Object.fromEntries(conQuitados.flatMap((r) => r.quitados.map((q) => [claveDecision(r, q), valor]))));
  const aGuardar = productosFinal.filter((r) => r.estado === "nuevo" || r.estado === "modificado");
  const hayNuevosValores = revision && Object.values(revision.nuevosValores).some((l) => l.length);

  // Un solo envío con lo autorizado; el back lo guarda en una transacción (todo o nada).
  const guardar = async () => {
    setGuardando(true);
    setErrorGuardar("");
    const nv = revision.nuevosValores;
    try {
      await onGuardar({
        archivo: archivo.nombre,
        filas: archivo.filas.length,
        conError: revision.resumen.conError,
        nuevosValores: {
          unidades: nv.unidades.map((n) => n.nombre),
          componentes: nv.componentes.map((n) => n.nombre),
          campos: nv.campos,
        },
        productos: aGuardar.map((r) => r.producto),
      });
      cerrar();
    } catch (err) {
      setErrorGuardar([err.message, ...(err.errores || [])].join(" · "));
      setPaso("revision");
    } finally {
      setGuardando(false);
    }
  };

  const skus = archivo && asignacion.sku ? new Set(archivo.filas.map((f) => f.valores[asignacion.sku]).filter(Boolean)).size : 0;

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={!puedeEditar || paso === "leyendo"}
        title={puedeEditar ? "Cargar productos desde un archivo Excel o CSV" : "Tu perfil solo permite consultar la matriz"}
        className="btn-secundario ml-auto"
      >
        {paso === "leyendo" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Carga masiva
      </button>
      <input ref={inputRef} type="file" accept={EXTENSIONES} onChange={elegir} className="hidden" />

      {paso === "error" && (
        <Ventana
          titulo="Carga masiva"
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
                fila por componente.
              </p>
            </div>
          </div>
        </Ventana>
      )}

      {paso === "asignar" && archivo && (
        <Ventana
          titulo="Asignar columnas del archivo"
          onCerrar={cerrar}
          pie={(
            <>
              {intento && faltantes.length > 0 && (
                <p className="mr-auto self-center text-sm text-red-600">Falta asignar: {faltantes.map((b) => b.label).join(", ")}.</p>
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

          <h3 className="font-semibold text-neutral-800">Datos del producto</h3>
          <p className="text-xs text-neutral-500 mb-1">Los campos con <span className="text-red-600">*</span> son obligatorios. El peso por unidad de venta y las TON se calculan solos.</p>
          <div className="divide-y">
            {base.map((b) => (
              <FilaAsignacion
                key={b.key}
                label={b.label}
                obligatorio={!b.opcional}
                valor={asignacion[b.key]}
                encabezados={archivo.encabezados}
                enUso={enUso}
                ejemplo={ejemplo(asignacion[b.key])}
                onCambiar={(col) => asignar(b.key, col)}
              />
            ))}
          </div>

          {[
            ["Información adicional del producto", "Un valor por SKU. Son opcionales.", campos.filter((c) => c.nivel !== "componente")],
            ["Información adicional del componente", "Un valor por fila (componente) del archivo. Son opcionales.", campos.filter((c) => c.nivel === "componente")],
          ].map(([titulo, ayuda, lista]) => (
            <React.Fragment key={titulo}>
              <h3 className="font-semibold text-neutral-800 mt-5">{titulo}</h3>
              <p className="text-xs text-neutral-500 mb-1">{ayuda}</p>
              {lista.length === 0 ? (
                <p className="text-sm text-neutral-500 py-1.5">La empresa no tiene campos de este tipo.</p>
              ) : (
                <div className="divide-y">
                  {lista.map((c) => (
                    <FilaAsignacion
                      key={c.id}
                      label={c.nombre}
                      valor={asignacion[`campo:${c.id}`]}
                      encabezados={archivo.encabezados}
                      enUso={enUso}
                      ejemplo={ejemplo(asignacion[`campo:${c.id}`])}
                      aviso={c.nivel !== "componente" && variaEnSku(asignacion[`campo:${c.id}`]) ? "Cambia entre filas de un mismo SKU: un campo adicional guarda un solo valor por producto, así que esos SKU quedarían con error." : ""}
                      onCambiar={(col) => asignar(`campo:${c.id}`, col)}
                    />
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}

          <h3 className="font-semibold text-neutral-800 mt-5">Columnas del archivo sin asignar</h3>
          <p className="text-xs text-neutral-500 mb-1">
            Marca las que quieras guardar como un campo adicional nuevo (con el nombre de la columna) y elige si es del
            producto o del componente. Las demás no se cargan.
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
                    <span className="flex flex-wrap items-center gap-2">
                      <label className={`flex items-center gap-2 ${motivo ? "" : "cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          checked={crear.includes(col)}
                          disabled={!!motivo}
                          onChange={(e) => marcarCrear(col, e.target.checked)}
                          className="w-4 h-4 accent-primary-dark"
                        />
                        {motivo || "Crear como campo adicional"}
                      </label>
                      {crear.includes(col) && (
                        <select
                          value={niveles[col] || "producto"}
                          onChange={(e) => setNiveles((n) => ({ ...n, [col]: e.target.value }))}
                          className="bg-gray-100 p-1.5 text-sm rounded-lg"
                          aria-label={`Nivel del campo ${col}`}
                        >
                          <option value="producto">del producto</option>
                          <option value="componente">del componente</option>
                        </select>
                      )}
                    </span>
                    <span className="text-xs text-neutral-500 truncate" title={ejemplo(col)}>{ejemplo(col) ? `Ej.: ${ejemplo(col)}` : ""}</span>
                    {crear.includes(col) && niveles[col] !== "componente" && variaEnSku(col) && (
                      <span className="sm:col-start-2 sm:col-span-2 text-xs text-yellow-700 flex gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />Cambia entre filas de un mismo SKU: como campo del producto esos SKU quedarían con error. Usa "del componente".
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Ventana>
      )}

      {paso === "vista" && archivo && (
        <Ventana
          titulo="Vista previa de la carga"
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
            <b>{archivo.nombre}</b> · {archivo.filas.length} filas · {skus} SKU distintos
            {crear.length > 0 && <> · {crear.length} campo{crear.length > 1 ? "s" : ""} adicional{crear.length > 1 ? "es" : ""} nuevo{crear.length > 1 ? "s" : ""}</>}
          </p>
          <p className="text-xs text-neutral-500 mb-3">
            Así se leerán los datos con la asignación elegida. Aún no se guarda nada: el siguiente paso revisa el contenido
            (errores por fila, valores nuevos y SKU nuevos o modificados).
          </p>
          <div className="overflow-auto max-h-[45dvh] border rounded-xl mb-3">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-neutral-600 sticky top-0 z-10">
                <tr>
                  <th className="p-2 text-right" title="N.º de fila en el archivo">Fila</th>
                  {columnasVista.map((c) => (
                    <th key={c.id} className="p-2 whitespace-nowrap">
                      {c.label}
                      {c.nuevo && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-green-50 text-green-800 text-xs font-normal">{c.nuevo}</span>}
                      {c.label !== c.col && <span className="block text-xs font-normal text-neutral-500">{c.col}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {archivo.filas.slice(0, mostradas).map((f, i, lista) => {
                  // Línea más marcada al empezar un SKU distinto, para ver los productos agrupados.
                  const nuevoSku = i > 0 && asignacion.sku && f.valores[asignacion.sku] !== lista[i - 1].valores[asignacion.sku];
                  return (
                    <tr key={f.fila} className={`align-top ${nuevoSku ? "border-t-2 border-gray-300" : "border-t"}`}>
                      <td className="p-2 text-right text-neutral-500 tabular-nums">{f.fila}</td>
                      {columnasVista.map((c) => (
                        <td key={c.id} className="p-2 max-w-[16rem] truncate" title={f.valores[c.col]}>
                          {mostrarValor(f.valores[c.col]) || (c.obligatorio ? <span className="text-red-500 italic text-xs">vacío</span> : "")}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 mb-4 text-sm text-neutral-500">
            <span>Mostrando {Math.min(mostradas, archivo.filas.length)} de {archivo.filas.length} filas</span>
            {mostradas < archivo.filas.length && (
              <button
                onClick={() => setMostradas((m) => m + FILAS_POR_PAGINA)}
                className="btn-secundario btn-chico"
              >
                Traer {FILAS_POR_PAGINA} más
              </button>
            )}
          </div>
        </Ventana>
      )}

      {paso === "revision" && revision && (
        <Ventana
          titulo="Revisión del contenido"
          onCerrar={cerrar}
          pie={(
            <>
              <button onClick={() => setPaso("vista")} className="btn-secundario mr-auto">
                Volver a la vista previa
              </button>
              {errorGuardar && <p role="alert" className="basis-full text-sm text-red-600">No se pudo guardar: {errorGuardar}</p>}
              {pendientes > 0 && (
                <p className="text-sm text-yellow-700">Decide qué hacer con {pendientes} componente{pendientes === 1 ? "" : "s"} que no viene{pendientes === 1 ? "" : "n"} en el archivo.</p>
              )}
              <button onClick={cerrar} className="btn-secundario">Cancelar</button>
              <button
                onClick={() => (hayNuevosValores ? setPaso("nuevos") : guardar())}
                disabled={aGuardar.length === 0 || pendientes > 0 || guardando}
                className="btn-principal"
              >
                {guardando ? "Guardando…" : `Guardar ${aGuardar.length} producto${aGuardar.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        >
          <Revision
            archivo={archivo.nombre}
            revision={revision}
            productos={productosFinal}
            conQuitados={conQuitados}
            decisionDe={(r, q) => decisiones[claveDecision(r, q)]}
            onDecidir={(r, q, valor) => decidir({ [claveDecision(r, q)]: valor })}
            onDecidirTodos={decidirTodos}
          />
        </Ventana>
      )}

      {paso === "nuevos" && revision && (
        <Ventana
          titulo="Se encontraron valores nuevos"
          onCerrar={cerrar}
          pie={(
            <>
              <button onClick={() => setPaso("revision")} disabled={guardando} className="btn-secundario mr-auto">
                Volver a la revisión
              </button>
              <button onClick={guardar} disabled={guardando} className="btn-principal">
                {guardando ? "Guardando…" : "Agregar y guardar"}
              </button>
            </>
          )}
        >
          <ValoresNuevos nuevosValores={revision.nuevosValores} />
        </Ventana>
      )}
    </>
  );
};

export default CargaMasivaMatriz;
