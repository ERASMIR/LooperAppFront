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
