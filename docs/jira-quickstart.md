# Jira Quickstart (2 personas)

Objetivo: ordenar `paes-app-codex` sin meter burocracia. Jira para tareas y prioridades; lo demas (contenido/archivos) vive en el repo.

## 1) Crear el proyecto
1. Jira Software -> `Create project`
2. Plantilla: `Kanban`
3. Nombre sugerido: `PAES App`

## 2) Board minimal (columnas)
Columnas recomendadas (simple, sin overkill):
- `Backlog`
- `Ready`
- `In Progress`
- `In Review`
- `Blocked`
- `Done`

Regla practica:
- Solo mover a `Ready` cuando tenga criterios de aceptacion.
- WIP recomendado: max 2 tickets en `In Progress` por persona.

## 3) Tipos de issue (lo justo)
- `Epic`: objetivos grandes (1-2 semanas minimo).
- `Story`: funcionalidad para usuario.
- `Task`: trabajo interno (docs, refactor, setup).
- `Bug`: defecto con pasos de reproduccion.
- `Spike`: investigacion con salida concreta (decision + nota).

## 4) Componentes (para filtrar y asignar)
Crea Components:
- `content` (banco, explicaciones, feedback)
- `ux-copy` (textos UI, onboarding)
- `qa` (pruebas, casos, validacion)
- `frontend`
- `backend`
- `data` (DB, seeds, migraciones)
- `infra` (deploy, docker)

## 5) Labels (tagging rapido)
Usa labels para dimension PAES y estado del contenido:
- `paes-lectura`, `paes-m1`, `paes-m2` (o las que usen)
- `difficulty-easy|mid|hard` (si aplica)
- `needs-content`, `needs-acceptance`, `needs-design`

## 6) Definicion de Ready / Done (muy corta)
Ready:
- Problema claro + output esperado
- Criterios de aceptacion (checklist)
- Si depende de contenido, link al ticket de contenido o checklist de insumos

Done (para stories):
- Cumple criterios de aceptacion
- No rompe flujo base (smoke test)
- Si toca UI: textos revisados (microcopy)

## 7) Cadencia recomendada (2 personas)
- 2 veces por semana (15-20 min): grooming (ordenar Backlog -> Ready)
- Diario (5-10 min): "hoy hago X / bloqueos"
- Fin de semana (20 min): demo interna + decidir el proximo "vertical slice"

## 8) Reparto de trabajo sugerido
Persona dev:
- stories de implementacion, integraciones, data, infra

Persona fonoaudiologa:
- `content`, `ux-copy`, `qa`: taxonomias, feedback por error, explicaciones, pruebas desde perspectiva estudiante

Tip: que ella siempre deje "entregables pegables" (texto final, tabla, checklist, casos). Eso acelera tu parte.

