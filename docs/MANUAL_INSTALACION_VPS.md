# Manual de Instalación - RNDC Connect
## Servidor VPS con Ubuntu 22.04 LTS y aaPanel

---

## Tabla de Contenidos

1. [Requisitos del Sistema](#1-requisitos-del-sistema)
2. [Preparación del Servidor](#2-preparación-del-servidor)
3. [Instalación de aaPanel](#3-instalación-de-aapanel)
4. [Configuración de PostgreSQL](#4-configuración-de-postgresql)
5. [Instalación de Node.js](#5-instalación-de-nodejs)
6. [Despliegue de la Aplicación](#6-despliegue-de-la-aplicación)
7. [Configuración de Variables de Entorno](#7-configuración-de-variables-de-entorno)
8. [Configuración del Dominio y SSL](#8-configuración-del-dominio-y-ssl)
9. [Configuración de PM2](#9-configuración-de-pm2)
10. [Mantenimiento](#10-mantenimiento)
11. [Solución de Problemas](#11-solución-de-problemas)
12. [Lista de Verificación](#12-lista-de-verificación)

---

## 1. Requisitos del Sistema

### 1.1 Hardware Mínimo

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 2 GB | 4 GB |
| Disco | 20 GB SSD | 40 GB SSD |
| Ancho de Banda | 1 TB/mes | Ilimitado |

### 1.2 Software

- **Sistema Operativo**: Ubuntu 22.04.5 LTS x86_64
- **Panel**: aaPanel 7.0.28
- **Runtime**: Node.js 20 LTS
- **Base de Datos**: PostgreSQL 15+
- **Proceso Manager**: PM2

### 1.3 Puertos Requeridos

| Puerto | Servicio |
|--------|----------|
| 22 | SSH |
| 80 | HTTP |
| 443 | HTTPS |
| 5432 | PostgreSQL (solo local) |
| 7800 | aaPanel |
| 5000 | Aplicación (interno) |

### 1.4 Dominio

- Un dominio o subdominio apuntando a la IP del servidor
- Acceso para configurar registros DNS

---

## 2. Preparación del Servidor

### 2.1 Actualizar el Sistema

```bash
# Conectar por SSH como root
ssh root@IP_DEL_SERVIDOR

# Actualizar paquetes
apt update && apt upgrade -y

# Instalar utilidades básicas
apt install -y curl wget git unzip software-properties-common
```

### 2.2 Configurar Zona Horaria

```bash
# Configurar zona horaria de Colombia
timedatectl set-timezone America/Bogota

# Verificar
timedatectl
```

### 2.3 Crear Usuario para la Aplicación

```bash
# Crear usuario
adduser rndcapp

# Agregar a grupo sudo
usermod -aG sudo rndcapp

# Cambiar a nuevo usuario
su - rndcapp
```

### 2.4 Configurar Firewall

```bash
# Habilitar UFW
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 7800/tcp  # aaPanel
sudo ufw enable

# Verificar estado
sudo ufw status
```

---

## 3. Instalación de aaPanel

### 3.1 Descargar e Instalar

```bash
# Volver a root
sudo su

# Descargar script de instalación
wget -O install.sh http://www.aapanel.com/script/install-ubuntu_6.0_en.sh

# Ejecutar instalación
bash install.sh aapanel
```

### 3.2 Acceder al Panel

Después de la instalación, recibirá:
- URL del panel: `http://IP:7800/RANDOM_PATH`
- Usuario: admin
- Contraseña: (generada automáticamente)

**Guarde estas credenciales de forma segura.**

### 3.3 Configuración Inicial de aaPanel

1. Acceda al panel web
2. En el asistente inicial, seleccione **LNMP** (Linux, Nginx, MySQL, PHP)
   - Nginx: Última versión
   - MySQL: No instalar (usaremos PostgreSQL)
   - PHP: No necesario
3. Espere a que se complete la instalación

### 3.4 Instalar PostgreSQL desde aaPanel

1. Vaya a **App Store** > **Database**
2. Busque **PostgreSQL**
3. Instale PostgreSQL 15 o superior
4. Una vez instalado, acceda a la configuración

---

## 4. Configuración de PostgreSQL

### 4.1 Crear Base de Datos

**Opción A: Desde aaPanel**

1. Vaya a **Database** > **PostgreSQL**
2. Haga clic en **Add Database**
3. Configure:
   - Database Name: `rndc_connect`
   - Username: `rndc_user`
   - Password: (genere una contraseña segura)
4. Guarde las credenciales

**Opción B: Desde Terminal**

```bash
# Conectar como postgres
sudo -u postgres psql

# Crear usuario
CREATE USER rndc_user WITH PASSWORD 'CONTRASEÑA_SEGURA';

# Crear base de datos
CREATE DATABASE rndc_connect OWNER rndc_user;

# Otorgar permisos
GRANT ALL PRIVILEGES ON DATABASE rndc_connect TO rndc_user;

# Salir
\q
```

### 4.2 Configurar Acceso

```bash
# Editar pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Agregar al final (solo conexiones locales):
local   rndc_connect    rndc_user                               md5
host    rndc_connect    rndc_user    127.0.0.1/32              md5

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### 4.3 Construir URL de Conexión

```
DATABASE_URL=postgresql://rndc_user:CONTRASEÑA_SEGURA@localhost:5432/rndc_connect
```

---

## 5. Instalación de Node.js

### 5.1 Instalar NVM

```bash
# Como usuario rndcapp
su - rndcapp

# Instalar NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Cargar NVM
source ~/.bashrc

# Verificar instalación
nvm --version
```

### 5.2 Instalar Node.js LTS

```bash
# Instalar Node.js 20 LTS
nvm install 20

# Establecer como predeterminado
nvm use 20
nvm alias default 20

# Verificar versiones
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 5.3 Instalar PM2 Globalmente

```bash
npm install -g pm2

# Verificar instalación
pm2 --version
```

---

## 6. Despliegue de la Aplicación

### 6.1 Crear Directorio de la Aplicación

```bash
# Como usuario rndcapp
sudo mkdir -p /var/www/rndc-connect
sudo chown -R rndcapp:rndcapp /var/www/rndc-connect
cd /var/www/rndc-connect
```

### 6.2 Clonar o Subir el Código

**Opción A: Desde Git**
```bash
git clone https://github.com/TU_USUARIO/rndc-connect.git .
```

**Opción B: Subir archivos manualmente**
1. Use SFTP o el administrador de archivos de aaPanel
2. Suba todos los archivos del proyecto a `/var/www/rndc-connect`

### 6.3 Instalar Dependencias

```bash
cd /var/www/rndc-connect

# Instalar dependencias
npm install

# Si hay errores de permisos
npm install --unsafe-perm
```

### 6.4 Compilar la Aplicación

```bash
# Compilar frontend y backend
npm run build
```

### 6.5 Ejecutar Migraciones de Base de Datos

```bash
# Ejecutar migraciones de Drizzle
npm run db:push

# O si usa migraciones
npm run db:migrate
```

---

## 7. Configuración de Variables de Entorno

### 7.1 Crear Archivo .env

```bash
nano /var/www/rndc-connect/.env
```

### 7.2 Variables Requeridas

```env
# Base de Datos
DATABASE_URL=postgresql://rndc_user:CONTRASEÑA_SEGURA@localhost:5432/rndc_connect

# Sesiones
SESSION_SECRET=GENERAR_CADENA_ALEATORIA_DE_64_CARACTERES

# Servidor
NODE_ENV=production
PORT=5000

# RNDC (opcionales - se configuran desde la interfaz)
# RNDC_WS_URL_PROD=https://rndc.mintransporte.gov.co/MenuPrincipal/tablogin/loginWebService.asmx
# RNDC_WS_URL_TEST=https://rndctest.mintransporte.gov.co/...
```

### 7.3 Generar SESSION_SECRET

```bash
# Generar cadena aleatoria
openssl rand -hex 32
```

### 7.4 Proteger el Archivo

```bash
chmod 600 /var/www/rndc-connect/.env
```

---

## 8. Configuración del Dominio y SSL

### 8.1 Configurar DNS

En su proveedor de dominio, cree un registro A:

| Tipo | Nombre | Valor |
|------|--------|-------|
| A | rndc (o @) | IP_DEL_SERVIDOR |

Espere la propagación DNS (puede tomar hasta 24 horas).

### 8.2 Agregar Sitio en aaPanel

1. Vaya a **Website** > **Add site**
2. Configure:
   - Domain: `sudominio.com`
   - PHP Version: Pure Static (o None)
   - Database: No crear
3. Haga clic en **Submit**

### 8.3 Configurar Reverse Proxy

1. Vaya a **Website** > seleccione su sitio > **Reverse proxy**
2. Agregue una nueva regla:
   - Name: `rndc_app`
   - Target URL: `http://127.0.0.1:5000`
   - Send Domain: `$host`
3. Guarde la configuración

### 8.4 Configuración Nginx Adicional

1. Vaya a **Website** > seleccione su sitio > **Config**
2. Agregue dentro del bloque `server`:

```nginx
# Configuración para WebSocket (si se usa)
location /ws {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Timeout extendido para operaciones RNDC
proxy_read_timeout 300s;
proxy_connect_timeout 75s;
```

### 8.5 Instalar Certificado SSL

1. Vaya a **Website** > seleccione su sitio > **SSL**
2. Seleccione **Let's Encrypt**
3. Seleccione su dominio
4. Haga clic en **Apply**
5. Habilite **Force HTTPS**

---

## 9. Configuración de PM2

### 9.1 Crear Archivo de Configuración

```bash
nano /var/www/rndc-connect/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'rndc-connect',
    script: 'dist/index.js',
    cwd: '/var/www/rndc-connect',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/rndc-connect/error.log',
    out_file: '/var/log/rndc-connect/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

### 9.2 Crear Directorio de Logs

```bash
sudo mkdir -p /var/log/rndc-connect
sudo chown rndcapp:rndcapp /var/log/rndc-connect
```

### 9.3 Iniciar la Aplicación

```bash
cd /var/www/rndc-connect

# Iniciar con PM2
pm2 start ecosystem.config.js

# Verificar estado
pm2 status

# Ver logs
pm2 logs rndc-connect
```

### 9.4 Configurar Inicio Automático

```bash
# Generar script de inicio
pm2 startup systemd -u rndcapp --hp /home/rndcapp

# Ejecutar el comando que muestra PM2
# sudo env PATH=$PATH:/home/rndcapp/.nvm/versions/node/v20.x.x/bin ...

# Guardar lista de procesos
pm2 save
```

---

## 10. Mantenimiento

### 10.1 Actualizar la Aplicación

```bash
cd /var/www/rndc-connect

# Detener la aplicación
pm2 stop rndc-connect

# Actualizar código
git pull origin main

# Instalar dependencias
npm install

# Compilar
npm run build

# Ejecutar migraciones
npm run db:push

# Reiniciar
pm2 restart rndc-connect
```

### 10.2 Respaldo de Base de Datos

**Crear respaldo manual:**

```bash
pg_dump -U rndc_user -h localhost rndc_connect > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Configurar respaldo automático en aaPanel:**

1. Vaya a **Cron** > **Add Task**
2. Configure:
   - Task Type: Shell Script
   - Name: `Backup RNDC DB`
   - Period: Daily at 2:00 AM
   - Script:
   ```bash
   pg_dump -U rndc_user -h localhost rndc_connect | gzip > /backup/rndc_$(date +\%Y\%m\%d).sql.gz
   find /backup -name "rndc_*.sql.gz" -mtime +7 -delete
   ```

### 10.3 Restaurar Base de Datos

```bash
psql -U rndc_user -h localhost rndc_connect < backup.sql
```

### 10.4 Monitoreo

**Ver estado de la aplicación:**
```bash
pm2 status
pm2 monit
```

**Ver logs en tiempo real:**
```bash
pm2 logs rndc-connect --lines 100
```

**Monitoreo en aaPanel:**
- Dashboard muestra uso de CPU, RAM y disco
- Configure alertas por correo

### 10.5 Rotación de Logs

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 11. Solución de Problemas

### 11.1 La Aplicación No Inicia

```bash
# Ver logs de error
pm2 logs rndc-connect --err --lines 50

# Verificar que el puerto no esté en uso
sudo lsof -i :5000

# Verificar variables de entorno
cat /var/www/rndc-connect/.env
```

### 11.2 Error de Conexión a Base de Datos

```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Probar conexión
psql -U rndc_user -h localhost -d rndc_connect

# Verificar pg_hba.conf
sudo cat /etc/postgresql/15/main/pg_hba.conf | grep rndc
```

### 11.3 Error 502 Bad Gateway

1. Verificar que la aplicación esté corriendo: `pm2 status`
2. Verificar que el proxy esté configurado correctamente
3. Revisar logs de Nginx: `tail -f /var/log/nginx/error.log`

### 11.4 Problemas de Permisos

```bash
# Corregir permisos del directorio
sudo chown -R rndcapp:rndcapp /var/www/rndc-connect

# Corregir permisos de archivos
find /var/www/rndc-connect -type f -exec chmod 644 {} \;
find /var/www/rndc-connect -type d -exec chmod 755 {} \;
```

### 11.5 Certificado SSL No Funciona

1. Verificar que el dominio apunte al servidor
2. Renovar certificado manualmente desde aaPanel
3. Verificar que el puerto 80 esté abierto (necesario para validación)

---

## 12. Lista de Verificación

### Pre-Instalación

- [ ] VPS con Ubuntu 22.04 LTS
- [ ] Acceso SSH como root
- [ ] Dominio configurado apuntando al servidor
- [ ] Puertos 22, 80, 443, 7800 abiertos

### Instalación

- [ ] Sistema actualizado
- [ ] aaPanel instalado y accesible
- [ ] PostgreSQL instalado y configurado
- [ ] Base de datos `rndc_connect` creada
- [ ] Usuario `rndc_user` creado con permisos
- [ ] Node.js 20 LTS instalado
- [ ] PM2 instalado globalmente
- [ ] Código de la aplicación desplegado
- [ ] Dependencias instaladas (`npm install`)
- [ ] Aplicación compilada (`npm run build`)
- [ ] Migraciones ejecutadas
- [ ] Archivo `.env` configurado
- [ ] PM2 configurado e iniciado
- [ ] Inicio automático configurado

### Post-Instalación

- [ ] Sitio agregado en aaPanel
- [ ] Reverse proxy configurado
- [ ] SSL instalado y forzado
- [ ] Acceso HTTPS funcionando
- [ ] Login de usuario funciona
- [ ] Conexión a RNDC funciona
- [ ] Respaldos automáticos configurados
- [ ] Monitoreo configurado

### Seguridad

- [ ] Firewall UFW habilitado
- [ ] Credenciales de aaPanel cambiadas
- [ ] Contraseña de PostgreSQL segura
- [ ] SESSION_SECRET generado aleatoriamente
- [ ] Acceso SSH solo por clave (recomendado)

---

## Comandos de Referencia Rápida

```bash
# Estado de la aplicación
pm2 status

# Reiniciar aplicación
pm2 restart rndc-connect

# Ver logs
pm2 logs rndc-connect

# Detener aplicación
pm2 stop rndc-connect

# Estado de PostgreSQL
sudo systemctl status postgresql

# Estado de Nginx
sudo systemctl status nginx

# Reiniciar Nginx
sudo systemctl restart nginx

# Ver uso de disco
df -h

# Ver uso de memoria
free -h

# Ver procesos
htop
```

---

*Manual de Instalación - RNDC Connect v1.0*
*Para Ubuntu 22.04 LTS + aaPanel 7.0.28*
*Última actualización: Enero 2026*
