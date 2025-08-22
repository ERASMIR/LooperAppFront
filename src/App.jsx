import React, { useState, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

import LogPage from "./LogPage";
import Home from './Paginas/Home';
import Header from './Componentes/Header';
import Sidebar from './Componentes/Sidebar';
import CrearReporte from './Paginas/CrearReporte';
import GestDoc from './Paginas/GestDoc';
import Tutoriales from './Paginas/Tutoriales';
import DatosUsuario from './Paginas/DatosUsuario';
import CreacionUsuario from './Paginas/CreacionUsuario';

// Ruta protegida
function PrivateRoute({ children, allowedProfiles }) {
  const { user } = useContext(AuthContext);
  console.log("👤 Usuario en PrivateRoute:", user);


  if (!user) return <Navigate to="/login" replace />;

  if (allowedProfiles && !allowedProfiles.includes(user.perfil)) {
    return <Navigate to="/inicio" replace />;
  }

  console.log("👤 Usuario en PrivateRoute:", user);


  return children;
};

function Layout({ children }) {
  const { user } = useContext(AuthContext);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Ocultar Header y Sidebar en login
  const isLoginPage = location.pathname === "/login";

  return (
    <div className="min-h-screen">
      {!isLoginPage && user && <Header />}

      <div className={`flex ${!isLoginPage ? "pt-14" : ""}`}>
        {!isLoginPage && user && (
          <Sidebar
            collapsed={sidebarCollapsed}
            toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}

        <main
          className={`transition-all duration-300 p-6 flex-1 ${
            !isLoginPage && user
              ? sidebarCollapsed
                ? "ml-16"
                : "ml-64"
              : "ml-0"
          }`}
        >
          {children}
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
          {/* Página pública */}
          <Route path="/login" element={<LogPage />} />

          {/* Rutas protegidas */}
          <Route
            path="/inicio"
            element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            }
          />
          <Route
            path="/crear-reporte"
            element={
              <PrivateRoute>
                <CrearReporte />
              </PrivateRoute>
            }
          />
          <Route
            path="/gestion-archivos"
            element={
              <PrivateRoute>
                <GestDoc />
              </PrivateRoute>
            }
          />
          <Route
            path="/tutoriales"
            element={
              <PrivateRoute>
                <Tutoriales />
              </PrivateRoute>
            }
          />
          <Route
            path="/datos-usuario"
            element={
              <PrivateRoute>
                <DatosUsuario />
              </PrivateRoute>
            }
          />
          <Route
            path="/creacion-usuario"
            element={
              <PrivateRoute>
                <CreacionUsuario />
              </PrivateRoute>
            }
          />

          {/* Redirección por defecto */}
          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
