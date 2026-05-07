# Diseño de Base de Datos — Logística Shipments

## Decisiones Arquitectónicas

### Motor: PostgreSQL 15+
- JSONB nativo para datos flexibles (dimensiones, configuración, metadata de eventos)
- `pg_trgm` para autocompletado de direcciones con búsqueda difusa
- UUIDs como PKs: evita enumeración de IDs en la API pública y facilita sistemas distribuidos
- `TIMESTAMPTZ` en todos los campos de tiempo: operación en dos países (EE.UU. / México)

### Multi-tenancy: Shared Schema + `agency_id`
Todas las tablas operativas incluyen `agency_id`. El aislamiento se implementa a nivel de aplicación con filtros obligatorios, y puede reforzarse con Row Level Security (RLS) de PostgreSQL en producción.

**Ventajas sobre schemas separados:**
- Migraciones simples (un solo `ALTER TABLE`)
- Queries de reporte cross-agency para el admin global
- Sin overhead de gestión de conexiones por schema

### Append-Only: `tracking_events`
Los eventos de tracking son inmutables por diseño. Se bloquean `UPDATE` y `DELETE` con reglas de PostgreSQL. Esto garantiza trazabilidad completa y cumple con requisitos de auditoría futura.

### Máquina de Estados: `shipments.status`

```
captured
   │
   ▼
received          ←── recibido físicamente en bodega EE.UU.
   │
   ▼
in_transit        ←── asignado a un lote (consolidation)
   │
   ▼
in_route          ←── asignado a ruta de última milla
   │         │
   ▼         ▼
delivered  failed ──► returned
                 └──► in_route (reintento)
```

Transiciones permitidas:
| Desde        | Hacia                          |
|-------------|-------------------------------|
| captured    | received, cancelled            |
| received    | in_transit, cancelled          |
| in_transit  | in_route, cancelled            |
| in_route    | delivered, failed              |
| failed      | in_route (reintento), returned |

---

## Diagrama ERD

```mermaid
erDiagram
    agencies {
        uuid id PK
        varchar name
        varchar slug
        jsonb config
        boolean is_active
    }

    users {
        uuid id PK
        uuid agency_id FK
        varchar email
        user_role role
        boolean is_active
    }

    addresses {
        uuid id PK
        uuid agency_id FK
        varchar street
        varchar city
        char country
        decimal lat
        decimal lng
        smallint geocode_score
    }

    customers {
        uuid id PK
        uuid agency_id FK
        varchar full_name
        varchar email
        varchar phone
    }

    shipments {
        uuid id PK
        varchar tracking_number
        uuid agency_id FK
        uuid customer_id FK
        uuid origin_address_id FK
        uuid destination_address_id FK
        shipment_status status
        service_type service_type
        package_type package_type
        decimal weight_kg
        jsonb dimensions
    }

    tracking_events {
        uuid id PK
        uuid shipment_id FK
        tracking_event_type event_type
        text description
        decimal location_lat
        decimal location_lng
        jsonb metadata
        timestamptz occurred_at
    }

    consolidations {
        uuid id PK
        uuid agency_id FK
        varchar code
        consolidation_status status
        transport_type transport_type
        varchar transport_ref
        date departure_date
        date arrival_date
    }

    consolidation_shipments {
        uuid consolidation_id FK
        uuid shipment_id FK
    }

    routes {
        uuid id PK
        uuid agency_id FK
        uuid driver_id FK
        date route_date
        route_status status
        jsonb vehicle_info
    }

    route_stops {
        uuid id PK
        uuid route_id FK
        uuid shipment_id FK
        smallint stop_order
        stop_status status
        text photo_url
        decimal actual_lat
        decimal actual_lng
    }

    incidents {
        uuid id PK
        uuid shipment_id FK
        uuid agency_id FK
        uuid route_stop_id FK
        incident_type type
        incident_resolution resolution
        smallint retry_count
        date next_attempt_date
    }

    billing_plans {
        uuid id PK
        varchar name
        billing_plan_type plan_type
        decimal price_per_guide
        decimal monthly_fee
        integer included_guides
    }

    agency_subscriptions {
        uuid id PK
        uuid agency_id FK
        uuid plan_id FK
        subscription_status status
        timestamptz started_at
        timestamptz ends_at
    }

    invoices {
        uuid id PK
        uuid agency_id FK
        uuid subscription_id FK
        date period_start
        date period_end
        decimal subtotal
        decimal tax
        decimal total
        invoice_status status
    }

    invoice_items {
        uuid id PK
        uuid invoice_id FK
        uuid shipment_id FK
        varchar description
        integer quantity
        decimal unit_price
        decimal total
    }

    payments {
        uuid id PK
        uuid invoice_id FK
        decimal amount
        payment_method method
        payment_status status
        timestamptz paid_at
    }

    agencies         ||--o{ users                 : "tiene"
    agencies         ||--o{ addresses             : "guarda"
    agencies         ||--o{ customers             : "tiene"
    agencies         ||--o{ shipments             : "opera"
    agencies         ||--o{ consolidations        : "crea"
    agencies         ||--o{ routes                : "gestiona"
    agencies         ||--o{ incidents             : "registra"
    agencies         ||--o{ agency_subscriptions  : "suscribe"
    agencies         ||--o{ invoices              : "factura"

    billing_plans    ||--o{ agency_subscriptions  : "define"
    agency_subscriptions ||--o{ invoices          : "genera"
    invoices         ||--o{ invoice_items         : "contiene"
    invoices         ||--o{ payments              : "cobra"

    customers        ||--o{ shipments             : "recibe"
    addresses        ||--o{ shipments             : "origen de"
    addresses        ||--o{ shipments             : "destino de"

    shipments        ||--o{ tracking_events       : "registra"
    shipments        ||--o{ consolidation_shipments : "agrupa en"
    consolidations   ||--o{ consolidation_shipments : "contiene"

    routes           ||--o{ route_stops           : "tiene"
    shipments        ||--o{ route_stops           : "se entrega en"
    users            ||--o{ routes                : "conduce"

    shipments        ||--o{ incidents             : "genera"
    route_stops      ||--o{ incidents             : "origina"
    shipments        ||--o{ invoice_items         : "se cobra en"
```

---

## Tabla de Entidades

| Tabla                    | Propósito                                        | Fase |
|--------------------------|--------------------------------------------------|------|
| `agencies`               | Tenants del sistema (ej. Manzanillo Express)     | MVP  |
| `users`                  | Todos los usuarios con sus roles                 | MVP  |
| `addresses`              | Direcciones origen (EE.UU.) y destino (MX)       | MVP  |
| `customers`              | Destinatarios finales de los envíos              | MVP  |
| `shipments`              | **Entidad central** — cada guía generada         | MVP  |
| `tracking_events`        | Log inmutable de eventos por envío               | MVP  |
| `consolidations`         | Lotes de mercancía para envío consolidado        | F2   |
| `consolidation_shipments`| Pivot lote ↔ envío                               | F2   |
| `routes`                 | Rutas de última milla por día y chofer           | F2   |
| `route_stops`            | Paradas ordenadas dentro de una ruta             | F2   |
| `incidents`              | Incidencias: fallo, dirección incorrecta, etc.   | F2   |
| `billing_plans`          | Planes de cobro (por guía, mensual, híbrido)     | F1   |
| `agency_subscriptions`   | Suscripción activa de cada agencia               | F1   |
| `invoices`               | Facturas por período                             | F1   |
| `invoice_items`          | Líneas de detalle de cada factura                | F1   |
| `payments`               | Pagos aplicados a facturas                       | F1   |
| `system_config`          | Configuración clave-valor global o por agencia   | MVP  |

---

## Estrategia de Índices

| Tabla              | Índice                              | Justificación                                      |
|--------------------|-------------------------------------|----------------------------------------------------|
| `users`            | `(agency_id)`                       | Filtro principal en todos los queries              |
| `shipments`        | `(agency_id)`, `(status)`           | Dashboard y filtros de estado                      |
| `shipments`        | `(tracking_number)`                 | Tracking público por guía                          |
| `shipments`        | `(created_at DESC)`                 | Lista paginada más recientes primero               |
| `tracking_events`  | `(shipment_id)`, `(occurred_at DESC)`| Timeline por envío                                |
| `addresses`        | `(lat, lng)` parcial               | Queries geoespaciales de optimización de rutas     |
| `addresses`        | `GIN trigram (street)`              | Autocompletado de direcciones                      |
| `routes`           | `(driver_id)`, `(route_date DESC)` | App del chofer: ruta del día                       |
| `incidents`        | `(resolution)`                      | Filtrar pendientes de resolución                   |

---

## Campos JSONB

| Tabla         | Campo          | Estructura esperada                                        |
|---------------|----------------|------------------------------------------------------------|
| `agencies`    | `config`       | `{"custom_statuses": [], "service_types": [], "branding": {}}` |
| `shipments`   | `dimensions`   | `{"width_cm": 30, "height_cm": 20, "depth_cm": 15}`       |
| `routes`      | `vehicle_info` | `{"plate": "ABC123", "model": "Sprinter", "color": "blanco"}` |
| `tracking_events` | `metadata` | Libre — foto_url, firma, coordenadas del chofer, etc.      |
| `system_config` | `value`      | Cualquier valor serializable según la clave                |

---

## Número de Guía

Formato: `LOG-YYYYMM-XXXXXXXX`

- Ejemplo: `LOG-202601-A4KR8NP2`
- Generado automáticamente por la función `generate_tracking_number()`
- Caracteres: alfanumérico sin ambiguos (sin `0`, `O`, `I`, `1`)
- Colisión: probabilidad ~1 en 33^8 ≈ 1 en 1.35 billones por mes

---

## Consideraciones de Seguridad

- `password_hash`: bcrypt con cost factor ≥ 12. Nunca almacenar texto plano.
- Tracking público (`/t/{tracking_number}`): endpoint sin auth, solo expone estado y eventos sin PII.
- RLS (Row Level Security) de PostgreSQL: activar en producción usando `agency_id` del JWT como variable de sesión para aislamiento a nivel de base de datos.
- Campos `photo_url` y `signature_url` en `route_stops`: almacenar en S3/blob storage, la DB solo guarda la URL firmada.

---

## Extensiones Futuras

| Módulo                  | Cambio de esquema                                               |
|-------------------------|-----------------------------------------------------------------|
| Score de dirección      | Columna `reliability_score` en `addresses`                     |
| Score de zona           | Nueva tabla `zone_scores(zone_geom, score, updated_at)`        |
| Integración FedEx/DHL   | Nueva tabla `external_carrier_events(shipment_id, carrier, raw_payload)` |
| Chat IA para reenvíos   | Nueva tabla `ai_conversations(incident_id, messages JSONB)`     |
| Geocoding avanzado      | Columna `geom GEOMETRY(Point, 4326)` en `addresses` con PostGIS |
