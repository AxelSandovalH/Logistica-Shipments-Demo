-- ============================================================
-- LOGÍSTICA SHIPMENTS — PostgreSQL Schema
-- Versión: 1.0.0  |  Motor: PostgreSQL 15+
-- Multi-tenant: shared schema + agency_id + RLS
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- búsqueda difusa en direcciones


-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'admin',            -- acceso total al sistema (sin agency_id)
    'agency_manager',   -- admin de su agencia
    'agency_operator',  -- captura y edición dentro de la agencia
    'driver'            -- solo ve su ruta del día
);

CREATE TYPE package_type AS ENUM (
    'envelope',
    'box',
    'pallet',
    'fragile',
    'other'
);

CREATE TYPE service_type AS ENUM (
    'standard',
    'express',
    'economy'
);

CREATE TYPE shipment_status AS ENUM (
    'captured',     -- registrado en caja, aún no recibido físicamente
    'received',     -- recibido en bodega origen (EE.UU.)
    'in_transit',   -- en camino a México (consolidado)
    'in_route',     -- asignado a ruta de última milla
    'delivered',    -- entregado al destinatario
    'failed',       -- intento fallido
    'returned',     -- devuelto al remitente
    'cancelled'
);

CREATE TYPE tracking_event_type AS ENUM (
    'captured',
    'received',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'failed_attempt',
    'returned',
    'cancelled',
    'incident',
    'note'          -- comentario manual del operador
);

CREATE TYPE consolidation_status AS ENUM (
    'open',         -- aceptando envíos
    'closed',       -- lote cerrado, listo para despacho
    'in_transit',   -- en camino
    'arrived',      -- llegó a destino
    'cancelled'
);

CREATE TYPE transport_type AS ENUM (
    'truck',
    'air',
    'sea',
    'van'
);

CREATE TYPE route_status AS ENUM (
    'planned',
    'in_progress',
    'completed',
    'cancelled'
);

CREATE TYPE stop_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'skipped'
);

CREATE TYPE incident_type AS ENUM (
    'no_one_home',
    'wrong_address',
    'rejected',
    'damaged',
    'lost',
    'other'
);

CREATE TYPE incident_resolution AS ENUM (
    'redelivery',
    'returned',
    'resolved',
    'pending',
    'cancelled'
);

CREATE TYPE billing_plan_type AS ENUM (
    'per_guide',    -- cobro por guía generada
    'monthly',      -- cuota fija mensual con guías incluidas
    'hybrid'        -- cuota fija + excedente por guía
);

CREATE TYPE invoice_status AS ENUM (
    'draft',
    'sent',
    'paid',
    'overdue',
    'cancelled'
);

CREATE TYPE payment_status AS ENUM (
    'pending',
    'confirmed',
    'failed',
    'refunded'
);

CREATE TYPE payment_method AS ENUM (
    'transfer',
    'cash',
    'card',
    'other'
);

CREATE TYPE subscription_status AS ENUM (
    'active',
    'suspended',
    'cancelled'
);

CREATE TYPE app_currency AS ENUM ('MXN', 'USD');


-- ============================================================
-- FUNCIÓN: auto-actualizar updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- FUNCIÓN: generar número de guía único
-- Formato: LOG-YYYYMM-XXXXXXXX (ej. LOG-202601-A4KR8NP2)
-- ============================================================

CREATE OR REPLACE FUNCTION generate_tracking_number()
RETURNS TEXT AS $$
DECLARE
    chars  TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    suffix TEXT := '';
    i      INT;
BEGIN
    FOR i IN 1..8 LOOP
        suffix := suffix || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN 'LOG-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || suffix;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 1. AGENCIES  (tenants)
-- ============================================================

CREATE TABLE agencies (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(150) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,   -- usado en URLs / subdominios
    logo_url        TEXT,
    contact_email   VARCHAR(255),
    contact_phone   VARCHAR(30),
    config          JSONB       NOT NULL DEFAULT '{}',  -- estados custom, tipos de servicio
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_agencies_updated_at
    BEFORE UPDATE ON agencies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 2. USERS
-- ============================================================

CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id       UUID        REFERENCES agencies(id) ON DELETE CASCADE,  -- NULL solo para 'admin'
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    role            user_role   NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(30),
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- admin global no pertenece a ninguna agencia; todos los demás sí
    CONSTRAINT chk_admin_no_agency CHECK (
        (role = 'admin' AND agency_id IS NULL) OR
        (role <> 'admin' AND agency_id IS NOT NULL)
    )
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_users_agency_id ON users(agency_id);
CREATE INDEX idx_users_role      ON users(role);


-- ============================================================
-- 3. ADDRESSES
-- ============================================================

CREATE TABLE addresses (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id           UUID        REFERENCES agencies(id) ON DELETE CASCADE,
    label               VARCHAR(100),               -- alias: "Bodega Chicago", "Casa Ana"
    street              VARCHAR(255) NOT NULL,
    exterior_number     VARCHAR(20),
    interior_number     VARCHAR(20),
    neighborhood        VARCHAR(150),               -- colonia (MX) / district (US)
    city                VARCHAR(100) NOT NULL,
    state               VARCHAR(100) NOT NULL,
    country             CHAR(2)     NOT NULL,       -- ISO 3166-1: MX | US
    postal_code         VARCHAR(15),
    lat                 DECIMAL(10, 7),
    lng                 DECIMAL(10, 7),
    geocode_score       SMALLINT    CHECK (geocode_score BETWEEN 0 AND 100),
    is_verified         BOOLEAN     NOT NULL DEFAULT FALSE,
    raw_input           TEXT,                       -- texto original antes de geocodificar
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_addresses_updated_at
    BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_addresses_agency_id ON addresses(agency_id);
CREATE INDEX idx_addresses_geo       ON addresses(lat, lng)
    WHERE lat IS NOT NULL AND lng IS NOT NULL;
-- índice trigram para autocompletado de calle/ciudad
CREATE INDEX idx_addresses_street_trgm ON addresses USING gin(street gin_trgm_ops);


-- ============================================================
-- 4. CUSTOMERS  (destinatarios finales)
-- ============================================================

CREATE TABLE customers (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id   UUID        NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    full_name   VARCHAR(200) NOT NULL,
    email       VARCHAR(255),
    phone       VARCHAR(30),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_customers_agency_id ON customers(agency_id);


-- ============================================================
-- 5. SHIPMENTS  (guías — entidad central del sistema)
-- ============================================================

CREATE TABLE shipments (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_number         VARCHAR(30)     NOT NULL UNIQUE DEFAULT generate_tracking_number(),
    agency_id               UUID            NOT NULL REFERENCES agencies(id)   ON DELETE RESTRICT,
    customer_id             UUID            REFERENCES customers(id)           ON DELETE SET NULL,
    origin_address_id       UUID            REFERENCES addresses(id)           ON DELETE SET NULL,
    destination_address_id  UUID            NOT NULL REFERENCES addresses(id)  ON DELETE RESTRICT,
    weight_kg               DECIMAL(8, 3),
    dimensions              JSONB,          -- {width_cm, height_cm, depth_cm}
    package_type            package_type    NOT NULL DEFAULT 'box',
    service_type            service_type    NOT NULL DEFAULT 'standard',
    declared_value          DECIMAL(12, 2),
    currency                app_currency    NOT NULL DEFAULT 'USD',
    status                  shipment_status NOT NULL DEFAULT 'captured',
    assigned_driver_id      UUID            REFERENCES users(id)               ON DELETE SET NULL,
    notes                   TEXT,
    created_by_user_id      UUID            REFERENCES users(id)               ON DELETE SET NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_shipments_agency_id        ON shipments(agency_id);
CREATE INDEX idx_shipments_status           ON shipments(status);
CREATE INDEX idx_shipments_customer_id      ON shipments(customer_id);
CREATE INDEX idx_shipments_tracking_number  ON shipments(tracking_number);
CREATE INDEX idx_shipments_created_at       ON shipments(created_at DESC);
CREATE INDEX idx_shipments_driver           ON shipments(assigned_driver_id) WHERE assigned_driver_id IS NOT NULL;


-- ============================================================
-- 6. TRACKING EVENTS  (log inmutable — append only)
-- ============================================================

CREATE TABLE tracking_events (
    id                  UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id         UUID                 NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    event_type          tracking_event_type  NOT NULL,
    description         TEXT,
    location_lat        DECIMAL(10, 7),
    location_lng        DECIMAL(10, 7),
    location_label      VARCHAR(255),
    created_by_user_id  UUID                 REFERENCES users(id) ON DELETE SET NULL,
    metadata            JSONB                NOT NULL DEFAULT '{}',
    occurred_at         TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ          NOT NULL DEFAULT NOW()
    -- sin updated_at: esta tabla es de solo escritura
);

-- Protección de integridad histórica: bloquear UPDATE y DELETE
CREATE RULE no_update_tracking_events AS ON UPDATE TO tracking_events DO INSTEAD NOTHING;
CREATE RULE no_delete_tracking_events AS ON DELETE TO tracking_events DO INSTEAD NOTHING;

CREATE INDEX idx_tracking_events_shipment_id  ON tracking_events(shipment_id);
CREATE INDEX idx_tracking_events_occurred_at  ON tracking_events(occurred_at DESC);


-- ============================================================
-- 7. CONSOLIDATIONS  (lotes de mercancía)
-- ============================================================

CREATE TABLE consolidations (
    id                  UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id           UUID                 NOT NULL REFERENCES agencies(id) ON DELETE RESTRICT,
    code                VARCHAR(50)          NOT NULL UNIQUE,   -- ej. LOTE-202601-001
    transport_type      transport_type       NOT NULL DEFAULT 'truck',
    transport_ref       VARCHAR(150),        -- guía del carrier externo (FedEx, DHL, etc.)
    status              consolidation_status NOT NULL DEFAULT 'open',
    departure_date      DATE,
    arrival_date        DATE,
    notes               TEXT,
    created_by_user_id  UUID                 REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_consolidations_updated_at
    BEFORE UPDATE ON consolidations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_consolidations_agency_id ON consolidations(agency_id);
CREATE INDEX idx_consolidations_status    ON consolidations(status);


-- ============================================================
-- 8. CONSOLIDATION_SHIPMENTS  (pivot lote ↔ envío)
-- ============================================================

CREATE TABLE consolidation_shipments (
    consolidation_id    UUID        NOT NULL REFERENCES consolidations(id) ON DELETE CASCADE,
    shipment_id         UUID        NOT NULL REFERENCES shipments(id)      ON DELETE CASCADE,
    added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by_user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (consolidation_id, shipment_id)
);

CREATE INDEX idx_cs_shipment_id ON consolidation_shipments(shipment_id);


-- ============================================================
-- 9. ROUTES  (rutas de última milla)
-- ============================================================

CREATE TABLE routes (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id           UUID         NOT NULL REFERENCES agencies(id) ON DELETE RESTRICT,
    driver_id           UUID         NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
    route_date          DATE         NOT NULL,
    status              route_status NOT NULL DEFAULT 'planned',
    vehicle_info        JSONB,       -- {plate, model, color}
    notes               TEXT,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_by_user_id  UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_routes_updated_at
    BEFORE UPDATE ON routes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_routes_agency_id  ON routes(agency_id);
CREATE INDEX idx_routes_driver_id  ON routes(driver_id);
CREATE INDEX idx_routes_route_date ON routes(route_date DESC);
CREATE INDEX idx_routes_status     ON routes(status);


-- ============================================================
-- 10. ROUTE_STOPS  (paradas de la ruta)
-- ============================================================

CREATE TABLE route_stops (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id        UUID        NOT NULL REFERENCES routes(id)    ON DELETE CASCADE,
    shipment_id     UUID        NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    stop_order      SMALLINT    NOT NULL,
    status          stop_status NOT NULL DEFAULT 'pending',
    arrived_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    notes           TEXT,
    photo_url       TEXT,
    signature_url   TEXT,
    actual_lat      DECIMAL(10, 7),
    actual_lng      DECIMAL(10, 7),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (route_id, shipment_id),
    UNIQUE (route_id, stop_order)
);

CREATE TRIGGER trg_route_stops_updated_at
    BEFORE UPDATE ON route_stops
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_route_stops_route_id    ON route_stops(route_id);
CREATE INDEX idx_route_stops_shipment_id ON route_stops(shipment_id);


-- ============================================================
-- 11. INCIDENTS  (incidencias de entrega)
-- ============================================================

CREATE TABLE incidents (
    id                  UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id         UUID                NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    agency_id           UUID                NOT NULL REFERENCES agencies(id)  ON DELETE RESTRICT,
    route_stop_id       UUID                REFERENCES route_stops(id)        ON DELETE SET NULL,
    type                incident_type       NOT NULL,
    description         TEXT,
    resolution          incident_resolution NOT NULL DEFAULT 'pending',
    resolution_notes    TEXT,
    retry_count         SMALLINT            NOT NULL DEFAULT 0,
    next_attempt_date   DATE,
    created_by_user_id  UUID                REFERENCES users(id) ON DELETE SET NULL,
    resolved_by_user_id UUID                REFERENCES users(id) ON DELETE SET NULL,
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_incidents_updated_at
    BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_incidents_shipment_id ON incidents(shipment_id);
CREATE INDEX idx_incidents_agency_id   ON incidents(agency_id);
CREATE INDEX idx_incidents_resolution  ON incidents(resolution);


-- ============================================================
-- 12. BILLING PLANS
-- ============================================================

CREATE TABLE billing_plans (
    id                  UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(100)      NOT NULL,
    plan_type           billing_plan_type NOT NULL,
    price_per_guide     DECIMAL(10, 4),   -- solo para per_guide e hybrid
    monthly_fee         DECIMAL(10, 2),   -- solo para monthly e hybrid
    included_guides     INTEGER,          -- guías incluidas en cuota mensual
    currency            app_currency      NOT NULL DEFAULT 'MXN',
    is_active           BOOLEAN           NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_billing_plans_updated_at
    BEFORE UPDATE ON billing_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 13. AGENCY_SUBSCRIPTIONS
-- ============================================================

CREATE TABLE agency_subscriptions (
    id          UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id   UUID                 NOT NULL REFERENCES agencies(id)      ON DELETE CASCADE,
    plan_id     UUID                 NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
    status      subscription_status  NOT NULL DEFAULT 'active',
    started_at  TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    ends_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_agency_subscriptions_updated_at
    BEFORE UPDATE ON agency_subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_subs_agency_id ON agency_subscriptions(agency_id);


-- ============================================================
-- 14. INVOICES
-- ============================================================

CREATE TABLE invoices (
    id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id       UUID           NOT NULL REFERENCES agencies(id)             ON DELETE RESTRICT,
    subscription_id UUID           REFERENCES agency_subscriptions(id)          ON DELETE SET NULL,
    period_start    DATE           NOT NULL,
    period_end      DATE           NOT NULL,
    total_guides    INTEGER        NOT NULL DEFAULT 0,
    subtotal        DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax             DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total           DECIMAL(12, 2) NOT NULL DEFAULT 0,
    currency        app_currency   NOT NULL DEFAULT 'MXN',
    status          invoice_status NOT NULL DEFAULT 'draft',
    due_date        DATE,
    paid_at         TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_invoice_total   CHECK (total = subtotal + tax),
    CONSTRAINT chk_invoice_period  CHECK (period_end >= period_start)
);

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_invoices_agency_id ON invoices(agency_id);
CREATE INDEX idx_invoices_status    ON invoices(status);


-- ============================================================
-- 15. INVOICE_ITEMS
-- ============================================================

CREATE TABLE invoice_items (
    id          UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id  UUID           NOT NULL REFERENCES invoices(id)  ON DELETE CASCADE,
    shipment_id UUID           REFERENCES shipments(id)          ON DELETE SET NULL,
    description VARCHAR(255)   NOT NULL,
    quantity    INTEGER        NOT NULL DEFAULT 1,
    unit_price  DECIMAL(10, 4) NOT NULL,
    total       DECIMAL(12, 2) NOT NULL,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_item_total  CHECK (ABS(total - (quantity * unit_price)) < 0.01)
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);


-- ============================================================
-- 16. PAYMENTS
-- ============================================================

CREATE TABLE payments (
    id                  UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id          UUID           NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    amount              DECIMAL(12, 2) NOT NULL,
    currency            app_currency   NOT NULL DEFAULT 'MXN',
    method              payment_method NOT NULL,
    reference           VARCHAR(255),
    status              payment_status NOT NULL DEFAULT 'pending',
    paid_at             TIMESTAMPTZ,
    notes               TEXT,
    created_by_user_id  UUID           REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);


-- ============================================================
-- 17. SYSTEM_CONFIG  (configuración clave-valor global o por agencia)
-- ============================================================

CREATE TABLE system_config (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id   UUID        REFERENCES agencies(id) ON DELETE CASCADE,  -- NULL = configuración global
    key         VARCHAR(100) NOT NULL,
    value       JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (agency_id, key)
);

CREATE TRIGGER trg_system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEMILLA: datos base requeridos para operar
-- ============================================================

INSERT INTO billing_plans (name, plan_type, price_per_guide, monthly_fee, included_guides, currency) VALUES
    ('Básico',       'per_guide', 2.50,  NULL, NULL, 'USD'),
    ('Profesional',  'monthly',   NULL,  99.00, 100, 'USD'),
    ('Enterprise',   'hybrid',    1.50, 299.00, 500, 'USD');

INSERT INTO system_config (agency_id, key, value) VALUES
    (NULL, 'default_currency',        '"USD"'),
    (NULL, 'max_retry_attempts',      '3'),
    (NULL, 'weekly_collection_day',   '"monday"'),
    (NULL, 'tracking_url_base',       '"https://track.logistica.mx/t/"');
