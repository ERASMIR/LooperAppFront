// Maqueta "Panel de Validación y Valorización" (sin funciones ni datos reales). Fuera del front desde 2026-10-30:
// sin ruta en App.jsx; se conserva como referencia de diseño para un módulo futuro.
import React, { useState } from "react";
import { FaFilter } from "react-icons/fa";
import { SquareChevronLeft, SquareChevronRight } from "lucide-react";
import EncabezadoPagina from "../Componentes/EncabezadoPagina";

export default function Home() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="p-4">
      <EncabezadoPagina titulo="Panel de Validación y Valorización" />

      {/* Botones de carga */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow transition">
          Carga archivo tributario
        </button>
        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow transition">
          Carga archivo ReSimple
        </button>
        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow transition">
          Carga archivo ProREP
        </button>
        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow transition">
          Carga archivo Valorización
        </button>
      </div>

      {/* Botones de procesos */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition">
          Procesar Validación
        </button>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition">
          Procesar Valorización
        </button>
        <div className="flex items-center gap-2">
          <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow transition">
            Guardar Declaración
          </button>
          <select className="border border-neutral-300 rounded px-2 py-1">
            <option>Mes</option>
            <option>Enero</option>
            <option>Febrero</option>
            <option>Marzo</option>
          </select>
          <select className="border border-neutral-300 rounded px-2 py-1">
            <option>Año</option>
            <option>2024</option>
            <option>2025</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Panel de sumadores (más estrecho) */}
        <div
          className={`relative transition-[width] duration-300 motion-reduce:transition-none ${
            collapsed ? "w-1" : "w-full md:col-span-1 lg:max-w-xs"
          }`}
        >
          <div
            className={`h-full rounded p-4 ${
              collapsed ? "hidden" : "block bg-orange-500/80 text-white shadow"
            }`}
          >
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="btn-icono absolute top-2 right-2"
              title={collapsed ? "Expandir panel" : "Contraer panel"}
              aria-label={collapsed ? "Expandir panel" : "Contraer panel"}
            >
              {collapsed ? <SquareChevronRight size={16} aria-hidden="true" /> : <SquareChevronLeft size={16} aria-hidden="true" />}
            </button>

            <h2 className="text-lg font-semibold mb-4">Sumadores</h2>
            <ul className="space-y-2 text-sm">
              <li>Hojalata: <b>300 tn</b></li>
              <li>Metal con aire comprimido: <b>670 tn</b></li>
              <li>Metales Reutilizables Nuevos: <b>567 tn</b></li>
              <li>Plástico: <b>65 tn</b></li>
              <li>Botellas PET: <b>124 tn</b></li>
              <li>Otros envases PET: <b>234 tn</b></li>
              <li>Envases PEAD (sin grasa): <b>123 tn</b></li>
              <li>PVC Flexible: <b>268 tn</b></li>
              <li>Cartón: <b>45 tn</b></li>
              <li>Papel: <b>89 tn</b></li>
              <li>Madera: <b>226 tn</b></li>
            </ul>
          </div>
        </div>

        {/* Tabla de resultados (sin tocar) */}
        <div className="md:col-span-3 bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-4 text-green-700">
            Resultados de Validación
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-green-700 text-white">
                <tr>
                  {[
                    "Empresa",
                    "Establecimiento",
                    "Subcategoría",
                    "Materialidad",
                    "Ton",
                    "Año",
                    "Mes",
                    "N° Documento",
                    "Fecha",
                    "Resultado",
                    "Estado Valorización",
                  ].map((col) => (
                    <th key={col} className="px-2 py-2 text-left">
                      <div className="flex items-center gap-1">
                        <span>{col}</span>
                        <FaFilter className="text-xs opacity-70" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-neutral-50">
                  <td className="px-2 py-1">COCA COLA EMBONOR S.A</td>
                  <td className="px-2 py-1">Talca</td>
                  <td className="px-2 py-1">Papel y Cartón</td>
                  <td className="px-2 py-1">Cartón</td>
                  <td className="px-2 py-1">0,533</td>
                  <td className="px-2 py-1">2025</td>
                  <td className="px-2 py-1">05</td>
                  <td className="px-2 py-1">97772073</td>
                  <td className="px-2 py-1">2025-05-07</td>
                  <td className="px-2 py-1 text-green-600 font-semibold">
                    Validado
                  </td>
                  <td className="px-2 py-1">
                    <select className="border border-neutral-300 rounded px-2 py-1">
                      <option>Valorizado</option>
                      <option>-</option>
                    </select>
                  </td>
                </tr>
                <tr className="border-b hover:bg-neutral-50">
                  <td className="px-2 py-1">COCA COLA EMBONOR S.A</td>
                  <td className="px-2 py-1">Talca</td>
                  <td className="px-2 py-1">Papel y Cartón</td>
                  <td className="px-2 py-1">Papel blanco</td>
                  <td className="px-2 py-1">0,516</td>
                  <td className="px-2 py-1">2025</td>
                  <td className="px-2 py-1">05</td>
                  <td className="px-2 py-1">97772073</td>
                  <td className="px-2 py-1">2025-05-07</td>
                  <td className="px-2 py-1 text-yellow-600 font-semibold">
                    Observado
                  </td>
                  <td className="px-2 py-1">
                    <select className="border border-neutral-300 rounded px-2 py-1">
                      <option>Valorizado</option>
                      <option>-</option>
                    </select>
                  </td>
                </tr>
                <tr className="hover:bg-neutral-50">
                  <td className="px-2 py-1">COCA COLA EMBONOR S.A</td>
                  <td className="px-2 py-1">Talca</td>
                  <td className="px-2 py-1">Papel y Cartón</td>
                  <td className="px-2 py-1">Cartón</td>
                  <td className="px-2 py-1">0,485</td>
                  <td className="px-2 py-1">2025</td>
                  <td className="px-2 py-1">05</td>
                  <td className="px-2 py-1">98041464</td>
                  <td className="px-2 py-1">2025-05-27</td>
                  <td className="px-2 py-1 text-red-600 font-semibold">
                    Registro no encontrado
                  </td>
                  <td className="px-2 py-1">
                    <select className="border border-neutral-300 rounded px-2 py-1">
                      <option>Valorizado</option>
                      <option>-</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
