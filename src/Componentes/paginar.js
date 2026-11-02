// Corta una lista en páginas (auditoría UI, UX-09). pagina empieza en 1 y se ajusta al rango válido.
// → { filas, pagina, paginas }. Se usa con el componente Paginacion.jsx.
export const paginar = (lista, pagina, porPagina) => {
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const actual = Math.min(Math.max(1, pagina), paginas);
  return { filas: lista.slice((actual - 1) * porPagina, actual * porPagina), pagina: actual, paginas };
};
