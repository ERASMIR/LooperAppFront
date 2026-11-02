# LooperAppFront — instrucciones del agente
Front React de LOOPER (Ley REP). Contexto general en `../CLAUDE.md`; detalle técnico en @agent.md.

## Comandos (desde esta carpeta)
- Dev **local**: `npx vite --config vite.config.local.js` → http://localhost:5173 (proxy a las Functions locales 7071/7072/7073/7075).
- 🚫 No usar `npm run dev`: su proxy (`vite.config.js`) apunta a las APIs de **producción**.
- Lint: `npm run lint` (ESLint 9; arreglado solo en la rama local `chore/fix-lint`, en `main` sigue roto) · Build: `npm run build` (salida `dist/`). No hay tests.

## Convenciones
- React 18 + React Router 6 + Tailwind (colores `primary`, `primary-light`) + Chart.js. Iconos: lucide-react / react-icons.
- Páginas en `src/Paginas/`, piezas comunes en `src/Componentes/`, URLs de API solo en `src/config/api.js`.
- Textos de UI en español. Imitar el estilo de la página más parecida antes de crear una nueva.

## Auditoría y mejoras de UI
- Skills en `.claude/skills/` (versionadas): entrada **`auditoria-ui`** (preferencias de la persona: mismos colores,
  limpio y ordenado, letra más chica como al 80 %, contraste AA, simple), que coordina `web-design-guidelines` (UX y
  accesibilidad) → `vercel-react-best-practices` (código) → `frontend-design` (visual). Hallazgos en
  `../specs/004-auditoria-front/hallazgos.md`. Auditar no cambia código; se implementa lo que la persona apruebe.

## Trampas conocidas
- **Push a `main` = deploy automático** a Azure Static Web Apps (GitHub Actions).
- `vite.config.local.js` es solo local (excluido en `.git/info/exclude`); no commitearlo ni copiar sus targets a `vite.config.js`.
- Sesión en `localStorage` (`token`, `user`); perfiles 1 admin, 2 usuarioREP, 3 dev (rutas dev en `PrivateRoute`).
- Las pantallas que suben archivos o crean tickets disparan subidas reales a Google Drive y correos reales (ver `../CLAUDE.md`).

## Límites
- ✅ Siempre: trabajar en rama `feature/<nombre>`; probar en local y en navegador antes de dar algo por terminado; actualizar `MEMORY.md`.
- ⚠️ Pregunta antes: dependencias nuevas, cambiar `vite.config.js`, `src/config/api.js` o el workflow de `.github/`.
- 🚫 Nunca: push/merge a `main`, tocar secretos del workflow, apuntar el front local a producción.

## Verificación
1. `npm run build` OK y `npm run lint` sin errores **nuevos** (hay 36 heredados, no tocarlos sin aprobación).
2. Con backends locales levantados: MCP `chrome-devtools` → abrir http://localhost:5173, login con usuario de prueba,
   recorrer la pantalla cambiada, `list_console_messages` sin errores y `list_network_requests` sin 4xx/5xx inesperados.
3. Captura (`take_screenshot`) de la pantalla final en el resumen de la tarea.

## Memoria
Lee `MEMORY.md` al empezar; actualízalo al terminar cada tarea (estado, decisiones con su porqué, errores a evitar).
