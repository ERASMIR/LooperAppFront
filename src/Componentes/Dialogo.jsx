import React, { useEffect, useRef } from "react";

// Ventana modal accesible (auditoría UI, UX-02): fondo oscuro + panel con role="dialog", aria-modal y el primer título
// del panel como nombre (aria-labelledby). Al abrir lleva el foco al panel (o al campo marcado con data-autofocus o al
// primer campo del formulario) y al cerrar lo devuelve al elemento que la abrió; Tab no sale de la ventana; Escape la
// cierra (si hay onCerrar); con ventanas apiladas solo responde la de arriba. La página de fondo no se desplaza.
// Props: onCerrar (opcional; sin él, Escape no cierra), capa (z-index), como (etiqueta del panel, p. ej. "form"),
// className (clases del panel: ancho, padding, flex…) y el resto de props van al panel (onSubmit, noValidate…).

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const pila = []; // ventanas abiertas, la última es la de arriba
let overflowOriginal = "";

const Dialogo = ({ onCerrar, capa = "z-50", como = "div", className = "", children, ...resto }) => {
  const panel = useRef(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    const el = panel.current;
    const previo = document.activeElement;
    if (!pila.length) overflowOriginal = document.body.style.overflow;
    pila.push(el);
    document.body.style.overflow = "hidden";

    const titulo = el.querySelector("h1, h2, h3");
    if (titulo) {
      if (!titulo.id) titulo.id = `dialogo-${Math.random().toString(36).slice(2, 9)}`;
      el.setAttribute("aria-labelledby", titulo.id);
    }
    const visibles = () => [...el.querySelectorAll(ENFOCABLES)].filter((n) => n.getClientRects().length > 0);
    const inicial = el.querySelector("[data-autofocus]") || el.querySelector("input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled])");
    (inicial || el).focus();

    const alTeclado = (e) => {
      if (pila[pila.length - 1] !== el) return;
      if (e.key === "Escape" && cerrar.current) {
        e.stopPropagation();
        cerrar.current();
      } else if (e.key === "Tab") {
        const lista = visibles();
        if (!lista.length) { e.preventDefault(); return; }
        const [primero, ultimo] = [lista[0], lista[lista.length - 1]];
        const fuera = !el.contains(document.activeElement);
        if (e.shiftKey && (fuera || document.activeElement === primero || document.activeElement === el)) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && (fuera || document.activeElement === ultimo)) {
          e.preventDefault();
          primero.focus();
        }
      }
    };
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.removeEventListener("keydown", alTeclado);
      pila.splice(pila.indexOf(el), 1);
      if (!pila.length) document.body.style.overflow = overflowOriginal;
      if (previo && document.contains(previo)) previo.focus();
    };
  }, []);

  return (
    <div className={`fixed inset-0 bg-black/40 flex items-center justify-center p-4 overscroll-contain ${capa}`}>
      {React.createElement(como, {
        ref: panel, role: "dialog", "aria-modal": "true", tabIndex: -1,
        className: `bg-white rounded-2xl shadow-xl w-full focus:outline-none ${className}`, ...resto,
      }, children)}
    </div>
  );
};

export default Dialogo;
