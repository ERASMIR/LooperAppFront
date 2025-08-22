import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const Header = () => {
  const [usuario, setUsuario] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem("usuario");
    if (usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado));
    }
  }, []);

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

  if (!usuario) return null; // No mostrar nada hasta que cargue

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    navigate("/login");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b border-gray-200 h-20 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <img
          src="/Logo-LoopeR3.png"
          alt="Looper Logo"
          className="h-16 w-auto max-h-18 object-contain"
        />
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-lg text-gray-700 hover:text-primary-500 transition"
        >
          {/* 👇 ahora muestra el campo correcto */}
          {usuario.name}
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

            {["admin", "dev"].includes(usuario.perfil) && (
              <Link
                to="/creacion-usuario"
                className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
              >
                Crear Nuevo Usuario
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
