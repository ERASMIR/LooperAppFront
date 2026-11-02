import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import { API_REPORTES, API_VENTAS } from "../config/api";
import { descargarArchivo, llamarApi, textoError } from "../config/apiCliente.js";
import { obtenerCatalogos } from "../config/cacheCatalogos.js";
import { MESES, nombrePeriodo } from "../Componentes/ventasRevision.js";
import { Loader2, Lock, AlertTriangle, CheckCircle2, X, Trash2, Calculator, FileCheck2, Info } from "lucide-react";
import EncabezadoPagina from "../Componentes/EncabezadoPagina";
import { inputCls, formatoFechaHora, plural, periodoAnterior, clavePeriodo, agruparPorPeriodo } from "../Componentes/reporte/utilidades.js";
import { Resultado, ListadoReportes, BotonPlanillaReSimple, VentanaReporte, Modal } from "../Componentes/reporte/piezasReporte.jsx";

// Crear Reporte (T8.6): calcula las toneladas declaradas de un periodo con la Matriz de Materiales y el Registro de Ventas
// de la BD (sin archivos ni Drive). Procesar = vista previa; confirmar = se guarda y bloquea las ventas del periodo; eliminar
// el reporte vigente (admin/dev) desbloquea. Plan: specs/003-reporte/plan-trabajo.md
// El cálculo, el guardado y el bloqueo los hace looper-reportes; aquí solo se muestran.
// Reporte vigente de ReSimple → descarga de la planilla oficial completa, generada por looper-reportes

// llamarApi: cliente común (config/apiCliente.js).


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
    obtenerCatalogos(token, empresaId)
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
    <div className="p-4 w-full">
      <EncabezadoPagina
        titulo="Crear Reporte"
        descripcion="Calcula las toneladas a declarar de un periodo con la Matriz de Materiales y el Registro de Ventas."
      />

      <div className="tarjeta p-6 min-h-[calc(100vh-14rem)]">
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
              <div role="status" className="mb-4 flex items-center gap-2 text-sm rounded-xl px-4 py-2 border text-green-800 bg-green-50 border-green-200">
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
