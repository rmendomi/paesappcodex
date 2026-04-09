# Backlog Starter (orden desde el caos)

Si estan "en todos los modulos", el truco es elegir 1 vertical slice y hacerlo impecable.

Vertical slice recomendado (MVP):
1) Diagnostico rapido (pocas preguntas)
2) Practica: resolver pregunta (seleccionar alternativa)
3) Feedback inmediato (explicacion + por que las otras no)
4) Registro basico de progreso (aciertos/errores por habilidad)

## Epics sugeridos
EPIC A - Practica (resolver pregunta)
- Done: puedo responder preguntas de punta a punta sin quedarme atrapado, y queda registro.

EPIC B - Contenido y feedback
- Done: hay un set inicial de preguntas etiquetadas + explicaciones consistentes (formato unico).

EPIC C - Diagnostico + plan
- Done: al entrar, puedo hacer un mini diagnostico y me recomienda que practicar.

EPIC D - Progreso
- Done: veo mi avance (aciertos/errores) y se actualiza con cada respuesta.

EPIC E - Calidad (QA + microcopy)
- Done: flujo base probado, textos claros, errores visibles.

## Primer set de tickets (para cargar en Jira hoy)

### Para tu pareja (fonoaudiologa)
1. Task (content): "Definir taxonomia de habilidades (Lectura Critica)"
   - Entregable: lista de habilidades + definicion en 1 linea + ejemplos de error tipico.
   - Criterio: alguien externo puede clasificar 10 preguntas sin dudas mayores.

2. Task (content): "Formato estandar de explicacion"
   - Entregable: plantilla corta para: correcta / por que / por que no las otras (1-2 lineas c/u).
   - Criterio: todas las explicaciones caben en pantalla movil sin ser pared de texto.

3. Task (ux-copy): "Microcopy del flujo de practica"
   - Entregable: textos finales para: boton, feedback correcto/incorrecto, 'siguiente', vacio, error de red.
   - Criterio: tono consistente y directo; evita ambiguedades (ej: 'Continuar' vs 'Siguiente').

4. Task (qa): "Smoke test (checklist) del flujo base"
   - Entregable: checklist de 10-15 pasos que cualquier persona puede seguir para validar que todo anda.
   - Criterio: incluye al menos 3 casos negativos (sin internet, sin seleccionar alternativa, etc).

5. Task (content): "Set inicial de preguntas (ej: 30) + tags"
   - Entregable: preguntas + alternativas + respuesta + habilidad + dificultad + explicacion.
   - Criterio: cero ambiguedad en la alternativa correcta; explicacion consistente con la plantilla.

### Para ti (dev)
6. Spike (data): "Definir formato y pipeline del banco de preguntas"
   - Salida: decision (DB vs JSON/CSV vs Google Sheet) + pros/cons + 1 ejemplo real.
   - Criterio: la decision permite que tu pareja aporte sin tocar codigo (o con edicion minima).

7. Story (frontend/backend): "Resolver 1 pregunta end-to-end"
   - AC: renderiza pregunta + 4 alternativas, permite seleccionar, confirma, muestra feedback.
   - AC: guarda intento (correcta/incorrecta + habilidad) y se refleja en progreso.

8. Story (frontend): "Estado de carga y errores visibles"
   - AC: loading skeleton/spinner, error banner, reintentar.

9. Story (data): "Semilla de contenido (seed) para dev"
   - AC: comando/script para cargar preguntas de ejemplo al entorno dev.

10. Bug/Task (qa): "Registrar issues del smoke test"
   - AC: cada bug con pasos de reproduccion + esperado/actual + evidencia.

## Asignacion practica (para no friccionar)
- Ella toma tickets de `content|ux-copy|qa` y los deja con entregable pegable.
- Tu tomas `frontend|backend|data|infra`.
- Todo ticket debe tener 1 owner (no "los dos"); si hay dependencia, se linkea y listo.

