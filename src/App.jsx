import React, { useState, useContext, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

// Componentes y Páginas
import LogPage from "./LogPage";
import Header from './Componentes/Header';
import Sidebar from './Componentes/Sidebar';
import PrivateRoute from './Componentes/PrivateRoute';

// Páginas: cada una se descarga al abrirla (auditoría UI, RC-01). Antes todo iba en un solo archivo de ~1 MB
// (xlsx y chart.js incluidos) que se bajaba ya en el login.
const Home = lazy(() => import('./Paginas/Home'));
const CrearReporte = lazy(() => import('./Paginas/CrearReporte'));
const ReportePeriodo = lazy(() => import('./Paginas/ReportePeriodo'));
// Gestión Archivos (Paginas/GestDoc.jsx) fuera del front desde 2026-10-30: ya no se usa (decisión de la persona).
const Tutoriales = lazy(() => import('./Paginas/Tutoriales'));
const Soporte = lazy(() => import('./Paginas/Soporte'));
const DatosUsuario = lazy(() => import('./Paginas/DatosUsuario'));
const CreacionUsuario = lazy(() => import('./Paginas/CreacionUsuario'));
const Empresas = lazy(() => import('./Paginas/Empresas'));
const Dashboard = lazy(() => import('./Paginas/DashBoard'));
const GestionUsuarios = lazy(() => import('./Paginas/GestionUsuarios'));
const Proyeccion = lazy(() => import('./Paginas/Proyeccion'));
const MatrizMateriales = lazy(() => import('./Paginas/MatrizMateriales'));
const RegistroVentas = lazy(() => import('./Paginas/RegistroVentas'));

const CargandoPagina = () => (
  <p role="status" className="p-6 text-neutral-600">Cargando…</p>
);

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
          className={`flex-1 flex-shrink-0 overflow-y-auto p-6 transition-[margin] duration-300 motion-reduce:transition-none ${
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
        <Suspense fallback={<CargandoPagina />}>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<LogPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />

          {/* Rutas protegidas */}
          <Route path="/inicio" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/matriz-materiales" element={<PrivateRoute><MatrizMateriales /></PrivateRoute>} />
          <Route path="/registro-ventas" element={<PrivateRoute><RegistroVentas /></PrivateRoute>} />
          {/* T8.6: reporte desde la BD. El flujo anterior por archivos queda oculto (solo dev) hasta validar el nuevo. */}
          <Route path="/crear-reporte" element={<PrivateRoute><ReportePeriodo /></PrivateRoute>} />
          <Route path="/crear-reporte-archivos" element={<PrivateRoute allowedProfiles={['dev']}><CrearReporte /></PrivateRoute>} />
          <Route path="/tutoriales" element={<PrivateRoute><Tutoriales /></PrivateRoute>} />
          <Route path="/soporte" element={<PrivateRoute><Soporte /></PrivateRoute>} />
          <Route path="/datos-usuario" element={<PrivateRoute><DatosUsuario /></PrivateRoute>} />
          <Route path="/creacion-usuario" element={<PrivateRoute allowedProfiles={['dev']}><CreacionUsuario /></PrivateRoute>} />
          {/* Empresas: dev crea y edita todas; admin edita la suya (datos para declarar). Reemplaza a /crear-empresa. */}
          <Route path="/empresas" element={<PrivateRoute allowedProfiles={['admin', 'dev']}><Empresas /></PrivateRoute>} />
          <Route path="/crear-empresa" element={<Navigate to="/empresas" replace />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/proyeccion" element={<PrivateRoute><Proyeccion /></PrivateRoute>} />
          <Route path="/gestion-usuarios" element={<PrivateRoute allowedProfiles={['dev']}><GestionUsuarios /></PrivateRoute>} />

          {/* Redirección por defecto */}
          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}

export default App;
