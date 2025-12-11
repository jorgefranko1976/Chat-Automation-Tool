# Manual de Instalación - RNDC Connect
## Despliegue en VPS con aaPanel + Ubuntu 22.04 + PostgreSQL 16.1

---

## Requisitos del Sistema

| Componente | Versión |
|------------|---------|
| Sistema Operativo | Ubuntu 22.04.5 LTS x86_64 |
| Panel de Control | aaPanel |
| Base de Datos | PostgreSQL 16.1 |
| Runtime | Node.js 20.x (LTS) |
| Process Manager | PM2 |

---

## Paso 1: Preparación del Servidor

### 1.1 Actualizar el Sistema

Conectarse al servidor vía SSH y ejecutar:

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Instalar aaPanel (si no está instalado)

```bash
wget -O install.sh http://www.aapanel.com/script/install-ubuntu_6.0_en.sh && sudo bash install.sh aapanel
```

Al finalizar, aaPanel mostrará:
- URL de acceso
- Usuario y contraseña

**Guardar estas credenciales en un lugar seguro.**

---

## Paso 2: Configuración de aaPanel

### 2.1 Acceder al Panel

1. Abrir navegador web
2. Ir a: `http://TU_IP_SERVIDOR:7800` (o el puerto indicado)
3. Iniciar sesión con las credenciales

### 2.2 Instalar Extensiones Necesarias

Ir a **App Store** (menú izquierdo) e instalar:

| Extensión | Descripción |
|-----------|-------------|
| **Nginx** | Servidor web para proxy reverso |
| **Node.js Version Manager** | Gestión de versiones de Node.js |
| **PM2 Manager** | Gestor de procesos Node.js |
| **PostgreSQL 16.x** | Base de datos |

### 2.3 Instalar Node.js

1. Ir a **Website → Node Project → Node Version Manager**
2. Instalar **Node.js 20.x** (versión LTS recomendada)
3. Hacer clic en **"Set as command line version"**

Verificar instalación por SSH:

```bash
node -v
# Debe mostrar: v20.x.x

npm -v
# Debe mostrar: 10.x.x
```

---

## Paso 3: Configuración de PostgreSQL

### 3.1 Crear Base de Datos

1. En aaPanel, ir a **Database**
2. Clic en **Add Database**
3. Configurar:
   - **Name:** `rndc_connect`
   - **Username:** `rndc_user`
   - **Password:** `[CONTRASEÑA_SEGURA]`
   - **Access:** `Local server`

### 3.2 Verificar Conexión

Por SSH, verificar que PostgreSQL está funcionando:

```bash
sudo systemctl status postgresql
```

### 3.3 Configurar Acceso Local

Editar el archivo de configuración:

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Asegurar que existe la línea:

```
local   all             all                                     md5
```

Reiniciar PostgreSQL:

```bash
sudo systemctl restart postgresql
```

---

## Paso 4: Despliegue de la Aplicación

### 4.1 Crear Directorio del Proyecto

```bash
sudo mkdir -p /www/wwwroot/rndc-connect
sudo chown -R www:www /www/wwwroot/rndc-connect
```

### 4.2 Subir Archivos del Proyecto

**Opción A: Usando SFTP**

1. En aaPanel, ir a **Files**
2. Navegar a `/www/wwwroot/rndc-connect`
3. Subir todos los archivos del proyecto (excepto `node_modules`)

**Opción B: Usando Git**

```bash
cd /www/wwwroot
sudo git clone [URL_DE_TU_REPOSITORIO] rndc-connect
cd rndc-connect
```

### 4.3 Instalar Dependencias

```bash
cd /www/wwwroot/rndc-connect
npm install
```

### 4.4 Compilar el Proyecto

```bash
npm run build
```

Este comando genera:
- `dist/` - Archivos compilados del servidor
- `dist/public/` - Archivos del frontend

---

## Paso 5: Configuración de Variables de Entorno

### 5.1 Crear Archivo de Entorno

```bash
nano /www/wwwroot/rndc-connect/.env
```

Agregar el siguiente contenido:

```env
# Base de Datos
DATABASE_URL=postgresql://rndc_user:[CONTRASEÑA]@localhost:5432/rndc_connect

# Servidor
NODE_ENV=production
PORT=5000

# Session
SESSION_SECRET=[CLAVE_SECRETA_ALEATORIA_32_CARACTERES]
```

**Generar clave secreta:**

```bash
openssl rand -hex 32
```

### 5.2 Proteger el Archivo

```bash
chmod 600 /www/wwwroot/rndc-connect/.env
```

---

## Paso 6: Ejecutar Migraciones de Base de Datos

```bash
cd /www/wwwroot/rndc-connect
npm run db:push
```

Este comando crea todas las tablas necesarias en PostgreSQL.

---

## Paso 7: Configurar PM2

### 7.1 Crear Archivo de Configuración PM2

```bash
nano /www/wwwroot/rndc-connect/ecosystem.config.js
```

Contenido:

```javascript
module.exports = {
  apps: [{
    name: 'rndc-connect',
    script: 'dist/index.js',
    cwd: '/www/wwwroot/rndc-connect',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_file: '/www/wwwroot/rndc-connect/.env'
  }]
};
```

### 7.2 Iniciar Aplicación con PM2

**Opción A: Desde aaPanel**

1. Ir a **App Store → PM2 Manager**
2. Clic en **Add Project**
3. Configurar:
   - **Name:** `rndc-connect`
   - **Path:** `/www/wwwroot/rndc-connect`
   - **Start File:** `dist/index.js`
   - **Port:** `5000`
4. Clic en **Confirm**

**Opción B: Por SSH**

```bash
cd /www/wwwroot/rndc-connect
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 7.3 Verificar Estado

```bash
pm2 status
```

Debe mostrar la aplicación como `online`.

---

## Paso 8: Configurar Nginx (Proxy Reverso)

### 8.1 Crear Sitio Web

1. En aaPanel, ir a **Website → Add Site**
2. Configurar:
   - **Domain Name:** `tudominio.com` (o IP del servidor)
   - **PHP Version:** `Pure Static`
   - **Create FTP:** No
   - **Create Database:** No

### 8.2 Configurar Proxy Reverso

1. Ir a **Website → tudominio.com → Settings**
2. Clic en **Reverse Proxy**
3. Clic en **Add Reverse Proxy**
4. Configurar:
   - **Name:** `rndc-connect`
   - **Target URL:** `http://127.0.0.1:5000`
   - **Send Domain:** `$host`
5. Clic en **Submit**

### 8.3 Configuración Avanzada (Opcional)

Para WebSocket y mejor rendimiento, editar la configuración:

1. Ir a **Website → tudominio.com → Settings → Config**
2. Buscar el bloque `location /` y reemplazar con:

```nginx
location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 86400;
    proxy_buffering off;
}
```

3. Guardar y reiniciar Nginx

---

## Paso 9: Configurar SSL (HTTPS)

### 9.1 Obtener Certificado SSL

1. En aaPanel, ir a **Website → tudominio.com → SSL**
2. Seleccionar **Let's Encrypt**
3. Marcar el dominio
4. Clic en **Apply**

### 9.2 Forzar HTTPS

1. En la misma sección SSL
2. Activar **Force HTTPS**

---

## Paso 10: Configurar Firewall

### 10.1 Abrir Puertos en aaPanel

1. Ir a **Security**
2. Agregar reglas para los puertos:

| Puerto | Descripción |
|--------|-------------|
| 80 | HTTP |
| 443 | HTTPS |
| 5432 | PostgreSQL (solo si necesitas acceso externo) |

### 10.2 Configurar UFW (Opcional)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Paso 11: Verificación Final

### 11.1 Verificar Aplicación

Abrir en el navegador:

```
https://tudominio.com
```

### 11.2 Verificar Logs

```bash
# Logs de la aplicación
pm2 logs rndc-connect

# Logs de Nginx
tail -f /www/wwwlogs/tudominio.com.log

# Logs de PostgreSQL
tail -f /var/log/postgresql/postgresql-16-main.log
```

### 11.3 Verificar Servicios

```bash
# Estado de PM2
pm2 status

# Estado de PostgreSQL
sudo systemctl status postgresql

# Estado de Nginx
sudo systemctl status nginx
```

---

## Comandos Útiles

### Gestión de la Aplicación

```bash
# Reiniciar aplicación
pm2 restart rndc-connect

# Detener aplicación
pm2 stop rndc-connect

# Ver logs en tiempo real
pm2 logs rndc-connect --lines 100

# Monitorear recursos
pm2 monit
```

### Gestión de Base de Datos

```bash
# Conectar a PostgreSQL
psql -U rndc_user -d rndc_connect -h localhost

# Backup de base de datos
pg_dump -U rndc_user rndc_connect > backup_$(date +%Y%m%d).sql

# Restaurar backup
psql -U rndc_user rndc_connect < backup_20241211.sql
```

### Actualizar la Aplicación

```bash
cd /www/wwwroot/rndc-connect

# Detener aplicación
pm2 stop rndc-connect

# Actualizar código (si usas Git)
git pull origin main

# Instalar nuevas dependencias
npm install

# Recompilar
npm run build

# Ejecutar migraciones si hay cambios
npm run db:push

# Reiniciar aplicación
pm2 restart rndc-connect
```

---

## Solución de Problemas

### Error: EADDRINUSE (Puerto en uso)

```bash
# Encontrar proceso usando el puerto
lsof -i :5000

# Terminar proceso
kill -9 [PID]

# Reiniciar aplicación
pm2 restart rndc-connect
```

### Error: Cannot connect to database

1. Verificar que PostgreSQL está corriendo:
   ```bash
   sudo systemctl status postgresql
   ```

2. Verificar credenciales en `.env`

3. Verificar que la base de datos existe:
   ```bash
   psql -U postgres -c "\l"
   ```

### Error 502 Bad Gateway

1. Verificar que la aplicación está corriendo:
   ```bash
   pm2 status
   ```

2. Verificar logs:
   ```bash
   pm2 logs rndc-connect
   ```

3. Verificar configuración de Nginx:
   ```bash
   nginx -t
   sudo systemctl reload nginx
   ```

### La aplicación no inicia

1. Verificar que el build existe:
   ```bash
   ls -la /www/wwwroot/rndc-connect/dist/
   ```

2. Si no existe, recompilar:
   ```bash
   npm run build
   ```

---

## Mantenimiento Programado

### Respaldos Automáticos

Crear script de backup:

```bash
nano /root/backup-rndc.sh
```

Contenido:

```bash
#!/bin/bash
FECHA=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups"

mkdir -p $BACKUP_DIR

# Backup base de datos
pg_dump -U rndc_user rndc_connect > $BACKUP_DIR/db_$FECHA.sql

# Backup archivos de configuración
cp /www/wwwroot/rndc-connect/.env $BACKUP_DIR/env_$FECHA

# Eliminar backups mayores a 7 días
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completado: $FECHA"
```

Hacer ejecutable y programar:

```bash
chmod +x /root/backup-rndc.sh

# Agregar a crontab (ejecutar diariamente a las 2 AM)
crontab -e
```

Agregar línea:

```
0 2 * * * /root/backup-rndc.sh >> /var/log/backup-rndc.log 2>&1
```

---

## Información de Contacto

Para soporte técnico o consultas sobre la instalación, contactar al desarrollador.

---

**Versión del Manual:** 1.0  
**Última Actualización:** Diciembre 2024  
**Aplicación:** RNDC Connect  
**Plataforma:** Ubuntu 22.04 + aaPanel + PostgreSQL 16.1 + Node.js 20.x
