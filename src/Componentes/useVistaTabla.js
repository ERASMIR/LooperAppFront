import { useEffect, useState } from "react";

// Columnas configurables de un listado (Matriz de Materiales, Registro de Ventas): columnas visibles y anchos por
// usuario y empresa, guardados en el navegador. Los componentes de la tabla están en columnasTabla.jsx.
// Cada columna: { id, label, ancho (px por defecto), fija?, campo? (campo adicional: oculto por defecto),
// oculta? (columna base oculta por defecto), render }.

const ANCHO_MIN = 80;

const leerVista = (clave) => {
  try {
    const v = JSON.parse(localStorage.getItem(clave));
    return { visibles: v?.visibles || {}, anchos: v?.anchos || {} };
  } catch {
    return { visibles: {}, anchos: {} };
  }
};

export const useVistaTabla = (claveVista, columnas) => {
  const [vista, setVista] = useState(() => leerVista(claveVista));

  useEffect(() => {
    try {
      localStorage.setItem(claveVista, JSON.stringify(vista));
    } catch {
      // Sin almacenamiento en el navegador: la tabla sigue con la vista en memoria.
    }
  }, [claveVista, vista]);

  // Lo no guardado usa el valor por defecto: columnas base visibles (salvo "oculta"), campos adicionales ocultos.
  const esVisible = (c) => c.fija || (vista.visibles[c.id] ?? !(c.campo || c.oculta));
  const anchoDe = (c) => vista.anchos[c.id] ?? c.ancho;
  const cambiarVisible = (id, valor) => setVista((v) => ({ ...v, visibles: { ...v.visibles, [id]: valor } }));
  const restablecer = () => setVista({ visibles: {}, anchos: {} });

  // Arrastrar el borde derecho del encabezado cambia el ancho de la columna (doble clic: ancho por defecto).
  const iniciarAjuste = (e, c) => {
    e.preventDefault();
    const inicioX = e.clientX;
    const inicio = anchoDe(c);
    const mover = (ev) => {
      const ancho = Math.max(ANCHO_MIN, Math.round(inicio + ev.clientX - inicioX));
      setVista((v) => ({ ...v, anchos: { ...v.anchos, [c.id]: ancho } }));
    };
    const soltar = () => {
      document.removeEventListener("mousemove", mover);
      document.removeEventListener("mouseup", soltar);
      document.body.style.cursor = "";
    };
    document.addEventListener("mousemove", mover);
    document.addEventListener("mouseup", soltar);
    document.body.style.cursor = "col-resize";
  };
  const anchoPorDefecto = (c) =>
    setVista((v) => ({ ...v, anchos: Object.fromEntries(Object.entries(v.anchos).filter(([id]) => id !== c.id)) }));

  return { visibles: columnas.filter(esVisible), esVisible, anchoDe, cambiarVisible, restablecer, iniciarAjuste, anchoPorDefecto };
};
