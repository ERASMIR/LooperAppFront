const isProd = import.meta.env.PROD;

export const API_USUARIOS = isProd
  ? 'https://looper-usuarios.azurewebsites.net/api'
  : '/api-usuarios';

export const API_GESTDOC = isProd
  ? 'https://looper-gestdoc.azurewebsites.net/api'
  : '/api-gestdoc';

export const API_GESTREPORT = isProd
  ? 'https://looper-gestreport.azurewebsites.net/api'
  : '/api-gestreport';

export const API_PROCESAR = isProd
  ? 'https://looperapp.azurewebsites.net/api'
  
  : '/api-procesar';

// Matriz de Materiales (Function looper-materiales; el recurso en Azure aún no existe)
export const API_MATERIALES = isProd
  ? 'https://looper-materiales.azurewebsites.net/api'
  : '/api-materiales';

// Registro de Ventas (Function looper-ventas; el recurso en Azure aún no existe)
export const API_VENTAS = isProd
  ? 'https://looper-ventas.azurewebsites.net/api'
  : '/api-ventas';

// Reportes por periodo desde la BD (Function looper-reportes; el recurso en Azure aún no existe)
export const API_REPORTES = isProd
  ? 'https://looper-reportes.azurewebsites.net/api'
  : '/api-reportes';
