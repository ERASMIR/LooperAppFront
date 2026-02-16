// Header.jsx
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Header = () => {
  const { user, logout, setEmpresaActiva } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const menuRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cargar empresas del usuario al montar
  useEffect(() => {
    if (!user?.id) return;

    const fetchEmpresas = async () => {
      try {
        const res = await fetch(
          `/api-usuarios/getEmpresasByUsuario?usuarioId=${user.id}`
        );
        if (!res.ok) throw new Error("Error al obtener empresas");
        const data = await res.json();
        setEmpresas(data);

        // Establecer la primera empresa de la lista como default
        if (data.length > 0) {
          const empresaActual = data.find((e) => e.id === user.empresaId);
          if (!empresaActual) {
            // Si la empresa del login no está en la lista, usar la primera
            setEmpresaActiva(data[0].id, data[0].nombre);
          }
        }
      } catch (error) {
        console.error("❌ Error al cargar empresas del usuario:", error);
      }
    };

    fetchEmpresas();
  }, [user?.id]);

  const handleEmpresaChange = (e) => {
    const selectedId = e.target.value;
    const selectedEmpresa = empresas.find((emp) => String(emp.id) === selectedId);
    if (selectedEmpresa) {
      setEmpresaActiva(selectedEmpresa.id, selectedEmpresa.nombre);
    }
  };

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200 h-20 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        {/* ✅ Logo clickeable que lleva al inicio */}
        <img
          src="/imagenes/Logo-color.png"
          alt="Looper Logo"
          className="h-16 w-auto object-contain cursor-pointer hover:opacity-80 transition"
          onClick={() => navigate("/inicio")}
        />
      </div>

      {/* Dropdown de empresas */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Empresa seleccionada</span>
        <select
          value={user.empresaId || ""}
          onChange={handleEmpresaChange}
          className="appearance-none bg-transparent border-none text-lg text-gray-700 hover:text-primary transition cursor-pointer focus:outline-none pr-1"
        >
          {empresas.length === 0 && (
            <option value={user.empresaId || ""}>{user.empresa || "Sin empresa"}</option>
          )}
          {empresas.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.nombre}
            </option>
          ))}
        </select>
        <ChevronDown size={18} className="text-gray-700 -ml-2 pointer-events-none" />
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-lg text-gray-700 hover:text-primary transition"
        >
          {user.name}
          <ChevronDown size={18} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-md py-2">
            <Link
              to="/datos-usuario"
              className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
            >
              Mis Datos
            </Link>

            {(user.perfil === "dev") && (
              <Link
                to="/creacion-usuario"
                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
              >
                Crear Nuevo Usuario
              </Link>
            )}

            {(user.perfil === "dev") && (
              <Link
                to="/crear-empresa"
                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
              >
                Crear Nueva Empresa
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
