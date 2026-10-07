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

## Verificación
TypeScript, compilación Worker y pruebas de reglas de planificación. Se inspecciona la migración inicial y se comprueba su ejecución local. La vista supervisada no fue accesible en este entorno, por lo que queda pendiente la comprobación visual y de interacciones en navegador. La validación de WebMCP en navegador no estuvo disponible: ambos tools se registran solo cuando el contexto lo soporta.

## Desarrollo
Mantener `.openai/hosting.json`, identidad del Site, esquema Drizzle y migraciones. Las migraciones aplicadas no se reescriben. La publicación y credenciales son administradas por Sites. No guardar credenciales en el repositorio.


## Repositorio y aplicación

Código fuente principal: https://github.com/clcdavi/app-tracking

Aplicación publicada: https://enfoco-david.clcdavi.chatgpt.site

Esta importación parte de la versión publicada `d7acfbaff4ace23d496a936d0449dda2c87fb846`. GitHub aloja el código; la aplicación, autenticación y base de datos siguen en Sites. Subir un commit a GitHub no publica automáticamente una nueva versión. Los cambios futuros deben guardarse en este repositorio y publicarse por el flujo de Sites cuando corresponda.

## Ejecutar en desarrollo

Requiere Node.js >= 22.13 y pnpm. Desde la raíz:

```sh
pnpm install --frozen-lockfile
pnpm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_damp_elektra.sql
pnpm run dev
```

Aplicar la migración inicial una sola vez a cada base local nueva. La ejecución portátil usa el puerto indicado por el servidor y permite una identidad de prueba local en `/signin-with-chatgpt?return_to=/`. La autenticación real y las restricciones privadas las provee Sites al publicar; no hay credenciales reales en el repositorio.

Para revisar tipos y compilar:

```sh
pnpm exec tsc --noEmit
pnpm run build
```

No subir `.env`, bases locales, `node_modules`, salida de compilación ni claves. Se conserva `.openai/hosting.json` para identificar la aplicación existente y sus bindings lógicos: no contiene secretos. La importación excluye el caché generado de TypeScript.
