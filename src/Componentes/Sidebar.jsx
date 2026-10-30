import React from 'react';
import { NavLink } from "react-router-dom";
import {
  FileText,
  LayoutDashboard,
  BookOpen,
  PanelLeft,
  LifeBuoy,
  Boxes,
  ShoppingCart,
} from "lucide-react";
import { FaChartColumn } from "react-icons/fa6";

// Menú lateral. Estilo (auditoría UI, VI-03): ítems sin caja, texto gris oscuro e ícono verde; el activo con fondo
// verde claro y texto verde oscuro (contraste AA). Colapsado: solo íconos, con el nombre como ayuda y aria-label.
const ITEMS = [
  { to: "/matriz-materiales", label: "Matriz de Materiales", icono: Boxes },
  { to: "/registro-ventas", label: "Registro de Ventas", icono: ShoppingCart },
  { to: "/crear-reporte", label: "Crear Reporte", icono: LayoutDashboard },
  { to: "/gestion-archivos", label: "Gestión Archivos", icono: FileText },
  { to: "/dashboard", label: "Dashboard", icono: FaChartColumn },
  { to: "/tutoriales", label: "Tutoriales", icono: BookOpen },
  { to: "/soporte", label: "Soporte", icono: LifeBuoy },
];

const claseItem = ({ isActive }) =>
  `flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark ${
    isActive ? "bg-primary-light text-primary-dark font-semibold" : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
  }`;

const Sidebar = ({ collapsed, toggleCollapse }) => (
  <aside
    className={`fixed top-20 left-0 z-40 bg-white border-r border-neutral-200 transition-[width] duration-300 motion-reduce:transition-none
      ${collapsed ? "w-22" : "w-64"}
      h-[calc(100vh-3.5rem)]`}
  >
    <div className="flex justify-end p-2">
      {/* Mismo ícono abierto y cerrado (cuadro dividido); el texto de ayuda dice la acción. */}
      <button
        onClick={toggleCollapse}
        aria-label={collapsed ? "Abrir menú" : "Cerrar menú"}
        aria-expanded={!collapsed}
        title={collapsed ? "Abrir menú" : "Cerrar menú"}
        className="btn-icono"
      >
        <PanelLeft size={18} aria-hidden="true" />
      </button>
    </div>

    <nav className="flex flex-col gap-1 px-3 text-base font-medium">
      {ITEMS.map(({ to, label, icono }) => (
        <NavLink key={to} to={to} className={claseItem} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}>
          {React.createElement(icono, { className: `${collapsed ? "w-6 h-6" : "w-4 h-4"} flex-shrink-0 text-primary-dark`, "aria-hidden": true })}
          {!collapsed && label}
        </NavLink>
      ))}
    </nav>
  </aside>
);

export default Sidebar;
