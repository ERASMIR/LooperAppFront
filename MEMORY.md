# MEMORY.md — LooperAppFront
Memoria del repo entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.
Lo transversal (BD, entorno, decisiones que cruzan servicios) va en `../MEMORY.md`.

## Estado actual
- 2026-10-16: clonado desde GitHub en `main` (commit `75dc8a2`), igual a producción. Sin cambios locales.
- Dependencias instaladas (`npm ci`). Dev local con `vite.config.local.js` (proxy a Functions locales).

## Decisiones (y por qué)
- (ninguna todavía)

## Aprendizajes y errores a evitar
- `npm run dev` usa el proxy a producción: usar siempre la config local.
- 2026-10-16: lint roto en `main` (config de ESLint 9 con ESLint 8 instalado). Arreglado en rama local `chore/fix-lint` (sin commit): eslint 9.36.0, @eslint/js 9.36.0, globals 16.4.0, eslint-plugin-react-hooks 5.2.0 en devDependencies.
- Lint reporta 36 problemas heredados (32 errores, 4 avisos): vars sin usar, `no-empty`, `hasOwnProperty`, deps de `useEffect`, `AuthContext` exporta no-componentes. Pendiente decidir si se corrigen.

- 2026-10-19 prueba en navegador (hallazgos, sin corregir):
  - `AuthContext` imprime el JWT completo en consola (`🔑 Guardando token`); hay más `console.log` de depuración.
  - Gestión Archivos: mientras carga muestra "No hay archivos registrados" o las filas de la pestaña anterior.
  - Todas las llamadas GET salen duplicadas (probable StrictMode en dev; confirmar en build).
  - Crear Reporte: los desplegables de archivos no distinguen nombres repetidos (sin fecha); años de carga solo 2024–2026.
  - Dashboard: el fondo del sidebar no llega al final de la página; avisos de React Router v7 (future flags).

- 2026-10-19 rama local `feature/matriz-ventas` (desde `main`, sin commit; arrastra los cambios de lint sin commitear):
  nuevas páginas `MatrizMateriales.jsx` (/matriz-materiales) y `RegistroVentas.jsx` (/registro-ventas), en el
  sidebar arriba de "Crear Reporte" (iconos Boxes / ShoppingCart). Por ahora solo encabezado + tarjeta "en construcción".
  Ajuste pedido (pendiente): un solo apartado "Matriz de Materiales"; desplegables con "+" que abren modal, solo admin.
  Plan en `../specs/001-matriz-materiales/plan-trabajo.md`. Orden: front (mock) → BD → back.

- 2026-10-20 borrador de Matriz de Materiales (solo front, datos simulados, sin commit, en `feature/matriz-ventas`):
  `src/Paginas/MatrizMateriales.jsx` (pestañas Listado / Crear nuevo producto, "+" con modal, adjunto único) y
  `src/data/catalogoGransicMock.js` (copia de materiales.json) + `src/data/matrizMaterialesMock.js`.
  Barra amarilla "Borrador" con selector de GRANSIC para revisar ReSimple/PROREP. Probado en navegador.
- Trampa: un `<fieldset>` tiene `min-width: min-content` y desborda la página; usar `min-w-0`.
- Entrar por URL directa a una ruta privada manda al login (PrivateRoute evalúa antes de leer localStorage): navegar por el sidebar.

- 2026-10-20 ajustes al borrador: composición visible desde el inicio (orden de la plantilla: componente, cantidad,
  peso kg, peso por unidad de venta = cantidad × peso, TON = /1000, [categoría PROREP], material, característica);
  característica Reutilizable / No reutilizable; botón "Carga masiva" desactivado arriba a la derecha.

- 2026-10-22 (T8.1/T8.3/T8.4): MatrizMateriales.jsx conectada a looper-materiales (`API_MATERIALES` en `src/config/api.js`,
  aprobado; proxy `/api-materiales` → 7074 en `vite.config.local.js`). Mocks y barra "Borrador" eliminados; GRANSIC viene de la empresa.
  Listado con Editar (formulario precargado, crea versión nueva; SKU con botón "Cambiar" + advertencia) y Eliminar (confirmación).
  El adjunto se sube después de guardar (base64). Probado en navegador con admin, REP (solo lectura) y dev (PROREP); build y lint OK.
- Pruebas en navegador sin contraseña: JWT de prueba (30 min) generado con el JWT_SECRET local y cargado en localStorage
  (`usuario` + `token`); luego navegar con `history.pushState` + `popstate` (la URL directa manda al login).

- 2026-10-23 (T8.9): sección "Información adicional" en el formulario (campos de texto de la empresa, opcionales), botones
  "Nuevo campo" y "Gestionar campos" (admin/dev), valores en el detalle del listado (también REP). Reactivar un campo en medio de
  una edición pasa su valor recuperado al formulario. Probado con admin y REP contra la API real.
- 2026-10-23 (T8.10): listado con columnas configurables (modal "Columnas", `localStorage` clave
  `looper.matriz.columnas.<usuarioId>.<empresaId>` con `{ visibles, anchos }`), ancho por arrastre (table-fixed + colgroup) y
  desplazamiento horizontal. Probado con admin y REP.

- 2026-10-26 (T8.5 parte A): `src/Componentes/CargaMasivaMatriz.jsx` (leer xlsx/xls/csv en el navegador, asignar columnas,
  vista previa de 10 en 10; asignación guardada en `looper.matriz.cargaMasiva.<usuarioId>.<empresaId>` por huella de encabezados).
  Característica obligatoria en ReSimple también en el formulario. Probado con los archivos de `../specs/001-matriz-materiales/pruebas-carga-masiva/`.
- Trampa: el Chrome de pruebas abría más alto que la pantalla (botones de las ventanas bajo la barra de tareas): ajustar con
  `resize_page` (p. ej. 1350×610) antes de revisar ventanas emergentes.
- Trampa: `sheet_to_json` parte en la primera fila con datos si la fila 1 está vacía; usar `range: 0`.
- Los JWT de prueba firmados con el secreto local ya no se permiten (bloqueado por el clasificador): la persona inicia sesión en el Chrome de pruebas.

- 2026-10-26 (T8.5 parte B, front): revisión en `src/Componentes/cargaMasivaRevision.js` (funciones puras) + pasos "revision" y
  "nuevos" en CargaMasivaMatriz. Guardado simulado en `guardarCargaMasiva` (MatrizMateriales.jsx) hasta tener el endpoint.
- Trampa: tras usar `upload_file` del MCP en una pestaña, Chrome no abre el selector de archivos al hacer clic a mano en
  esa pestaña (queda interceptado): para pruebas manuales, abrir otra pestaña.

- 2026-10-26 (T8.5/T8.11 conectados al back): sin vigencia; columna "Última actualización" (fecha, usuario, origen); campos con nivel
  producto/componente (columnas extra en la composición); sub categoría desde `gransic.subcategorias`; carga masiva real
  (`POST productos/cargaMasiva`, recarga catálogos y productos). Editar sin cambios → aviso, sin versión nueva. Probado en navegador.

## Próximos pasos
- Optimizar tiempos de la carga masiva (back) y fijar encabezado/barra horizontal del listado (idea anotada). Login real con contraseña: probarlo cuando la persona esté presente.

- 2026-10-27 (T9 fase 1, front simulado): `src/Paginas/RegistroVentas.jsx` (periodo mes/año, resumen, listado con búsqueda de
  50 en 50, historial de cargas), `src/Componentes/CargaMasivaVentas.jsx` + `ventasRevision.js` (RUT con DV, fechas dd/mm/aaaa
  o número de Excel, decimales solo a granel, cruce SKU + unidad con la Matriz real) y `src/data/registroVentasMock.js`
  (ventas en memoria; "a granel" simulado por nombre de unidad). Lectura de archivos y ventanas comunes extraídas de
  CargaMasivaMatriz a `cargaMasivaLectura.js` y `cargaMasivaComun.jsx` (la Matriz usa las mismas; re-probada OK). Probado en navegador 2026-10-27 con `../specs/002-registro-ventas/pruebas/`.
- 2026-10-27 (T9 conectado): RegistroVentas usa `API_VENTAS` (`/api-ventas` → 7076 en `vite.config.local.js`); mock eliminado.
  Matriz: la ventana "Nueva unidad de venta" pregunta "¿Se vende a granel?" (envía `aGranel`). Probado en navegador (dev).
  Corregido: una asignación recordada que apuntaba a un campo que ya no existe vuelve a proponer la columna (antes se perdía).
  Pendiente: gestionar campos de ventas (renombrar/eliminar; el endpoint existe), columnas configurables, RUT con puntos,
  marcar "a granel" en unidades existentes desde la UI (hoy solo al crear; el endpoint PUT existe).
- 2026-10-28 (T9.5a, T9.7 y T9.8 fase 1, front simulado): gestor de columnas común (`columnasTabla.jsx` + `useVistaTabla.js`,
  opción `oculta`), usado por la Matriz y Ventas. `FormularioVenta.jsx` (nueva/editar venta, sugerencia de razón social por RUT,
  crear campo adicional). Documentos Factura/Guía/Boleta/Pedido en `ventasRevision.js` (folio entero, al menos uno, venta repetida
  = error, `clasificarCoincidencias` para Combinar por documento, `revisarVentaManual`). `RegistroVentas.jsx`: acciones por fila
  (REP solo lo suyo), filas dudosas, "Última modificación", bloqueo del periodo; **`SIMULADO = true`** (quitar en la fase 4).
  Corregido: al cambiar rápido de periodo, una respuesta tardía pisaba la del periodo elegido. Pruebas: `../specs/002-registro-ventas/pruebas/03_*` y `04_*`.
- 2026-10-28 (T9.7/T9.8 conectado): sin `SIMULADO`. RegistroVentas usa POST/PUT/DELETE `ventas`, `ventas/revisarDocumentos`
  (formulario con espera de 400 ms y revisión de la carga) y `clientes` (sugerencia por RUT, 300 ms). Bloqueo real desde
  `GET ventas` (`bloqueado`). Probado en navegador (dic-2025, archivo `../specs/002-registro-ventas/pruebas/05_*`).
- 2026-10-28 (T8.6 fase 1, front simulado): `src/Paginas/ReportePeriodo.jsx` = nueva "Crear Reporte" (`/crear-reporte`):
  periodo → Procesar (vista previa con resumen y toneladas por material, filtros por categoría) → Confirmar (bloquea) /
  Eliminar reporte vigente (admin/dev, motivo). `SIMULADO = true` (toneladas ficticias, reporte en memoria). La pantalla
  anterior por archivos (`CrearReporte.jsx`) quedó en `/crear-reporte-archivos` solo para dev hasta validar.
- 2026-10-28: **corregido (con OK de la persona) error de producción: recargar la página cerraba la sesión.** `AuthContext.jsx`
  leía la sesión de localStorage en un `useEffect`, y `PrivateRoute` redirigía al login antes. Ahora se lee en el estado
  inicial. ReportePeriodo: historial de reportes (vigentes y eliminados) con "Ver".
- 2026-10-29 (T8.6 fase 4): ReportePeriodo conectado a looper-reportes, sin `SIMULADO`. `API_REPORTES` en `api.js` (OK de la
  persona) y `/api-reportes` → 7077 en `vite.config.local.js`. Vigente del periodo: `GET reportes?anio&mes` (con materiales);
  historial: `GET reportes?empresaId` (sin materiales: usa `toneladasTotal`; la ventana pide el detalle al abrirse).
  Sin el reporte guardado en la BD no hay bloqueo de ventas: por eso en la fase 1 el bloqueo "no funcionaba".
- 2026-10-29: `Paginas/Empresas.jsx` en `/empresas` (reemplaza `CreacionEmpresa.jsx`, borrado; `/crear-empresa` redirige):
  dev lista/crea/edita todas, admin edita la suya sin GRANSIC; usa `/api/empresas` de looper-usuarios (con JWT). Menú:
  "Empresas" (dev) / "Datos de la Empresa" (admin). ReportePeriodo: botón "Reporte ReSimple .xlsx" (descarga con fetch+blob,
  nombre desde Content-Disposition; errores junto al botón). Plan: `specs/003-reporte/plantilla-resimple.md`.
- 2026-10-30: Matriz: cuadro "Unidades de venta" → "Unidades de venta por producto (total)" (suma SKU+unidad, no tipos).
  `GestionUsuarios.jsx`: token en las llamadas, perfiles corregidos (1 admin, 2 REP, 3 dev; estaban 1/3 invertidos y editar
  cambiaba el perfil), empresa "Sin cambio" ya no la borra, casillas "Otras empresas con acceso" (T11, `PUT usuarioEmpresas`).
  `CreacionUsuario.jsx`: token, sin `console.log` que mostraba la contraseña, aviso si el correo existe (409). Publicar junto
  con looper-usuarios de la misma fecha (exige el token).
- 2026-10-30 (sin commit): auditoría UI cerrada salvo Gestión Archivos (sale del front en producción). Piezas comunes nuevas:
  `Componentes/EncabezadoPagina.jsx` (título en caja blanca con barra verde; `extra` a la derecha), clases `btn-icono`,
  `tarjeta`, `chip-etiqueta` (index.css), caché `config/cacheCatalogos.js` (invalidar al cambiar catálogos en la Matriz).
  Archivos divididos: `Componentes/matriz/`, `Componentes/reporte/`, `cargaMasiva*Comun.js`, `CargaMasiva*Revision.jsx`.
  Detalle en `../specs/004-auditoria-front/hallazgos.md`.
- 2026-10-30: "Validación ecológica" (`/validacion-ecologica`, maqueta sin funciones, datos de ejemplo con una empresa
  real) sacada del front: sin ruta en `App.jsx` (redirige a /inicio). `ValidEcologica.jsx` se conserva como referencia.
  Pendiente al pasar a producción: sacar también Gestión Archivos del front (decisión de la persona).
- 2026-10-30 (rama `feature/proyeccion`): módulo **Proyección** (`Paginas/Proyeccion.jsx`, `Componentes/proyeccion/`), conectado a
  looper-reportes (`/api/proyeccion`, `/api/proyecciones`); Excel en el navegador. Gestión Archivos fuera del menú y sin ruta.
