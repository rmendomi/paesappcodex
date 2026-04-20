# PAES App — Referencia Técnica

> Versión 0.2.0 · React 18 + Vite 6 + Supabase · Última actualización: 2026-04-18

---

## Tabla de contenidos

1. [Stack y dependencias](#1-stack-y-dependencias)
2. [Arquitectura general](#2-arquitectura-general)
3. [Estructura de archivos](#3-estructura-de-archivos)
4. [Base de datos (Supabase)](#4-base-de-datos-supabase)
5. [Capa API (`api.js`)](#5-capa-api-apijs)
6. [Estado global (`AuthContext`)](#6-estado-global-authcontext)
7. [Sistema de navegación](#7-sistema-de-navegación)
8. [Generación de preguntas con IA](#8-generación-de-preguntas-con-ia)
9. [Backend GAS (`gas/Code.gs`)](#9-backend-gas-gasCodegs)
10. [Cache y persistencia local](#10-cache-y-persistencia-local)
11. [Variables de entorno](#11-variables-de-entorno)
12. [Scripts de base de datos](#12-scripts-de-base-de-datos)
13. [Despliegue](#13-despliegue)

---

## 1. Stack y dependencias

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| Frontend | React | 18.3.1 |
| Build tool | Vite | 6.0.5 |
| Estilos | Tailwind CSS | 3.4.17 |
| Auth + DB | Supabase JS | 2.101.1 |
| Google OAuth | @react-oauth/google | 0.12.1 |
| Iconos | lucide-react | 0.468.0 |
| IA | Google Apps Script → Claude / Gemini | — |
| Lenguaje | JavaScript (JSX, sin TypeScript) | — |

**Sin React Router.** La navegación se implementa con estado local (`view` en `App.jsx`) + hash URL sincronizado.

---

## 2. Arquitectura general

```
┌─────────────────────────────────────────────────────────────────┐
│                         NAVEGADOR                               │
│                                                                 │
│  ┌──────────────┐    ┌─────────────────────────────────────┐   │
│  │  AuthContext │    │              App.jsx                │   │
│  │  (estado     │◄───│  view state · navigate() · Sidebar  │   │
│  │   global)    │    └──────────────┬──────────────────────┘   │
│  └──────┬───────┘                   │ React.lazy                │
│         │                  ┌────────┴────────┐                  │
│         │                  │   Páginas JSX   │                  │
│         │                  │ Dashboard Exams │                  │
│         │                  │ Practice Planner│                  │
│         │                  │ Settings ...    │                  │
│         │                  └────────┬────────┘                  │
│         │                           │                           │
│         │                  ┌────────▼────────┐                  │
│         │                  │    api.js        │                  │
│         │                  │ (capa única de  │                  │
│         │                  │  acceso a datos)│                  │
│         │                  └────┬───────┬────┘                  │
└─────────┼───────────────────────┼───────┼────────────────────────┘
          │                       │       │
          ▼                       ▼       ▼
   ┌──────────────┐    ┌──────────────┐  ┌───────────────────┐
   │  Supabase    │    │  Supabase    │  │  Google Apps      │
   │  Auth        │    │  PostgreSQL  │  │  Script (proxy IA)│
   │              │    │  (RLS off)   │  │  → Claude/Gemini  │
   └──────────────┘    └──────────────┘  └───────────────────┘
```

### Flujo de autenticación

```
Usuario abre app
      │
      ▼
onAuthStateChange (Supabase)
      │
      ├── INITIAL_SESSION ──► loadUserData(email)
      │                              │
      │                    ┌─────────▼──────────┐
      │                    │ 1. Hidratar cache   │
      │                    │    localStorage     │
      │                    │ 2. Fetch Supabase   │
      │                    │    (perfil + datos) │
      │                    │ 3. Actualizar cache │
      │                    └─────────────────────┘
      │
      ├── SIGNED_IN ────────► loadUserData(email)
      │
      └── SIGNED_OUT ───────► reset state → landing
```

---

## 3. Estructura de archivos

```
paes-app-codex/
├── src/
│   ├── main.jsx              # Entry point: GoogleOAuthProvider + AuthProvider
│   ├── App.jsx               # Router manual, Sidebar, TopBar, lazy loading
│   ├── api.js                # Todas las llamadas Supabase + proxy IA
│   ├── index.css             # Estilos globales Tailwind + animaciones
│   │
│   ├── lib/
│   │   ├── supabase.js       # Cliente Supabase con mutex lock
│   │   └── progress.js       # buildProgressStats, PROGRESS_MODE_OPTIONS
│   │
│   ├── context/
│   │   └── AuthContext.jsx   # Estado global: user, sessions, streak, planner
│   │
│   ├── data/
│   │   ├── catalogSource.js  # Banco estático de preguntas + catálogo exams/skills/unis
│   │   └── catalogData.js    # Re-export de catalogSource
│   │
│   ├── components/
│   │   ├── Sidebar.jsx       # Navegación lateral colapsable
│   │   └── Decor.jsx         # Elementos decorativos SVG
│   │
│   └── pages/
│       ├── Landing.jsx       # Página pública de entrada
│       ├── Login.jsx         # Login email/password + Google OAuth
│       ├── Register.jsx      # Registro con verificación de correo
│       ├── Onboarding.jsx    # Primer acceso: diagnóstico + configuración metas
│       ├── Dashboard.jsx     # Panel principal del estudiante
│       ├── Exams.jsx         # Selección de examen + modal de modo
│       ├── Practice.jsx      # Motor de práctica pregunta a pregunta
│       ├── Results.jsx       # Resultados tras sesión
│       ├── Progress.jsx      # Historial y gráficos de progreso
│       ├── Proyecciones.jsx  # Proyección de puntaje PAES
│       ├── Planner.jsx       # Planificador semanal IA + manual
│       ├── Settings.jsx      # Perfil, metas, foto de perfil
│       ├── Calculator.jsx    # Calculadora puntaje ponderado
│       ├── Universities.jsx  # Calculadora admisión + explorador universidades
│       ├── Leaderboard.jsx   # Ranking global por racha/puntaje
│       ├── AdminDashboard.jsx
│       ├── AdminUsuarios.jsx
│       ├── AdminPreguntas.jsx
│       └── AdminSesiones.jsx
│
├── gas/
│   └── Code.gs              # Backend GAS: proxy IA, fallback Sheets
│
├── docs/                    # Esta documentación
├── supabase_schema.sql      # Schema completo de tablas
├── supabase_*.sql           # Migraciones y seeds específicos
├── .env                     # Variables de entorno (no en git)
├── vite.config.js
└── tailwind.config.js
```

---

## 4. Base de datos (Supabase)

> RLS está **deshabilitado** en todas las tablas (proyecto personal/educativo).

### Diagrama de tablas

```
usuarios (PK: email)
├── email          TEXT
├── name           TEXT
├── picture        TEXT        ← data URL base64 (320×320 max)
├── school         TEXT
├── grade_level    TEXT
├── target_score   INTEGER
├── targets        JSONB       ← { lectora: 700, m1: 700, ... }
├── anio_nacimiento INTEGER
├── situacion      TEXT
├── region         TEXT
├── colegio_id     INTEGER     → colegios.id
├── objetivo_principal    JSONB
├── objetivos_secundarios JSONB[]
├── diagnostico_completado BOOLEAN
└── onboarding_completado  BOOLEAN

sesiones (PK: id)
├── id              TEXT
├── user_email      TEXT        → usuarios.email
├── exam_id         TEXT        ← lectora | m1 | m2 | historia | ciencias
├── mode            TEXT        ← practice | ai_practice | exam | skill | diagnostic
├── correct         INTEGER
├── total           INTEGER
├── score           INTEGER     ← escala 100–1000
├── skill_id        TEXT        ← habilidad practicada (modo skill)
├── question_ids    JSONB[]     ← IDs de preguntas en la sesión
├── wrong_ids       JSONB[]     ← IDs de preguntas respondidas mal
├── security_events JSONB[]     ← eventos de integridad académica
├── security_warnings INTEGER   ← contador de advertencias
└── date            TIMESTAMP

streak (PK: user_email)
├── user_email     TEXT        → usuarios.email
├── current        INTEGER
├── best           INTEGER
├── total_days     INTEGER
├── last_activity  DATE
└── history        JSONB       ← { "2026-04-18": true, ... }

planner (PK: user_email)
├── user_email     TEXT        → usuarios.email
├── week_id        TEXT        ← "2026-W16"
├── plan_id        TEXT        ← "standard" | "intensive" | "light" | "custom" | "ai"
├── progress       JSONB       ← { "0-0": true, "1-2": false, ... }
├── plan_content   JSONB       ← contenido del plan (días y sesiones)
└── updated_at     TIMESTAMP

banco_ia (PK: id)
├── id             TEXT
├── exam_id        TEXT
├── skill_id       TEXT
├── text           TEXT
├── options        JSONB       ← array de 4–5 opciones
├── correct        INTEGER     ← índice 0-based
├── explanation    TEXT
├── generado_por   TEXT        ← "claude" | "gemini"
└── veces_usada    INTEGER

preguntas_vistas (UK: user_email + question_id)
├── user_email     TEXT
└── question_id    TEXT

colegios (PK: id)
├── id             INTEGER
├── nombre         TEXT
├── comuna         TEXT
├── tipo           TEXT
└── region         TEXT

leaderboard (RPC)
└── get_public_leaderboard(p_limit) → tabla virtual de ranking
```

### Fórmula de puntaje XP (leaderboard)
```
xp = sesiones_count * 100 + avg_score + racha_actual * 10
```

---

## 5. Capa API (`api.js`)

Todas las llamadas a Supabase y al proxy IA pasan por `api.js`. **Nunca llamar Supabase directamente desde páginas.**

### Funciones principales

| Función | Descripción |
|---------|-------------|
| `getUserProfile(email)` | Obtiene perfil de `usuarios` |
| `getUserData(email)` | Obtiene `{ sessions, streak, planner }` de una vez |
| `createUserProfile({...})` | Inserta nuevo usuario en `usuarios` |
| `updateProfile({email, ...})` | Actualiza campos de perfil (upsert) |
| `saveSession(sessionData)` | Inserta en `sesiones` |
| `updateStreak(email, streak)` | Upsert en `streak` |
| `savePlannerWithContent(...)` | Upsert en `planner` con plan_content |
| `generateQuestions({examId, skillId, count, userEmail})` | Flujo completo de generación |
| `saveObjetivos(email, principal, secundarios)` | Guarda objetivos académicos |
| `saveDiagnostico(email, resultados)` | Guarda resultados de diagnóstico inicial |
| `completeOnboarding(email)` | Marca onboarding como completado |
| `getLeaderboard()` | RPC o fallback manual |
| `getUniversidades()` | Catálogo de universidades del `catalogData` |
| `getCarrerasByUniversidad(uniId)` | Carreras filtradas por universidad |
| `getColegiosByRegion(region)` | Busca colegios en `colegios` por región |
| `generateStudyPlan({...})` | Llama GAS para generar plan IA |

### Flujo de generación de preguntas

```
generateQuestions(examId, skillId, count, userEmail)
│
├── 1. Buscar en banco_ia (no vistas por userEmail)
│       SELECT * FROM banco_ia
│       WHERE exam_id = ? AND skill_id = ?
│       AND id NOT IN (SELECT question_id FROM preguntas_vistas WHERE user_email = ?)
│       LIMIT count
│
├── 2. Si faltan preguntas → callGASForQuestions()
│       fetch(VITE_GAS_URL + ?action=generateQuestion&...)
│       AbortController 30s timeout
│       → GAS → Claude/Gemini → JSON array
│
├── 3. Guardar preguntas nuevas en banco_ia
│
├── 4. Marcar todas como vistas en preguntas_vistas
│
└── 5. Retornar { questions: [...] }
```

---

## 6. Estado global (`AuthContext`)

El contexto expone el siguiente estado y funciones:

### Estado

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `user` | Object | Perfil completo del usuario |
| `sessions` | Array | Historial de sesiones de práctica |
| `streak` | Object | `{ current, best, totalDays, lastActivity, history }` |
| `planner` | Object | `{ weekId, planId, progress, planContent, generatedBy }` |
| `leaderboard` | Array | Ranking global |
| `authLoading` | Boolean | `true` mientras Supabase verifica la sesión inicial |
| `progressStats` | Object | Derivado con `useMemo` desde `sessions` via `buildProgressStats()` |
| `recentActivity` | Array | Últimas 5 sesiones (derivado) |
| `isAdmin` | Boolean | `user?.role === 'admin'` |

### Funciones expuestas

| Función | Descripción |
|---------|-------------|
| `login({ email, password })` | `signInWithPassword` |
| `logout()` | Limpia cache + `signOut` |
| `register({ email, password, ... })` | `signUp` + crear perfil |
| `resetPassword(email)` | Envía email de reset |
| `updateProfile(data)` | Actualiza perfil en Supabase + estado local |
| `saveSession(sessionData)` | Guarda sesión + actualiza streak |
| `savePlannerProgress(weekId, planId, progress, content)` | Persiste estado del planner |
| `saveObjetivos(principal, secundarios)` | Guarda objetivos académicos |
| `saveDiagnostico(resultados)` | Guarda diagnóstico inicial |
| `completeOnboarding()` | Marca onboarding como hecho |
| `fetchLeaderboard()` | Carga el ranking desde API |

### Mutex de Supabase (`supabase.js`)

El cliente usa un mutex en memoria para serializar los refreshes de token y evitar la race condition "Invalid Refresh Token" que ocurre cuando extensiones del navegador (MetaMask, etc.) disparan múltiples requests simultáneos:

```js
// Todos los refreshes pasan por una cola FIFO
const safeLock = (name, timeout, fn) => {
  if (!_locked) { _locked = true; return Promise.resolve().then(fn).finally(_release); }
  return new Promise(resolve => _queue.push(() => { ... }));
};
```

---

## 7. Sistema de navegación

Sin React Router. La navegación se basa en el estado `view` de `App.jsx` y la función `navigate(target, data?)`.

### Vistas disponibles

| `view` | Componente | Sidebar |
|--------|-----------|---------|
| `landing` | Landing | No |
| `login` | Login | No |
| `register` | Register | No |
| `onboarding` | Onboarding | No |
| `practice` | Practice | No |
| `results` | Results | No |
| `dashboard` | Dashboard | Sí |
| `exams` | Exams | Sí |
| `progress` | Progress | Sí |
| `proyecciones` | Proyecciones | Sí |
| `settings` | Settings | Sí |
| `calculator` | Calculator | Sí |
| `universities` | Universities | Sí |
| `planner` | Planner | Sí |
| `leaderboard` | Leaderboard | Sí |
| `admin` | AdminDashboard | Sí |
| `admin-usuarios` | AdminUsuarios | Sí |
| `admin-preguntas` | AdminPreguntas | Sí |
| `admin-sesiones` | AdminSesiones | Sí |

### Hash URL

Cada vez que se navega a una página con sidebar, se sincroniza el hash de la URL:

```js
history.replaceState(null, '', `#dashboard`)
```

Esto permite compartir links directos y sobrevivir recargas. Al montar la app, si hay un hash válido se usa como destino post-auth.

### Cómo navegar desde un componente hijo

```jsx
// Ir a una página
onNavigate('exams')

// Ir a práctica con datos
onNavigate('practice', {
  examId: 'lectora',
  questions: [...],
  mode: 'practice',
  skillId: 'localizar',
  skillName: 'Comprensión Lectora · Localizar'
})

// Ir a resultados
onNavigate('results', resultData)
```

---

## 8. Generación de preguntas con IA

### Banco estático (`catalogSource.js`)

Banco de preguntas hardcodeado organizadas por examen y habilidad. Sirve de fallback y seed inicial. Estructura:

```js
questionsBySkill = {
  lectora: {
    localizar:   [{ id, text, options, correct, explanation, skill }],
    interpretar: [...],
    evaluar:     [...]
  },
  m1: { resolver, modelar, representar, argumentar },
  m2: { resolver, modelar, representar, argumentar },
  historia: { temporal, fuentes, critico },
  ciencias: { observar, planificar, procesar, evaluar, comunicar }
}
```

### Banco dinámico (`banco_ia`)

Preguntas generadas por IA y almacenadas en Supabase. Se evita repetir preguntas ya vistas via la tabla `preguntas_vistas`.

### Prompt de generación

```
Eres un experto evaluador de la PAES chilena.
Tu tarea: generar N preguntas de "{exam.name}".
Habilidad objetivo: "{skill.description}".
{exam.instructions}

FORMATO: array JSON con { text, options, correct (int 0-based), skill, explanation }
```

### Proveedores IA (GAS)

Configurar `AI_PROVIDER` en `gas/Code.gs`:
- `'claude'` → Anthropic Claude (requiere `CLAUDE_API_KEY` en propiedades del script)
- `'gemini'` → Google Gemini (usa credenciales de servicio GCP)

---

## 9. Backend GAS (`gas/Code.gs`)

Desplegado como **Web App** en Google Apps Script. Actúa como proxy entre el frontend y las APIs de IA para no exponer API keys en el cliente.

### Endpoints

```
GET ?action=generateQuestion
    &examId=lectora
    &skillId=localizar
    &count=10
    &userEmail=usuario@mail.com
```

### Despliegue

1. Abrir [script.google.com](https://script.google.com) → Nuevo proyecto
2. Pegar el contenido de `gas/Code.gs`
3. **Extensiones → Apps Script** (si desde una Hoja de Cálculo)
4. **Implementar → Nueva implementación → Aplicación web**
   - Ejecutar como: **Yo** (tu cuenta Google)
   - Acceso: **Cualquier persona**
5. Copiar URL del Web App → asignarla a `VITE_GAS_URL` en `.env`
6. En **Propiedades del script**: añadir `CLAUDE_API_KEY` (si se usa Claude)

---

## 10. Cache y persistencia local

### Cache `localStorage`

Al cargar datos del usuario, `AuthContext` guarda una copia en `localStorage` con TTL de 10 minutos:

```
clave:  paes_cache_{email}
valor:  { data: { user, sessions, streak, planner }, ts: timestamp }
```

Al recargar la app, la UI se hidrata instantáneamente desde el cache mientras se obtienen datos frescos de Supabase en segundo plano.

El cache se limpia automáticamente al hacer logout.

### Planner

El progreso de checkboxes y el contenido del plan se guardan en Supabase (`planner`). El estado local se sincroniza con el contexto. Las ediciones del plan personalizado tienen un debounce de 800ms para evitar escrituras excesivas.

---

## 11. Variables de entorno

Archivo `.env` en la raíz del proyecto (no incluido en git):

```env
VITE_GOOGLE_CLIENT_ID=...           # Google OAuth Client ID
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_GAS_URL=https://script.google.com/macros/s/.../exec
```

> Todas las variables deben empezar con `VITE_` para que Vite las exponga al cliente.

---

## 12. Scripts de base de datos

| Archivo | Uso |
|---------|-----|
| `supabase_schema.sql` | Schema completo — ejecutar en DB nueva |
| `supabase_auth_update.sql` | Ajustes de configuración Auth |
| `supabase_banco_ia_update.sql` | Migraciones de `banco_ia` |
| `supabase_leaderboard_rpc_fix.sql` | Crea la RPC `get_public_leaderboard` |
| `supabase_planner_mejoras.sql` | Agrega columna `plan_content` a `planner` |
| `supabase_reset_completo.sql` | **DESTRUCTIVO** — borra y recrea todo |
| `supabase_seed_universidades.sql` | Seed de universidades y carreras |
| `supabase_security_migration.sql` | Agrega columnas de integridad académica a `sesiones` |

### Ejecutar en Supabase

1. Ir a **SQL Editor** en el dashboard de Supabase
2. Pegar el contenido del archivo `.sql`
3. Ejecutar

---

## 13. Despliegue

### Desarrollo local

```bash
# Instalar dependencias
npm install

# Crear .env con las variables de entorno

# Iniciar servidor de desarrollo
npm run dev
# → http://localhost:5173
```

### Build de producción

```bash
npm run build
# Genera dist/ con assets chunkeados por página (code splitting)

npm run preview
# Sirve el build localmente para verificar
```

### Docker

```bash
# Desarrollo (Vite con hot reload en :5173)
docker compose --profile dev up --build

# Producción (Nginx en :8080)
docker compose --profile prod up --build -d
```

El `Dockerfile` es multi-stage (base → dev → build → prod). El `docker-compose.yml` define dos perfiles: `dev` y `prod`. Ver [DOCKER.md](../DOCKER.md) para detalles.

### Tamaños de bundle (build actual)

| Chunk | Tamaño (gzip) |
|-------|--------------|
| `index.js` (core + Supabase) | ~128 KB |
| `Settings.jsx` | ~6.6 KB |
| `Planner.jsx` | ~6.4 KB |
| `Onboarding.jsx` | ~5.8 KB |
| `Progress.jsx` | ~5.5 KB |
| Resto de páginas | < 5 KB c/u |

---

## Apéndice: Paleta de colores

| Token | Valor | Uso |
|-------|-------|-----|
| `#0c1f3d` | Azul oscuro | Texto principal, backgrounds dark |
| `#1d4ed8` | Azul primario | CTAs, links, acentos |
| `#f8faff` | Fondo | Background general de la app |
| `#f97316` | Naranja | Streak, gamificación |
| `#10b981` | Verde | Éxito, puntajes sobre meta |
| `#ef4444` | Rojo | Error, puntajes bajo meta |
| `#7c3aed` | Violeta | IA, planner IA |
| `#f59e0b` | Amarillo | Advertencias, meta personal |
