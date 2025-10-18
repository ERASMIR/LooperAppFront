import React from "react"; // <--- ¡Esta es la línea que faltaba!
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

function PrivateRoute({ children, allowedProfiles }) {
  const { token, user } = useContext(AuthContext);

  // Si no hay token, el usuario no está autenticado
  if (!token) return <Navigate to="/" replace />;

  // Si se especifican perfiles permitidos y el usuario no tiene el perfil correcto
  if (allowedProfiles && !allowedProfiles.includes(user?.perfil)) {
    // Redirigir a la página de inicio si no tiene permisos
    return <Navigate to="/inicio" replace />;
  }

  // Si todo está bien, renderizar el componente hijo
  return children;
}

export default PrivateRoute;
