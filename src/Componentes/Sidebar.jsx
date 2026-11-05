import React from 'react';
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  PanelLeft,
  LifeBuoy,
  Boxes,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { FaChartColumn } from "react-icons/fa6";

// Menú lateral. Estilo (auditoría UI, VI-03): ítems sin caja, texto gris oscuro e ícono verde; el activo con fondo
// verde claro y texto verde oscuro (contraste AA). Colapsado: solo íconos, con el nombre como ayuda y aria-label.
const ITEMS = [
  { to: "/matriz-materiales", label: "Matriz de Materiales", icono: Boxes },
  { to: "/registro-ventas", label: "Registro de Ventas", icono: ShoppingCart },
  { to: "/crear-reporte", label: "Crear Reporte", icono: LayoutDashboard },
  { to: "/dashboard", label: "Dashboard", icono: FaChartColumn },
  { to: "/proyeccion", label: "Proyección", icono: TrendingUp },
  { to: "/tutoriales", label: "Tutoriales", icono: BookOpen },
  { to: "/soporte", label: "Soporte", icono: LifeBuoy },
];

const claseItem = (collapsed) => ({ isActive }) =>
  `flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark ${
    collapsed ? "justify-center" : ""
  } ${isActive ? "bg-primary-light text-primary-dark font-semibold" : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"}`;

// La barra es una columna del diseño (no flotante): su fondo blanco llega siempre hasta el final de la página, también
// en capturas de página completa e impresión. El menú va pegado bajo el encabezado (sticky, 5rem = h-20 del Header) y
// hace scroll propio si la ventana es baja. El ancho (w-64 / w-20) lo ocupa la columna, así que el contenido no se monta.
const Sidebar = ({ collapsed, toggleCollapse }) => (
  <aside
    className={`flex-shrink-0 bg-white border-r border-neutral-200 transition-[width] duration-300 motion-reduce:transition-none
      ${collapsed ? "w-20" : "w-64"}`}
  >
    <div className="sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto pb-4">
      <div className={`flex p-2 ${collapsed ? "justify-center" : "justify-end"}`}>
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
          <NavLink key={to} to={to} className={claseItem(collapsed)} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}>
            {React.createElement(icono, { className: `${collapsed ? "w-6 h-6" : "w-4 h-4"} flex-shrink-0 text-primary-dark`, "aria-hidden": true })}
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>
    </div>
  </aside>
);

export default Sidebar;
