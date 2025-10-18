import React, { useState, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

// Componentes y Páginas
import LogPage from "./LogPage";
import Home from './Paginas/Home';
import Header from './Componentes/Header';
import Sidebar from './Componentes/Sidebar';
import CrearReporte from './Paginas/CrearReporte';
import GestDoc from './Paginas/GestDoc';
import Tutoriales from './Paginas/Tutoriales';
import Soporte from './Paginas/Soporte'; // Importa el nuevo componente
import DatosUsuario from './Paginas/DatosUsuario';
import CreacionUsuario from './Paginas/CreacionUsuario';
import CreacionEmpresa from './Paginas/CreacionEmpresa';
import Dashboard from './Paginas/DashBoard';
import Ecologica from './Paginas/ValidEcologica';
import PrivateRoute from './Componentes/PrivateRoute';

// Layout principal de la aplicación
function Layout({ children }) {
  const { user } = useContext(AuthContext);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  const isLoginPage = location.pathname === "/";

  // Para la página de login, usamos un layout simple
  if (isLoginPage) {
    return <main className="h-screen w-screen">{children}</main>;
  }

  // Layout principal para usuarios autenticados
  return (
    <div className="min-h-screen w-full flex flex-col bg-neutral-100"> {/* <--- Clase de fondo corregida */}
      {user && <Header />}
      <div className="flex flex-1 pt-20"> {/* Contenedor principal con padding ajustado */}
        {user && (
          <Sidebar
            collapsed={sidebarCollapsed}
            toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}
        <main
          className={`flex-1 flex-shrink-0 overflow-y-auto p-6 transition-all duration-300 ${
            user ? (sidebarCollapsed ? "ml-16" : "ml-64") : "ml-0"
          }`}
        >
          {children} {/* El contenido ahora se desplazará correctamente */}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<LogPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />

          {/* Rutas protegidas */}
          <Route path="/inicio" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/crear-reporte" element={<PrivateRoute><CrearReporte /></PrivateRoute>} />
          <Route path="/gestion-archivos" element={<PrivateRoute><GestDoc /></PrivateRoute>} />
          <Route path="/tutoriales" element={<PrivateRoute><Tutoriales /></PrivateRoute>} />
          <Route path="/soporte" element={<PrivateRoute><Soporte /></PrivateRoute>} />
          <Route path="/datos-usuario" element={<PrivateRoute><DatosUsuario /></PrivateRoute>} />
          <Route path="/creacion-usuario" element={<PrivateRoute allowedProfiles={['dev']}><CreacionUsuario /></PrivateRoute>} />
          <Route path="/crear-empresa" element={<PrivateRoute allowedProfiles={['dev']}><CreacionEmpresa /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/validacion-ecologica" element={<PrivateRoute><Ecologica /></PrivateRoute>} />

          {/* Redirección por defecto */}
          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
