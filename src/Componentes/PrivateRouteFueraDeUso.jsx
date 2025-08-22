import { useContext } from "react";
import { AuthContext } from "../context/AuthContext"; // Ajusta la ruta según tu estructura
import { Navigate } from "react-router-dom";

function PrivateRoute({ children, allowedProfiles }) {
  const { user } = useContext(AuthContext);

  if (!user) return <Navigate to="/login" replace />;

  if (allowedProfiles && !allowedProfiles.includes(user.perfil)) {
    return <Navigate to="/inicio" replace />;
  }

  return children;
};

export default PrivateRoute;
