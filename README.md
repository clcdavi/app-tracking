# Enfoco

Aplicación de organización personal y planificación consciente del día a día para David. Enfocada en elegir qué hacer hoy sin sobrecarga, respetando la capacidad diaria en minutos y priorizando con un Top 3 claro.

---

## 🚀 Arquitectura y Tecnologías

* **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Radix UI / Shadcn UI, Lucide Icons, Sonner.
* **Backend**: Next.js Standalone (Node.js runtime) con API Routes seguras.
* **Base de Datos**: **PostgreSQL 16** con **Drizzle ORM** (`drizzle-orm/node-postgres`).
* **Autenticación**: Sesiones seguras persistidas en PostgreSQL con cookies `HttpOnly`, `SameSite=Lax` y contraseñas hasheadas con `bcryptjs`.
* **Seguridad**:
  * Cabeceras HTTP de seguridad (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
  * Hasheo SHA-256 de tokens de integración.
  * Verificación CSRF mediante validación de origen en mutaciones.
  * Validación exhaustiva de esquemas con **Zod**.
  * Lectura limitada de streams HTTP (`readLimitedBody`) para prevenir ataques DoS por payloads grandes.
* **Despliegue**: Docker y Docker Compose (multi-contenedor con soporte multi-arquitectura: x86_64 y ARM64 Ampere de Oracle Cloud).

---

## 🗄️ Modelo de Datos (PostgreSQL)

El almacenamiento original monolítico en JSON ha sido reemplazado por un esquema relacional normalizado:

* `users`: Cuentas de usuario con email único, hash bcrypt y nombre.
* `sessions`: Tokens de sesión seguros con expiración automática (30 días).
* `tasks`: Tareas normalizadas con índices optimizados en `(user_id, status)`, `(user_id, plan_date)`, `(user_id, deadline)` y `(user_id, external_ref)`.
* `daily_budgets`: Presupuestos diarios en minutos por usuario y fecha (`AAAA-MM-DD`).
* `integration_keys`: Claves API para automatizaciones externas guardadas como hash SHA-256.

---

## ☁️ Guía de Despliegue en Oracle Cloud (OCI VPS)

### 1. Requisitos Previos en tu Instancia OCI
* Una instancia Compute en Oracle Cloud (Ubuntu 22.04/24.04 u Oracle Linux 8/9). Es compatible con las instancias gratuitas **Ampere A1 (ARM64)** o **AMD**.
* Docker y Docker Compose instalados.

Para instalar Docker en tu instancia (Ubuntu):
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Cerrar sesión y volver a entrar vía SSH para aplicar el grupo docker
```

### 2. Configurar el Firewall y Red en Oracle Cloud (Crucial)

En Oracle Cloud, el tráfico está bloqueado por dos capas: la Lista de Seguridad de OCI (VCN) y el firewall del sistema operativo.

#### A. Reglas de Entrada en OCI Console:
1. Ve a **Networking** > **Virtual Cloud Networks** > Tu VCN > **Security Lists** > **Default Security List**.
2. Haz clic en **Add Ingress Rules**:
   * **Source CIDR**: `0.0.0.0/0`
   * **Destination Port Range**: `80, 443, 3000` (o solo 80 y 443 si usas proxy inverso).
   * **Protocol**: TCP.

#### B. Abrir Puertos en la Instancia (Ubuntu / Oracle Linux):
```bash
# En Ubuntu:
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save  # o instalar iptables-persistent si no está presente

# O si utilizas ufw:
sudo ufw allow 3000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 3. Clonar y Configurar el Proyecto

```bash
git clone https://github.com/clcdavi/app-tracking.git
cd app-tracking
```

Copia la plantilla de variables de entorno:
```bash
cp .env.example .env
```

Edita `.env` con tus credenciales seguras:
```env
DB_USER=enfoco
DB_PASSWORD=tu_password_super_seguro_aqui_456
DB_NAME=enfoco_db
APP_PORT=3000
ALLOW_REGISTRATION=true
TZ=America/Argentina/Buenos_Aires
```

> **Nota de Privacidad**: Una vez que hayas creado tu cuenta de usuario al ingresar por primera vez, puedes cambiar `ALLOW_REGISTRATION=false` y ejecutar `docker compose up -d` para bloquear nuevos registros de desconocidos.

### 4. Iniciar la Aplicación

```bash
docker compose up -d --build
```

Esto levantará:
1. `enfoco_db`: PostgreSQL 16 con volumen persistente `pgdata` y control de salud (`healthcheck`).
2. `enfoco_app`: La aplicación Next.js Standalone que se conecta a PostgreSQL y auto-ejecuta las migraciones de esquema en el arranque.

### 5. Verificar el Estado y Logs

```bash
docker compose ps
docker compose logs -f --tail=100
```

Accede desde tu navegador a `http://<IP_PUBLICA_DE_TU_ORACLE_VM>:3000`.

---

## 🔒 Producción con Dominio y Certificado SSL (HTTPS)

Para exponer la web en `https://tudominio.com` sin abrir el puerto 3000 directamente, se recomienda configurar **Nginx** o **Caddy** en el VPS:

### Opción Rápida con Caddy (SSL Automático):
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

Edita `/etc/caddy/Caddyfile`:
```caddy
tudominio.com {
    reverse_proxy 127.0.0.1:3000
}
```

Aplica la configuración:
```bash
sudo systemctl reload caddy
```
Caddy obtendrá y renovará automáticamente tu certificado SSL con Let's Encrypt.

---

## 💾 Copias de Seguridad (Backups) de PostgreSQL

Para respaldar tu base de datos de manera automática en la VPS:

```bash
# Backup manual:
docker exec -t enfoco_db pg_dump -U enfoco enfoco_db > backup_$(date +%Y%m%d).sql

# Restaurar backup:
cat backup_20261013.sql | docker exec -i enfoco_db psql -U enfoco enfoco_db
```

Puedes agregar una tarea en `crontab -e` para realizar backups diarios:
```bash
0 3 * * * docker exec -t enfoco_db pg_dump -U enfoco enfoco_db | gzip > /home/ubuntu/backups/enfoco_$(date +\%F).sql.gz
```

---

## 🔌 API de Integraciones (Google Apps Script, n8n, Make, curl)

En la aplicación, ingresa a **Conectar otra app** (`/integrations`) para generar claves seguras con prefijo `enf_live_...`.

### Enviar tareas vía cURL:
```bash
curl -X POST 'http://<TU_IP_O_DOMINIO>:3000/api/integrations/tasks' \
  -H 'Authorization: Bearer enf_live_TU_CLAVE' \
  -H 'Content-Type: application/json' \
  -d '{
    "tasks": [
      {
        "externalId": "orden-492",
        "title": "Llamar al cliente",
        "area": "Trabajo",
        "priority": 1,
        "minutes": 20,
        "deadline": "2026-10-20"
      }
    ]
  }'
```

* `title`: Obligatorio (1–240 caracteres).
* `externalId`: Opcional y recomendado para idempotencia. Si se repite con la misma clave, actualiza la tarea en lugar de duplicarla.
* Admite lotes de 1 a 50 tareas por petición (máximo 100 KB).

---

## 🛠️ Comandos de Desarrollo Local

Si deseas correr la aplicación localmente sin Docker:
```bash
npm install
# Iniciar base de datos local (o docker compose up db -d)
npm run db:migrate  # Ejecuta las migraciones en PostgreSQL
npm run dev         # Inicia el servidor de desarrollo en http://localhost:3000
npm run build       # Compila la versión optimizada standalone
```
