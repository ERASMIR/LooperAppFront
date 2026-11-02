// Caché del catálogo de la Matriz por empresa (auditoría UI, RC-03): Matriz, Ventas y Crear Reporte lo usan y antes
// cada pantalla lo volvía a pedir. Se guarda la promesa (dos pantallas a la vez comparten el mismo pedido) por unos
// minutos; la Matriz la invalida cuando crea o cambia unidades, componentes, características o campos.
import { API_MATERIALES } from "./api";
import { llamarApi } from "./apiCliente.js";

const VIGENCIA_MS = 5 * 60 * 1000;
const cache = new Map(); // empresaId → { promesa, desde }

export const obtenerCatalogos = (token, empresaId, { forzar = false } = {}) => {
  const guardado = cache.get(empresaId);
  if (!forzar && guardado && Date.now() - guardado.desde < VIGENCIA_MS) return guardado.promesa;
  const promesa = llamarApi(token, API_MATERIALES, `catalogosMatriz?empresaId=${empresaId}`).catch((err) => {
    cache.delete(empresaId); // un error no queda guardado
    throw err;
  });
  cache.set(empresaId, { promesa, desde: Date.now() });
  return promesa;
};

export const invalidarCatalogos = (empresaId) => cache.delete(empresaId);
