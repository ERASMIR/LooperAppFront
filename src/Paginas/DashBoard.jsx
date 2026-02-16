import React, { useState, useEffect, useContext, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { FaAnglesLeft, FaAnglesRight, FaChartBar, FaTable } from "react-icons/fa6";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { AuthContext } from "../context/AuthContext";
import { API_GESTDOC } from "../config/api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);


// ============================================================================
// COMPONENTE DE MODAL DE ADVERTENCIA
// ============================================================================

const WarningModal = ({ message, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
          <h3 className="text-lg font-bold text-yellow-600">Atención</h3>
          <p className="mt-2 text-sm text-neutral-700">{message}</p>
          <button
              onClick={onClose}
              className="mt-4 w-full bg-primary text-white font-semibold px-4 py-2 rounded-md hover:bg-primary/90 transition"
          >
              Entendido
          </button>
      </div>
  </div>
);



// ============================================================================
// COMPONENTES REUTILIZABLES
// ============================================================================

const Panel = ({ isOpen, toggle, className, children, collapsedIcon, style }) => (
  <div
    style={style}
    className={`relative flex flex-col transition-all duration-300 ease-in-out bg-white rounded-lg shadow-md ${className || ''}`}
  >
    <button
      onClick={toggle}
      className="absolute top-2 right-2 bg-white text-primary rounded-md w-7 h-7 flex items-center justify-center shadow-md hover:bg-primary-light transition z-10"
      title={isOpen ? "Colapsar" : "Expandir"}
    >
      {isOpen ? <FaAnglesLeft /> : <FaAnglesRight />}
    </button>
    {isOpen ? children : (
      <div className="flex items-center justify-center h-full text-neutral-400">
        {collapsedIcon}
      </div>
    )}
  </div>
);

// ============================================================================
// PANEL DE TABLA (IZQUIERDO)
// ============================================================================
const SumatoriaPanel = ({ tablaDatos, filtroCategoria, setFiltroCategoria, categorias, tienePeligrosidad }) => (
  <div className="p-4 pt-10 flex flex-col h-full w-full bg-white rounded-lg shadow-sm">
    <h2 className="text-lg font-semibold text-neutral-800 mb-3">
      📋 Sumatoria de materiales
    </h2>
    <div className="flex gap-2 mb-4 flex-wrap">
      {['todas', ...categorias].map((val) => (
        <button
          key={val}
          onClick={() => setFiltroCategoria(val)}
          className={`px-3 py-1 rounded-md text-sm font-medium border transition ${
            filtroCategoria === val
              ? "bg-primary text-white"
              : "hover:bg-neutral-100"
          }`}
        >
          {val.charAt(0).toUpperCase() + val.slice(1)}
        </button>
      ))}
    </div>
    <div className="flex-1 border-t border-neutral-200 rounded-md overflow-hidden">
      <div className="max-h-[calc(100vh-1px)] overflow-y-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-neutral-100 text-neutral-700 sticky top-0 z-10">
            <tr>
              <th className="p-2 text-left font-semibold">Material</th>
              {tienePeligrosidad ? (
                <>
                  <th className="p-2 text-right font-semibold">T. Peligrosos</th>
                  <th className="p-2 text-right font-semibold">T. No Peligrosos</th>
                </>
              ) : (
                <th className="p-2 text-right font-semibold">Total</th>
              )}
            </tr>
          </thead>
          <tbody>
            {tablaDatos.map((row) => (
              <tr key={row.material} className="border-t hover:bg-neutral-50">
                <td className="p-2">{row.material}</td>
                {tienePeligrosidad ? (
                  <>
                    <td className="p-2 text-right tabular-nums">
                      {(row.peligrosos ?? 0).toFixed(3)}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {(row.noPeligrosos ?? 0).toFixed(3)}
                    </td>
                  </>
                ) : (
                  <td className="p-2 text-right tabular-nums">
                    {(row.total ?? 0).toFixed(3)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// ============================================================================
// PANEL DE GRÁFICO (DERECHO)
// ============================================================================
const GraficoPanelContent = ({ datos }) => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      title: { 
        display: true, 
        text: "Distribución de materiales", 
        font: { size: 16 } 
      },
    },
    layout: {
      padding: { top: 10, right: 20, bottom: 30, left: 10 },
    },
    scales: {
      x: {
        ticks: {
          autoSkip: false,
          maxRotation: 70,
          minRotation: 70,
          align: "end",
          font: { size: 11 },
        },
        title: {
          display: true,
          text: "Materiales",
          font: { size: 13 },
        },
      },
      y: {
        beginAtZero: true,
        title: { 
          display: true, 
          text: "Toneladas totales", 
          font: { size: 13 } 
        },
        ticks: {
          precision: 0,
        },
      },
    },
  };

  return (
    <div className="p-4 pt-10 flex flex-col h-full w-full overflow-hidden">
      <h2 className="text-lg font-semibold text-neutral-800 mb-3">
        📊 Distribución de materiales
      </h2>
      <div className="relative flex-1 w-full h-full min-h-[900px]">
        {datos ? (
          <Bar 
            data={datos} 
            options={options} 
            style={{ width: "100%", height: "100%" }} 
          />
        ) : (
          <p>No hay datos para mostrar.</p>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL DASHBOARD
// ============================================================================

function Dashboard() {
  const { user, token } = useContext(AuthContext);
  const [filtros, setFiltros] = useState({
    mesInicio: new Date().getMonth() + 1,
    anioInicio: new Date().getFullYear(),
    mesFin: new Date().getMonth() + 1,
    anioFin: new Date().getFullYear(),
  });
  const [tablaDatos, setTablaDatos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [tienePeligrosidad, setTienePeligrosidad] = useState(true);

  const [isTableOpen, setTableOpen] = useState(true);
  const [isChartOpen, setChartOpen] = useState(true);

  const meses = [
    { valor: 1, nombre: "Enero" }, { valor: 2, nombre: "Febrero" },
    { valor: 3, nombre: "Marzo" }, { valor: 4, nombre: "Abril" },
    { valor: 5, nombre: "Mayo" }, { valor: 6, nombre: "Junio" },
    { valor: 7, nombre: "Julio" }, { valor: 8, nombre: "Agosto" },
    { valor: 9, nombre: "Septiembre" }, { valor: 10, nombre: "Octubre" },
    { valor: 11, nombre: "Noviembre" }, { valor: 12, nombre: "Diciembre" },
  ];

  const anioActual = new Date().getFullYear();
  //const anios = Array.from({ length: 2 }, (_, i) => anioActual - i);
  const anioInicioFijo = 2024;
  const numAnios = Math.max(0, anioActual - anioInicioFijo + 1);
  const anios = Array.from({ length: numAnios }, (_, i) => anioActual - i);

  const handleChange = (e) => {
    setFiltros(prev => ({ ...prev, [e.target.name]: parseInt(e.target.value) }));
  };

  const obtenerDatos = async () => {
    if (!user?.id || !user?.empresaId || !token) return;
    setCargando(true);
    setError(null);
    setDuplicateWarning(null);
    const params = new URLSearchParams({ usuarioId: user.id, empresaId: user.empresaId, ...filtros });
    try {
      const res = await fetch(`${API_GESTDOC}/listarReporteMateriales?${params.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();

      const periodos = data.map(item => `${item.periodo_mes}-${item.periodo_anio}`);
      const counts = periodos.reduce((acc, periodo) => {
          acc[periodo] = (acc[periodo] || 0) + 1;
          return acc;
      }, {});
      const duplicados = Object.entries(counts).filter(([_, count]) => count > 1).map(([periodo]) => periodo);

      if (duplicados.length > 0) {
          setDuplicateWarning(`Atención, hay más de un reporte para el periodo ${duplicados.join(', ')}. Por favor revíselos y elimine los duplicados para obtener una sumatoria real.`);
      }

      // Detectar tipo de reporte (peligrosidad o total) y categorias dinamicamente
      const allReportes = data.flatMap(item =>
        Array.isArray(item.result_reporte) ? item.result_reporte : JSON.parse(item.result_reporte || "[]")
      );
      const getCat = (r) => (r["categoría"] || r["categoria"] || r["categoria_producto"] || "").toLowerCase().trim();
      const getMat = (r) => (r["material"] || r["material_reciclado"] || r["nombre_material"] || "Desconocido").trim();
      const detectedCats = [...new Set(allReportes.map(r => getCat(r)).filter(Boolean))];
      const hasPeligrosidad = allReportes.some(r => r.hasOwnProperty("Materiales peligrosos"));

      setCategorias(detectedCats);
      setTienePeligrosidad(hasPeligrosidad);

      const safeParseNum = (val) => {
        if (val === undefined || val === null || val === "") return 0;
        const s = String(val).trim().replace(/\s/g, "").replace(",", ".");
        const n = Number(s);
        return Number.isFinite(n) ? n : 0;
      };

      const acumulado = data.reduce((acc, item) => {
        const reporte = Array.isArray(item.result_reporte) ? item.result_reporte : JSON.parse(item.result_reporte || "[]");
        reporte.forEach(r => {
          const cat = getCat(r);
          if (!cat) return;
          const material = getMat(r);
          if (!acc[material]) acc[material] = {};
          if (!acc[material][cat]) acc[material][cat] = { p: 0, np: 0, total: 0 };

          if (hasPeligrosidad) {
            acc[material][cat].p += safeParseNum(r["Materiales peligrosos"]);
            acc[material][cat].np += safeParseNum(r["Materiales no peligrosos"]);
          } else {
            acc[material][cat].total += safeParseNum(r["Total"]);
          }
        });
        return acc;
      }, {});

      const tabla = Object.entries(acumulado)
        .filter(([, catData]) => {
          if (filtroCategoria === "todas") return true;
          return catData.hasOwnProperty(filtroCategoria);
        })
        .map(([material, catData]) => {
          if (hasPeligrosidad) {
            let p = 0, np = 0;
            if (filtroCategoria === "todas") {
              Object.values(catData).forEach(v => { p += v.p; np += v.np; });
            } else {
              p = catData[filtroCategoria].p;
              np = catData[filtroCategoria].np;
            }
            return { material, peligrosos: p, noPeligrosos: np };
          } else {
            let total = 0;
            if (filtroCategoria === "todas") {
              Object.values(catData).forEach(v => { total += v.total; });
            } else {
              total = catData[filtroCategoria].total;
            }
            return { material, total };
          }
        });
      setTablaDatos(tabla.sort((a, b) => a.material.localeCompare(b.material)));
    } catch (err) {
      console.error(err); setError(err.message);
    } finally { setCargando(false); }
  };

  useEffect(() => { obtenerDatos(); }, [filtroCategoria, user?.empresaId, token]);

  const datosGrafico = useMemo(() => {
    if (!tablaDatos.length) return null;
    if (tienePeligrosidad) {
      return {
        labels: tablaDatos.map(d => d.material),
        datasets: [
          { label: "Peligrosos", data: tablaDatos.map(d => d.peligrosos ?? 0), backgroundColor: '#f59e0b' },
          { label: "No Peligrosos", data: tablaDatos.map(d => d.noPeligrosos ?? 0), backgroundColor: '#00b86b' },
        ],
      };
    } else {
      return {
        labels: tablaDatos.map(d => d.material),
        datasets: [
          { label: "Total", data: tablaDatos.map(d => d.total ?? 0), backgroundColor: '#00b86b' },
        ],
      };
    }
  }, [tablaDatos, tienePeligrosidad]);

  const tablePanelStyle = {
    flexGrow: isTableOpen ? 1 : 0,
    flexShrink: 1,
    flexBasis: isTableOpen ? '0%' : '4rem',
    minWidth: isTableOpen ? 0 : '4rem',
    transition: "flex-basis 0.4s ease, min-width 0.4s ease",
  };

  const chartPanelStyle = {
    flexGrow: isChartOpen ? 3 : 0, 
    flexShrink: 1,
    flexBasis: isChartOpen ? '0%' : '4rem',
    minWidth: isChartOpen ? 0 : '4rem',
    transition: "flex-basis 0.4s ease, min-width 0.4s ease",
  };

  return (
    <div className="flex flex-col h-full w-full min-w-full flex-grow p-4">
      {duplicateWarning && <WarningModal message={duplicateWarning} onClose={() => setDuplicateWarning(null)} />}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-800">Visualización de Materiales</h1>
        <p className="text-neutral-600">Selecciona filtros para consultar los reportes.</p>
      </header>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-medium text-neutral-700">Período:</span>
          <div className="flex items-center gap-2">
            <select name="mesInicio" value={filtros.mesInicio} onChange={handleChange} className="border rounded-md px-2 py-1 text-sm">
              {meses.map(mes => <option key={mes.valor} value={mes.valor}>{mes.nombre}</option>)}
            </select>
            <select name="anioInicio" value={filtros.anioInicio} onChange={handleChange} className="border rounded-md px-2 py-1 text-sm">
              {anios.map(anio => <option key={anio} value={anio}>{anio}</option>)}
            </select>
          </div>
          <span className="text-neutral-500">-</span>
          <div className="flex items-center gap-2">
            <select name="mesFin" value={filtros.mesFin} onChange={handleChange} className="border rounded-md px-2 py-1 text-sm">
              {meses.map(mes => <option key={mes.valor} value={mes.valor}>{mes.nombre}</option>)}
            </select>
            <select name="anioFin" value={filtros.anioFin} onChange={handleChange} className="border rounded-md px-2 py-1 text-sm">
              {anios.map(anio => <option key={anio} value={anio}>{anio}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={obtenerDatos}
          disabled={cargando}
          className="bg-primary text-white font-semibold px-4 py-2 rounded-md hover:bg-primary/90 transition disabled:bg-neutral-400"
        >
          {cargando ? "Consultando..." : "Consultar registros"}
        </button>
      </div>

      <main className="flex flex-1 w-full min-w-full gap-4 overflow-hidden items-stretch">
        <Panel
          isOpen={isTableOpen}
          toggle={() => setTableOpen(o => !o)}
          style={tablePanelStyle}
          collapsedIcon={<FaTable className="w-7 h-7" />}
        >
          <SumatoriaPanel {...{ tablaDatos, filtroCategoria, setFiltroCategoria, categorias, tienePeligrosidad }} />
        </Panel>
        <Panel
          isOpen={isChartOpen}
          toggle={() => setChartOpen(o => !o)}
          style={chartPanelStyle}
          collapsedIcon={<FaChartBar className="w-7 h-7" />}
        >
          <GraficoPanelContent datos={datosGrafico} />
        </Panel>
      </main>
    </div>
  );
}

export default Dashboard;
