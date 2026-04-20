# PAES App Codex

App web de preparación para la **PAES** (Prueba de Acceso a la Educación Superior, Chile). Permite a estudiantes practicar preguntas con IA, ver su progreso, planificar semanas de estudio y competir en un ranking global.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18.3 + Vite 6 (JSX, sin TypeScript) |
| Estilos | Tailwind CSS 3.4 + inline `style={{}}` |
| Auth + DB | Supabase (PostgreSQL + Google OAuth) |
| IA | Google Apps Script proxy → Claude API / Gemini |
| Estado global | React Context (`AuthContext`) |
| Navegación | Manual (`view` state en `App.jsx`, sin React Router) |
| Iconos | lucide-react |
| Despliegue | Docker multi-stage (dev Vite / prod Nginx) |

## Inicio rápido

```bash
npm install
cp .env.example .env   # completar variables (ver abajo)
npm run dev            # http://localhost:5173
```

### Variables de entorno requeridas (`.env`)

```env
VITE_GOOGLE_CLIENT_ID=...       # Google OAuth Client ID
VITE_SUPABASE_URL=...           # URL del proyecto Supabase
VITE_SUPABASE_ANON_KEY=...      # Anon key pública de Supabase
VITE_GAS_URL=...                # URL Web App de Google Apps Script (proxy IA)
```

## Comandos principales

```bash
npm run dev      # Dev server con hot reload
npm run build    # Build de producción → dist/
npm run preview  # Preview local del build
```

## Docker

```bash
# Desarrollo (hot reload)
docker compose --profile dev up --build

# Producción (Nginx en puerto 8080)
docker compose --profile prod up --build
```

Ver [DOCKER.md](DOCKER.md) para detalles.

## Estructura del proyecto

```
src/
  main.jsx              # Entry point
  App.jsx               # Router manual + layout
  api.js                # Toda la lógica Supabase + IA
  context/AuthContext.jsx
  lib/supabase.js       # Cliente con noopLock
  lib/progress.js       # Cálculo de estadísticas
  data/catalogSource.js # Banco estático de preguntas
  components/           # Sidebar, Decor
  pages/                # 18 páginas JSX (ver docs/)
gas/Code.gs             # Backend GAS (proxy IA)
supabase/functions/     # Edge Function alternativa
supabase_schema.sql     # Schema completo de la DB
supabase_*.sql          # Migraciones adicionales
docs/                   # Documentación técnica y de usuario
```

## Documentación

| Documento | Descripción |
|-----------|-------------|
| [CLAUDE.md](CLAUDE.md) | Contexto técnico para Claude Code |
| [DOCKER.md](DOCKER.md) | Guía de despliegue con Docker |
| [docs/technical-reference.md](docs/technical-reference.md) | Referencia técnica completa (DB, API, Auth, IA) |
| [docs/diagramas-arquitectura.md](docs/diagramas-arquitectura.md) | Diagramas Mermaid de arquitectura |
| [docs/guia-usuario.md](docs/guia-usuario.md) | Manual de usuario en español |
| [docs/ui-ux-audit-2026.md](docs/ui-ux-audit-2026.md) | Auditoría UI/UX y mejoras pendientes |

## Exámenes PAES soportados

| ID | Nombre | Preguntas |
|----|--------|-----------|
| `lectora` | Comprensión Lectora | 65 |
| `m1` | Matemática M1 | 65 |
| `m2` | Matemática M2 | 55 |
| `historia` | Historia y Cs. Sociales | 65 |
| `ciencias` | Ciencias Naturales | 80 |

## Base de datos

PostgreSQL en Supabase. 7 tablas principales: `usuarios`, `sesiones`, `streak`, `planner`, `banco_ia`, `preguntas_vistas`, `colegios`. RLS deshabilitado (proyecto educativo personal).

Ejecutar `supabase_schema.sql` en un proyecto Supabase nuevo para crear el schema completo.
