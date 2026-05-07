# Logística Shipments — Sistema de Tracking y Última Milla

> Sistema modular donde todo gira alrededor del envío, pero el valor real está en el tracking y la última milla.

---

## Descripción del Negocio

Plataforma de gestión logística B2B orientada a empresas de paquetería que operan rutas **Estados Unidos → México**. El sistema reemplaza procesos manuales de guías, consolida mercancía para recolecciones semanales y expone el estado de cada envío en tiempo real — tanto a agencias vendedoras (multi-tenant) como al cliente final.

**Problema central:** las guías se operan de forma manual, no hay visibilidad del estado del negocio ni trazabilidad para el chofer de última milla.

**Solución:** sistema multiusuario que, desde la captura en caja, registra cada evento y construye automáticamente la ruta del día para el chofer.

---

## Arquitectura de Módulos

El sistema se divide en **16 módulos** agrupados por fase de entrega.

### Fase 1 — MVP

| # | Módulo | Descripción |
|---|--------|-------------|
| 1 | **Captura de Envíos** | Creación de guías con datos del cliente, dirección estructurada + geolocalización, peso/tipo de paquete y estado inicial automático. |
| 2 | **Portal de Agencias (Multi-tenant)** | Cada cliente tipo "Manzanillo Express" accede a su propio dashboard, ve únicamente sus envíos y gestiona sus usuarios. Aislamiento total por agencia. |
| 3 | **Gestión de Guías** | Lista de envíos con filtros, edición, historial de cambios y control de estados. |
| 4 | **Motor de Tracking** | Timeline por envío con eventos: `recibido → en tránsito → en ruta → entregado`. Historial completo e inmutable. |

### Fase 2 — Operaciones

| # | Módulo | Descripción |
|---|--------|-------------|
| 5 | **Consolidación de Mercancía** | Agrupa envíos en lotes, los asigna a transporte y mueve estados de forma masiva. |
| 6 | **Gestión de Rutas (Última Milla)** | Creación de rutas, asignación de envíos, orden de paradas y optimización manual inicial. |
| 7 | **App / Panel de Chofer** | Vista de ruta del día, marcado de entrega/fallo, registro de incidencias y captura opcional de foto + ubicación. |

### Fase 3 — Inteligencia y Escala

| # | Módulo | Descripción |
|---|--------|-------------|
| 8 | **Analytics** | % de entregas exitosas, tiempo promedio, intentos por entrega y zonas problemáticas. |
| 9 | **Gestión de Direcciones Inteligentes** | Direcciones frecuentes guardadas, geocoding (lat/lng), score de dirección y autocompletado. |
| 10 | **Tracking Público** | Página sin login por URL de guía; UX simple para el cliente final. |
| 11 | **Integraciones / API** | Endpoints REST (crear envío, actualizar estado) + webhooks. Preparado para FedEx y DHL. |

### Módulos Transversales (todas las fases)

| # | Módulo | Descripción |
|---|--------|-------------|
| 12 | **Gestión de Usuarios y Roles** | Roles: `Admin`, `Agencia`, `Chofer`. Permisos granulares y control de accesos. |
| 13 | **Facturación / Cobros** *(opcional)* | Cobro por guía, plan mensual, historial de pagos. |
| 14 | **Configuración del Sistema** | Estados personalizados, tipos de servicio y reglas operativas. |
| 15 | **Gestión de Incidencias** | Paquetes fallidos, reintentos y motivos: no estaba / dirección incorrecta / rechazado. |
| 16 | **Motor de Decisiones** *(futuro)* | Score de dirección y zona, sugerencias de horario y agrupación de rutas con soporte de IA. |

---

## Roles de Usuario

```
Admin
 └─ Visibilidad total del sistema, configuración y reportes

Agencia  (ej. Manzanillo Express)
 └─ Dashboard propio, sus envíos, sus usuarios, sus direcciones

Chofer
 └─ Ruta del día, marcado de entrega/incidencia

Cliente Final
 └─ Tracking público por URL de guía (sin login)
```

---

## Flujo Operativo Principal

```
1. Captura en caja  →  guía generada + estado "recibido"
2. Agencia visualiza envío en su portal
3. Operador consolida envíos en lote semanal
4. Se asigna lote a transporte  →  estado "en tránsito"
5. Llegada a destino  →  se crea ruta de última milla
6. Chofer ve ruta en app  →  marca entregado / fallido
7. Cliente consulta estado en tracking público
8. Incidencias escalan a humano de soporte o IA para reenvíos
```

---

## Características Clave de UX/UI

- **Funcional desde el primer día:** MVP diseñado para operar con mínima fricción.
- **Multi-tenant real:** cada agencia vive en su propio espacio sin contaminación de datos.
- **El dato más importante es la última milla:** toda la interfaz prioriza el estado de entrega final.
- **Chat con IA para reenvíos:** asistencia automatizada para gestionar terceros; humano disponible como fallback para casos no automatizables.
- **Tracking público sin login:** UX simple para el destinatario final, accesible por URL única de guía.

---

## Stack Tecnológico Sugerido

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js + Tailwind CSS |
| Backend / API | Node.js (NestJS) o Go |
| Base de datos | PostgreSQL + PostGIS (geodatos) |
| Autenticación | JWT + RBAC multi-tenant |
| Geocoding | Google Maps API / Mapbox |
| Tiempo real | WebSockets / Server-Sent Events |
| Infraestructura | Docker + Railway / Render |
| Integraciones futuras | FedEx API, DHL API |

---

## Roadmap

```
Q1  ──  MVP: Captura · Portal Agencias · Guías · Tracking básico
Q2  ──  Consolidación · Rutas · App Chofer
Q3  ──  Analytics · Inteligencia · API pública
Q4  ──  Motor de decisiones · Score de dirección · IA para reenvíos
```

---

## Contexto de Negocio

- **Segmento:** B2B — empresa de logística que da servicio a otras empresas de logística.
- **Corredor:** Estados Unidos → México.
- **Frecuencia de recolección:** semanal (una vez por semana).
- **Servicio diferenciador:** última milla con trazabilidad en tiempo real.
- **Acceso:** target privado, no marketplace público.

---

## Contribución

1. Crea una rama desde `main` siguiendo la convención `feature/<módulo>-<descripción>`.
2. Cada PR debe referenciar el módulo correspondiente del roadmap.
3. Los cambios en esquema de base de datos requieren migración versionada.
4. Toda lógica de negocio core (estados de guía, eventos de tracking) debe estar cubierta con tests.

---

*Logística Shipments Demo — construido para escalar desde el primer envío.*
