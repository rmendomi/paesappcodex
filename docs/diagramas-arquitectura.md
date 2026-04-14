# Diagramas de Arquitectura — paes-app-codex

> Renderizar con VS Code (extensión Markdown Preview Mermaid Support), GitHub, o Obsidian.

---

## 1. Arquitectura General

```mermaid
graph TB
    subgraph Browser
        APP[App.jsx<br/>view state + navigate]
        AUTH[AuthContext<br/>user/sessions/streak/planner]
        API[api.js<br/>Supabase calls + AI logic]
        LIB[supabase.js<br/>client con noopLock]
        CAT[catalogSource.js<br/>banco estático de preguntas]
    end

    subgraph Supabase
        SBAUTH[Supabase Auth<br/>email + Google OAuth]
        DB[(PostgreSQL<br/>usuarios/sesiones<br/>streak/planner<br/>banco_ia)]
    end

    subgraph Google
        GAS[Apps Script<br/>Web App proxy]
        CLAUDE[Claude API]
        GEMINI[Gemini API]
    end

    APP --> AUTH
    AUTH --> API
    API --> LIB
    LIB --> SBAUTH
    LIB --> DB
    API --> CAT
    API --> GAS
    GAS --> CLAUDE
    GAS --> GEMINI
    GAS --> DB
```

---

## 2. Flujo de Navegación (sin React Router)

```mermaid
stateDiagram-v2
    [*] --> landing
    landing --> login
    landing --> register
    login --> dashboard : auth ok
    register --> login
    dashboard --> exams
    dashboard --> progress
    dashboard --> proyecciones
    dashboard --> planner
    dashboard --> leaderboard
    dashboard --> settings
    dashboard --> calculator
    dashboard --> universities
    exams --> practice : configura sesión
    practice --> results : termina práctica
    results --> exams
    results --> dashboard
```

---

## 3. Esquema de Base de Datos (Supabase)

```mermaid
erDiagram
    usuarios {
        text email PK
        text name
        text picture
        text school
        text grade_level
        int target_score
        jsonb targets
        text anio_nacimiento
        text situacion
        text region
        text colegio_id
        timestamptz created_at
        timestamptz last_login
    }
    sesiones {
        text id PK
        text user_email FK
        text exam_id
        text mode
        int correct
        int total
        int score
        timestamptz date
    }
    streak {
        text user_email PK_FK
        int current
        int best
        int total_days
        text last_activity
        jsonb history
    }
    planner {
        text user_email PK_FK
        text week_id
        text plan_id
        jsonb progress
        timestamptz updated_at
    }
    banco_ia {
        text id PK
        text exam_id
        text skill_id
        text text
        jsonb options
        int correct
        text explanation
        text generado_por
        int veces_usada
    }
    preguntas_vistas {
        text user_email FK
        text question_id FK
        text exam_id
        text skill_id
        bool fue_correcta
    }
    colegios {
        text id PK
        text nombre
        text comuna
        text tipo
        text region
    }

    usuarios ||--o{ sesiones : "user_email"
    usuarios ||--o| streak : "user_email"
    usuarios ||--o| planner : "user_email"
    usuarios ||--o{ preguntas_vistas : "user_email"
    banco_ia ||--o{ preguntas_vistas : "question_id"
```

---

## 4. Flujo de Generación de Preguntas IA

```mermaid
sequenceDiagram
    participant P as Practice.jsx
    participant A as api.js
    participant DB as Supabase banco_ia
    participant GAS as Apps Script
    participant AI as Claude/Gemini

    P->>A: generateQuestions(examId, skillId, count)
    A->>DB: getBancoQuestions() — no vistas
    DB-->>A: preguntas del banco (0-N)
    alt faltan preguntas
        A->>GAS: ?action=generateQuestion&count=missing
        GAS->>AI: prompt PAES estilo
        AI-->>GAS: JSON array preguntas
        GAS-->>A: { questions: [...] }
        A->>DB: saveToBancoIA()
    end
    A->>DB: markQuestionsAsSeen()
    A-->>P: { questions, fromBanco, fromAI }
```

---

## 5. AuthContext — Estado Global

```mermaid
graph LR
    AC[AuthContext]

    AC -->|expone| U[user<br/>email, name, picture<br/>school, targets]
    AC -->|expone| S[sessions[]<br/>historial de práctica]
    AC -->|expone| ST[streak<br/>current, best, totalDays]
    AC -->|expone| PL[planner<br/>weekId, planId, progress]
    AC -->|expone| LB[leaderboard[]]
    AC -->|computed| PS[progressStats<br/>por examen: attempted/correct/trend]
    AC -->|computed| RA[recentActivity<br/>últimas 5 sesiones]

    AC -->|métodos| M1[login / logout / register]
    AC -->|métodos| M2[saveSession]
    AC -->|métodos| M3[updateProfile]
    AC -->|métodos| M4[savePlannerProgress]
    AC -->|métodos| M5[fetchLeaderboard]
```

---

## 6. Estructura de Componentes por Página

```mermaid
graph TD
    APP[App.jsx]

    APP --> PUB[Páginas Públicas<br/>sin sidebar]
    PUB --> LAN[Landing.jsx]
    PUB --> LOG[Login.jsx]
    PUB --> REG[Register.jsx]

    APP --> FLOW[Flujo Práctica<br/>full-screen]
    FLOW --> PRA[Practice.jsx]
    FLOW --> RES[Results.jsx]

    APP --> PORT[Portal Estudiante<br/>con Sidebar]
    PORT --> SB[Sidebar.jsx]
    PORT --> DB[Dashboard.jsx]
    PORT --> EX[Exams.jsx]
    PORT --> PR[Progress.jsx]
    PORT --> PRO[Proyecciones.jsx]
    PORT --> PL[Planner.jsx]
    PORT --> LB[Leaderboard.jsx]
    PORT --> SET[Settings.jsx]
    PORT --> CA[Calculator.jsx]
    PORT --> UN[Universities.jsx]
```
