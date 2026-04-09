# Docker - PAES App

## Requisitos
- Docker Desktop instalado y corriendo.

## 1) Desarrollo (hot reload)
```bash
docker compose --profile dev up --build
```

URL:
- http://localhost:5173

Detener:
```bash
docker compose --profile dev down
```

## 2) Producción local (build + Nginx)
```bash
docker compose --profile prod up --build
```

URL:
- http://localhost:8080

Healthcheck:
- `GET /health`

Detener:
```bash
docker compose --profile prod down
```

## Variables de entorno
- El build de producción usa estas variables:
  - `VITE_GOOGLE_CLIENT_ID`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_GAS_URL`
- Se leen desde tu `.env` local (docker compose interpolation).

## Notas
- En producción, Vite inyecta variables en **build time**.
- Si cambias variables `VITE_*`, reconstruye:
  - `docker compose --profile prod up --build`
