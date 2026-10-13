# Enfoco

Aplicación privada de organización personal para David. Primera versión enfocada en elegir qué hacer hoy, basada en la investigación previa del proyecto Seguimiento y sus respuestas de alcance.

## Producto
- Captura rápida en bandeja de entrada.
- Áreas: Personal, Trabajo, Estudio, Iglesia, Proyectos.
- Tareas con prioridad, duración, proyecto, notas, fecha planificada, fecha límite y próximo seguimiento.
- Mi día, Top 3, capacidad diaria ajustable y propuesta explicable por reglas.
- Revisión de próximos siete días, pendientes que necesitan atención, esperando y completadas.
- Guardado privado por identidad de ChatGPT en D1, con versión para detectar ediciones concurrentes.

## Decisiones
No se precargan tareas personales inventadas. El valor inicial de 120 minutos es ajustable por día; no presupone disponibilidad real. Las fechas se interpretan en Buenos Aires. El plan sugerido evita las tareas esperando y las planificadas a futuro, considera el tiempo ya asignado (incluyendo completadas) y conserva las tres prioridades elegidas hasta que el usuario las quite. Elegir manualmente puede exceder capacidad, con advertencia visible. Los seguimientos se muestran dentro de la aplicación, sin avisos externos.

## Límites de esta versión
Requiere conexión. No incluye notificaciones push, recurrencias, integración de calendario, modo offline ni cuentas compartidas. No es una aplicación nativa de iOS o macOS. Las sugerencias usan vencimiento, tarea en curso, prioridad y duración, sin modelo de IA. La API acepta hasta 2000 tareas y 2 MB por espacio. Las ediciones concurrentes producen un aviso: actualizar la vista antes de guardar nuevamente; el formulario permanece abierto.

## Integrar tareas desde otra API
En la aplicación, abrí **Conectar otra app** para crear una clave por integración, copiarla una sola vez y revocarla cuando quieras. Las claves se almacenan como hashes. El endpoint es `POST /api/integrations/tasks`; se autentica con `Authorization: Bearer <clave>` y acepta JSON con 1 a 50 tareas por solicitud (máximo 100 KB). Es una API para llamadas desde un servidor o automatizador, no desde JavaScript expuesto en un navegador.

```sh
curl -X POST 'https://enfoco-david.clcdavi.chatgpt.site/api/integrations/tasks' \
  -H 'Authorization: Bearer enf_live_TU_CLAVE' \
  -H 'Content-Type: application/json' \
  -d '{"tasks":[{"externalId":"orden-492","title":"Llamar al cliente","area":"Trabajo","priority":1,"minutes":20,"deadline":"2026-10-20"}]}'
```

`title` es obligatorio. `externalId` es opcional y debe ser estable y único dentro del sistema que envía: si se repite con la misma clave, Enfoco actualiza esa tarea en lugar de crear un duplicado. Sin `externalId`, cada solicitud crea una tarea nueva. Los campos opcionales incluyen `area` (Personal, Trabajo, Estudio, Iglesia o Proyectos), `project`, `notes`, `priority` (1–3), `minutes` (5–1440), `status` (inbox, todo, doing o waiting), `planDate`, `deadline` y `followUp` en formato `AAAA-MM-DD`. Los valores omitidos al actualizar se conservan. La respuesta devuelve cuántas tareas se crearon y actualizaron.

## Verificación
TypeScript, compilación Worker y pruebas de reglas de planificación. Se inspecciona la migración inicial y se comprueba su ejecución local. La vista supervisada no fue accesible en este entorno, por lo que queda pendiente la comprobación visual y de interacciones en navegador. La validación de WebMCP en navegador no estuvo disponible: ambos tools se registran solo cuando el contexto lo soporta.

## Desarrollo
Mantener `.openai/hosting.json`, identidad del Site, esquema Drizzle y migraciones. Las migraciones aplicadas no se reescriben. La publicación y credenciales son administradas por Sites. No guardar credenciales en el repositorio.
