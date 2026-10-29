import React, { useRef, useState } from "react";
import { Upload, AlertTriangle, CheckCircle2, Loader2, FileSpreadsheet, Download, ChevronDown, ChevronRight } from "lucide-react";
import { normalizar, revisarCarga, aplicarDecisiones, resumir } from "./cargaMasivaRevision.js";
import {
  EXTENSIONES, FILAS_POR_PAGINA, mostrarValor, huellaDe, leerConfig, guardarConfig, leerArchivo, descargarErrores,
} from "./cargaMasivaLectura.js";
import { Ventana, FilaAsignacion, Paginado } from "./cargaMasivaComun.jsx";
import { Indicador, Indicadores } from "./Indicador.jsx";

// Carga masiva de la Matriz de Materiales: leer el archivo, asignar columnas, vista previa (parte A),
// revisar el contenido, autorizar valores nuevos y guardar (parte B; lógica en cargaMasivaRevision.js).
// Plan: specs/001-matriz-materiales/carga-masiva.md

const MAX_NOMBRE_CAMPO = 100;
// Columnas que la app calcula (o deduce del material): no se cargan ni se crean como campo adicional.
const CALCULADAS = ["peso por unidad de venta kg", "peso por unidad de venta", "ton", "toneladas", "sub categoria", "subcategoria"];

// Campos base según el GRANSIC (ReSimple: categoría y peligrosidad por producto; PROREP: categoría por componente).
// alias: nombres de columna que se reconocen al sugerir la asignación.
const camposBase = (tienePeligrosidad) => [
  { key: "sku", label: "SKU", alias: ["sku", "codigo", "codigo producto"] },
  { key: "descripcion", label: "Descripción", alias: ["descripcion", "descripcion del producto", "producto"] },
  { key: "unidad", label: "Unidad de venta", alias: ["unidad de venta", "unidad", "unidades de venta"] },
  { key: "componente", label: "Componente", alias: ["componente", "componentes"] },
  { key: "cantidad", label: "Cantidad", alias: ["cantidad", "cantidades"] },
  { key: "pesoKg", label: "Peso (kg)", alias: ["peso kg", "peso", "peso unitario kg"] },
  { key: "categoria", label: tienePeligrosidad ? "Categoría (del producto)" : "Categoría (del componente)", alias: ["categoria", "categorias"] },
  { key: "material", label: "Material", alias: ["material", "materiales"] },
  { key: "caracteristica", label: "Característica", alias: ["caracteristica", "caracteristicas"], opcional: !tienePeligrosidad },
  ...(tienePeligrosidad ? [{ key: "peligrosidad", label: "Peligrosidad", alias: ["peligrosidad"] }] : []),
];

// Asignación inicial: la guardada para este formato o, si no hay, una sugerida comparando nombres.
const asignacionInicial = (encabezados, base, campos, clave) => {
  const guardada = leerConfig(clave).formatos[huellaDe(encabezados)];
  const claves = [...base.map((b) => b.key), ...campos.map((c) => `campo:${c.id}`)];
  if (guardada) {
    const asignacion = Object.fromEntries(
      Object.entries(guardada.asignacion).filter(([k, col]) => claves.includes(k) && encabezados.includes(col)),
    );
    // Una columna marcada para crear cuyo campo ya existe (se creó en otra carga) se asigna a ese campo.
    const crear = [];
    for (const col of guardada.crear || []) {
      if (!encabezados.includes(col) || Object.values(asignacion).includes(col)) continue;
      const existente = campos.find((c) => normalizar(c.nombre) === normalizar(col));
      if (existente) asignacion[`campo:${existente.id}`] ??= col;
      else crear.push(col);
    }
    const niveles = Object.fromEntries(crear.map((col) => [col, guardada.niveles?.[col] || "producto"]));
    return { asignacion, crear, niveles, recordada: true };
  }

  const asignacion = {};
  const libre = (col) => !Object.values(asignacion).includes(col);
  for (const b of base) {
    const col = encabezados.find((e) => libre(e) && b.alias.includes(normalizar(e)));
    if (col) asignacion[b.key] = col;
  }
  for (const c of campos) {
    const col = encabezados.find((e) => libre(e) && normalizar(e) === normalizar(c.nombre));
    if (col) asignacion[`campo:${c.id}`] = col;
  }
  return { asignacion, crear: [], niveles: {}, recordada: false };
};

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
                      {c.label !== c.col && <span className="block text-xs font-normal text-neutral-400">{c.col}</span>}
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
                      <td className="p-2 text-right text-neutral-400 tabular-nums">{f.fila}</td>
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
              {errorGuardar && <p className="basis-full text-sm text-red-600">No se pudo guardar: {errorGuardar}</p>}
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

// ── Revisión: resumen, errores y cambios ─────────────────────────────────────
const ESTADOS = {
  nuevo: { label: "Nuevos", cls: "bg-green-50 text-green-800", tono: "correcto" },
  modificado: { label: "Modificados", cls: "bg-blue-50 text-blue-800", tono: "cambio" },
  sinCambios: { label: "Sin cambios", cls: "bg-gray-100 text-neutral-600", tono: "neutro" },
  error: { label: "Con errores (no se cargan)", cls: "bg-red-50 text-red-700", tono: "error" },
};
const ETIQUETA_ESTADO = { nuevo: "Nuevo", modificado: "Modificado" };


// productos: revisados con las decisiones aplicadas. conQuitados: los que tienen componentes que no vienen en el archivo.
const Revision = ({ archivo, revision, productos, conQuitados, decisionDe, onDecidir, onDecidirTodos }) => {
  const [verErrores, setVerErrores] = useState(FILAS_POR_PAGINA);
  const [verCambios, setVerCambios] = useState(FILAS_POR_PAGINA);
  const [abierto, setAbierto] = useState(null);
  const { errores, nuevosValores } = revision;
  const resumen = resumir(productos);
  const cambios = productos.filter((r) => r.estado === "nuevo" || r.estado === "modificado");
  const totalNuevosValores = Object.values(nuevosValores).reduce((n, l) => n + l.length, 0);

  return (
    <div className="pb-4 space-y-5">
      <div>
        <p className="text-sm text-neutral-700 mb-2"><b>{archivo}</b> · {productos.length} SKU revisados</p>
        <Indicadores>
          {[["nuevo", resumen.nuevos], ["modificado", resumen.modificados], ["sinCambios", resumen.sinCambios], ["error", resumen.conError]].map(([estado, n]) => (
            <Indicador key={estado} etiqueta={ESTADOS[estado].label} valor={n} tono={ESTADOS[estado].tono} />
          ))}
        </Indicadores>
        <p className="text-xs text-neutral-500 mt-2">
          Se guardan los nuevos y los modificados. Los sin cambios no se tocan, y los productos de la matriz que no vienen en
          el archivo quedan como están.
        </p>
      </div>

      {errores.length > 0 && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 className="font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Errores: {errores.length} fila{errores.length === 1 ? "" : "s"}
            </h3>
            <button onClick={() => descargarErrores(archivo, errores, [["Fila", "fila", 6], ["SKU", "sku", 20], ["Error", "mensaje", 90]])} className="flex items-center gap-1 text-sm text-primary-dark hover:text-green-800">
              <Download className="w-4 h-4" /> Descargar errores (Excel)
            </button>
          </div>
          <p className="text-xs text-neutral-500 mb-2">
            Los SKU con algún error <b>no se cargan</b> (ninguna de sus filas). Corrígelos en el archivo y vuelve a subirlo.
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

      {conQuitados.length > 0 && (
        <ComponentesQuitados conQuitados={conQuitados} decisionDe={decisionDe} onDecidir={onDecidir} onDecidirTodos={onDecidirTodos} />
      )}

      {totalNuevosValores > 0 && (
        <section className="flex gap-3 text-sm rounded-xl px-4 py-3 border text-yellow-800 bg-yellow-50 border-yellow-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            El archivo trae <b>{totalNuevosValores} valor{totalNuevosValores === 1 ? "" : "es"} nuevo{totalNuevosValores === 1 ? "" : "s"}</b> que
            no existen en tus catálogos. Antes de guardar te pediremos autorizar que se agreguen.
          </p>
        </section>
      )}

      <section>
        <h3 className="font-semibold text-neutral-800 mb-1">Productos a guardar: {cambios.length}</h3>
        {cambios.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay productos nuevos ni modificados para guardar.</p>
        ) : (
          <>
            <ul className="border rounded-xl divide-y">
              {cambios.slice(0, verCambios).map((r) => (
                <li key={r.sku} className="text-sm">
                  <button
                    onClick={() => setAbierto(abierto === r.sku ? null : r.sku)}
                    className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-50"
                  >
                    {abierto === r.sku ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                    <span className={`px-2 py-0.5 rounded-full text-xs ${ESTADOS[r.estado].cls}`}>{ETIQUETA_ESTADO[r.estado]}</span>
                    <span className="font-semibold whitespace-nowrap">{r.sku}</span>
                    <span className="text-neutral-600 truncate">{r.descripcion}</span>
                    {r.estado === "modificado" && (
                      <span className="ml-auto text-xs text-neutral-500 whitespace-nowrap">{r.cambios.length} cambio{r.cambios.length === 1 ? "" : "s"}</span>
                    )}
                  </button>
                  {abierto === r.sku && (
                    <div className="px-9 pb-3 text-neutral-700">
                      {r.estado === "modificado" ? (
                        <ul className="list-disc ml-4 space-y-0.5">{r.cambios.map((c) => <li key={c}>{c}</li>)}</ul>
                      ) : (
                        <ul className="space-y-0.5">
                          {r.producto.unidades.map((u) => (
                            <li key={u.unidad}>
                              <b>{u.unidad}:</b>{" "}
                              {u.filas.map((f) => `${f.componente} (${f.cantidad.toLocaleString("es-CL")} × ${f.pesoKg.toLocaleString("es-CL", { maximumFractionDigits: 6 })} kg)`).join(", ")}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <Paginado total={cambios.length} mostradas={verCambios} onMas={() => setVerCambios((n) => n + FILAS_POR_PAGINA)} texto="productos" />
          </>
        )}
      </section>
    </div>
  );
};

// ── Componentes de la matriz que no vienen en el archivo ─────────────────────
const BotonDecision = ({ activo, onClick, children, peligro }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 rounded-lg text-xs border ${activo
      ? (peligro ? "bg-red-600 border-red-600 text-white" : "bg-primary-dark border-primary text-white")
      : "bg-white border-gray-300 text-neutral-700 hover:bg-gray-50"}`}
  >
    {children}
  </button>
);

const ComponentesQuitados = ({ conQuitados, decisionDe, onDecidir, onDecidirTodos }) => {
  const total = conQuitados.reduce((n, r) => n + r.quitados.length, 0);
  return (
    <section className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Componentes que no vienen en el archivo: {total} en {conQuitados.length} producto{conQuitados.length === 1 ? "" : "s"}
        </h3>
        <div className="flex gap-2">
          <BotonDecision onClick={() => onDecidirTodos("conservar")}>Conservar todos</BotonDecision>
          <BotonDecision onClick={() => onDecidirTodos("eliminar")}>Eliminar todos</BotonDecision>
        </div>
      </div>
      <p className="text-xs text-yellow-800 mb-3">
        Estos componentes están hoy en la matriz, pero el archivo trae el producto sin ellos. Indica para cada uno si se
        <b> conserva</b> (sigue en el producto) o se <b>elimina</b> de la matriz.
      </p>
      <div className="space-y-3 max-h-[35dvh] overflow-y-auto">
        {conQuitados.map((r) => (
          <div key={r.sku} className="bg-white rounded-lg border border-yellow-100 p-2">
            <p className="text-sm mb-1"><b>{r.sku}</b> <span className="text-neutral-600">{r.descripcion}</span></p>
            <ul className="divide-y">
              {r.quitados.map((q) => {
                const d = decisionDe(r, q);
                return (
                  <li key={q.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                    <span className="flex-1 min-w-[12rem]">
                      {q.unidad} · <b>{q.componente}</b>
                      <span className="text-neutral-500"> ({q.fila.cantidad.toLocaleString("es-CL")} × {q.fila.pesoKg.toLocaleString("es-CL", { maximumFractionDigits: 6 })} kg, {q.fila.material})</span>
                      {q.unidadCompleta && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs">falta toda la unidad</span>}
                    </span>
                    <BotonDecision activo={d === "conservar"} onClick={() => onDecidir(r, q, "conservar")}>Conservar</BotonDecision>
                    <BotonDecision activo={d === "eliminar"} peligro onClick={() => onDecidir(r, q, "eliminar")}>Eliminar</BotonDecision>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};

// ── Autorización de valores nuevos, agrupados por campo ─────────────────────
const ValoresNuevos = ({ nuevosValores }) => {
  const grupos = [
    ["Unidad de venta", nuevosValores.unidades],
    ["Componente", nuevosValores.componentes],
  ].filter(([, lista]) => lista.length);
  return (
    <div className="pb-4 space-y-4">
      <p className="text-sm text-neutral-700">
        Estos valores no existen en los catálogos de tu empresa. Si confirmas, se agregan y quedan disponibles también en el
        formulario. Revisa que no sean errores de escritura de un valor existente (por ejemplo, "Tambr" en vez de "Tambor").
      </p>
      {grupos.map(([campo, lista]) => (
        <section key={campo}>
          <h3 className="font-semibold text-neutral-800 mb-1">{campo} <span className="font-normal text-neutral-500">({lista.length})</span></h3>
          <div className="overflow-auto max-h-[30dvh] border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-neutral-600 sticky top-0">
                <tr><th className="p-2">Valor nuevo</th><th className="p-2 text-right">Filas</th><th className="p-2">SKU (ejemplos)</th></tr>
              </thead>
              <tbody>
                {lista.map((n) => (
                  <tr key={n.nombre} className="border-t">
                    <td className="p-2 font-semibold">{n.nombre}</td>
                    <td className="p-2 text-right tabular-nums">{n.filas}</td>
                    <td className="p-2 text-neutral-600">{n.skus.slice(0, 3).join(", ")}{n.skus.length > 3 ? ` y ${n.skus.length - 3} más` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {nuevosValores.campos.length > 0 && (
        <section>
          <h3 className="font-semibold text-neutral-800 mb-1">Campos adicionales <span className="font-normal text-neutral-500">({nuevosValores.campos.length})</span></h3>
          <ul className="text-sm text-neutral-700 list-disc ml-5">
            {nuevosValores.campos.map((c) => <li key={c.nombre}>{c.nombre} <span className="text-neutral-500">({c.nivel === "componente" ? "del componente" : "del producto"})</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
};


export default CargaMasivaMatriz;