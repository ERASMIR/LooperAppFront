import React from 'react' // ← esto es lo que falta
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'; // Esto importa Tailwind en toda la app
import { AuthProvider } from "./context/AuthContext.jsx";
import { AuthContext } from "./context/AuthContext"; // 👈 importa aquí


createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);





//ReactDOM.createRoot(document.getElementById("root")).render(
  //<React.StrictMode>
    //<AuthProvider>
      //<App />
    //</AuthProvider>
  //</React.StrictMode>
//);


//<AuthContext.Provider value={{ user: { id: "123", name: "Usuario Dev" } }}>
  //    <App />
    //</AuthContext.Provider>





//createRoot(document.getElementById('root')).render(
  //<StrictMode>
    //<App />
  //</StrictMode>,
//)
