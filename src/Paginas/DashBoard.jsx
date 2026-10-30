import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import { FaChartBar, FaTable } from "react-icons/fa6";
import { AlertTriangle, Loader2, Maximize2, Minimize2 } from "lucide-react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { AuthContext } from "../context/AuthContext";
import { API_REPORTES } from "../config/api";
import { llamarApi } from "../config/apiCliente.js";
import { Indicador, Indicadores } from "../Componentes/Indicador.jsx";
import { MESES } from "../Componentes/ventasRevision.js";

import EncabezadoPagina from "../Componentes/EncabezadoPagina";
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Dashboard: suma de los reportes VIGENTES (Crear Reporte, BD) de un rango de periodos, por material. Hay a lo más un
// reporte vigente por periodo, así que no hay duplicados; si faltan reportes en el rango se avisa que el total no es el
// real. API: GET reportes/resumen de looper-reportes. Plan: specs/003-reporte/dashboard.md

const formatoTon = (n) => (n ? n.toLocaleString("es-CL", { minimumFractionDigits: 3, maximumFractionDigits: 6 }) : "—");
const nombreCorto = ({ anio, mes }) => `${MESES[mes - 1].slice(0, 3)} ${anio}`;
const clave = ({ anio, mes }) => anio * 100 + mes;

// Por defecto: desde enero hasta el mes anterior (el último periodo que se puede declarar).
const rangoPorDefecto = () => {
  const hoy = new Date();
  const hasta = hoy.getMonth() === 0 ? { anio: hoy.getFullYear() - 1, mes: 12 } : { anio: hoy.getFullYear(), mes: hoy.getMonth() };
  return { desde: { anio: hasta.anio, mes: 1 }, hasta };
};

// ── Componentes ───────────────────────────────────────────────────────────────
const Panel = ({ isOpen, toggle, children, collapsedIcon, style }) => (
  <div style={style} className="relative flex flex-col transition-[flex,width] duration-300 ease-in-out motion-reduce:transition-none tarjeta">
    <button
      onClick={toggle}
      className="btn-icono absolute top-2 right-2 z-10"
      title={isOpen ? "Contraer panel" : "Expandir panel"}
      aria-label={isOpen ? "Contraer panel" : "Expandir panel"}
      aria-expanded={isOpen}
    >
      {isOpen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
    </button>
    {isOpen ? children : (
      <div className="flex items-center justify-center h-full text-neutral-500">{collapsedIcon}</div>
    )}
  </div>
);

const SumatoriaPanel = ({ filas, tienePeligrosidad, categorias, filtroCategoria, setFiltroCategoria }) => {
  const suma = (k) => filas.reduce((n, f) => n + (f[k] || 0), 0);
  return (
    <div className="p-4 pt-10 flex flex-col h-full w-full">
      <h2 className="text-lg font-semibold text-neutral-800 mb-3">Sumatoria de materiales</h2>
      <div className="flex gap-2 mb-4 flex-wrap">
        {["", ...categorias].map((c) => (
          <button
            key={c || "todas"}
            onClick={() => setFiltroCategoria(c)}
            aria-pressed={filtroCategoria === c}
            className={`chip capitalize ${filtroCategoria === c ? "chip-activo" : ""}`}
          >
            {c || "Todas"}
          </button>
        ))}
      </div>
      <div className="flex-1 border-t border-neutral-200 overflow-y-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-neutral-100 text-neutral-700 sticky top-0 z-10">
            <tr>
              <th className="p-2 text-left font-semibold">Material</th>
              {tienePeligrosidad ? (
                <>
                  <th className="p-2 text-right font-semibold">T. peligrosos</th>
                  <th className="p-2 text-right font-semibold">T. no peligrosos</th>
                </>
              ) : <th className="p-2 text-right font-semibold">Toneladas</th>}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={3} className="p-4 text-center text-neutral-500">No hay toneladas en esta categoría.</td></tr>
            )}
            {filas.map((f) => (
              <tr key={`${f.categoria}::${f.material}`} className="border-t hover:bg-neutral-50">
                <td className="p-2">{f.material}{!filtroCategoria && <span className="block text-xs text-neutral-500 capitalize">{f.categoria}</span>}</td>
                {tienePeligrosidad ? (
                  <>
                    <td className="p-2 text-right tabular-nums">{formatoTon(f.toneladasPeligroso)}</td>
                    <td className="p-2 text-right tabular-nums">{formatoTon(f.toneladasNoPeligroso)}</td>
                  </>
                ) : <td className="p-2 text-right tabular-nums">{formatoTon(f.toneladasTotal)}</td>}
              </tr>
            ))}
          </tbody>
          {filas.length > 0 && (
            <tfoot className="bg-neutral-50 font-semibold border-t sticky bottom-0">
              <tr>
                <td className="p-2">Total</td>
                {tienePeligrosidad ? (
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
    </div>
  );
};

const GraficoPanel = ({ filas, tienePeligrosidad }) => {
  const datos = useMemo(() => {
    if (!filas.length) return null;
    const labels = filas.map((f) => f.material);
    return tienePeligrosidad
      ? {
        labels,
        datasets: [
          { label: "Peligrosos", data: filas.map((f) => f.toneladasPeligroso || 0), backgroundColor: "#f59e0b" },
          { label: "No peligrosos", data: filas.map((f) => f.toneladasNoPeligroso || 0), backgroundColor: "#00b86b" },
        ],
      }
      : { labels, datasets: [{ label: "Toneladas", data: filas.map((f) => f.toneladasTotal || 0), backgroundColor: "#00b86b" }] };
  }, [filas, tienePeligrosidad]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "top" } },
    layout: { padding: { top: 10, right: 20, bottom: 30, left: 10 } },
    scales: {
      x: { ticks: { autoSkip: false, maxRotation: 70, minRotation: 70, align: "end", font: { size: 11 } } },
      y: { beginAtZero: true, title: { display: true, text: "Toneladas", font: { size: 13 } } },
    },
  };

  return (
    <div className="p-4 pt-10 flex flex-col h-full w-full overflow-hidden">
      <h2 className="text-lg font-semibold text-neutral-800 mb-3">Distribución de materiales</h2>
      <div className="relative flex-1 w-full min-h-[600px]">
        {datos ? <Bar data={datos} options={options} /> : <p className="text-neutral-500">No hay datos para mostrar.</p>}
      </div>
    </div>
  );
};

// ── Página ────────────────────────────────────────────────────────────────────
function Dashboard() {
  const { user, token } = useContext(AuthContext);
  const empresaId = user?.empresaId;
  const [rango, setRango] = useState(rangoPorDefecto);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [isTableOpen, setTableOpen] = useState(true);
  const [isChartOpen, setChartOpen] = useState(true);

  const anios = useMemo(() => {
    const lista = [];
    for (let a = new Date().getFullYear(); a >= 2023; a--) lista.push(a);
    return lista;
  }, []);

  // El rango se lee de una referencia: la consulta automática corre al entrar y al cambiar de empresa, y los cambios de
  // periodo se aplican con "Consultar" (antes un eslint-disable en el efecto).
  const rangoActual = useRef(rango);
  useEffect(() => { rangoActual.current = rango; }, [rango]);

  const consultar = useCallback(async () => {
    const rango = rangoActual.current;
    if (!token || !empresaId) return;
    if (clave(rango.desde) > clave(rango.hasta)) {
      setError("El periodo inicial debe ser anterior o igual al final.");
      return;
    }
    setCargando(true);
    setError("");
    try {
      const p = (x) => `${x.anio}-${String(x.mes).padStart(2, "0")}`;
      setResumen(await llamarApi(token, API_REPORTES, `reportes/resumen?empresaId=${empresaId}&desde=${p(rango.desde)}&hasta=${p(rango.hasta)}`));
      setFiltroCategoria("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [token, empresaId]);

  useEffect(() => { consultar(); }, [consultar]);

  const tienePeligrosidad = resumen?.gransic?.tienePeligrosidad ?? true;
  const categorias = useMemo(() => [...new Set((resumen?.materiales || []).map((m) => m.categoria))], [resumen]);
  const filas = useMemo(() => (resumen?.materiales || []).filter((m) =>
    (!filtroCategoria || m.categoria === filtroCategoria)
    && (m.toneladasPeligroso || 0) + (m.toneladasNoPeligroso || 0) + (m.toneladasTotal || 0) > 0), [resumen, filtroCategoria]);

  const cambiar = (extremo, campo) => (e) => setRango((r) => ({ ...r, [extremo]: { ...r[extremo], [campo]: Number(e.target.value) } }));
  const selectCls = "campo py-1.5";

  const totalPeriodos = resumen ? resumen.periodos.length + resumen.faltantes.length : 0;
  const panelStyle = (abierto, crecer) => ({
    flexGrow: abierto ? crecer : 0, flexShrink: 1, flexBasis: abierto ? "0%" : "4rem", minWidth: abierto ? 0 : "4rem",
    transition: "flex-basis 0.4s ease, min-width 0.4s ease",
  });

  return (
    <div className="flex flex-col h-full w-full min-w-full flex-grow p-4">
      <EncabezadoPagina titulo="Dashboard" descripcion="Toneladas declaradas en los reportes vigentes del rango de periodos." />

      <div className="tarjeta p-4 mb-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-medium text-neutral-700">Período:</span>
          {["desde", "hasta"].map((extremo, i) => (
            <React.Fragment key={extremo}>
              {i === 1 && <span className="text-neutral-500">a</span>}
              <div className="flex items-center gap-2">
                <select aria-label={`Mes ${extremo}`} value={rango[extremo].mes} onChange={cambiar(extremo, "mes")} className={selectCls}>
                  {MESES.map((m, j) => <option key={m} value={j + 1}>{m}</option>)}
                </select>
                <select aria-label={`Año ${extremo}`} value={rango[extremo].anio} onChange={cambiar(extremo, "anio")} className={selectCls}>
                  {anios.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </React.Fragment>
          ))}
        </div>
        <button
          onClick={consultar}
          disabled={cargando}
          className="btn-principal"
        >
          {cargando && <Loader2 className="w-4 h-4 animate-spin" />} {cargando ? "Consultando…" : "Consultar"}
        </button>
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}

      {resumen && (
        <Indicadores className="mb-4">
          <Indicador etiqueta={`Periodos con reporte (de ${totalPeriodos})`} valor={resumen.periodos.length} />
          <Indicador etiqueta="Periodos sin reporte" valor={resumen.faltantes.length} tono="atencion" />
          <Indicador
            etiqueta="Toneladas del rango"
            valor={formatoTon(resumen.materiales.reduce((n, m) => n + (m.toneladasPeligroso || 0) + (m.toneladasNoPeligroso || 0) + (m.toneladasTotal || 0), 0))}
          />
          <Indicador etiqueta="Sistema de gestión" valor={resumen.gransic?.nombre || "—"} />
        </Indicadores>
      )}

      {resumen?.faltantes?.length > 0 && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p>
              <b>Los totales no son el total real del rango.</b> Faltan reportes de {resumen.faltantes.length}{" "}
              {resumen.faltantes.length === 1 ? "periodo" : "periodos"}: {resumen.faltantes.map(nombreCorto).join(", ")}.
            </p>
            <p className="mt-1">
              Se calcularon solo con {resumen.periodos.length === 1 ? "el único reporte vigente disponible" : `los ${resumen.periodos.length} reportes vigentes disponibles`}.
              {" "}Crea los que faltan en Crear Reporte.
            </p>
          </div>
        </div>
      )}

      {resumen && resumen.periodos.length === 0 ? (
        <p className="tarjeta p-6 text-center text-neutral-600">
          No hay reportes vigentes entre {nombreCorto(resumen.desde)} y {nombreCorto(resumen.hasta)}. Créalos en Crear Reporte.
        </p>
      ) : resumen && (
        <main className="flex flex-1 w-full min-w-full gap-4 overflow-hidden items-stretch">
          <Panel isOpen={isTableOpen} toggle={() => setTableOpen((o) => !o)} style={panelStyle(isTableOpen, 1)} collapsedIcon={<FaTable className="w-7 h-7" />}>
            <SumatoriaPanel {...{ filas, tienePeligrosidad, categorias, filtroCategoria, setFiltroCategoria }} />
          </Panel>
          <Panel isOpen={isChartOpen} toggle={() => setChartOpen((o) => !o)} style={panelStyle(isChartOpen, 3)} collapsedIcon={<FaChartBar className="w-7 h-7" />}>
            <GraficoPanel filas={filas} tienePeligrosidad={tienePeligrosidad} />
          </Panel>
        </main>
      )}
    </div>
  );
}

export default Dashboard;
