import React from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from "chart.js";
import { MESES } from "../ventasRevision.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// Gráfico de una serie (o del total): lo real en línea continua, la proyección en línea discontinua y la banda de
// sensibilidad (80 %) sombreada. La proyección parte del último mes real para que la línea no quede cortada.
const VERDE = "#007f4a";
const VERDE_CLARO = "rgba(0, 184, 107, 0.15)";
const GRIS = "#334155";

const nombreCorto = ({ anio, mes }) => `${MESES[mes - 1].slice(0, 3)} ${String(anio).slice(2)}`;
const formato = (n) => (n == null ? "—" : n.toLocaleString("es-CL", { maximumFractionDigits: 3 }));

const GraficoProyeccion = ({ real, proyeccion, titulo }) => {
  const n = real.length;
  const etiquetas = [...real, ...proyeccion].map(nombreCorto);
  const vacio = (k) => Array(k).fill(null);
  const ultimo = real[n - 1].valor;
  const datos = {
    labels: etiquetas,
    datasets: [
      { label: "Real", data: [...real.map((r) => r.valor), ...vacio(proyeccion.length)], borderColor: GRIS, backgroundColor: GRIS, borderWidth: 2, pointRadius: 2, tension: 0.25 },
      { label: "Proyección", data: [...vacio(n - 1), ultimo, ...proyeccion.map((p) => p.valor)], borderColor: VERDE, backgroundColor: VERDE, borderDash: [6, 4], borderWidth: 2, pointRadius: 2, tension: 0.25 },
      { label: "Sensibilidad (80 %)", rango: "alto", data: [...vacio(n - 1), ultimo, ...proyeccion.map((p) => p.alto)], borderColor: "transparent", backgroundColor: VERDE_CLARO, pointRadius: 0, fill: "+1", tension: 0.25 },
      { label: "Sensibilidad (80 %)", rango: "bajo", data: [...vacio(n - 1), ultimo, ...proyeccion.map((p) => p.bajo)], borderColor: "transparent", backgroundColor: VERDE_CLARO, pointRadius: 0, fill: false, tension: 0.25 },
    ],
  };
  const opciones = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom", labels: { filter: (item) => item.datasetIndex !== 3, boxWidth: 14 } },
      tooltip: {
        filter: (item) => item.raw != null && !(item.dataIndex === n - 1 && item.datasetIndex > 0),
        callbacks: { label: (c) => `${c.dataset.rango ? `Rango ${c.dataset.rango}` : c.dataset.label}: ${formato(c.raw)} t` },
      },
    },
    scales: { y: { beginAtZero: true, title: { display: true, text: "Toneladas" } } },
  };
  return (
    <figure className="h-80">
      <figcaption className="sr-only">{titulo}: historia real y proyección con banda de sensibilidad</figcaption>
      <Line data={datos} options={opciones} />
    </figure>
  );
};

export default GraficoProyeccion;
