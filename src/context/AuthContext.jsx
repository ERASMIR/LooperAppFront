import React, { createContext, useContext, useState } from "react";

export const AuthContext = createContext(null);

// Hook para consumir el contexto fácilmente
export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  // Sesión guardada en localStorage: se lee en el primer render (no en un efecto) para que PrivateRoute no redirija al
  // login antes de recuperarla al recargar la página.
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("usuario");
      return storedUser && localStorage.getItem("token") ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("usuario") ? localStorage.getItem("token") : null;
    } catch {
      return null;
    }
  });

  // Función para iniciar sesión (ahora recibe user y token)
  const login = (userData, token) => {
    const fullUserData = {
      id: userData.id || "",
      name: [userData.nombre, userData.apellido].filter(Boolean).join(" "),
      email: userData.email || "",
      empresaId: userData.empresaId || "",
      empresa: userData.empresa?.nombre || userData.empresa || "",
      perfil: userData.perfil || "",
    };

    console.log("🟢 Guardando usuario en AuthContext:", fullUserData);
    console.log("🔑 Guardando token:", token);

    setUser(fullUserData);
    setToken(token);
    localStorage.setItem("usuario", JSON.stringify(fullUserData));
    localStorage.setItem("token", token);
  };

  // Función para cambiar la empresa activa
  const setEmpresaActiva = (empresaId, empresaNombre) => {
    const updatedUser = { ...user, empresaId, empresa: empresaNombre };
    setUser(updatedUser);
    localStorage.setItem("usuario", JSON.stringify(updatedUser));
  };

  // Función para cerrar sesión
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("usuario");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, setEmpresaActiva }}>
      {children}
    </AuthContext.Provider>
  );
};
