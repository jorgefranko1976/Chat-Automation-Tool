# Manual de Funcionamiento - RNDC Connect

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Módulo Monitoreo](#3-módulo-monitoreo)
4. [Módulo Seguimiento](#4-módulo-seguimiento)
5. [Módulo Despachos](#5-módulo-despachos)
6. [Módulo Inscripción](#6-módulo-inscripción)
7. [Módulo Facturación](#7-módulo-facturación)
8. [Configuración](#8-configuración)
9. [Diseñador de Reportes](#9-diseñador-de-reportes)
10. [Glosario](#10-glosario)
11. [Solución de Problemas](#11-solución-de-problemas)

---

## 1. Introducción

### 1.1 ¿Qué es RNDC Connect?

RNDC Connect es una plataforma de logística diseñada para empresas de transporte terrestre colombianas que necesitan interactuar con el RNDC (Registro Nacional de Despacho de Carga) del Ministerio de Transporte.

### 1.2 Funcionalidades Principales

- **Monitoreo**: Consulta de manifiestos autorizados desde el RNDC
- **Seguimiento**: Reporte de tiempos de llegada/salida en puntos de control
- **Despachos**: Flujo integral de generación de Remesas, Manifiestos y PDFs
- **Inscripción**: Gestión de Terceros, Vehículos, Conductores y Destinos
- **Facturación**: Generación de reportes de facturación desde archivos Excel
- **Diseñador de Reportes**: Personalización visual de plantillas PDF

### 1.3 Requisitos Previos

- Credenciales RNDC (usuario y contraseña)
- NIT de la empresa transportadora
- Acceso a internet estable
- Navegador web moderno (Chrome, Firefox, Edge)

### 1.4 Arquitectura del Sistema

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend       │────▶│   PostgreSQL    │
│   React + Vite  │     │   Express.js    │     │   Database      │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   RNDC SOAP     │
                        │   Web Service   │
                        └─────────────────┘
```

---

## 2. Acceso al Sistema

### 2.1 Inicio de Sesión

1. Abra el navegador y acceda a la URL del sistema
2. Ingrese su correo electrónico y contraseña
3. Haga clic en "Iniciar Sesión"

### 2.2 Registro de Usuario

1. En la pantalla de login, haga clic en "Registrarse"
2. Complete los campos:
   - Nombre completo
   - Correo electrónico
   - Contraseña (mínimo 6 caracteres)
3. Haga clic en "Registrar"

### 2.3 Recuperación de Contraseña

1. Acceda a Configuración > Perfil
2. Use la opción "Cambiar Contraseña"
3. Ingrese la contraseña actual y la nueva

### 2.4 Cierre de Sesión

Haga clic en el botón "Cerrar Sesión" en el menú lateral.

---

## 3. Módulo Monitoreo

### 3.1 Descripción

El módulo de Monitoreo permite consultar los manifiestos autorizados desde el RNDC para empresas de monitoreo satelital.

### 3.2 Tipos de Consulta

| Tipo | Descripción |
|------|-------------|
| Nuevos | Manifiestos nuevos desde la última consulta |
| Últimas 24h | Todos los manifiestos de las últimas 24 horas |
| Por Número | Búsqueda específica por número de manifiesto |

### 3.3 Proceso de Consulta

1. Seleccione el tipo de consulta
2. Complete los parámetros requeridos (si aplica)
3. Haga clic en "Consultar"
4. Los resultados se muestran en una tabla con opciones de exportación

### 3.4 Interpretación de Resultados

- **Estado Activo**: Manifiesto vigente para monitoreo
- **Estado Cumplido**: Viaje completado
- **Estado Anulado**: Manifiesto cancelado

---

## 4. Módulo Seguimiento

### 4.1 Descripción

Permite reportar tiempos de llegada y salida en puntos de control al RNDC.

### 4.2 Importación desde Excel

El sistema acepta archivos Excel con las siguientes columnas:

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| MANIFIESTO | Número de manifiesto | 600001 |
| PLACA | Placa del vehículo | ABC123 |
| PUNTO_CONTROL | Código del punto | PC001 |
| FECHA_LLEGADA | Fecha de llegada | 01/01/2024 |
| HORA_LLEGADA | Hora de llegada | 08:30 |
| FECHA_SALIDA | Fecha de salida | 01/01/2024 |
| HORA_SALIDA | Hora de salida | 09:00 |

### 4.3 Envío de Reportes

1. Cargue el archivo Excel
2. Valide los datos en la vista previa
3. Seleccione los registros a enviar
4. Haga clic en "Enviar al RNDC"
5. Monitoree el progreso en tiempo real

### 4.4 Reintentos

Si un reporte falla:
1. Revise el mensaje de error
2. Corrija los datos si es necesario
3. Use el botón "Reintentar" para reenviar

---

## 5. Módulo Despachos

### 5.1 Descripción

El módulo de Despachos implementa el flujo completo de generación de documentos de transporte:

```
Excel → Validación → Remesas → Manifiestos → PDFs → Envío
```

### 5.2 Flujo de Trabajo

#### Paso A: Validación de Datos Internos

1. **Cargar Excel**: Seleccione un archivo con las columnas:
   - GRANJA (destino)
   - PLANTA (origen)
   - PLACA (vehículo)
   - CEDULA (conductor)
   - TONELADAS (peso)
   - FECHA (fecha de despacho)

2. **Validación Automática**: El sistema verifica contra los datos internos:
   - Granjas registradas
   - Plantas registradas
   - Información de flete

3. **Indicadores**:
   - ✓ Verde: Dato válido
   - ✗ Rojo: Dato no encontrado
   - ⚠ Amarillo: Advertencia

#### Paso B: Validación Placas RNDC

1. Haga clic en "Validar Placas RNDC"
2. El sistema consulta cada placa en el RNDC
3. Obtiene información del propietario/titular para los manifiestos
4. Progreso visible en tiempo real

#### Paso C: Validación Cédulas RNDC

1. Haga clic en "Validar Cédulas RNDC"
2. El sistema consulta cada conductor en el RNDC
3. Verifica vigencia de licencia de conducción
4. Progreso visible en tiempo real

#### Paso D: Generación de Remesas

1. Seleccione las filas validadas (casillas de verificación)
2. Haga clic en "Generar Remesas XML"
3. Revise el XML generado
4. Haga clic en "Enviar al RNDC"
5. Monitoree el progreso:
   - Procesadas: X/Total
   - Exitosas: N
   - Con Error: N

#### Paso E: Generación de Manifiestos

1. Una vez las remesas sean exitosas, haga clic en "Generar Manifiestos XML"
2. El sistema genera un manifiesto por cada remesa exitosa
3. Haga clic en "Enviar al RNDC"
4. Progreso en tiempo real:
   - ✓ OK: Manifiestos aprobados
   - ✗ Error: Manifiestos rechazados
   - Pendientes: En cola

#### Paso F: Generación de PDFs

1. Seleccione los manifiestos exitosos
2. Haga clic en "Generar PDFs"
3. Cada PDF incluye:
   - Datos del manifiesto
   - Código QR con ID del RNDC
   - Información del conductor y vehículo

### 5.3 Gestión de Errores

#### Reintentar Manifiesto Individual

1. Localice el manifiesto con error
2. Haga clic en el botón naranja (↻) para reintentar

#### Regenerar XML desde Excel Actualizado

1. Corrija los datos en el Excel original
2. Cargue el Excel actualizado y valide
3. Haga clic en el botón verde (⟳) para regenerar el XML
4. Luego reintente el envío

#### Actualización Manual

Si el manifiesto fue registrado exitosamente en RNDC pero el sistema muestra error:
1. Consulte el manifiesto en el módulo de Consultas del RNDC
2. Copie el XML de respuesta
3. Haga clic en el botón morado (✎)
4. Pegue el XML y confirme

### 5.4 Despachos Guardados

- **Guardar**: Guarde el progreso en cualquier momento
- **Cargar**: Recupere despachos guardados usando la búsqueda
- **Buscar**: Filtre por nombre, fecha o estado
- **Paginación**: Navegue entre páginas (10 por página)

### 5.5 Numeración Consecutiva

El sistema mantiene automáticamente el consecutivo de remesas/manifiestos configurado en Configuración.

---

## 6. Módulo Inscripción

### 6.1 Descripción

Gestiona el registro de entidades necesarias para los despachos.

### 6.2 Terceros

Registre remitentes, destinatarios, propietarios y tenedores.

| Campo | Descripción |
|-------|-------------|
| Tipo ID | C (Cédula), N (NIT), E (Extranjería) |
| Número ID | Número de identificación |
| Nombre | Nombre o razón social |
| Dirección | Dirección de contacto |
| Teléfono | Número de contacto |
| Municipio | Código DANE del municipio |

### 6.3 Vehículos

Registre los vehículos de la flota.

| Campo | Descripción |
|-------|-------------|
| Placa | Placa del vehículo |
| Tipo | Tipo de carrocería |
| Capacidad | Capacidad en toneladas |
| Propietario | ID del propietario |
| Tenedor | ID del tenedor (si aplica) |
| SOAT | Fecha vencimiento SOAT |
| Tecno | Fecha vencimiento revisión técnica |

### 6.4 Conductores

Registre los conductores autorizados.

| Campo | Descripción |
|-------|-------------|
| Cédula | Número de cédula |
| Nombre | Nombre completo |
| Licencia | Número de licencia |
| Categoría | Categoría de licencia |
| Vencimiento | Fecha vencimiento licencia |

### 6.5 Destinos RNDC

Configure las granjas y plantas con información del RNDC.

| Campo | Descripción |
|-------|-------------|
| Código | Código interno |
| Nombre | Nombre del destino |
| Sede RNDC | Código de sede en RNDC |
| Municipio | Código DANE |
| Flete | Valor del flete por tonelada |

### 6.6 Importación/Exportación

- **Exportar**: Descargue los datos en formato Excel
- **Importar**: Cargue datos masivamente desde Excel

---

## 7. Módulo Facturación

### 7.1 Descripción

Genera reportes de facturación basados en los despachos realizados.

### 7.2 Carga de Datos

1. Cargue el libro de Excel con los datos de despacho
2. El sistema analiza las hojas disponibles
3. Seleccione las columnas relevantes

### 7.3 Tipos de Reporte

#### Resumen

Vista agregada por:
- Cliente/Destino
- Período
- Totales de fletes

#### Detalle

Lista completa de:
- Cada despacho individual
- Información del conductor y vehículo
- Valores de flete

#### Pre-Factura

Documento preliminar para revisión antes de facturar.

### 7.4 Exportación

- Excel: Datos en formato tabular
- PDF: Documento formateado para impresión

---

## 8. Configuración

### 8.1 Credenciales RNDC

| Campo | Descripción |
|-------|-------------|
| Usuario RNDC | Usuario asignado por el RNDC |
| Contraseña RNDC | Contraseña del RNDC |
| NIT Empresa | NIT de la empresa transportadora |
| Ambiente | Producción o Pruebas |

### 8.2 Información de la Empresa

| Campo | Descripción |
|-------|-------------|
| Nombre | Razón social |
| Dirección | Dirección principal |
| Teléfono | Teléfono de contacto |
| Ciudad | Ciudad sede principal |

### 8.3 Consecutivo de Remesas

Configure el número inicial para la numeración automática de remesas y manifiestos.

### 8.4 Configuración GPS

| Campo | Descripción |
|-------|-------------|
| ID GPS | Identificador del proveedor GPS |
| URL Test | URL del ambiente de pruebas RNDC |
| URL Prod | URL del ambiente de producción RNDC |

### 8.5 Perfil de Usuario

- Actualice su nombre
- Cambie su contraseña

---

## 9. Diseñador de Reportes

### 9.1 Descripción

Permite personalizar visualmente la posición de los campos en los PDFs de manifiestos.

### 9.2 Uso del Editor

1. Seleccione una plantilla existente o cree una nueva
2. Arrastre los campos a la posición deseada
3. Ajuste el tamaño de texto si es necesario
4. Guarde la plantilla

### 9.3 Campos Disponibles

#### Campos Predefinidos
- Número de manifiesto
- Fecha de expedición
- Placa del vehículo
- Nombre del conductor
- Origen y destino
- Valor del flete

#### Campos Personalizados
- Puede agregar campos adicionales con etiquetas personalizadas

### 9.4 Previsualización

Use el botón "Vista Previa" para ver cómo quedará el PDF final.

---

## 10. Glosario

| Término | Definición |
|---------|------------|
| **RNDC** | Registro Nacional de Despacho de Carga |
| **Remesa** | Documento que ampara la mercancía transportada |
| **Manifiesto** | Documento que ampara el servicio de transporte |
| **Tercero** | Persona natural o jurídica (remitente, destinatario, propietario) |
| **Titular** | Propietario o tenedor del vehículo |
| **SOAT** | Seguro Obligatorio de Accidentes de Tránsito |
| **Consecutivo** | Número secuencial asignado a remesas/manifiestos |
| **Batch** | Lote de envíos procesados en grupo |
| **SOAP** | Protocolo de comunicación con el RNDC |

---

## 11. Solución de Problemas

### 11.1 Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| "Credenciales inválidas" | Usuario/contraseña incorrectos | Verifique en Configuración |
| "Placa no encontrada" | Vehículo no registrado en RNDC | Registre el vehículo en RNDC |
| "Conductor no habilitado" | Licencia vencida o no registrada | Actualice datos en RNDC |
| "Consecutivo duplicado" | Número ya usado | Ajuste el consecutivo en Configuración |
| "Timeout de conexión" | Servidor RNDC no responde | Reintente más tarde |

### 11.2 Mejores Prácticas

1. **Valide antes de enviar**: Siempre complete los 3 pasos de validación
2. **Guarde frecuentemente**: Use "Guardar Despacho" para no perder progreso
3. **Horarios de menor carga**: El RNDC funciona mejor en horarios nocturnos
4. **Respalde sus datos**: Exporte periódicamente la información

### 11.3 Soporte

Para asistencia técnica, contacte al administrador del sistema.

---

*Manual de Funcionamiento - RNDC Connect v1.0*
*Última actualización: Enero 2026*
