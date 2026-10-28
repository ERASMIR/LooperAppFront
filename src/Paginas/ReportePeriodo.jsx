import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import { API_MATERIALES, API_VENTAS } from "../config/api";
import { MESES, nombrePeriodo } from "../Componentes/ventasRevision.js";
import { Loader2, Lock, AlertTriangle, CheckCircle2, X, Trash2, Calculator, FileCheck2, Info, History } from "lucide-react";

// Crear Reporte (T8.6): calcula las toneladas declaradas de un periodo con la Matriz de Materiales y el Registro de Ventas
// de la BD (sin archivos ni Drive). Procesar = vista previa; confirmar = se guarda y bloquea las ventas del periodo; eliminar
// el reporte vigente (admin/dev) desbloquea. Plan: specs/003-reporte/plan-trabajo.md

// ── Fase 1: datos simulados ───────────────────────────────────────────────────
// Las ventas del periodo y el catálogo GRANSIC son reales (API de ventas y materiales); las toneladas son ficticias y el
// reporte confirmado vive en memoria (no se guarda ni bloquea nada). En la fase 4 se usa looper-reportes.
const SIMULADO = true;

// Toneladas ficticias pero estables: uno de cada tres materiales del catálogo, proporcional a las líneas del periodo.
const simularCalculo = (gransic, ventas) => {
  const materiales = [];
  let i = 0;
  for (const [categoria, lista] of Object.entries(gransic.categorias)) {
    for (const material of lista) {
      const base = i % 3 === 0 ? Math.round(ventas.length * 0.0137 * (i + 1) * 1e8) / 1e8 : 0;
      materiales.push(gransic.tiene_peligrosidad
        ? { categoria, material, toneladasPeligroso: i % 6 === 0 ? Math.round(base * 0.2 * 1e8) / 1e8 : 0, toneladasNoPeligroso: base, toneladasTotal: null }
        : { categoria, material, toneladasPeligroso: null, toneladasNoPeligroso: null, toneladasTotal: base });
      i += 1;
    }
  }
  return {
    gransic: { nombre: gransic.nombre, tienePeligrosidad: gransic.tiene_peligrosidad },
    materiales,
    resumen: { lineas: ventas.length, procesadas: ventas.length, noEncontradas: [] },
  };
};

const inputCls = "bg-gray-100 p-2.5 text-sm rounded-lg";
const formatoTon = (n) => (n ? n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "—");
const formatoFechaHora = (f) => new Date(f).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const plural = (n, uno, varios) => `${n.toLocaleString("es-CL")} ${n === 1 ? uno : varios}`;

const periodoAnterior = () => {
  const hoy = new Date();
  return hoy.getMonth() === 0 ? { anio: hoy.getFullYear() - 1, mes: 12 } : { anio: hoy.getFullYear(), mes: hoy.getMonth() };
};

const llamarApi = async (token, base, ruta, { metodo = "GET", body } = {}) => {
  const res = await fetch(`${base}/${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Error ${res.status} al comunicarse con el servidor`);
    err.errores = data?.errores || [];
    throw err;
  }
  return data;
};

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
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border capitalize ${categoria === c ? "bg-primary text-white border-primary" : "bg-white text-gray-700 border-gray-300 hover:bg-neutral-100"}`}
            >
              {c || "Todas"}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
            <input type="checkbox" checked={soloConValor} onChange={(e) => setSoloConValor(e.target.checked)} className="accent-primary" />
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
const toneladasTotales = (r) =>
  r.materiales.reduce((n, m) => n + (m.toneladasPeligroso || 0) + (m.toneladasNoPeligroso || 0) + (m.toneladasTotal || 0), 0);
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
              <td className="p-3 text-right">
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
// del mismo periodo (sin resultados).
const VentanaReporte = ({ grupo, puedeEliminar, onEliminar, onCerrar }) => {
  const { vigente, versiones } = grupo;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[calc(100dvh-2rem)] flex flex-col">
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
              <button onClick={() => onEliminar(vigente)} className="flex items-center gap-2 bg-white text-red-600 border border-red-300 px-4 py-2 rounded-lg hover:bg-red-50 text-sm">
                <Trash2 className="w-4 h-4" /> Eliminar reporte
              </button>
            )}
            <button onClick={onCerrar} className="p-1 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-8">
          {vigente && <Resultado calculo={vigente} />}
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
      </div>
    </div>
  );
};

const Modal = ({ titulo, children, pie }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
      <h2 className="text-lg font-bold text-neutral-800 mb-3">{titulo}</h2>
      {children}
      <div className="flex justify-end gap-3 mt-6">{pie}</div>
    </div>
  </div>
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
  const [historial, setHistorial] = useState([]); // simulación: todos los reportes de la empresa (vigentes y eliminados)
  const [abierto, setAbierto] = useState(null); // clave "anio-mes" del periodo abierto en la ventana del reporte
  const [calculo, setCalculo] = useState(null); // vista previa
  const [procesando, setProcesando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(null); // reporte vigente a eliminar
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!token || !empresaId) return;
    llamarApi(token, API_MATERIALES, `catalogosMatriz?empresaId=${empresaId}`)
      .then((cat) => setGransic(cat.gransic))
      .catch((err) => setError(err.message));
  }, [token, empresaId]);

  // Al cambiar de periodo: ventas del periodo. Una respuesta tardía no pisa la del periodo elegido.
  const cargarPeriodo = useCallback(() => {
    let vigente = true;
    setVentas(null);
    setCalculo(null);
    setError("");
    llamarApi(token, API_VENTAS, `ventas?empresaId=${empresaId}&anio=${periodo.anio}&mes=${periodo.mes}`)
      .then((d) => vigente && setVentas(d.ventas))
      .catch((err) => vigente && setError(err.message));
    return () => { vigente = false; };
  }, [token, empresaId, periodo]);
  useEffect(() => (token && empresaId ? cargarPeriodo() : undefined), [cargarPeriodo, token, empresaId]);

  const periodos = useMemo(() => agruparPorPeriodo(historial), [historial]);
  const grupoAbierto = periodos.find((p) => clavePeriodo(p) === abierto) || null;
  const vigente = periodos.find((p) => clavePeriodo(p) === clavePeriodo(periodo))?.vigente || null;

  const procesar = async () => {
    setProcesando(true);
    setError("");
    setAviso("");
    await new Promise((r) => setTimeout(r, 600)); // simulación: el cálculo real lo hará looper-reportes
    setCalculo(simularCalculo(gransic, ventas));
    setProcesando(false);
  };

  const confirmar = () => {
    const reporte = {
      ...calculo, id: `sim-${Date.now()}`, ...periodo, creadoPor: user?.name, creadoFecha: new Date().toISOString(), eliminado: null,
    };
    setHistorial((h) => [reporte, ...h]);
    setCalculo(null);
    setConfirmando(false);
    setAviso(`Reporte de ${nombrePeriodo(periodo)} confirmado. Las ventas del periodo quedaron bloqueadas (simulado: no se guardó en la BD).`);
  };

  const eliminar = () => {
    const r = eliminando;
    const eliminado = { fecha: new Date().toISOString(), por: user?.name, motivo: motivo.trim() };
    setHistorial((h) => h.map((x) => (x.id === r.id ? { ...x, eliminado } : x)));
    setEliminando(null);
    setMotivo("");
    setAviso(`Reporte de ${nombrePeriodo(r)} eliminado. Las ventas del periodo quedaron desbloqueadas y se puede crear un reporte nuevo (simulado).`);
  };

  const anios = useMemo(() => {
    const lista = [];
    for (let a = new Date().getFullYear(); a >= 2023; a--) lista.push(a);
    return lista;
  }, []);

  let crear;
  if (!gransic || !ventas) {
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
        <button onClick={() => setAbierto(clavePeriodo(periodo))} className="bg-white text-primary border border-primary px-4 py-2 rounded-lg hover:bg-green-50 text-sm">Ver reporte</button>
        {puedeEliminar && (
          <button onClick={() => setEliminando(vigente)} className="flex items-center gap-2 bg-white text-red-600 border border-red-300 px-4 py-2 rounded-lg hover:bg-red-50 text-sm">
            <Trash2 className="w-4 h-4" /> Eliminar reporte
          </button>
        )}
      </div>
    );
  } else if (calculo) {
    crear = (
      <>
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Info className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">Vista previa del reporte de <b>{nombrePeriodo(periodo)}</b>: aún no se guarda. Revísala y confírmala.</span>
          <button onClick={() => setCalculo(null)} className="bg-white text-primary border border-primary px-4 py-2 rounded-lg hover:bg-green-50">Descartar</button>
          <button onClick={() => setConfirmando(true)} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-green-700">Confirmar reporte</button>
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
          className="mt-4 inline-flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
            <div className="flex flex-wrap items-center gap-4 mb-6">
              {[["crear", "Crear reporte"], ["historial", "Historial de reportes"]].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPestana(id)}
                  className={`px-4 py-2 text-sm rounded-xl transition ${pestana === id ? "bg-primary text-white" : "bg-gray-200 hover:bg-gray-300"}`}
                >
                  {label}
                </button>
              ))}
              {SIMULADO && <span className="ml-auto text-xs text-neutral-500">Fase 1: toneladas simuladas; los reportes no se guardan en la BD.</span>}
            </div>

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
        <VentanaReporte grupo={grupoAbierto} puedeEliminar={puedeEliminar} onEliminar={setEliminando} onCerrar={() => setAbierto(null)} />
      )}

      {confirmando && (
        <Modal
          titulo={`Confirmar reporte de ${nombrePeriodo(periodo)}`}
          pie={(
            <>
              <button onClick={() => setConfirmando(false)} className="bg-white text-primary border border-primary px-5 py-2 rounded-lg hover:bg-green-50">Cancelar</button>
              <button onClick={confirmar} className="bg-primary text-white px-5 py-2 rounded-lg hover:bg-green-700">Confirmar</button>
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
          pie={(
            <>
              <button onClick={() => { setEliminando(null); setMotivo(""); }} className="bg-white text-primary border border-primary px-5 py-2 rounded-lg hover:bg-green-50">Cancelar</button>
              <button onClick={eliminar} disabled={!motivo.trim()} className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed">Eliminar</button>
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
