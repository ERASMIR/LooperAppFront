# Skills del front (Claude Code)

Se cargan solas al trabajar en `LooperAppFront`. Punto de entrada: **`auditoria-ui`** (reglas de LOOPER, orden y
flujo). Versionadas en el repo de respaldo `prueba-LooperAppFront` (decisión 2026-10-29).

| Skill | Origen | Versión (commit) | Licencia | Cambios locales |
|---|---|---|---|---|
| `auditoria-ui` | propia (LOOPER) | — | — | — |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) `skills/frontend-design` | `41bbe19` | Apache 2.0 (`LICENSE.txt`) | sección "Adaptación LOOPER" al final de `SKILL.md` |
| `vercel-react-best-practices` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/react-best-practices` | `1a2c79d` | MIT (declarada en su `SKILL.md`; el repo no declara licencia general) | sección "Adaptación LOOPER" al final de `SKILL.md` |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/web-design-guidelines` | `1a2c79d` | no declarada (repo público de Vercel) | lee `guidelines.md` local en vez de descargarlo |
| ↳ `guidelines.md` | [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) `command.md` | `434b7f9` | MIT | copia sin cambios |

Descargadas y revisadas el 2026-10-29: solo Markdown y JSON (sin scripts). Para actualizarlas: volver a bajar los
archivos de esos repos, revisarlos completos y conservar las secciones "Adaptación LOOPER".
