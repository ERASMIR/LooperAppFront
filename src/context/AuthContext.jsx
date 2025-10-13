import React, { createContext, useContext, useState, useEffect } from "react";


export const AuthContext = createContext(null);




// Hook para consumir el contexto fácilmente
export const useAuth = () => {
  return useContext(AuthContext);
};


export const AuthProvider = ({ children }) => {
  //const [user, setUser] = useState(null); // { id, name, email, empresa } USAR ESTA LINEA CUANDO LO SAQUE A PRODUCCION
    const [user, setUser] = useState({
    id: "demo",
    name: "Usuario Demo",
    email: "emiranda@blockadiaconsultores.com",
    empresaId: "1",
    empresa: "Ecológica",
    perfil: "admin"
  });

  // Cargar usuario desde localStorage si existe
  useEffect(() => {
    const storedUser = localStorage.getItem("usuario");
    console.log("📦 Cargando desde localStorage:", storedUser);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Función para iniciar sesión
  const login = (userData) => {
    // Merge con los campos actuales para evitar problemas si falta alguno
    const fullUserData = {
      id: userData.id || "",
      name: [userData.nombre, userData.apellido].filter(Boolean).join(" "), // 👈 nombre completo
      email: userData.email || "",
      empresaId: userData.empresaId || "",  // 👈 aquí ya se llena bien
      //empresa: userData.empresa || "",
      //empresaId: userData.empresa_id || userData.empresa?.id || "", // 👈 siempre un ID real
      empresa: userData.empresa?.nombre || userData.empresa || "", // 👈 nombre de la empresa
      perfil: userData.perfil || "", // <-- agrega el perfil
    };

    console.log("🟢 Guardando usuario en AuthContext:", fullUserData);

    setUser(fullUserData);
    localStorage.setItem("usuario", JSON.stringify(fullUserData));
  };

  // Función para cerrar sesión
  const logout = () => {
    setUser(null);
    localStorage.removeItem("usuario");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
