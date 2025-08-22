import React, { createContext, useContext, useState, useEffect } from "react";

//export const AuthContext = createContext();
export const AuthContext = createContext({
  user: { id: "123", name: "Usuario Dev" }
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { id, name, email }

  // Cargar usuario desde localStorage si existe
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Función para iniciar sesión
  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  // Función para cerrar sesión
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
