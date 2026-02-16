import React, { createContext, useContext, useState, useEffect } from "react";

export const AuthContext = createContext(null);

// Hook para consumir el contexto fácilmente
export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Cargar usuario y token desde localStorage al iniciar la app
  useEffect(() => {
    const storedUser = localStorage.getItem("usuario");
    const storedToken = localStorage.getItem("token");
    
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
  }, []);

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
