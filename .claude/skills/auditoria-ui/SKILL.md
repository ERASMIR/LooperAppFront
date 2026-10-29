---
name: auditoria-ui
description: Auditoría y mejora de la UI del front de LOOPER (UX, accesibilidad, calidad del código React y aspecto visual). Usar cuando la persona pida revisar, auditar o mejorar la interfaz, la experiencia de usuario, la accesibilidad, el contraste, el tamaño de letra o el código React de las pantallas. Coordina web-design-guidelines, vercel-react-best-practices y frontend-design con las reglas de estilo del proyecto.
---

# Auditoría de UI — LOOPER

Coordina tres skills (en `.claude/skills/`, origen y versión en `../README.md`):

| Orden | Skill | Mira | Pregunta que responde |
|---|---|---|---|
| 1 | `web-design-guidelines` | UX y accesibilidad | ¿Se puede usar bien? (teclado, foco, contraste, formularios, estados, textos) |
| 2 | `vercel-react-best-practices` | Código React | ¿Está bien hecho? (renders, efectos, estado, carga de datos, tamaño del bundle) |
| 3 | `frontend-design` | Aspecto visual | ¿Se ve limpio y ordenado? (jerarquía, espaciado, tipografía, consistencia) |

El orden importa: lo visual va al final para no maquillar problemas de uso o de código.

## Preferencias de la persona (mandan sobre las skills)

1. **Mantener el estilo de colores.** Verde de marca `primary` #00b86b, `primary-light` #ecfdf5, escala `neutral` y
   `warning` de `tailwind.config.js`; fuente Poppins. No se cambia la marca ni se agregan colores de acento nuevos.
2. **Limpio y ordenado es la prioridad.** Menos bordes, sombras, cajas y textos de relleno; alinear, agrupar y dar aire.
   Ante la duda, quitar (ver "Restraint" en `frontend-design`).
3. **Letra más chica.** A la persona le gusta cómo se ve la app con el navegador **al 80 %**; al 100 % la letra y los
   espacios se ven grandes. Buscar ese resultado al 100 % con un **ajuste global de escala** (p. ej. tamaño base en
   `html` ≈ 13–14 px, de modo que los `rem` de Tailwind escalen texto y espacios juntos) en vez de cambiar clases página
   por página. Es un cambio global: proponerlo con capturas antes/después al 100 % y aplicarlo solo con aprobación.
4. **Buen contraste y simplicidad.** Mínimo WCAG AA: 4,5:1 texto normal, 3:1 texto grande (≥ 18,7 px negrita) e íconos
   o bordes que informan. Datos medidos:
   - `#00b86b` sobre blanco ≈ **2,6:1 → no cumple** como texto ni como fondo de texto blanco (botones `bg-primary
     text-white`, textos `text-primary`). Propuesta a validar: un tono oscuro del **mismo verde** para texto y botones
     (≈ `#007f4a`, ≈ 5,1:1) como token `primary-dark`, dejando `#00b86b` para acentos, bordes e íconos grandes.
   - `neutral-400` / `gray-400` (#94a3b8) sobre blanco ≈ 2,6:1 → no usar para texto; `neutral-500` (#64748b) ≈ 4,8:1 sí.
   - Verificar siempre con números (fórmula de luminancia WCAG), no a ojo.

5. **Piezas comunes ya definidas (usarlas, no inventar otras):** botones `btn-principal` / `btn-secundario` /
   `btn-peligro` / `btn-peligro-borde` (+ `btn-chico`), `pestana` / `pestana-activa`, `chip` / `chip-activo` y `campo`
   en `src/index.css`; ventanas con `Componentes/Dialogo.jsx`; listados largos con `Componentes/Paginacion.jsx`;
   llamadas a la API con `src/config/apiCliente.js`.
6. **Cuadros de resumen (decisión 2026-10-29):** siempre con `Componentes/Indicador.jsx`, **un color por significado,
   igual en todos los módulos**: neutro (totales y contexto), correcto (procesado / válido / nuevo), cambio
   (modificado), atención (no cuenta o hay que revisar) y error (bloquea). Atención y error solo se colorean si el
   número es mayor que 0.

## Excepciones de las guías en LOOPER

- **Textos en español**, con mayúscula solo al inicio (no "Title Case" de Chicago). Puntos suspensivos con `…` en
  textos de la UI ("Cargando…"). Comillas: no es hallazgo.
- Fechas y números ya usan `toLocaleString("es-CL")` (Intl): correcto. Marcar formatos armados a mano.
- No aplican: modo oscuro, SSR/hidratación, safe areas de móviles con notch, video/GIF. Sincronizar estado con la URL
  es mejora menor (no prioritaria) salvo en filtros que la persona quiera compartir.
- React: ver la sección "Adaptación LOOPER" de `vercel-react-best-practices/SKILL.md` (SPA con Vite, sin Next.js).
- **Sin dependencias nuevas** (SWR, virtualización, librerías de UI) sin aprobación explícita.

## Alcance

Por defecto (decisión 2026-10-29), solo las pantallas nuevas y sus componentes:
- `src/Paginas/MatrizMateriales.jsx`, `RegistroVentas.jsx`, `ReportePeriodo.jsx`, `Empresas.jsx`
- `src/Componentes/CargaMasivaMatriz.jsx`, `CargaMasivaVentas.jsx`, `FormularioVenta.jsx`, `columnasTabla.jsx` y los
  módulos que usan (`useVistaTabla.js`, `ventasRevision.js`, `cargaMasivaRevision.js`)
- Lo común que las envuelve (`Header.jsx`, `Sidebar.jsx`, `Layout`, `index.css`, `tailwind.config.js`) solo en lo que
  afecte a esas pantallas. Las pantallas antiguas (Gestión Archivos, Dashboard, Soporte, …) quedan para otra ronda.

## Cómo auditar

1. Leer el código del alcance completo y **mirar cada pantalla en el navegador** (MCP `chrome-devtools`, front local
   `npx vite --config vite.config.local.js`, la persona inicia sesión): captura al 100 %, recorrer con teclado (Tab),
   revisar estados vacíos, de carga y de error, y ventanas modales.
2. Pasar las tres skills en orden. Cada hallazgo, una fila. Agrupar repeticiones ("12 botones solo-ícono sin
   aria-label en …") en vez de listar 12 filas.
3. Escribir el resultado en `../specs/004-auditoria-front/hallazgos.md` (workspace) con este formato y ordenar por
   prioridad (gravedad alta y esfuerzo bajo primero):

   | ID | Pantalla · archivo:línea | Skill · regla | Gravedad | Problema | Mejora propuesta | Esfuerzo | Estado |
   |---|---|---|---|---|---|---|---|
   | UX-01 | Registro de Ventas · `RegistroVentas.jsx:236` | web-design-guidelines · botón solo-ícono | Alta | … | … | Bajo | Propuesto |

   Prefijos: `UX-` (skill 1), `RC-` (skill 2), `VI-` (skill 3). Gravedad: **Alta** (impide o confunde el uso,
   accesibilidad básica, contraste que no cumple), **Media** (molesta o es inconsistente), **Baja** (pulido). Esfuerzo:
   Bajo (< 30 min), Medio (unas horas), Alto (rediseño de una parte).
4. Al inicio del archivo, un resumen corto: los 5–10 cambios de mayor impacto, en lenguaje simple, y las capturas.
5. **No cambiar código durante la auditoría.** Presentar el resumen a la persona y esperar su elección.

## Cómo implementar las mejoras aprobadas

- Rama `feature/auditoria-ui` (o la que indique la persona). Por tandas chicas, cada una con un tema (p. ej. "contraste
  de botones", "escala tipográfica", "accesibilidad de tablas").
- Cambios globales primero (tokens de color, escala de letra en `index.css` / `tailwind.config.js`) y con capturas
  antes/después; después los de cada pantalla. Preferir clases y componentes comunes existentes
  (`columnasTabla.jsx`, patrones de `Modal`) a copiar estilos.
- No cambiar comportamiento, textos de negocio ni llamadas a la API salvo que el hallazgo lo diga y esté aprobado.
- Verificar cada tanda: `npm run build`, `npm run lint` sin errores **nuevos**, prueba en navegador (consola y red sin
  errores) y captura. Actualizar la columna Estado (Hecho / Descartado / Pendiente) y `MEMORY.md`.
- Pregunta antes: tocar `vite.config.js`, `src/config/api.js`, dependencias nuevas o pantallas fuera del alcance.

## Pedidos típicos

- "Revisá la UI con web-design-guidelines y proponé mejoras de UX" → pasos 1–5 solo con la skill 1.
- "Auditoría completa del front" → las tres skills en orden.
- "Implementá UX-01 a UX-05" → sección "Cómo implementar".
