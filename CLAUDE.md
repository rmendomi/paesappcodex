# PAES App Codex — Contexto para Claude

## Proyecto
App de preparación para la PAES (Prueba de Acceso a la Educación Superior, Chile).
Estudiantes practican preguntas, ven su progreso, generan planes de estudio y compiten en ranking.

## Stack Exacto
- **Frontend**: React 18 + Vite 6 (JSX, sin TypeScript)
- **Estilos**: Tailwind CSS 3.4 + estilos inline con `style={{}}`
- **Auth + DB**: Supabase JS v2 (`@supabase/supabase-js`)
- **IA**: Google Apps Script (proxy) → Claude API o Gemini — variable `AI_PROVIDER` en `gas/Code.gs`
- **State**: React Context (`AuthContext`) — sin Redux ni Zustand
- **Router**: Ninguno — navegación por estado `view` en `App.jsx` + función `navigate(target, data?)`
- **Iconos**: `lucide-react`

## Estructura de Archivos Clave
```
src/
  App.jsx              # Router manual (view state), sidebar, topbar
  api.js               # Todas las llamadas a Supabase + lógica IA
  main.jsx             # Entry point, GoogleOAuthProvider, AuthProvider
  context/
    AuthContext.jsx    # Estado global: user, sessions, streak, planner, leaderboard
  lib/
    supabase.js        # Cliente Supabase con noopLock para compatibilidad extensiones
  data/
    catalogSource.js   # Banco estático de preguntas + catálogo exámenes/skills/universidades
    catalogData.js     # Re-export de catalogSource
  components/
    Sidebar.jsx        # Navegación lateral (desktop fijo, mobile overlay)
    Decor.jsx          # Elementos decorativos SVG
  pages/
    Landing.jsx        # Página pública inicial
    Login.jsx          # Login email/password + Google OAuth
    Register.jsx       # Registro con email verification
    Dashboard.jsx      # Panel principal del estudiante
    Exams.jsx          # Selección de examen + configuración de práctica
    Practice.jsx       # Motor de práctica (preguntas una a una)
    Results.jsx        # Resultados tras sesión de práctica
    Progress.jsx       # Progreso histórico por examen
    Proyecciones.jsx   # Proyección de puntaje PAES
    Planner.jsx        # Planificador semanal de estudio
    Leaderboard.jsx    # Ranking global de usuarios
    Settings.jsx       # Perfil y configuración de metas
    Calculator.jsx     # Calculadora de puntaje ponderado
    Universities.jsx   # Calculadora de admisión universitaria
gas/
  Code.gs              # Backend GAS: proxy AI, fallback Google Sheets
prisma/
  schema.prisma        # Schema Prisma (SQLite) — referencia de modelos, NO en uso en prod
```

## Base de Datos Supabase (PRODUCCIÓN)
Tablas activas:
- `usuarios` — PK: `email`. Campos: name, picture, school, grade_level, target_score, targets(jsonb), anio_nacimiento, situacion, region, colegio_id
- `sesiones` — PK: `id`. FK: user_email → usuarios. Campos: exam_id, mode, correct, total, score, date
- `streak` — PK: `user_email`. Campos: current, best, total_days, last_activity, history(jsonb)
- `planner` — PK: `user_email`. Campos: week_id, plan_id, progress(jsonb), updated_at
- `banco_ia` — PK: `id`. Preguntas generadas por IA. Campos: exam_id, skill_id, text, options(jsonb), correct(int), explanation, generado_por, veces_usada
- `preguntas_vistas` — UK: (user_email, question_id). Tracking de preguntas ya vistas por usuario
- `colegios` — Catálogo de colegios chilenos (id, nombre, comuna, tipo, region)
- `leaderboard` — RPC: `get_public_leaderboard(p_limit)` con fallback manual

RLS está **deshabilitado** (proyecto personal/educativo).

## Exámenes PAES
| id | Nombre | Total preguntas |
|----|--------|-----------------|
| `lectora` | Comprensión Lectora | 65 |
| `m1` | Matemática M1 | 65 |
| `m2` | Matemática M2 | 55 |
| `historia` | Historia y Cs. Soc. | 65 |
| `ciencias` | Ciencias | 80 |

## Flujo de Generación de Preguntas (api.js → generateQuestions)
1. Buscar preguntas no vistas en `banco_ia` (Supabase)
2. Si faltan → llamar GAS (`VITE_GAS_URL?action=generateQuestion&...`)
3. GAS llama a Claude/Gemini → devuelve JSON con preguntas
4. Guardar en `banco_ia` + marcar como vistas en `preguntas_vistas`

## Navegación (sin React Router)
```js
// En cualquier página hijo:
onNavigate('exams')                    // ir a exams
onNavigate('practice', { examId, skillId, count, mode })   // abrir práctica
onNavigate('results', resultData)      // mostrar resultados
```
`Practice` y `Results` se renderizan sin sidebar.
El resto usa `<Sidebar>` + `<main className="lg:ml-64">`.

## Auth (Supabase + Google OAuth)
- `supabase.auth.signUp/signInWithPassword/signInWithOAuth`
- `onAuthStateChange` en `AuthContext` maneja INITIAL_SESSION / SIGNED_IN / SIGNED_OUT
- Perfil extendido en tabla `usuarios` (no en Supabase Auth metadata)
- Google OAuth via `@react-oauth/google` → `api.getOrCreateUser()`

## Variables de Entorno (.env)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GAS_URL=          # URL del Web App de Google Apps Script
```

## Convenciones de Código
- Componentes en PascalCase, archivos `.jsx`
- Estilos: Tailwind clases + `style={{}}` inline para colores de marca exactos
- Paleta: `#0c1f3d` (dark), `#1d4ed8` (blue), `#f8faff` (bg)
- `useAuth()` hook para acceder a todo el estado global
- Funciones API siempre en `api.js` — nunca llamar Supabase directo desde páginas
- Errores: throw new Error(message) en api.js, catch en componentes con estado local

## Comandos
```bash
npm run dev      # Vite dev server
npm run build    # Build producción
npm run preview  # Preview del build
```

## GAS Backend
- Archivo: `gas/Code.gs`
- Desplegado como Web App (Ejecutar como: Yo, Acceso: Cualquier persona)
- Acción: `?action=generateQuestion&examId=...&skillId=...&count=...&userEmail=...`
- Proveedores soportados: `'claude'` | `'gemini'` (variable `AI_PROVIDER`)
- Spreadsheet de respaldo: `SS_ID` en Code.gs

## Notas Importantes
- `prisma/schema.prisma` es referencia de modelos pero la app usa Supabase, NO Prisma en prod
- El `noopLock` en `supabase.js` es intencional: evita conflicto con extensiones browser (MetaMask)
- Leaderboard tiene fallback manual si RPC `get_public_leaderboard` no existe (compatibilidad)
- XP score formula: `sessions * 100 + avgScore + streak * 10`
