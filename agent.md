# LooperApp Front — Agent Context

## Proyecto
- **Tipo:** React + Vite SPA
- **Azure:** Static Web App (deploy automatico via GitHub Actions)
- **GitHub:** https://github.com/ERASMIR/LooperAppFront.git (branch: main)
- **Puerto local:** 5173 (`npm run dev`)
- **Version tag:** v1.0-deploy-2026-02-16

## Arquitectura
```
LooperAppFront/
├── index.html                   # Entry point, fuente Poppins
├── vite.config.js               # Proxy para 4 APIs en dev
├── tailwind.config.js           # Theme custom (primary, primary-light)
├── postcss.config.js
├── package.json
├── src/
│   ├── main.jsx                 # ReactDOM.createRoot + BrowserRouter
│   ├── App.jsx                  # Rutas principales
│   ├── LogPage.jsx              # Login + recuperar contrasena
│   ├── index.css                # Tailwind imports
│   ├── config/
│   │   └── api.js               # URLs dinamicas dev/prod
│   ├── context/
│   │   └── AuthContext.jsx      # Auth state, JWT, empresa activa
│   ├── Componentes/
│   │   ├── Header.jsx           # Logo, selector empresa, menu usuario
│   │   ├── Sidebar.jsx          # Navegacion lateral colapsable
│   │   └── PrivateRoute.jsx     # Proteccion de rutas por perfil
│   └── Paginas/
│       ├── Home.jsx             # Pagina inicio
│       ├── CrearReporte.jsx     # Subir archivos + procesar + guardar informe
│       ├── GestDoc.jsx          # Gestion documental (listar, ver, eliminar)
│       ├── DashBoard.jsx        # Visualizacion de materiales (graficos Chart.js)
│       ├── DatosUsuario.jsx     # Editar perfil + cambiar contrasena
│       ├── CreacionUsuario.jsx  # Crear usuario (solo dev)
│       ├── CreacionEmpresa.jsx  # Crear empresa (solo dev)
│       ├── Soporte.jsx          # Tickets de soporte con adjuntos
│       └── Tutoriales.jsx       # Videos tutoriales
└── public/
    └── imagenes/                # Logos, fondo login
```

## Config de APIs (src/config/api.js)
```js
const isProd = import.meta.env.PROD;
API_USUARIOS  = isProd ? 'https://looper-usuarios.azurewebsites.net/api' : '/api-usuarios'
API_GESTDOC   = isProd ? 'https://looper-gestdoc.azurewebsites.net/api'  : '/api-gestdoc'
API_GESTREPORT= isProd ? 'https://looper-gestreport.azurewebsites.net/api': '/api-gestreport'
API_PROCESAR  = isProd ? 'https://looperapp.azurewebsites.net/api'       : '/api-procesar'
```

## Proxy Vite (solo dev)
En `vite.config.js`:
- `/api-usuarios` → `http://localhost:7073`
- `/api-procesar` → `https://looperapp.azurewebsites.net`
- `/api-gestdoc` → `https://looper-gestdoc.azurewebsites.net`
- `/api-gestreport` → `https://looper-gestreport.azurewebsites.net`

## Autenticacion (AuthContext)
- Login retorna JWT + objeto usuario
- Se guarda en localStorage (token, user)
- `setEmpresaActiva(id, nombre)` permite cambiar empresa activa
- JWT contiene: id, perfil, nombre, email, empresaId
- Perfiles: "admin" (1), "usuarioREP" (2), "dev" (3)

## Rutas y permisos
| Ruta | Componente | Acceso |
|------|-----------|--------|
| / o /login | LogPage | Publico |
| /inicio | Home | Autenticado |
| /crear-reporte | CrearReporte | Autenticado |
| /gestion-archivos | GestDoc | Autenticado |
| /dashboard | DashBoard | Autenticado |
| /datos-usuario | DatosUsuario | Autenticado |
| /tutoriales | Tutoriales | Autenticado |
| /soporte | Soporte | Autenticado |
| /creacion-usuario | CreacionUsuario | Solo dev |
| /crear-empresa | CreacionEmpresa | Solo dev |

## Flujo principal: Crear Reporte
1. Usuario sube archivos Excel (matriz + ventas) → se envian a API_GESTREPORT/subirArchivo
2. Se procesan via API_PROCESAR/LooperProcesFiles4
3. Resultado se guarda via API_GESTREPORT/guardarInforme
4. Dashboard lee los resultados via API_GESTDOC/listarReporteMateriales

## Stack tecnico
- React 18, React Router v6
- Vite como bundler
- Tailwind CSS (colores custom: primary, primary-light)
- Chart.js (react-chartjs-2) para graficos
- Lucide React + React Icons para iconos
- uuid para generar IDs

## Deploy
- Push a main → GitHub Actions → Azure Static Web App (automatico)
- Secret en GitHub: AZURE_STATIC_WEB_APPS_API_TOKEN_JOLLY_WAVE_05AAF690F
- Build: `npm run build` (output: dist/)

## Notas importantes
- CORS abierto (*) en todos los backends
- Todos los backends usan la misma BD MySQL en Azure
- Google Drive se usa como storage de archivos (no Azure Blob)
- Soft deletes en todas las tablas de archivos
