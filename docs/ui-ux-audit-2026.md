# PAES App - UI/UX Audit 2026

## Cambios aplicados ahora
- Se rediseñó la edición de metas en `Settings`:
  - Input numérico editable sin bloqueo por tecla.
  - Botones `+/-` por pasos.
  - Slider por prueba.
  - Presets rápidos (`650/700/750/800`).
- Se ajustó la foto de perfil:
  - Guardado automático al seleccionar imagen.
  - Mensajes de éxito/error visibles.
  - Compresión de imagen para reducir fallos por payload grande.
  - Guardado inmediato en `usuarios.picture` vía `updateProfile`.
- Se agregó manejo de error visible al guardar configuración general.

## Diagnóstico del problema de foto que no quedaba en BD
Hipótesis más probable por revisión de código:
1. El flujo anterior requería `Cargar foto` y luego `Guardar cambios`, no era automático.
2. Si fallaba el `update`, el error quedaba solo en consola (sin feedback en UI).
3. Con imágenes grandes, el payload en `picture` (base64 en `text`) puede ser rechazado o tardar más de lo esperado.

Mitigación implementada:
- Guardado inmediato de foto con feedback.
- Compresión y validación de tamaño antes de persistir.
- Bloqueo de acciones simultáneas mientras se procesa/guarda foto.

## Mejoras recomendadas (priorizadas)

### P0 - Impacto alto inmediato
- Normalizar encoding UTF-8 en textos (hay caracteres mojibake en varias vistas).
- Estandarizar feedback de errores async en todas las páginas (no solo console).
- Reemplazar iconografía emoji por un set único (Lucide/SVG) para consistencia visual.

### P1 - UX y accesibilidad
- Definir sistema de focus visible uniforme (teclado y lectores de pantalla).
- Revisar tamaño mínimo de target táctil y separaciones en controles densos.
- Mejorar semántica de formularios: mensajes inline, jerarquía y recuperación de errores.

### P2 - Performance y arquitectura UI
- Dividir rutas con `React.lazy`/`dynamic import` (bundle actual > 500 kB).
- Introducir tokens UI centralizados (espaciado, radio, sombras, tipografía, color).
- Implementar estados de carga consistentes (skeletons en vez de solo spinners).

## Tendencias actuales relevantes (2025-2026)
- **Diseño expresivo con sistema coherente** (Material 3 Expressive): mayor personalización visual, tipografía variable y motion intencional.
- **Patrones de accesibilidad más estrictos** (WCAG 2.2): foco no oculto, apariencia de foco y tamaños de objetivo.
- **Experiencias más fluidas y modernas** (Baseline 2025 / View Transitions, `@scope`, `content-visibility`).
- **Sistemas visuales “new look” por plataforma** (Apple Design: Liquid Glass, nuevos recursos y patrones de iconografía).
- **Heurísticas de usabilidad vigentes** (NN/g): visibilidad del estado, prevención y recuperación de errores, minimalismo útil.

## Fuentes
- Apple Design - What’s New / Liquid Glass: https://developer.apple.com/design/
- WCAG 2.2 (W3C Recommendation): https://www.w3.org/TR/WCAG22/
- Baseline 2025 (web.dev): https://web.dev/baseline/2025?hl=es-419
- NN/g Heuristics (actualizado 2024): https://www.nngroup.com/articles/ten-usability-heuristics/
- Material 3 Expressive (Android Developers): https://developer.android.com/design/ui/wear/guides/get-started/design-language?hl=it
