import React from 'react';
import { NavLink } from "react-router-dom";
import {
  FileText,
  LayoutDashboard,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  LifeBuoy, // Importa el nuevo icono
} from "lucide-react";
import { FaChartColumn } from "react-icons/fa6";

const Sidebar = ({ collapsed, toggleCollapse }) => (
  <aside
    className={`fixed top-20 left-0 z-40 bg-gray-50 border-r border-gray-200 transition-all duration-300
      ${collapsed ? "w-22" : "w-64"} 
      h-[calc(100vh-3.5rem)]`}
  >
    <div className="flex justify-end p-2">
      <button onClick={toggleCollapse} className="text-gray-700 hover:text-primary">
        {collapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
      </button>
    </div>

    <nav className="flex flex-col gap-3 px-4 text-xl font-medium">
      <NavLink
        to="/crear-reporte"
        className={({ isActive }) =>
           `flex items-center gap-2 px-3 py-2 rounded-md transition-colors duration-200 border 
          ${isActive
            ? "bg-primary text-white border-transparent"
            : "bg-white text-primary border-gray-200"} 
          hover:bg-primary-light hover:text-primary hover:border-gray-300`
        }
      >
        <LayoutDashboard className= {`${collapsed ? "w-7 h-7" : "w-4 h-4"} transition-all`} />
        {!collapsed && "Crear Reporte"}
      </NavLink>

      <NavLink
        to="/gestion-archivos"
        className={({ isActive }) =>
          `flex items-center gap-2 px-3 py-2 rounded-md transition-all border 
          ${isActive
            ? "bg-primary text-white border-transparent"
            : "bg-white text-primary border-gray-200"} 
          hover:bg-primary-light hover:text-primary hover:border-gray-300`
        }
      >
        <FileText className={`${collapsed ? "w-7 h-7" : "w-4 h-4"} transition-all`} />
        {!collapsed && "Gestión Archivos"}
      </NavLink>


      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          `flex items-center gap-2 px-3 py-2 rounded-md transition-all border 
          ${isActive
            ? "bg-primary text-white border-transparent"
            : "bg-white text-primary border-gray-200"} 
          hover:bg-primary-light hover:text-primary hover:border-gray-300`
        }
      >
        <FaChartColumn className={`${collapsed ? "w-7 h-7" : "w-4 h-4"} transition-all`} />
        {!collapsed && "Dashboard"}
      </NavLink>

      <NavLink
        to="/tutoriales"
        className={({ isActive }) =>
          `flex items-center gap-2 px-3 py-2 rounded-md transition-all border 
          ${isActive
            ? "bg-primary text-white border-transparent"
            : "bg-white text-primary border-gray-200"} 
          hover:bg-primary-light hover:text-primary hover:border-gray-300`
        }
      >
        <BookOpen className={`${collapsed ? "w-7 h-7" : "w-4 h-4"} transition-all`} />
        {!collapsed && "Tutoriales"}
      </NavLink>
      
      {/* Nuevo enlace a Soporte */}
      <NavLink
        to="/soporte"
        className={({ isActive }) =>
          `flex items-center gap-2 px-3 py-2 rounded-md transition-all border 
          ${isActive
            ? "bg-primary text-white border-transparent"
            : "bg-white text-primary border-gray-200"} 
          hover:bg-primary-light hover:text-primary hover:border-gray-300`
        }
      >
        <LifeBuoy className={`${collapsed ? "w-7 h-7" : "w-4 h-4"} transition-all`} />
        {!collapsed && "Soporte"}
      </NavLink>
    </nav>
  </aside>
);

export default Sidebar;
