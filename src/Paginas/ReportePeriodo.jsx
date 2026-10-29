import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import Dialogo from "../Componentes/Dialogo.jsx";
import { AuthContext } from "../context/AuthContext.jsx";
import { API_MATERIALES, API_REPORTES, API_VENTAS } from "../config/api";
import { descargarArchivo, llamarApi, textoError } from "../config/apiCliente.js";
import { MESES, nombrePeriodo } from "../Componentes/ventasRevision.js";
import { Loader2, Lock, AlertTriangle, CheckCircle2, X, Trash2, Calculator, FileCheck2, FileSpreadsheet, Info, History } from "lucide-react";

// Crear Reporte (T8.6): calcula las toneladas declaradas de un periodo con la Matriz de Materiales y el Registro de Ventas
// de la BD (sin archivos ni Drive). Procesar = vista previa; confirmar = se guarda y bloquea las ventas del periodo; eliminar
// el reporte vigente (admin/dev) desbloquea. Plan: specs/003-reporte/plan-trabajo.md
// El cálculo, el guardado y el bloqueo los hace looper-reportes; aquí solo se muestran.
// Reporte vigente de ReSimple → descarga de la planilla oficial completa, generada por looper-reportes
// (specs/003-reporte/plantilla-resimple.md).
const esReSimple = (gransic) => /resimple/i.test(gransic?.nombre || "");

const inputCls = "campo";
const formatoTon = (n) => (n ? n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "—");
const formatoFechaHora = (f) => new Date(f).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const plural = (n, uno, varios) => `${n.toLocaleString("es-CL")} ${n === 1 ? uno : varios}`;

const periodoAnterior = () => {
  const hoy = new Date();
  return hoy.getMonth() === 0 ? { anio: hoy.getFullYear() - 1, mes: 12 } : { anio: hoy.getFullYear(), mes: hoy.getMonth() };
};

// llamarApi: cliente común (config/apiCliente.js).

// ── Resultado: resumen, líneas no encontradas y toneladas por material ────────
const Tarjeta = ({ n, texto, cls }) => (
  <div className={`rounded-xl px-4 py-3 ${cls}`}>
    <p className="text-2xl font-bold tabular-nums">{n.toLocaleString("es-CL")}</p>
    <p className="text-xs">{texto}</p>
  </div>
);

const Resultado = ({ calculo }) => {
  const [categoria, setCategoria] = useState("");
  const [soloConValor, setSoloConValor] = useState(true);
  const { gransic, materiales, resumen } = calculo;
  const peligrosidad = gransic.tienePeligrosidad;
  const categorias = [...new Set(materiales.map((m) => m.categoria))];
  const conValor = (m) => (m.toneladasPeligroso || 0) + (m.toneladasNoPeligroso || 0) + (m.toneladasTotal || 0) > 0;
  const filas = materiales.filter((m) => (!categoria || m.categoria === categoria) && (!soloConValor || conValor(m)));
  const suma = (k) => filas.reduce((n, m) => n + (m[k] || 0), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tarjeta n={resumen.lineas} texto="Líneas de venta del periodo" cls="bg-gray-100 text-neutral-700" />
        <Tarjeta n={resumen.procesadas} texto="Procesadas" cls="bg-green-50 text-green-800" />
        <Tarjeta n={resumen.noEncontradas.length} texto="No encontradas en la Matriz (no se contabilizan)" cls="bg-yellow-50 text-yellow-800" />
      </div>

      {resumen.noEncontradas.length > 0 && (
        <section className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="font-semibold text-yellow-800 flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4" /> Ventas no encontradas en la Matriz</h3>
          <ul className="text-sm text-yellow-900 space-y-1 max-h-48 overflow-auto">
            {resumen.noEncontradas.map((n) => <li key={n.ventaId}><b>{n.sku}</b> · {n.unidad} · {n.cantidad}</li>)}
          </ul>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h3 className="font-semibold text-neutral-800 mr-2">Toneladas por material · {gransic.nombre}</h3>
          {["", ...categorias].map((c) => (
            <button
              key={c || "todas"}
              onClick={() => setCategoria(c)}
              aria-pressed={categoria === c}
              className={`chip capitalize ${categoria === c ? "chip-activo" : ""}`}
            >
              {c || "Todas"}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
            <input type="checkbox" checked={soloConValor} onChange={(e) => setSoloConValor(e.target.checked)} className="accent-primary-dark" />
            Solo materiales con toneladas
          </label>
        </div>
        <div className="overflow-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-neutral-600">
              <tr>
                <th className="p-2">Categoría</th>
                <th className="p-2">Material</th>
                {peligrosidad ? (
                  <>
                    <th className="p-2 text-right">T. peligrosos</th>
                    <th className="p-2 text-right">T. no peligrosos</th>
                  </>
                ) : <th className="p-2 text-right">Toneladas</th>}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-neutral-500">No hay materiales con toneladas en esta categoría.</td></tr>
              )}
              {filas.map((m) => (
                <tr key={`${m.categoria}::${m.material}`} className="border-t">
                  <td className="p-2 capitalize">{m.categoria}</td>
                  <td className="p-2">{m.material}</td>
                  {peligrosidad ? (
                    <>
                      <td className="p-2 text-right tabular-nums">{formatoTon(m.toneladasPeligroso)}</td>
                      <td className="p-2 text-right tabular-nums">{formatoTon(m.toneladasNoPeligroso)}</td>
                    </>
                  ) : <td className="p-2 text-right tabular-nums">{formatoTon(m.toneladasTotal)}</td>}
                </tr>
              ))}
            </tbody>
            {filas.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold border-t">
                <tr>
                  <td className="p-2" colSpan={2}>Total{categoria ? ` ${categoria}` : ""}</td>
                  {peligrosidad ? (
                    <>
                      <td className="p-2 text-right tabular-nums">{formatoTon(suma("toneladasPeligroso"))}</td>
                      <td className="p-2 text-right tabular-nums">{formatoTon(suma("toneladasNoPeligroso"))}</td>
                    </>
                  ) : <td className="p-2 text-right tabular-nums">{formatoTon(suma("toneladasTotal"))}</td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
};

// ── Pestaña "Historial de reportes": una fila por periodo con su reporte vigente (o sin vigente, si se eliminó) ──
// El historial llega sin materiales: el total viene calculado por el back.
const toneladasTotales = (r) =>
  r.toneladasTotal ?? r.materiales.reduce((n, m) => n + (m.toneladasPeligroso || 0) + (m.toneladasNoPeligroso || 0) + (m.toneladasTotal || 0), 0);
const clavePeriodo = ({ anio, mes }) => `${anio}-${mes}`;

// Reportes agrupados por periodo (el más reciente primero): { anio, mes, vigente, versiones (la más reciente primero) }.
const agruparPorPeriodo = (reportes) => {
  const grupos = new Map();
  for (const r of reportes) {
    const g = grupos.get(clavePeriodo(r)) || { anio: r.anio, mes: r.mes, vigente: null, versiones: [] };
    g.versiones.push(r);
    if (!r.eliminado) g.vigente = r;
    grupos.set(clavePeriodo(r), g);
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, versiones: g.versiones.sort((a, b) => b.creadoFecha.localeCompare(a.creadoFecha)) }))
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes);
};

const ListadoReportes = ({ periodos, puedeEliminar, onAbrir, onEliminar }) => (
  periodos.length === 0 ? (
    <p className="text-sm text-neutral-500 border rounded-xl p-6 text-center">Aún no hay reportes de esta empresa. Créalos en la pestaña "Crear reporte".</p>
  ) : (
    <div className="overflow-auto border rounded-xl">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-neutral-600">
          <tr>
            <th className="p-3">Mes</th>
            <th className="p-3">Año</th>
            <th className="p-3">Usuario</th>
            <th className="p-3">Fecha de carga</th>
            <th className="p-3 text-right">Toneladas totales</th>
            <th className="p-3">Estado</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {periodos.map((p) => (
            <tr key={clavePeriodo(p)} onClick={() => onAbrir(p)} className={`border-t cursor-pointer hover:bg-gray-50 ${p.vigente ? "" : "text-neutral-500"}`}>
              <td className="p-3 font-semibold">{MESES[p.mes - 1]}</td>
              <td className="p-3">{p.anio}</td>
              <td className="p-3">{p.vigente?.creadoPor || "—"}</td>
              <td className="p-3 whitespace-nowrap">{p.vigente ? formatoFechaHora(p.vigente.creadoFecha) : "—"}</td>
              <td className="p-3 text-right tabular-nums">{p.vigente ? formatoTon(toneladasTotales(p.vigente)) : "—"}</td>
              <td className="p-3">
                {p.vigente
                  ? <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-800 text-xs">Vigente</span>
                  : <span className="px-2 py-0.5 rounded-full bg-gray-100 text-neutral-600 text-xs">Sin reporte vigente</span>}
              </td>
              <td className="p-3 text-right whitespace-nowrap">
                {/* UX-04: botón real para abrir con teclado; la fila sigue respondiendo al clic */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAbrir(p); }}
                  aria-label={`Ver el reporte de ${nombrePeriodo(p)}`}
                  className="px-2 py-1 rounded-md text-sm font-medium text-primary-dark hover:bg-primary-light"
                >
                  Ver
                </button>
                {puedeEliminar && p.vigente && (
                  <button
                    title="Eliminar reporte (desbloquea las ventas del periodo)"
                    onClick={(e) => { e.stopPropagation(); onEliminar(p.vigente); }}
                    className="p-1.5 rounded-full hover:bg-red-50 text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
);

// Ventana con el reporte de un periodo: datos y resultados del vigente (el declarado) y, abajo, las versiones anteriores
// del mismo periodo (sin resultados). detalle: el vigente con sus materiales (null mientras se carga).
// Botón de la planilla oficial de ReSimple (solo para reportes vigentes de ReSimple), con su descripción arriba.
const BotonPlanillaReSimple = ({ reporte, descargando, error, onDescargar }) => (
  esReSimple(reporte?.gransic) && !reporte.eliminado ? (
    <div className="basis-full flex flex-col items-start gap-1.5 border-t border-green-200 pt-3">
      <p className="text-sm text-neutral-700">Planilla oficial de ReSimple con este reporte, lista para cargarla en ReSimple y hacer la declaración.</p>
      <button
        onClick={() => onDescargar(reporte)}
        disabled={descargando}
        className="btn-principal"
      >
        {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Reporte ReSimple .xlsx
      </button>
      {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}</p>}
    </div>
  ) : null
);

const VentanaReporte = ({ grupo, detalle, puedeEliminar, onEliminar, onCerrar, descargando, errorDescarga, onDescargar }) => {
  const { vigente, versiones } = grupo;
  return (
    <Dialogo onCerrar={onCerrar} className="max-w-5xl max-h-[calc(100dvh-2rem)] flex flex-col">
        <div className="flex justify-between items-start gap-3 px-6 pt-5 pb-3 border-b">
          <div>
            <h2 className="text-lg font-bold text-neutral-800">Reporte de {nombrePeriodo(grupo)}</h2>
            {vigente ? (
              <p className="text-sm text-neutral-600">
                Vigente · creado el {formatoFechaHora(vigente.creadoFecha)} por {vigente.creadoPor} · {vigente.gransic.nombre} ·
                {" "}{plural(vigente.resumen.procesadas, "línea procesada", "líneas procesadas")} · {formatoTon(toneladasTotales(vigente))} t
              </p>
            ) : <p className="text-sm text-neutral-500">Sin reporte vigente: el último se eliminó y aún no se crea uno nuevo.</p>}
          </div>
          <div className="flex items-center gap-2">
            {puedeEliminar && vigente && (
              <button onClick={() => onEliminar(vigente)} className="btn-peligro-borde">
                <Trash2 className="w-4 h-4" /> Eliminar reporte
              </button>
            )}
            <button onClick={onCerrar} aria-label="Cerrar" className="p-1 rounded-full hover:bg-gray-100"><X className="w-5 h-5" aria-hidden="true" /></button>
          </div>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-8">
          <BotonPlanillaReSimple reporte={vigente} descargando={descargando} error={errorDescarga} onDescargar={onDescargar} />
          {vigente && (detalle
            ? <Resultado calculo={detalle} />
            : <p className="flex items-center gap-2 text-neutral-600"><Loader2 className="w-4 h-4 animate-spin" /> Cargando resultados…</p>)}
          <section>
            <h3 className="font-semibold text-neutral-800 flex items-center gap-2 mb-2">
              <History className="w-4 h-4" /> Historial del reporte de {nombrePeriodo(grupo)}: {plural(versiones.length, "vez generado", "veces generado")}
            </h3>
            <div className="overflow-auto border rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-neutral-600">
                  <tr>
                    <th className="p-2 text-right">Versión</th>
                    <th className="p-2">Creado</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2">Eliminado</th>
                  </tr>
                </thead>
                <tbody>
                  {versiones.map((r, i) => (
                    <tr key={r.id} className="border-t align-top">
                      <td className="p-2 text-right tabular-nums">{versiones.length - i}</td>
                      <td className="p-2 text-xs leading-5">{formatoFechaHora(r.creadoFecha)}<br />{r.creadoPor}</td>
                      <td className="p-2">
                        {r.eliminado
                          ? <span className="px-2 py-0.5 rounded-full bg-gray-100 text-neutral-600 text-xs">Eliminado</span>
                          : <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-800 text-xs">Vigente (declarado)</span>}
                      </td>
                      <td className="p-2 text-xs leading-5">
                        {r.eliminado ? <>{formatoFechaHora(r.eliminado.fecha)} · {r.eliminado.por}<br /><span className="italic">{r.eliminado.motivo}</span></> : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
    </Dialogo>
  );
};

const Modal = ({ titulo, children, pie, onCerrar }) => (
  <Dialogo onCerrar={onCerrar} capa="z-[60]" className="max-w-lg p-6">
    <h2 className="text-lg font-bold text-neutral-800 mb-3">{titulo}</h2>
    {children}
    <div className="flex justify-end gap-3 mt-6">{pie}</div>
  </Dialogo>
);

// ── Página ────────────────────────────────────────────────────────────────────
const ReportePeriodo = () => {
  const { user, token } = useContext(AuthContext);
  const empresaId = user?.empresaId;
  const puedeEliminar = user?.perfil === "admin" || user?.perfil === "dev";

  const [pestana, setPestana] = useState("crear");
  const [periodo, setPeriodo] = useState(periodoAnterior);
  const [gransic, setGransic] = useState(null);
  const [ventas, setVentas] = useState(null); // ventas vigentes del periodo (para el resumen)
  const [vigente, setVigente] = useState(undefined); // reporte vigente del periodo elegido (null = no hay; undefined = cargando)
  const [historial, setHistorial] = useState([]); // todos los reportes de la empresa (vigentes y eliminados), sin materiales
  const [abierto, setAbierto] = useState(null); // clave "anio-mes" del periodo abierto en la ventana del reporte
  const [detalle, setDetalle] = useState(null); // vigente del periodo abierto, con sus materiales
  const [calculo, setCalculo] = useState(null); // vista previa
  const [procesando, setProcesando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(null); // reporte vigente a eliminar
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState(""); // se muestra junto al botón (también dentro de la ventana)
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!token || !empresaId) return;
    llamarApi(token, API_MATERIALES, `catalogosMatriz?empresaId=${empresaId}`)
      .then((cat) => setGransic(cat.gransic))
      .catch((err) => setError(err.message));
  }, [token, empresaId]);

  const cargarHistorial = useCallback(() => {
    llamarApi(token, API_REPORTES, `reportes?empresaId=${empresaId}`)
      .then((d) => setHistorial(d.reportes))
      .catch((err) => setError(err.message));
  }, [token, empresaId]);
  useEffect(() => { if (token && empresaId) cargarHistorial(); }, [cargarHistorial, token, empresaId]);

  // Al cambiar de periodo: sus ventas y su reporte vigente. Una respuesta tardía no pisa la del periodo elegido.
  const cargarPeriodo = useCallback(() => {
    let actual = true;
    const filtro = `empresaId=${empresaId}&anio=${periodo.anio}&mes=${periodo.mes}`;
    setVentas(null);
    setVigente(undefined);
    setCalculo(null);
    setError("");
    setErrorDescarga("");
    Promise.all([llamarApi(token, API_VENTAS, `ventas?${filtro}`), llamarApi(token, API_REPORTES, `reportes?${filtro}`)])
      .then(([v, r]) => { if (actual) { setVentas(v.ventas); setVigente(r.reporte); } })
      .catch((err) => actual && setError(err.message));
    return () => { actual = false; };
  }, [token, empresaId, periodo]);
  useEffect(() => (token && empresaId ? cargarPeriodo() : undefined), [cargarPeriodo, token, empresaId]);

  const periodos = useMemo(() => agruparPorPeriodo(historial), [historial]);
  const grupoAbierto = periodos.find((p) => clavePeriodo(p) === abierto) || null;

  // Ventana del reporte: el historial no trae materiales, se piden al abrirla.
  useEffect(() => {
    setDetalle(null);
    const vigenteAbierto = grupoAbierto?.vigente;
    if (!vigenteAbierto) return undefined;
    let actual = true;
    llamarApi(token, API_REPORTES, `reportes?empresaId=${empresaId}&anio=${vigenteAbierto.anio}&mes=${vigenteAbierto.mes}`)
      .then((d) => actual && setDetalle(d.reporte))
      .catch((err) => actual && setError(err.message));
    return () => { actual = false; };
  }, [grupoAbierto?.vigente, token, empresaId]);

  const procesar = async () => {
    setProcesando(true);
    setError("");
    setAviso("");
    try {
      const d = await llamarApi(token, API_REPORTES, "reportes/calcular", { metodo: "POST", body: { empresaId, ...periodo } });
      if (d.vigente) {
        // Otro usuario lo confirmó mientras tanto: se muestra el vigente en vez de la vista previa.
        cargarPeriodo();
        cargarHistorial();
      } else {
        setCalculo(d);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const confirmar = async () => {
    setGuardando(true);
    setError("");
    try {
      const d = await llamarApi(token, API_REPORTES, "reportes", { metodo: "POST", body: { empresaId, ...periodo } });
      setVigente(d.reporte);
      setCalculo(null);
      setAviso(`Reporte de ${nombrePeriodo(periodo)} confirmado. Las ventas del periodo quedaron bloqueadas.`);
      cargarHistorial();
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirmando(false);
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    const r = eliminando;
    setGuardando(true);
    setError("");
    try {
      await llamarApi(token, API_REPORTES, `reportes?empresaId=${empresaId}&id=${r.id}&motivo=${encodeURIComponent(motivo.trim())}`, { metodo: "DELETE" });
      setEliminando(null);
      setMotivo("");
      setAviso(`Reporte de ${nombrePeriodo(r)} eliminado. Las ventas del periodo quedaron desbloqueadas y se puede crear un reporte nuevo.`);
      if (clavePeriodo(r) === clavePeriodo(periodo)) setVigente(null);
      cargarHistorial();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const descargarPlanilla = async (r) => {
    setDescargando(true);
    setErrorDescarga("");
    setAviso("");
    try {
      const nombre = await descargarArchivo(
        token,
        `${API_REPORTES}/reportes/plantillaResimple?empresaId=${empresaId}&id=${r.id}`,
        `ReSimple_LB_${r.anio}-${String(r.mes).padStart(2, "0")}.xlsx`,
      );
      setAviso(`Se descargó ${nombre}: la planilla oficial de ReSimple de ${nombrePeriodo(r)}, lista para cargarla en ReSimple.`);
    } catch (err) {
      setErrorDescarga(textoError(err, ", "));
    } finally {
      setDescargando(false);
    }
  };

  const anios = useMemo(() => {
    const lista = [];
    for (let a = new Date().getFullYear(); a >= 2023; a--) lista.push(a);
    return lista;
  }, []);

  let crear;
  if (!gransic || !ventas || vigente === undefined) {
    crear = error
      ? <p className="text-red-600">No se pudo cargar el periodo: {error}</p>
      : <p className="flex items-center gap-2 text-neutral-600"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>;
  } else if (vigente) {
    crear = (
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <FileCheck2 className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm text-green-900">
          <p><b>{nombrePeriodo(periodo)} ya tiene un reporte vigente</b> · creado el {formatoFechaHora(vigente.creadoFecha)} por {vigente.creadoPor}.</p>
          <p className="flex items-center gap-1 mt-1 text-green-800">
            <Lock className="w-3.5 h-3.5" /> Sus ventas están bloqueadas. Para crear otro reporte, primero hay que eliminar el vigente{puedeEliminar ? "" : " (lo hace un administrador)"}.
          </p>
        </div>
        <button onClick={() => setAbierto(clavePeriodo(periodo))} className="btn-secundario">Ver reporte</button>
        {puedeEliminar && (
          <button onClick={() => setEliminando(vigente)} className="btn-peligro-borde">
            <Trash2 className="w-4 h-4" /> Eliminar reporte
          </button>
        )}
        <BotonPlanillaReSimple reporte={vigente} descargando={descargando} error={errorDescarga} onDescargar={descargarPlanilla} />
      </div>
    );
  } else if (calculo) {
    crear = (
      <>
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Info className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">Vista previa del reporte de <b>{nombrePeriodo(periodo)}</b>: aún no se guarda. Revísala y confírmala.</span>
          <button onClick={() => setCalculo(null)} className="btn-secundario">Descartar</button>
          <button onClick={() => setConfirmando(true)} className="btn-principal">Confirmar reporte</button>
        </div>
        <Resultado calculo={calculo} />
      </>
    );
  } else {
    crear = (
      <div className="rounded-xl border border-gray-200 p-6 text-center">
        <p className="text-neutral-700">
          {nombrePeriodo(periodo)} tiene <b>{plural(ventas.length, "línea de venta", "líneas de venta")}</b>.
          {" "}El reporte se calcula con la Matriz de Materiales vigente y el sistema de gestión <b>{gransic.nombre}</b>.
        </p>
        {ventas.length === 0 && <p className="text-sm text-neutral-500 mt-2">Carga primero las ventas del periodo en el Registro de Ventas.</p>}
        <button
          onClick={procesar}
          disabled={!ventas.length || procesando}
          className="btn-principal mt-4"
        >
          {procesando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />} {procesando ? "Procesando…" : "Procesar"}
        </button>
      </div>
    );
  }

  return (
    <div className="p-10 w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-800">Crear Reporte</h1>
        <p className="text-neutral-600">Calcula las toneladas a declarar de un periodo con la Matriz de Materiales y el Registro de Ventas.</p>
      </header>

      <div className="bg-white p-6 rounded-lg shadow-sm min-h-[calc(100vh-14rem)]">
        {!empresaId ? (
          <p className="text-neutral-600">Selecciona una empresa para crear su reporte.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2 mb-6 border-b border-neutral-200">
              {[["crear", "Crear reporte"], ["historial", "Historial de reportes"]].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPestana(id)}
                  aria-current={pestana === id ? "page" : undefined}
                  className={`pestana ${pestana === id ? "pestana-activa" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {error && gransic && ventas && (
              <div className="mb-4 flex items-center gap-2 text-sm rounded-xl px-4 py-2 border text-red-700 bg-red-50 border-red-200">
                <AlertTriangle className="w-4 h-4" /><span className="flex-1">{error}</span>
                <button onClick={() => setError("")} className="p-0.5 rounded-full hover:bg-black/5"><X className="w-4 h-4" /></button>
              </div>
            )}

            {aviso && (
              <div className="mb-4 flex items-center gap-2 text-sm rounded-xl px-4 py-2 border text-green-800 bg-green-50 border-green-200">
                <CheckCircle2 className="w-4 h-4" /><span className="flex-1">{aviso}</span>
                <button onClick={() => setAviso("")} className="p-0.5 rounded-full hover:bg-black/5"><X className="w-4 h-4" /></button>
              </div>
            )}

            {pestana === "crear" ? (
              <>
                <div className="mb-5">
                  <label className="block font-semibold text-sm mb-1" htmlFor="reporte-mes">Periodo</label>
                  <div className="flex gap-2">
                    <select id="reporte-mes" value={periodo.mes} onChange={(e) => setPeriodo((p) => ({ ...p, mes: Number(e.target.value) }))} className={inputCls}>
                      {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                    <select aria-label="Año" value={periodo.anio} onChange={(e) => setPeriodo((p) => ({ ...p, anio: Number(e.target.value) }))} className={inputCls}>
                      {anios.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>
                {crear}
              </>
            ) : (
              <ListadoReportes
                periodos={periodos}
                puedeEliminar={puedeEliminar}
                onAbrir={(p) => setAbierto(clavePeriodo(p))}
                onEliminar={setEliminando}
              />
            )}
          </>
        )}
      </div>

      {grupoAbierto && (
        <VentanaReporte grupo={grupoAbierto} detalle={detalle} descargando={descargando} errorDescarga={errorDescarga} onDescargar={descargarPlanilla} puedeEliminar={puedeEliminar} onEliminar={setEliminando} onCerrar={() => setAbierto(null)} />
      )}

      {confirmando && (
        <Modal
          titulo={`Confirmar reporte de ${nombrePeriodo(periodo)}`}
          onCerrar={guardando ? undefined : () => setConfirmando(false)}
          pie={(
            <>
              <button onClick={() => setConfirmando(false)} disabled={guardando} className="btn-secundario">Cancelar</button>
              <button onClick={confirmar} disabled={guardando} className="btn-principal">
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar
              </button>
            </>
          )}
        >
          <p className="text-sm text-neutral-700">
            Se guardará el reporte con {plural(calculo.resumen.procesadas, "línea procesada", "líneas procesadas")} y las
            <b> ventas de {nombrePeriodo(periodo)} quedarán bloqueadas</b>: no se podrán cargar, editar ni eliminar mientras el
            reporte esté vigente.
          </p>
        </Modal>
      )}

      {eliminando && (
        <Modal
          titulo={`Eliminar reporte de ${nombrePeriodo(eliminando)}`}
          onCerrar={guardando ? undefined : () => { setEliminando(null); setMotivo(""); }}
          pie={(
            <>
              <button onClick={() => { setEliminando(null); setMotivo(""); }} disabled={guardando} className="btn-secundario">Cancelar</button>
              <button onClick={eliminar} disabled={!motivo.trim() || guardando} className="btn-peligro">
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar
              </button>
            </>
          )}
        >
          <p className="text-sm text-neutral-700 mb-3">
            El reporte deja de estar vigente (queda en el historial del periodo y en la auditoría) y las <b>ventas de
            {" "}{nombrePeriodo(eliminando)} se desbloquean</b> para poder corregirlas. Luego se puede crear un reporte nuevo.
          </p>
          <label className="block text-sm font-semibold text-neutral-700 mb-1" htmlFor="motivo-eliminar">Motivo <span className="text-red-600">*</span></label>
          <textarea id="motivo-eliminar" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={255} rows={3} className={`${inputCls} w-full`} placeholder="Ej.: corrección de ventas de una factura" />
        </Modal>
      )}
    </div>
  );
};

export default ReportePeriodo;
