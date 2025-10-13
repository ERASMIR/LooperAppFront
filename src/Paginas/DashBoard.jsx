import React, { useState, useEffect, useContext } from 'react';
import { Line } from 'react-chartjs-2';
import { FaAnglesLeft, FaAnglesRight } from "react-icons/fa6";
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { AuthContext } from "../context/AuthContext";

ChartJS.register(CategoryScale, LinearScale,  PointElement, LineElement, BarElement, Title, Tooltip, Legend);

// ============================================================================
// COMPONENTE DEL GRÁFICO
// ============================================================================
function Grafico({ datos }) {
    if (!datos) return <p className="text-center text-gray-500">No hay datos disponibles para mostrar.</p>;
  
    const data = {
      labels: datos.labels,
      datasets: datos.datasets.map(ds => ({
        ...ds,
        borderWidth: 1.5,
        borderRadius: 5,
        barThickness: 28,
      })),
    };
  
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 13 },
          },
        },
        title: {
          display: true,
          text: 'Distribución de materiales por tipo',
          font: { size: 18 },
        },
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Cantidad total',
          },
        },
      },
    };
  
    return (
      <div className="relative w-full h-[500px] overflow-x-auto">
        <div style={{ width: Math.max(900, datos.labels.length * 80) }}>
          <Bar data={data} options={options} />
        </div>
      </div>
    );
  }




// ============================================================================
// COMPONENTE DE FILTROS PRINCIPALES
// ============================================================================
function Filtros({ filtros, setFiltros, onAplicarFiltros, cargando }) {
  const MESES = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  const ANIOS = [2023, 2024, 2025, 2026];

  const handleChange = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md flex flex-wrap items-center gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Desde:</label>
        <div className="flex gap-2">
          <select name="mesInicio" value={filtros.mesInicio} onChange={handleChange} className="border p-2 rounded-md">
            {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select name="anioInicio" value={filtros.anioInicio} onChange={handleChange} className="border p-2 rounded-md">
            {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hasta:</label>
        <div className="flex gap-2">
          <select name="mesFin" value={filtros.mesFin} onChange={handleChange} className="border p-2 rounded-md">
            {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select name="anioFin" value={filtros.anioFin} onChange={handleChange} className="border p-2 rounded-md">
            {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={onAplicarFiltros}
        disabled={cargando}
        className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
      >
        {cargando ? 'Cargando...' : 'Consultar'}
      </button>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL DASHBOARD
// ============================================================================
function Dashboard() {
  const { user } = useContext(AuthContext);

  const [filtros, setFiltros] = useState({
    mesInicio: new Date().getMonth() + 1,
    anioInicio: new Date().getFullYear(),
    mesFin: new Date().getMonth() + 1,
    anioFin: new Date().getFullYear(),
  });

  //const [datosGrafico, setDatosGrafico] = useState(null);
  const [tablaDatos, setTablaDatos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  // Función principal de carga de datos
  const obtenerDatos = async () => {
    if (!user?.id || !user?.empresaId) {
      console.warn("⚠️ Falta user.id o user.empresaId");
      return;
    }

    setCargando(true);
    setError(null);

    const params = new URLSearchParams({
      usuarioId: user.id || user.id_usuario || "",
      empresaId: user.empresaId || user.empresa_id || "",
      mesInicio: filtros.mesInicio,
      anioInicio: filtros.anioInicio,
      mesFin: filtros.mesFin,
      anioFin: filtros.anioFin,
    });

    try {
      const response = await fetch(`https://looper-gestdoc.azurewebsites.net/api/listarreportemateriales?${params.toString()}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);

      const data = await response.json();

      // Acumulador de materiales
      const acumulado = {};

      data.forEach((item) => {
        const reporte = Array.isArray(item.result_reporte)
          ? item.result_reporte
          : JSON.parse(item.result_reporte || "[]");

        reporte.forEach((r) => {
          const categoria = (r["categoría"] || "").toLowerCase().trim();
          const material = (r.material || "Desconocido").trim();

          const peligrosos = parseFloat((r["Materiales peligrosos"] || "0").replace(",", "."));
          const noPeligrosos = parseFloat((r["Materiales no peligrosos"] || "0").replace(",", "."));

          if (!acumulado[material]) {
            acumulado[material] = {
              domiciliario: { peligrosos: 0, noPeligrosos: 0 },
              "no domiciliario": { peligrosos: 0, noPeligrosos: 0 },
            };
          }

          if (categoria === "domiciliario" || categoria === "no domiciliario") {
            acumulado[material][categoria].peligrosos += peligrosos;
            acumulado[material][categoria].noPeligrosos += noPeligrosos;
          }
        });
      });

      // Aplicar filtro seleccionado
      const tabla = Object.entries(acumulado).map(([material, valores]) => {
        let totalPeligrosos = 0;
        let totalNoPeligrosos = 0;

        if (filtroCategoria === "todas") {
          totalPeligrosos = valores.domiciliario.peligrosos + valores["no domiciliario"].peligrosos;
          totalNoPeligrosos = valores.domiciliario.noPeligrosos + valores["no domiciliario"].noPeligrosos;
        } else {
          totalPeligrosos = valores[filtroCategoria].peligrosos;
          totalNoPeligrosos = valores[filtroCategoria].noPeligrosos;
        }

        return { material, peligrosos: totalPeligrosos, noPeligrosos: totalNoPeligrosos };
      });

      tabla.sort((a, b) => a.material.localeCompare(b.material));
      setTablaDatos(tabla);

      // Datos del gráfico
      const labels = tabla.map((t) => t.material);
      const datasets = [
        {
          label: "Materiales peligrosos",
          data: tabla.map((t) => t.peligrosos),
          borderColor: "hsl(0, 70%, 50%)",
          backgroundColor: "rgba(255, 99, 132, 0.4)",
        },
        {
          label: "Materiales no peligrosos",
          data: tabla.map((t) => t.noPeligrosos),
          borderColor: "hsl(210, 70%, 50%)",
          backgroundColor: "rgba(54, 162, 235, 0.4)",
        },
      ];

      setDatosGrafico({ labels, datasets });
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  // Efecto: recargar cuando se cambia filtro de categoría
  useEffect(() => {
    obtenerDatos();
  }, [filtroCategoria]);

  

  // Construir datos para el gráfico en base a la tabla filtrada
const datosGrafico = React.useMemo(() => {
    if (!tablaDatos || tablaDatos.length === 0) return null;
  
    return {
      labels: tablaDatos.map(row => row.material),
      datasets: [
        {
          label: "Total Peligrosos",
          data: tablaDatos.map(row => row.peligrosos ?? 0),
          backgroundColor: "rgba(255, 99, 132, 0.5)",
        },
        {
          label: "Total No Peligrosos",
          data: tablaDatos.map(row => row.noPeligrosos ?? 0),
          backgroundColor: "rgba(75, 192, 192, 0.5)",
        },
      ],
    };
  }, [tablaDatos]);
  

  return (
    <div className="app-container">
    <header className="mb-8">
      <h1 className="text-3xl font-bold text-gray-800">Visualización de Materiales</h1>
      <p className="text-gray-600 mt-1">
        Selecciona un rango de períodos y categoría para consultar los reportes.
      </p>
    </header>

    <Filtros
      filtros={filtros}
      setFiltros={setFiltros}
      onAplicarFiltros={obtenerDatos}
      cargando={cargando}
    />

    <main className="transition-all duration-300 p-6 flex-1">
      <div className="min-h-screen w-full bg-gray-100 flex flex-col flex-grow">
        <div className="flex flex-1 gap-4">
          <SumatoriaPanel
            tablaDatos={tablaDatos}
            filtroCategoria={filtroCategoria}
            setFiltroCategoria={setFiltroCategoria}
          />
          <GraficoPanel datos={datosGrafico} />
        </div>
      </div>
    </main>
  </div>
  );
}

// ================== PANEL IZQUIERDO ===================
function SumatoriaPanel({ tablaDatos, filtroCategoria, setFiltroCategoria }) {
  const [abierto, setAbierto] = useState(true);

  const toggleFiltro = (tipo) => {
    setFiltroCategoria(tipo);
  };

  return (
    <div
      className={`relative flex flex-col transition-all duration-500 ease-in-out bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden
        ${abierto ? "flex-[1_1_50%]" : "flex-[0_0_3.5rem]"}`}
    >
      {/* Botón de colapsar */}
      <button
        onClick={() => setAbierto(!abierto)}
        className="absolute top-2 right-2 bg-white text-[#00E676] rounded-md w-7 h-7 flex items-center justify-center shadow-md hover:bg-[#00E676] hover:text-white transition"
        title={abierto ? "Colapsar panel izquierdo" : "Expandir panel izquierdo"}
      >
        {abierto ? <FaAnglesLeft className="w-4 h-4" /> : <FaAnglesRight className="w-4 h-4" />}
      </button>

      {abierto && (
        <div className="pt-6 flex-1 overflow-auto">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">📋 Sumatoria de materiales</h2>

          {/* Botones de filtro */}
          <div className="flex gap-2 mb-4">
            {[
              { label: "Todo", value: "todas" },
              { label: "Domiciliario", value: "domiciliario" },
              { label: "No Domiciliario", value: "no domiciliario" },
            ].map((btn) => (
              <button
                key={btn.value}
                onClick={() => toggleFiltro(btn.value)}
                className={`px-3 py-1 rounded-md text-sm font-medium border transition
                  ${
                    filtroCategoria === btn.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                  }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Tabla */}
          <div className="overflow-y-auto max-h-[60vh]">
            <table className="w-full border border-gray-200 rounded-md text-sm">
              <thead className="bg-gray-100 text-gray-700 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Material</th>
                  <th className="p-2 text-right">Total Peligrosos</th>
                  <th className="p-2 text-right">Total No Peligrosos</th>
                </tr>
              </thead>
              <tbody>
                {tablaDatos.map((row) => (
                  <tr key={row.material} className="border-t border-gray-200">
                    <td className="p-2">{row.material}</td>
                    <td className="p-2 text-right">{(row.peligrosos ?? 0).toFixed(3)}</td>
                    <td className="p-2 text-right">{(row.noPeligrosos ?? 0).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}



// ================== PANEL DERECHO ===================GraficoPanel
function GraficoPanel({ datos }) {
    if (!datos || !datos.labels?.length)
      return (
        <div className="flex items-center justify-center w-full h-[550px] bg-gray-50 rounded-md">
          <p className="text-center text-gray-500">No hay datos disponibles para mostrar.</p>
        </div>
      );
  
    // calcular rango dinámico del eje Y
    const allValues = datos.datasets.flatMap((ds) => ds.data);
    const minY = 0; // siempre desde cero
    const maxY = Math.max(...allValues);
    const padding = maxY * 0.1 || 1; // 10% extra arriba
  
    const data = {
      labels: datos.labels,
      datasets: datos.datasets.map((ds) => ({
        ...ds,
        borderWidth: 1.5,
        borderRadius: 6,
        barPercentage: 0.7,
        categoryPercentage: 0.6,
      })),
    };
  
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: {
            font: { size: 13 },
          },
        },
        title: {
          display: true,
          text: "Distribución de materiales por tipo",
          font: { size: 18 },
        },
      },
      layout: {
        padding: 20,
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 40,
            minRotation: 40,
            font: { size: 12 },
            callback: function (value, index) {
              const label = this.getLabelForValue(value);
              // cortar etiquetas largas (para evitar que se salgan del canvas)
              return label.length > 25 ? label.slice(0, 25) + "…" : label;
            },
          },
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          min: minY,
          max: maxY + padding,
          title: {
            display: true,
            text: "Cantidad total",
            font: { size: 13 },
          },
          ticks: {
            stepSize: Math.max((maxY + padding) / 5, 1),
            font: { size: 12 },
          },
          grid: {
            color: "rgba(0,0,0,0.1)",
          },
        },
      },
    };
  
    // ancho dinámico: 120px por etiqueta (para que no se amontonen)
    const widthPx = Math.max(1000, datos.labels.length * 120);
  
    return (
      <div className="relative w-full h-[550px] bg-gray-50 rounded-lg shadow-inner overflow-x-auto overflow-y-hidden p-4">
        <div style={{ width: `${widthPx}px`, height: "100%" }}>
          <Bar data={data} options={options} />
        </div>
      </div>
    );
  }
  
export default Dashboard;
