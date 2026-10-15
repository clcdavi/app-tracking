# Enfoco

Aplicación de organización personal y planificación consciente del día a día para David. Enfocada en elegir qué hacer hoy sin sobrecarga cognitiva, respetando la capacidad diaria en minutos, priorizando con un **Top 3** claro y capturando pendientes al instante mediante **Telegram (con IA y notas de voz)** y **API REST**.

---

## ✨ Funcionalidades Principales

* 🎯 **Planificación Consciente & Top 3**:
  * Selección diaria de hasta 3 prioridades clave con estrellas (`⭐`).
  * Cálculo de presupuesto diario en minutos (`daily_budget`) para no saturar tu jornada.
  * Puntuación inteligente (`planner.score`) para sugerir qué tareas encarar según vencimiento, urgencia y estado.
* 🤖 **Bot de Telegram con IA y Notas de Voz**:
  * **Captura en lenguaje natural**: Escribí *"Llamar a Juan mañana 30m #trabajo !alta"* y el bot lo procesa y clasifica automáticamente.
  * **Notas de voz (`🎙️`)**: Enviá un audio hablando libremente; Gemini transcribe e interpreta la tarea, fecha, duración y área de vida.
  * **Ajustes conversacionales en vivo**: Podés pedirle cambiar área, fecha o duración sobre la marcha (*«Guardalo en proyectos»*, *«Ponelo para hoy»*, *«Que dure 45 min»*).
  * **Acciones interactivas de un toque**: Cada tarea guardada incluye botones inline (`[✅ Completar]`, `[📅 Para hoy]`, `[🗑️ Borrar]`).
  * **Consultas completas**: `/pendientes` (o *"¿Hay pendientes?"*), `/hoy` (o *"¿Qué tengo para hoy?"*), `/inbox` (o *"¿Qué hay en la bandeja?"*).
* ☀️ **Rutinas Proactivas Programadas (Telegram Scheduler)**:
  * **Briefing Matutino (8:00 AM)**: Resumen del día con tus tareas planificadas, Top 3 y tiempo total estimado.
  * **Alerta de Vencimientos (17:00)**: Notificación de pendientes que vencen en el día para no dejar cosas colgadas.
  * **Revisión Vespertina (20:00)**: Cierre de jornada con balance y botones interactivos para posponer lo no terminado a mañana o moverlo a la bandeja.
* 🧠 **Desglose Inteligente con IA (Gemini)**:
  * Botón mágico en cada tarea para dividir proyectos o tareas complejas en 3 a 5 subtareas concretas y accionables de 15 a 45 minutos.
* ⏱️ **Modo Enfoque (Temporizador Pomodoro)**:
  * Temporizador visual integrado con descansos configurables, alerta sonora y modo pantalla completa sin distracciones.
* 📅 **Timeboxing Visual**:
  * Distribución visual de tu jornada en bloques horarios según tu hora de inicio y fin configuradas.
* 📊 **Métricas, Hábitos y Balance**:
  * Tasa de cumplimiento, rachas diarias consecutivas y distribución del tiempo por áreas de vida (*Personal, Trabajo, Estudio, Iglesia, Proyectos*).
* ⚙️ **Panel de Ajustes y Personalización**:
  * Configuración completa de horarios de trabajo, capacidad diaria, notificaciones (con botón para **probar envío en vivo**) y clave personal de Gemini AI.
* 🔌 **API REST de Integraciones**:
  * Claves de acceso API con prefijo `enf_live_...` para sincronizar tareas desde scripts Python, cURL, Google Apps Script, Make, n8n, etc.

---

## 🚀 Arquitectura y Tecnologías

* **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Radix UI / Lucide Icons, Sonner.
* **Backend**: Next.js Standalone (Node.js runtime) con API Routes y Server Components.
* **Base de Datos**: **PostgreSQL 16** con **Drizzle ORM** (`drizzle-orm/node-postgres`). Migraciones automáticas al inicio del contenedor.
* **Bot de Telegram**: **grammY** en modo Long Polling supervisado con reconexión automática resiliente y soporte para webhooks limpios.
* **Inteligencia Artificial**: **Google Gemini API** (`gemini-3.5-flash-lite` y `gemini-3.8-flash`) para comprensión multimodal (texto y audio).
* **Autenticación**: Sesiones persistidas en PostgreSQL con cookies `HttpOnly`, `SameSite=Lax` y contraseñas hasheadas con `bcryptjs`.
* **Seguridad**:
  * Cabeceras de seguridad estrictas (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
  * Hasheo SHA-256 de tokens de integración API.
  * Verificación CSRF mediante validación de origen en mutaciones (`sameOrigin`).
  * Validación de esquemas con **Zod**.
  * Prevención DoS con límite de tamaño de payloads (`readLimitedBody`).
* **Despliegue**: Docker y Docker Compose multi-contenedor optimizado para ARM64 (Oracle Cloud Ampere) y x86_64.

---

## 🗄️ Modelo de Datos (PostgreSQL)

* `users`: Cuentas con email único, hash bcrypt, nombre, `telegram_chat_id`, tokens temporales de vinculación y configuración (`settings` JSONB).
* `sessions`: Tokens de sesión seguros con expiración automática (30 días).
* `tasks`: Tareas con índices en `(user_id, status)`, `(user_id, plan_date)`, `(user_id, deadline)` y `(user_id, external_ref)`.
* `daily_budgets`: Presupuestos diarios en minutos por usuario y fecha (`AAAA-MM-DD`).
* `integration_keys`: Claves API para automatizaciones externas guardadas como hash SHA-256.

---

## ☁️ Guía de Despliegue en VPS (Oracle Cloud / Ubuntu)

### 1. Requisitos Previos
* Instancia Compute en Oracle Cloud (Ubuntu 22.04/24.04 o ARM64 Ampere A1).
* Docker y Docker Compose instalados:
  ```bash
  sudo apt update && sudo apt install -y docker.io docker-compose-v2
  sudo systemctl enable --now docker
  sudo usermod -aG docker $USER
  ```

### 2. Firewall y Puertos (OCI Console y UFW)
En la consola de Oracle Cloud:
* **Networking** > **Virtual Cloud Networks** > Tu VCN > **Security Lists** > **Default Security List**:
  * Agregar regla de entrada Ingress: Source CIDR `0.0.0.0/0`, Protocolo TCP, Puertos: `80, 443, 3000`.

En la terminal de la VPS:
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 3. Clonar y Configurar

```bash
git clone https://github.com/clcdavi/app-tracking.git
cd app-tracking
cp .env.example .env
```

Edita `.env` con tus credenciales:
```env
DB_USER=enfoco
DB_PASSWORD=tu_password_super_seguro_123
DB_NAME=enfoco_db
APP_PORT=3000
ALLOW_REGISTRATION=true
TZ=America/Argentina/Buenos_Aires

# Bot de Telegram (Obtené el token desde @BotFather)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRstuVWXyz
TELEGRAM_BOT_USERNAME=MiEnfocoAppBot

# Google Gemini AI (Obtené tu clave gratuita en aistudio.google.com)
GEMINI_API_KEY=AQ.Ab8RN6Kpn...
GEMINI_MODEL=gemini-3.5-flash-lite
```

> **Privacidad**: Una vez que hayas creado tu cuenta de usuario al ingresar por primera vez, puedes cambiar `ALLOW_REGISTRATION=false` para bloquear nuevos registros de terceros.

### 4. Iniciar con Docker Compose

```bash
docker compose up -d --build
```

Esto levantará:
1. `enfoco_db`: PostgreSQL 16 con volumen persistente `pgdata`.
2. `enfoco_app`: Next.js Standalone, migraciones automáticas, scheduler proactivo y bot de Telegram.

Para verificar:
```bash
docker compose ps
docker compose logs -f enfoco_app
```

Accedé desde tu navegador a `http://<IP_DE_TU_VPS>:3000`.

---

## 📱 Vinculación con el Bot de Telegram

1. Ingresá a tu cuenta de Enfoco en la web.
2. Andá a **Integraciones** (`/integrations`).
3. Hacé clic en **Conectar con Telegram** (o abrí el enlace generado).
4. Presioná **Iniciar** en Telegram. Tu cuenta quedará vinculada de inmediato.

### Comandos disponibles en Telegram:
| Comando | Descripción |
| :--- | :--- |
| `/pendientes` o `/tareas` | Lista todos tus pendientes activos (atrasados, hoy y backlog) |
| `/hoy` | Muestra las tareas planificadas para hoy con su Top 3 y tiempo total |
| `/inbox` | Muestra las tareas sin fecha en tu bandeja de entrada |
| `/completar` o `/listo` | Marca como terminada la última tarea creada o modificada |
| `/borrar` | Elimina la última tarea |
| `/help` o `/ayuda` | Despliega la guía de uso y ejemplos |
| `/desconectar` | Desvincula tu cuenta de Telegram |

### Ejemplos en lenguaje natural (texto o voz 🎙️):
* `Terminar presentación #trabajo !alta hoy 45m`
* `Comprar insumos mañana 15m`
* `Guardalo en el área de proyectos` *(modifica el área de la tarea anterior)*
* `Ponelo para hoy` *(mueve la tarea anterior al día de hoy)*
* `Prioridad alta y que dure 1 hora` *(ajusta prioridad y tiempo)*
* `¿Qué tengo para hoy?` o `¿Hay pendientes?`

---

## 🔌 API REST de Integraciones

En **Integraciones** podés generar claves API con prefijo `enf_live_...`.

### Enviar tareas vía cURL:
```bash
curl -X POST 'http://<IP_O_DOMINIO>:3000/api/integrations/tasks' \
  -H 'Authorization: Bearer enf_live_TU_CLAVE' \
  -H 'Content-Type: application/json' \
  -d '{
    "tasks": [
      {
        "externalId": "id-unico-1",
        "title": "Enviar balance mensual",
        "area": "Trabajo",
        "project": "Finanzas",
        "priority": 3,
        "minutes": 45,
        "deadline": "2026-10-20"
      }
    ]
  }'
```

* `title`: Obligatorio (1–240 caracteres).
* `externalId`: Opcional y recomendado. Si se repite con la misma clave, actualiza la tarea en lugar de duplicarla.
* Admite lotes de 1 a 50 tareas por petición.

---

## 💾 Copias de Seguridad (Backups)

```bash
# Backup manual de PostgreSQL:
docker exec -t enfoco_db pg_dump -U enfoco enfoco_db > backup_$(date +%Y%m%d).sql

# Restaurar backup:
cat backup_20261015.sql | docker exec -i enfoco_db psql -U enfoco enfoco_db
```

Cron automático diario (`crontab -e`):
```bash
0 3 * * * docker exec -t enfoco_db pg_dump -U enfoco enfoco_db | gzip > /home/ubuntu/backups/enfoco_$(date +\%F).sql.gz
```

---

## 🛠️ Desarrollo Local

```bash
npm install
npm run db:migrate  # Aplica migraciones a la BD
npm test            # Ejecuta la suite de pruebas unitarias (34 tests)
npm run dev         # Servidor de desarrollo en http://localhost:3000
npm run build       # Compila la versión de producción
```
