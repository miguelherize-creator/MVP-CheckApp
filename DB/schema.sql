-- ============================================================================
-- WALVY DB v2.0 — Schema Combinado (Producción)
-- PostgreSQL 15+
-- Generado: 2026-05-05
--
-- Base: Walvy DB (schema.sql, G1–G15)
-- Mejoras aplicadas de: Edificate DB (walvy_model_postgres_v4_iter5_final_exec_audited.sql)
--
-- Filosofía:
--   - Status centralizado (status_domain + status) en lugar de ENUMs rígidos
--   - Multi-país y multi-moneda desde el inicio (ISO-3166 / ISO-4217)
--   - RBAC granular (role + permission + role_permission)
--   - Deduplicación de movimientos (source_fingerprint UNIQUE)
--   - Historial de clasificación (movement_classification_history)
--   - Precios versionados (plan_price con valid_from/valid_to)
--   - B2B corporativo (company + contract + eligible_employee)
--   - Read models CQRS explícitos (4 tablas de summary)
--   - Vistas de negocio (v_user_access, v_user_home_month, etc.)
--   - Motor de deudas operacional completo (debt_payments + schedules + attachments)
--   - Gamificación completa (G11 intacto — diferenciador de producto)
--   - Asistente IA (G13 intacto — diferenciador de producto)
--   - Backoffice propio + app_config operacional
--   - Soft deletes en tablas financieras críticas
--   - Idempotencia de webhooks de pago (payment_order.commerce_order UNIQUE)
--
-- Ejecución:
--   psql -d walvy -f schema.sql
-- Reset (DBeaver):
--   DROP SCHEMA public CASCADE; CREATE SCHEMA public;
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- FUNCIONES GLOBALES
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Valida que un status_id pertenezca al dominio esperado. SQLSTATE 23514 si falla.
CREATE OR REPLACE FUNCTION enforce_status_domain(expected_domain_code text, p_status_id bigint)
RETURNS void AS $$
DECLARE v_ok boolean;
BEGIN
  SELECT TRUE INTO v_ok
    FROM status s
    JOIN status_domain d ON d.status_domain_id = s.status_domain_id
   WHERE s.status_id = p_status_id AND d.code = expected_domain_code LIMIT 1;
  IF COALESCE(v_ok, FALSE) = FALSE THEN
    RAISE EXCEPTION 'status_id % no pertenece al dominio %', p_status_id, expected_domain_code
      USING ERRCODE = '23514';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- LAYER 0 — CATÁLOGOS BASE (ISO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS country (
  country_id   BIGSERIAL    PRIMARY KEY,
  country_code CHAR(2)      NOT NULL UNIQUE,   -- ISO-3166-1 alpha-2. Ej: CL
  name         VARCHAR(100) NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_country_updated_at BEFORE UPDATE ON country
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS currency (
  currency_id   BIGSERIAL   PRIMARY KEY,
  currency_code CHAR(3)     NOT NULL UNIQUE,   -- ISO-4217. Ej: CLP, USD
  name          VARCHAR(100) NOT NULL,
  minor_units   SMALLINT    NOT NULL CHECK (minor_units BETWEEN 0 AND 6),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_currency_updated_at BEFORE UPDATE ON currency
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS country_currency (
  country_id  BIGINT      NOT NULL REFERENCES country(country_id),
  currency_id BIGINT      NOT NULL REFERENCES currency(currency_id),
  is_primary  BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (country_id, currency_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_country_currency_primary
  ON country_currency(country_id) WHERE is_primary = true;
CREATE TRIGGER trg_country_currency_updated_at BEFORE UPDATE ON country_currency
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS document_type (
  document_type_id BIGSERIAL    PRIMARY KEY,
  code             VARCHAR(30)  NOT NULL UNIQUE,  -- Ej: RUT, DNI, PASSPORT
  name             VARCHAR(100) NOT NULL,
  country_id       BIGINT       NULL REFERENCES country(country_id),  -- NULL = global
  subject_scope    VARCHAR(10)  NOT NULL DEFAULT 'person'
                   CHECK (subject_scope IN ('person','company','both')),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_document_type_name_country UNIQUE (country_id, name)
);
CREATE TRIGGER trg_document_type_updated_at BEFORE UPDATE ON document_type
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 1 — STATUS CENTRALIZADO (reemplaza ENUMs)
-- ============================================================================
-- Agregar estado = INSERT en status. No requiere deploy ni ALTER TYPE.

CREATE TABLE IF NOT EXISTS status_domain (
  status_domain_id BIGSERIAL   PRIMARY KEY,
  code             VARCHAR(50) NOT NULL UNIQUE,   -- Ej: user, movement, debt
  name             VARCHAR(100) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_status_domain_updated_at BEFORE UPDATE ON status_domain
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS status (
  status_id        BIGSERIAL   PRIMARY KEY,
  status_domain_id BIGINT      NOT NULL REFERENCES status_domain(status_domain_id),
  code             VARCHAR(50) NOT NULL,
  name             VARCHAR(100) NOT NULL,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  sort_order       SMALLINT    NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_status_domain_code UNIQUE (status_domain_id, code)
);
CREATE TRIGGER trg_status_updated_at BEFORE UPDATE ON status
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 2 — RBAC (ROLES Y PERMISOS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS role (
  role_id     BIGSERIAL    PRIMARY KEY,
  code        VARCHAR(50)  NOT NULL UNIQUE,   -- Ej: admin, support, user
  name        VARCHAR(100) NOT NULL,
  description TEXT         NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_role_updated_at BEFORE UPDATE ON role
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS permission (
  permission_id BIGSERIAL    PRIMARY KEY,
  code          VARCHAR(120) NOT NULL UNIQUE,   -- Ej: movements.read
  name          VARCHAR(150) NOT NULL,
  description   TEXT         NULL,
  path_pattern  VARCHAR(200) NULL,              -- Ej: /api/movements*
  http_methods  VARCHAR(50)  NULL,              -- Ej: GET,POST
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_permission_path_methods UNIQUE (path_pattern, http_methods)
);
CREATE TRIGGER trg_permission_updated_at BEFORE UPDATE ON permission
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS role_permission (
  role_id       BIGINT      NOT NULL REFERENCES role(role_id),
  permission_id BIGINT      NOT NULL REFERENCES permission(permission_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);
CREATE TRIGGER trg_role_permission_updated_at BEFORE UPDATE ON role_permission
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 3 — CONFIGURACIÓN Y ESTADO DE SALUD
-- ============================================================================

-- Nivel de salud financiera del usuario (el avatar Walvy)
CREATE TABLE IF NOT EXISTS financial_health_level (
  financial_health_level_id BIGSERIAL    PRIMARY KEY,
  code          VARCHAR(50)  NOT NULL UNIQUE,   -- overwhelmed | transitioning | in_control
  name_es       VARCHAR(120) NOT NULL,
  description_es TEXT        NULL,
  asset_path    VARCHAR(500) NULL,              -- Ruta del asset del avatar
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_fin_health_level_updated_at BEFORE UPDATE ON financial_health_level
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Configuración global operacional (ajustable desde backoffice sin deploy)
CREATE TABLE IF NOT EXISTS app_config (
  key                 TEXT        PRIMARY KEY,
  value               JSONB       NOT NULL,
  value_type          VARCHAR(10) NOT NULL DEFAULT 'json'
                      CHECK (value_type IN ('integer','decimal','boolean','json','text')),
  description         TEXT,
  updated_by_admin_id UUID        NULL,  -- FK a admin_users (declarada después)
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- LAYER 4 — IDENTIDAD Y AUTH
-- ============================================================================

-- Tabla principal de usuario: combina Walvy (auth local) + Edificate (multi-país, RBAC, trial)
CREATE TABLE IF NOT EXISTS app_user (
  user_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificación
  email            VARCHAR(320) NULL UNIQUE,
  password_hash    TEXT         NULL,           -- NULL si usa solo auth_provider externo
  auth_provider    VARCHAR(50)  NULL,           -- google, apple, auth0, cognito
  auth_provider_user_id VARCHAR(200) NULL,
  identifier_type  VARCHAR(20)  NOT NULL DEFAULT 'email'
                   CHECK (identifier_type IN ('email','rut','username')),
  -- Perfil básico
  full_name              VARCHAR(200) NULL,
  username               VARCHAR(80)  NULL UNIQUE,
  avatar_url             VARCHAR(500) NULL,
  notification_email     VARCHAR(320) NULL,        -- Email de notificaciones (puede diferir del login)
  notification_email_verified_at TIMESTAMPTZ NULL, -- NULL hasta que el usuario confirme el nuevo email
  -- Documento (normalizado, no hardcodeado como RUT)
  document_type_id BIGINT       NULL REFERENCES document_type(document_type_id),
  document_number  VARCHAR(50)  NULL,
  -- País y moneda
  country_id       BIGINT       NOT NULL REFERENCES country(country_id),
  default_currency_id BIGINT    NOT NULL REFERENCES currency(currency_id),
  -- RBAC
  role_id          BIGINT       NOT NULL REFERENCES role(role_id),
  -- Estado (dominio: user)
  user_status_id   BIGINT       NOT NULL REFERENCES status(status_id),
  -- Trial (sin tarjeta obligatoria)
  trial_started_at TIMESTAMPTZ  NULL,
  trial_ends_at    TIMESTAMPTZ  NULL,
  -- Estado Walvy (avatar / salud financiera actual)
  current_financial_health_level_id BIGINT NULL
    REFERENCES financial_health_level(financial_health_level_id),
  financial_health_updated_at TIMESTAMPTZ NULL,
  -- Verificación
  email_verified_at TIMESTAMPTZ NULL,
  accepted_terms_at TIMESTAMPTZ NULL,
  -- Soft delete
  deleted_at       TIMESTAMPTZ  NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_trial_pair CHECK (
    (trial_started_at IS NULL AND trial_ends_at IS NULL) OR
    (trial_started_at IS NOT NULL AND trial_ends_at IS NOT NULL AND trial_ends_at > trial_started_at)
  )
);
CREATE INDEX IF NOT EXISTS idx_app_user_role ON app_user(role_id);
CREATE INDEX IF NOT EXISTS idx_app_user_email ON app_user(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_app_user_username ON app_user(username) WHERE username IS NOT NULL;
CREATE TRIGGER trg_app_user_updated_at BEFORE UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION trg_app_user_status_domain()
RETURNS trigger AS $$ BEGIN
  PERFORM enforce_status_domain('user', NEW.user_status_id); RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_app_user_status_domain ON app_user;
CREATE TRIGGER trg_app_user_status_domain BEFORE INSERT OR UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION trg_app_user_status_domain();

-- Tokens de autenticación (de Walvy — intactos)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rt_user_expires ON refresh_tokens(user_id, expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  email      TEXT        NOT NULL,
  token_hash TEXT        NOT NULL UNIQUE,  -- hash del código de 6 dígitos
  expires_at TIMESTAMPTZ NOT NULL,         -- 15 min (código corto, no link)
  attempts   SMALLINT    NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evt_user_id ON email_verification_tokens(user_id);

-- Preferencias biométricas (1:1 con app_user)
CREATE TABLE IF NOT EXISTS biometric_preferences (
  user_id    UUID        PRIMARY KEY REFERENCES app_user(user_id) ON DELETE CASCADE,
  enabled    BOOLEAN     NOT NULL DEFAULT false,
  method     TEXT,
  device_id  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Onboarding (de Edificate — más rico que el de Walvy)
CREATE TABLE IF NOT EXISTS user_onboarding_state (
  user_id           UUID        PRIMARY KEY REFERENCES app_user(user_id) ON DELETE CASCADE,
  onboarding_status VARCHAR(20) NOT NULL DEFAULT 'not_started'
                    CHECK (onboarding_status IN ('not_started','in_progress','completed')),
  current_step      VARCHAR(80) NULL,         -- Ej: email_verification, profile, goals
  resume_surface    VARCHAR(80) NULL,         -- home | onboarding
  resume_context    JSONB       NULL,
  financial_profile_completed BOOLEAN NOT NULL DEFAULT false,
  goals_set         BOOLEAN     NOT NULL DEFAULT false,
  import_attempted  BOOLEAN     NOT NULL DEFAULT false,
  biometric_prompted BOOLEAN    NOT NULL DEFAULT false,
  min_doc_threshold_met BOOLEAN NOT NULL DEFAULT false,
  last_checkpoint_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_user_onboarding_state_updated_at BEFORE UPDATE ON user_onboarding_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 5 — B2B (de Edificate — canal corporativo)
-- ============================================================================

CREATE TABLE IF NOT EXISTS company (
  company_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(200) NOT NULL,
  country_id         BIGINT      NOT NULL REFERENCES country(country_id),
  document_type_id   BIGINT      NULL REFERENCES document_type(document_type_id),
  document_number    VARCHAR(50) NULL,
  contact_email      VARCHAR(320) NULL,
  contact_person_name VARCHAR(150) NULL,
  contact_phone      VARCHAR(40) NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_company_country_name UNIQUE (country_id, name),
  CONSTRAINT uq_company_country_document UNIQUE (country_id, document_number)
);
CREATE TRIGGER trg_company_updated_at BEFORE UPDATE ON company
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS company_benefit_contract (
  contract_id UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID      NOT NULL REFERENCES company(company_id),
  plan_code   VARCHAR(50) NOT NULL,   -- Código interno del convenio. Ej: walvy_premium_12m
  starts_at   DATE      NOT NULL,
  ends_at     DATE      NULL,
  is_active   BOOLEAN   NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contract_company ON company_benefit_contract(company_id);
CREATE TRIGGER trg_company_benefit_contract_updated_at BEFORE UPDATE ON company_benefit_contract
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS company_eligible_employee (
  eligible_employee_id UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id          UUID   NOT NULL REFERENCES company_benefit_contract(contract_id),
  email                VARCHAR(320) NOT NULL,
  document_type_id     BIGINT NULL REFERENCES document_type(document_type_id),
  document_number      VARCHAR(50) NULL,
  invited_at           TIMESTAMPTZ NULL,
  activated_user_id    UUID   NULL REFERENCES app_user(user_id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_eligible_employee_contract_email
  ON company_eligible_employee(contract_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_eligible_employee_contract_document
  ON company_eligible_employee(contract_id, document_type_id, document_number)
  WHERE document_type_id IS NOT NULL AND document_number IS NOT NULL;
CREATE TRIGGER trg_company_eligible_employee_updated_at BEFORE UPDATE ON company_eligible_employee
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS benefit_invitation (
  invitation_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  eligible_employee_id UUID        NOT NULL REFERENCES company_eligible_employee(eligible_employee_id),
  invitation_status    VARCHAR(20) NOT NULL
    CHECK (invitation_status IN ('created','sent','accepted','expired','revoked')),
  sent_at              TIMESTAMPTZ NULL,
  accepted_at          TIMESTAMPTZ NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_invitation_sent_at CHECK (
    (invitation_status IN ('sent','accepted') AND sent_at IS NOT NULL) OR
    (invitation_status NOT IN ('sent','accepted'))
  ),
  CONSTRAINT chk_invitation_accepted_at CHECK (
    (invitation_status = 'accepted' AND accepted_at IS NOT NULL) OR
    (invitation_status <> 'accepted')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_benefit_invitation_active
  ON benefit_invitation(eligible_employee_id)
  WHERE invitation_status IN ('created','sent');
CREATE TRIGGER trg_benefit_invitation_updated_at BEFORE UPDATE ON benefit_invitation
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 6 — PERFIL DE USUARIO Y ALERTAS
-- ============================================================================

-- Perfil financiero declarado (1:1 con app_user)
CREATE TABLE IF NOT EXISTS user_financial_profile (
  user_id                    UUID          PRIMARY KEY
    REFERENCES app_user(user_id) ON DELETE CASCADE,
  monthly_income_estimate    NUMERIC(19,4) NULL,
  stable_expenses_note       TEXT          NULL,
  estimated_payment_capacity NUMERIC(19,4) NULL,
  currency_id                BIGINT        NULL REFERENCES currency(currency_id),
  updated_at                 TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Metas financieras del usuario
CREATE TABLE IF NOT EXISTS user_goals (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  goal_type      VARCHAR(40) NOT NULL
    CHECK (goal_type IN ('reduce_debt','save_amount','improve_savings_capacity',
                         'avoid_late_payments','meet_budget','other')),
  target_value   NUMERIC(19,4) NULL,
  declared_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  progress_cache JSONB,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ug_user_id ON user_goals(user_id);
CREATE TRIGGER trg_user_goals_updated_at BEFORE UPDATE ON user_goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Preferencias de alertas configuradas por el usuario
CREATE TABLE IF NOT EXISTS alert_preferences (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  alert_type   TEXT        NOT NULL,
  channel      VARCHAR(10) NOT NULL CHECK (channel IN ('in_app','push','email')),
  enabled      BOOLEAN     NOT NULL DEFAULT true,
  intensity    TEXT        NULL,
  cadence_days INT         NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, alert_type, channel)
);
CREATE INDEX IF NOT EXISTS idx_ap_user_id ON alert_preferences(user_id);
CREATE TRIGGER trg_alert_preferences_updated_at BEFORE UPDATE ON alert_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cola de notificaciones (push / email / in-app)
CREATE TABLE IF NOT EXISTS notification_queue (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  channel          VARCHAR(10) NOT NULL CHECK (channel IN ('in_app','push','email')),
  payload          JSONB       NOT NULL,
  scheduled_for    TIMESTAMPTZ NOT NULL,
  sent_at          TIMESTAMPTZ NULL,
  reference_type   TEXT        NULL,   -- Ej: user_payment, debt
  reference_id     UUID        NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nq_pending ON notification_queue(scheduled_for)
  WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nq_user_scheduled ON notification_queue(user_id, scheduled_for)
  WHERE sent_at IS NULL;

-- ============================================================================
-- LAYER 7 — CATÁLOGOS FINANCIEROS
-- ============================================================================

-- Instituciones financieras (catálogo global/por país — de Edificate)
CREATE TABLE IF NOT EXISTS financial_institution (
  financial_institution_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     VARCHAR(200) NOT NULL,
  country_id               BIGINT      NOT NULL REFERENCES country(country_id),
  institution_type         VARCHAR(20) NOT NULL
    CHECK (institution_type IN ('bank','wallet','retail','broker','cooperative','other')),
  contact_email            VARCHAR(320) NULL,
  contact_phone            VARCHAR(40)  NULL,
  has_api                  BOOLEAN     NOT NULL DEFAULT false,
  api_base_url             VARCHAR(500) NULL,
  api_notes                TEXT        NULL,
  is_active                BOOLEAN     NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fin_inst_country_name UNIQUE (country_id, name),
  CONSTRAINT chk_fin_inst_api_fields CHECK (
    (has_api = false AND api_base_url IS NULL) OR (has_api = true AND api_base_url IS NOT NULL)
  )
);
CREATE TRIGGER trg_financial_institution_updated_at BEFORE UPDATE ON financial_institution
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Instrumentos financieros del usuario (cuentas, tarjetas, etc.)
CREATE TABLE IF NOT EXISTS user_financial_instrument (
  financial_instrument_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  financial_institution_id UUID        NULL REFERENCES financial_institution(financial_institution_id),
  instrument_type          VARCHAR(30) NOT NULL
    CHECK (instrument_type IN ('checking_account','credit_card','debit_card','cash',
                                'credit_line','investment','loan','other')),
  instrument_name          VARCHAR(120) NOT NULL,
  monthly_cost             NUMERIC(19,4) NULL CHECK (monthly_cost IS NULL OR monthly_cost >= 0),
  benefits_notes           TEXT        NULL,
  is_active                BOOLEAN     NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ufi_user ON user_financial_instrument(user_id);
CREATE TRIGGER trg_user_financial_instrument_updated_at BEFORE UPDATE ON user_financial_instrument
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Nodos semánticos de cashflow (origen/destino del dinero — de Edificate)
CREATE TABLE IF NOT EXISTS cashflow_node (
  cashflow_node_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(120) NOT NULL,
  node_type        VARCHAR(20) NOT NULL
    CHECK (node_type IN ('origin','destination','instrument','third_party','pocket')),
  is_liquidity_source BOOLEAN  NOT NULL DEFAULT false,
  is_internal_node BOOLEAN     NOT NULL DEFAULT false,
  owner_user_id    UUID        NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_cashflow_node_updated_at BEFORE UPDATE ON cashflow_node
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Categorías (jerarquía recursiva — de Edificate, reemplaza categories + subcategories)
CREATE TABLE IF NOT EXISTS category (
  category_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_category_id    UUID        NULL REFERENCES category(category_id),
  name                  VARCHAR(120) NOT NULL,
  is_leaf               BOOLEAN     NOT NULL DEFAULT true,
  icon                  TEXT        NULL,
  color                 TEXT        NULL,
  owner_user_id         UUID        NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  governance_scope      VARCHAR(20) NOT NULL DEFAULT 'system'
    CHECK (governance_scope IN ('system','user','suggested','approved')),
  sort_order            INT         NOT NULL DEFAULT 0,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  replaced_by_category_id UUID      NULL REFERENCES category(category_id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_category_parent ON category(parent_category_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_system
  ON category(parent_category_id, name) WHERE owner_user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_user
  ON category(parent_category_id, owner_user_id, name) WHERE owner_user_id IS NOT NULL;
CREATE TRIGGER trg_category_updated_at BEFORE UPDATE ON category
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Reglas de gastos hormiga configuradas por usuario
CREATE TABLE IF NOT EXISTS ant_expense_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  max_amount  NUMERIC(19,4) NULL,
  category_id UUID        NULL REFERENCES category(category_id) ON DELETE SET NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aer_user_id ON ant_expense_rules(user_id);
CREATE TRIGGER trg_ant_expense_rules_updated_at BEFORE UPDATE ON ant_expense_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 8 — PIPELINE DE INGESTA
-- ============================================================================

-- Carga de archivos (de Edificate — más rico que statement_imports)
CREATE TABLE IF NOT EXISTS file_upload (
  file_upload_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  source_type          VARCHAR(20) NOT NULL CHECK (source_type IN ('document','manual','integration')),
  provider             VARCHAR(80) NULL,          -- Ej: bank_santander_cl, csv_generic, fintoc
  storage_path         VARCHAR(800) NOT NULL,
  original_filename    VARCHAR(255) NOT NULL,
  mime_type            VARCHAR(120) NULL,
  file_status_id       BIGINT      NOT NULL REFERENCES status(status_id),  -- dominio: file_upload
  records_total        INTEGER     NULL CHECK (records_total IS NULL OR records_total >= 0),
  records_success      INTEGER     NULL CHECK (records_success IS NULL OR records_success >= 0),
  records_failed       INTEGER     NULL CHECK (records_failed IS NULL OR records_failed >= 0),
  error_summary        TEXT        NULL,
  error_details_path   VARCHAR(800) NULL,
  uploaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_started_at TIMESTAMPTZ NULL,
  processed_at         TIMESTAMPTZ NULL,
  correlation_id       VARCHAR(120) NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_file_upload_counts CHECK (
    (records_total IS NULL AND records_success IS NULL AND records_failed IS NULL) OR
    (records_total IS NOT NULL AND records_success IS NOT NULL AND records_failed IS NOT NULL
     AND records_total = records_success + records_failed)
  )
);
CREATE INDEX IF NOT EXISTS idx_file_upload_user_uploaded ON file_upload(user_id, uploaded_at DESC);
CREATE TRIGGER trg_file_upload_updated_at BEFORE UPDATE ON file_upload
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION trg_file_upload_status_domain()
RETURNS trigger AS $$ BEGIN
  PERFORM enforce_status_domain('file_upload', NEW.file_status_id); RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_file_upload_status_domain ON file_upload;
CREATE TRIGGER trg_file_upload_status_domain BEFORE INSERT OR UPDATE ON file_upload
  FOR EACH ROW EXECUTE FUNCTION trg_file_upload_status_domain();

-- Ítems individuales del archivo para revisión del usuario (de Walvy)
CREATE TABLE IF NOT EXISTS import_line_items (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  file_upload_id     UUID        NOT NULL REFERENCES file_upload(file_upload_id) ON DELETE CASCADE,
  row_index          INT         NULL,
  raw_row            JSONB       NULL,
  normalized         JSONB       NULL,
  user_review_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (user_review_status IN ('pending','accepted','rejected','edited')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ili_upload_status ON import_line_items(file_upload_id, user_review_status);
CREATE TRIGGER trg_import_line_items_updated_at BEFORE UPDATE ON import_line_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Sugerencias de clasificación automática (de Walvy — el usuario siempre confirma)
CREATE TABLE IF NOT EXISTS movement_classification_suggestions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  import_line_id   UUID        NULL REFERENCES import_line_items(id) ON DELETE SET NULL,
  suggested_target VARCHAR(20) NOT NULL CHECK (suggested_target IN ('debt_plan','bills_payable','transaction')),
  confidence       NUMERIC(4,3) NULL,
  rule_matched     TEXT        NULL,
  user_decision    VARCHAR(15) NULL CHECK (user_decision IN ('accepted','ignored','corrected')),
  decided_at       TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mcs_user_id ON movement_classification_suggestions(user_id);

-- ============================================================================
-- LAYER 9 — MOVIMIENTOS (fuente de verdad transaccional)
-- ============================================================================

-- Movimiento financiero (de Edificate + is_ant_expense + deleted_at de Walvy)
CREATE TABLE IF NOT EXISTS financial_movement (
  movement_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  operation_date       DATE        NOT NULL,
  posted_at            TIMESTAMPTZ NULL,
  raw_description      TEXT        NOT NULL,
  bank_description     TEXT        NULL,         -- Glosa original del banco
  movement_direction   VARCHAR(3)  NOT NULL CHECK (movement_direction IN ('in','out')),
  amount_in            NUMERIC(19,4) NOT NULL DEFAULT 0,
  amount_out           NUMERIC(19,4) NOT NULL DEFAULT 0,
  currency_id          BIGINT      NOT NULL REFERENCES currency(currency_id),
  category_id          UUID        NULL REFERENCES category(category_id) ON DELETE SET NULL,
  category_leaf_id     UUID        NULL REFERENCES category(category_id) ON DELETE SET NULL,
  classification_method VARCHAR(10) NOT NULL DEFAULT 'manual'
    CHECK (classification_method IN ('auto','manual','assisted','inherited')),
  classification_confidence NUMERIC(5,2) NULL
    CHECK (classification_confidence IS NULL OR classification_confidence BETWEEN 0 AND 100),
  is_ant_expense       BOOLEAN     NOT NULL DEFAULT false,
  cashflow_origin_id   UUID        NULL REFERENCES cashflow_node(cashflow_node_id),
  cashflow_destination_id UUID     NULL REFERENCES cashflow_node(cashflow_node_id),
  financial_institution_id UUID    NULL REFERENCES financial_institution(financial_institution_id),
  payment_instrument_type VARCHAR(15) NULL
    CHECK (payment_instrument_type IN ('cash','debit','credit','transfer','other')),
  financial_instrument_id UUID     NULL REFERENCES user_financial_instrument(financial_instrument_id),
  source_type          VARCHAR(20) NOT NULL CHECK (source_type IN ('document','manual','integration')),
  source_reference     VARCHAR(200) NULL,
  source_fingerprint   VARCHAR(200) NULL,        -- Hash para deduplicación en importaciones
  potential_duplicate_flag BOOLEAN NOT NULL DEFAULT false,
  file_upload_id       UUID        NULL REFERENCES file_upload(file_upload_id) ON DELETE SET NULL,
  movement_status_id   BIGINT      NOT NULL REFERENCES status(status_id),  -- dominio: movement
  deleted_at           TIMESTAMPTZ NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_fin_mov_amount_nonneg CHECK (amount_in >= 0 AND amount_out >= 0),
  CONSTRAINT chk_fin_mov_one_side_positive CHECK (
    (amount_in > 0 AND amount_out = 0) OR (amount_out > 0 AND amount_in = 0)
  ),
  CONSTRAINT chk_fin_mov_direction_amounts CHECK (
    (movement_direction='in' AND amount_in > 0 AND amount_out = 0) OR
    (movement_direction='out' AND amount_out > 0 AND amount_in = 0)
  )
);
-- Deduplicación de importaciones
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_mov_user_fingerprint
  ON financial_movement(user_id, source_fingerprint)
  WHERE source_fingerprint IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_mov_user_source_ref
  ON financial_movement(user_id, source_type, source_reference)
  WHERE source_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_mov_user_date
  ON financial_movement(user_id, operation_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fin_mov_user_cat_date
  ON financial_movement(user_id, category_id, operation_date DESC)
  WHERE category_id IS NOT NULL AND deleted_at IS NULL;
CREATE TRIGGER trg_financial_movement_updated_at BEFORE UPDATE ON financial_movement
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION trg_fin_mov_status_domain()
RETURNS trigger AS $$ BEGIN
  PERFORM enforce_status_domain('movement', NEW.movement_status_id); RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_fin_mov_status_domain ON financial_movement;
CREATE TRIGGER trg_fin_mov_status_domain BEFORE INSERT OR UPDATE ON financial_movement
  FOR EACH ROW EXECUTE FUNCTION trg_fin_mov_status_domain();

-- Cola de revisión de movimientos con prioridad (de Edificate)
CREATE TABLE IF NOT EXISTS movement_review_queue (
  review_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  movement_id    UUID        NOT NULL REFERENCES financial_movement(movement_id) ON DELETE CASCADE,
  review_reason  VARCHAR(30) NOT NULL
    CHECK (review_reason IN ('uncategorized','possible_duplicate','instrument_conflict',
                              'loan_ambiguity','ant_expense_check','other')),
  priority_level SMALLINT    NOT NULL DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 5),
  review_status_id BIGINT    NOT NULL REFERENCES status(status_id),  -- dominio: review_queue
  resolved_at    TIMESTAMPTZ NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_queue_user_status_priority
  ON movement_review_queue(user_id, review_status_id, priority_level, created_at DESC);
CREATE TRIGGER trg_movement_review_queue_updated_at BEFORE UPDATE ON movement_review_queue
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION trg_review_queue_status_domain()
RETURNS trigger AS $$ BEGIN
  PERFORM enforce_status_domain('review_queue', NEW.review_status_id); RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_review_queue_status_domain ON movement_review_queue;
CREATE TRIGGER trg_review_queue_status_domain BEFORE INSERT OR UPDATE ON movement_review_queue
  FOR EACH ROW EXECUTE FUNCTION trg_review_queue_status_domain();

-- Historial de reclasificaciones (de Edificate — auditoría completa)
CREATE TABLE IF NOT EXISTS movement_classification_history (
  classification_history_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id    UUID        NOT NULL REFERENCES financial_movement(movement_id) ON DELETE CASCADE,
  old_category_id UUID       NULL REFERENCES category(category_id),
  new_category_id UUID       NULL REFERENCES category(category_id),
  old_leaf_id    UUID        NULL REFERENCES category(category_id),
  new_leaf_id    UUID        NULL REFERENCES category(category_id),
  change_reason  VARCHAR(120) NULL,
  changed_by     UUID        NULL REFERENCES app_user(user_id) ON DELETE SET NULL,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_class_hist_movement_time
  ON movement_classification_history(movement_id, changed_at DESC);
CREATE TRIGGER trg_movement_classification_history_updated_at
  BEFORE UPDATE ON movement_classification_history
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 10 — PRESUPUESTO
-- ============================================================================

-- Presupuesto mensual (de Edificate — period_month DATE es más limpio que year/month int)
CREATE TABLE IF NOT EXISTS budget_plan (
  budget_plan_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  period_month   DATE        NOT NULL,    -- Primer día del mes. Ej: 2026-05-01
  currency_id    BIGINT      NOT NULL REFERENCES currency(currency_id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_budget_plan_user_month UNIQUE (user_id, period_month)
);
CREATE INDEX IF NOT EXISTS idx_bp_user ON budget_plan(user_id);
CREATE TRIGGER trg_budget_plan_updated_at BEFORE UPDATE ON budget_plan
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS budget_plan_item (
  budget_plan_item_id UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_plan_id      UUID          NOT NULL REFERENCES budget_plan(budget_plan_id) ON DELETE CASCADE,
  category_id         UUID          NOT NULL REFERENCES category(category_id),
  amount_limit        NUMERIC(19,4) NOT NULL CHECK (amount_limit >= 0),
  planned_min         NUMERIC(19,4) NULL,
  planned_max         NUMERIC(19,4) NULL,
  suggested_by_app    BOOLEAN       NOT NULL DEFAULT false,
  notes               TEXT          NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_budget_plan_item UNIQUE (budget_plan_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_bpi_plan ON budget_plan_item(budget_plan_id);
CREATE TRIGGER trg_budget_plan_item_updated_at BEFORE UPDATE ON budget_plan_item
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 11 — DEUDAS (MOTOR BOLA DE NIEVE)
-- ============================================================================

-- Deuda (combina Edificate + campos operacionales de Walvy)
CREATE TABLE IF NOT EXISTS debt (
  debt_id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID          NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  name                   VARCHAR(200)  NOT NULL,
  creditor_label         TEXT          NULL,
  debt_type              VARCHAR(20)   NOT NULL
    CHECK (debt_type IN ('consumer','mortgage','credit_card','line','other')),
  debt_source_type       VARCHAR(20)   NULL
    CHECK (debt_source_type IN ('bank','retail','person','other')),
  principal_initial      NUMERIC(19,4) NULL CHECK (principal_initial IS NULL OR principal_initial >= 0),
  current_balance        NUMERIC(19,4) NOT NULL CHECK (current_balance >= 0),
  currency_id            BIGINT        NOT NULL REFERENCES currency(currency_id),
  apr_annual             NUMERIC(7,4)  NULL CHECK (apr_annual IS NULL OR apr_annual >= 0),
  interest_rate_pct      NUMERIC(10,4) NULL CHECK (interest_rate_pct IS NULL OR interest_rate_pct >= 0),
  minimum_payment        NUMERIC(19,4) NULL CHECK (minimum_payment IS NULL OR minimum_payment >= 0),
  installments_total     INT           NULL,
  installments_remaining INT           NULL,
  due_day                INT           NULL CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
  next_due_date          DATE          NULL,
  estimated_payoff_date  DATE          NULL,
  released_cashflow_amount NUMERIC(19,4) NULL CHECK (released_cashflow_amount IS NULL OR released_cashflow_amount >= 0),
  financial_instrument_id UUID         NULL REFERENCES user_financial_instrument(financial_instrument_id),
  snowball_priority      INT           NULL,
  debt_status_id         BIGINT        NOT NULL REFERENCES status(status_id),  -- dominio: debt
  metadata               JSONB         NOT NULL DEFAULT '{}',
  deleted_at             TIMESTAMPTZ   NULL,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_debt_user_status   ON debt(user_id, debt_status_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_debt_user_snowball  ON debt(user_id, snowball_priority ASC) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_debt_updated_at BEFORE UPDATE ON debt
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION trg_debt_status_domain()
RETURNS trigger AS $$ BEGIN
  PERFORM enforce_status_domain('debt', NEW.debt_status_id); RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_debt_status_domain ON debt;
CREATE TRIGGER trg_debt_status_domain BEFORE INSERT OR UPDATE ON debt
  FOR EACH ROW EXECUTE FUNCTION trg_debt_status_domain();

-- Cronograma de cuotas por deuda (de Walvy — operacional)
CREATE TABLE IF NOT EXISTS debt_schedules (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id           UUID          NOT NULL REFERENCES debt(debt_id) ON DELETE CASCADE,
  installment_no    INT           NOT NULL,
  due_date          DATE          NOT NULL,
  planned_principal NUMERIC(19,4) NULL,
  planned_interest  NUMERIC(19,4) NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ds_debt_id ON debt_schedules(debt_id);

-- Log inmutable de abonos a deuda (de Walvy — auditabilidad)
CREATE TABLE IF NOT EXISTS debt_payments (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id        UUID          NOT NULL REFERENCES debt(debt_id) ON DELETE CASCADE,
  paid_at        TIMESTAMPTZ   NOT NULL,
  amount         NUMERIC(19,4) NOT NULL CHECK (amount > 0),
  movement_id    UUID          NULL REFERENCES financial_movement(movement_id) ON DELETE SET NULL,
  notes          TEXT          NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dp_debt_paid ON debt_payments(debt_id, paid_at DESC);

-- Adjuntos de deuda (cartolas, documentos — de Walvy)
CREATE TABLE IF NOT EXISTS debt_attachments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  debt_id           UUID        NULL REFERENCES debt(debt_id) ON DELETE SET NULL,
  storage_key       TEXT        NOT NULL,
  mime_type         TEXT        NULL,
  original_filename TEXT        NULL,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  parsed_summary    JSONB       NULL
);
CREATE INDEX IF NOT EXISTS idx_da_debt_id ON debt_attachments(debt_id);

-- Simulación de payoff (de Edificate — append-only via trigger)
CREATE TABLE IF NOT EXISTS debt_payoff_simulation (
  simulation_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  start_date          DATE          NOT NULL,
  extra_monthly_payment NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK (extra_monthly_payment >= 0),
  initial_lump_sum    NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK (initial_lump_sum >= 0),
  simulation_status   VARCHAR(20)   NOT NULL DEFAULT 'active'
    CHECK (simulation_status IN ('draft','active','archived')),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dps_user_created ON debt_payoff_simulation(user_id, created_at DESC);
CREATE TRIGGER trg_debt_payoff_simulation_updated_at BEFORE UPDATE ON debt_payoff_simulation
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Detalle del plan por deuda en la simulación (de Edificate)
CREATE TABLE IF NOT EXISTS debt_payoff_schedule (
  schedule_id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id              UUID          NOT NULL REFERENCES debt_payoff_simulation(simulation_id) ON DELETE CASCADE,
  debt_id                    UUID          NOT NULL REFERENCES debt(debt_id),
  sequence_order             INTEGER       NOT NULL CHECK (sequence_order > 0),
  estimated_months_to_close  INTEGER       NOT NULL CHECK (estimated_months_to_close >= 0),
  estimated_close_date       DATE          NULL,
  released_cashflow_after_close NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK (released_cashflow_after_close >= 0),
  created_at                 TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_schedule UNIQUE (simulation_id, debt_id)
);
CREATE TRIGGER trg_debt_payoff_schedule_updated_at BEFORE UPDATE ON debt_payoff_schedule
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 12 — PAGOS Y AGENDA
-- ============================================================================

-- Agenda de pagos (de Edificate + recurrencia de Walvy)
CREATE TABLE IF NOT EXISTS user_payment (
  user_payment_id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID          NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  debt_id                  UUID          NULL REFERENCES debt(debt_id) ON DELETE SET NULL,
  movement_id              UUID          NULL REFERENCES financial_movement(movement_id) ON DELETE SET NULL,
  title                    VARCHAR(200)  NOT NULL,
  amount                   NUMERIC(19,4) NOT NULL CHECK (amount > 0),
  currency_id              BIGINT        NOT NULL REFERENCES currency(currency_id),
  due_date                 DATE          NOT NULL,
  source                   VARCHAR(10)   NOT NULL DEFAULT 'user'
    CHECK (source IN ('user','system')),
  traffic_light_state      VARCHAR(10)   NULL CHECK (traffic_light_state IN ('green','yellow','red')),
  is_recurring             BOOLEAN       NOT NULL DEFAULT false,
  recurrence_interval_days INT           NULL,
  notes                    TEXT          NULL,
  user_payment_status_id   BIGINT        NOT NULL REFERENCES status(status_id),  -- dominio: user_payment
  paid_at                  TIMESTAMPTZ   NULL,
  cancelled_at             TIMESTAMPTZ   NULL,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_up_user_status ON user_payment(user_id, user_payment_status_id);
CREATE INDEX IF NOT EXISTS idx_up_user_due    ON user_payment(user_id, due_date ASC);
-- Deduplicación de pagos generados por el sistema para una deuda
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_payment_system_dedupe
  ON user_payment(user_id, due_date, amount, debt_id)
  WHERE source='system' AND debt_id IS NOT NULL;
CREATE TRIGGER trg_user_payment_updated_at BEFORE UPDATE ON user_payment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION trg_user_payment_status_domain()
RETURNS trigger AS $$ BEGIN
  PERFORM enforce_status_domain('user_payment', NEW.user_payment_status_id); RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_user_payment_status_domain ON user_payment;
CREATE TRIGGER trg_user_payment_status_domain BEFORE INSERT OR UPDATE ON user_payment
  FOR EACH ROW EXECUTE FUNCTION trg_user_payment_status_domain();

-- FK diferida de notification_queue a user_payment
ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS user_payment_id UUID NULL
  REFERENCES user_payment(user_payment_id) ON DELETE SET NULL;

-- Sugerencias de pagos recurrentes detectados (de Walvy)
CREATE TABLE IF NOT EXISTS recurring_payment_suggestions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  source            VARCHAR(20) NOT NULL CHECK (source IN ('movement_pattern','import')),
  suggested_payload JSONB       NOT NULL,
  status            VARCHAR(25) NOT NULL DEFAULT 'pending_user_confirm'
    CHECK (status IN ('pending_user_confirm','accepted','dismissed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rps_user_id ON recurring_payment_suggestions(user_id);
CREATE TRIGGER trg_recurring_payment_suggestions_updated_at BEFORE UPDATE ON recurring_payment_suggestions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 13 — MONETIZACIÓN
-- ============================================================================

-- Plan base (mensual / anual)
CREATE TABLE IF NOT EXISTS plan (
  plan_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) NOT NULL UNIQUE,   -- monthly | annual | free
  name_es        VARCHAR(120) NOT NULL,
  billing_period VARCHAR(10) NULL CHECK (billing_period IN ('monthly','annual')),
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_plan_updated_at BEFORE UPDATE ON plan
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Precio versionado por país/moneda (de Edificate — bitemporal)
CREATE TABLE IF NOT EXISTS plan_price (
  plan_price_id UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID          NOT NULL REFERENCES plan(plan_id),
  country_id    BIGINT        NOT NULL REFERENCES country(country_id),
  currency_id   BIGINT        NOT NULL REFERENCES currency(currency_id),
  price_amount  NUMERIC(19,4) NOT NULL CHECK (price_amount >= 0),
  valid_from    DATE          NOT NULL,
  valid_to      DATE          NULL,   -- NULL = precio vigente
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT chk_plan_price_valid_range CHECK (valid_to IS NULL OR valid_to > valid_from)
);
-- Solo un precio vigente activo por plan+país+moneda
CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_price_active
  ON plan_price(plan_id, country_id, currency_id)
  WHERE is_active = true AND valid_to IS NULL;
CREATE TRIGGER trg_plan_price_updated_at BEFORE UPDATE ON plan_price
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Métodos de pago guardados (de Edificate — multi-proveedor, sin PCI)
CREATE TABLE IF NOT EXISTS payment_method (
  payment_method_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type                 VARCHAR(10) NOT NULL CHECK (owner_type IN ('USER','COMPANY')),
  user_id                    UUID        NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  company_id                 UUID        NULL REFERENCES company(company_id),
  provider                   VARCHAR(50) NOT NULL,   -- stripe, mercadopago, flow
  provider_customer_ref      VARCHAR(120) NULL,
  provider_payment_method_ref VARCHAR(120) NOT NULL,
  card_brand                 VARCHAR(30) NULL,
  card_last4                 VARCHAR(4)  NULL,
  card_exp_month             SMALLINT    NULL CHECK (card_exp_month IS NULL OR card_exp_month BETWEEN 1 AND 12),
  card_exp_year              SMALLINT    NULL CHECK (card_exp_year IS NULL OR card_exp_year BETWEEN 2000 AND 2100),
  is_default                 BOOLEAN     NOT NULL DEFAULT false,
  payment_method_status_id   BIGINT      NOT NULL REFERENCES status(status_id),  -- dominio: payment_method
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_payment_method_owner_exclusive CHECK (
    (owner_type='USER' AND user_id IS NOT NULL AND company_id IS NULL) OR
    (owner_type='COMPANY' AND company_id IS NOT NULL AND user_id IS NULL)
  )
);
CREATE TRIGGER trg_payment_method_updated_at BEFORE UPDATE ON payment_method
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION trg_payment_method_status_domain()
RETURNS trigger AS $$ BEGIN
  PERFORM enforce_status_domain('payment_method', NEW.payment_method_status_id); RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_payment_method_status_domain ON payment_method;
CREATE TRIGGER trg_payment_method_status_domain BEFORE INSERT OR UPDATE ON payment_method
  FOR EACH ROW EXECUTE FUNCTION trg_payment_method_status_domain();

-- Suscripción (de Edificate + gift subscriptions)
CREATE TABLE IF NOT EXISTS subscription (
  subscription_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID          NOT NULL REFERENCES app_user(user_id),
  company_id              UUID          NULL REFERENCES company(company_id),
  origin                  VARCHAR(3)    NOT NULL CHECK (origin IN ('B2B','B2C')),
  plan_id                 UUID          NOT NULL REFERENCES plan(plan_id),
  plan_price_id           UUID          NULL REFERENCES plan_price(plan_price_id),
  -- Snapshot del precio facturado (inmutable tras pago)
  billed_amount           NUMERIC(19,4) NULL CHECK (billed_amount IS NULL OR billed_amount >= 0),
  billed_currency_id      BIGINT        NULL REFERENCES currency(currency_id),
  subscription_status_id  BIGINT        NOT NULL REFERENCES status(status_id),  -- dominio: subscription
  starts_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  ends_at                 TIMESTAMPTZ   NULL,
  provider                VARCHAR(50)   NOT NULL DEFAULT 'manual',
  external_subscription_ref VARCHAR(120) NULL,
  external_payment_ref    VARCHAR(120)  NULL,
  renew_at                TIMESTAMPTZ   NULL,
  cancelled_at            TIMESTAMPTZ   NULL,
  -- Gift subscriptions
  is_gift                 BOOLEAN       NOT NULL DEFAULT false,
  gift_sender_name        VARCHAR(120)  NULL,
  gift_sender_email       VARCHAR(320)  NULL,
  gift_recipient_email    VARCHAR(320)  NULL,
  gift_message            VARCHAR(250)  NULL,
  gift_token              VARCHAR(120)  NULL,
  gift_redeemed_at        TIMESTAMPTZ   NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT chk_subscription_b2b_company CHECK (
    (origin='B2B' AND company_id IS NOT NULL) OR (origin='B2C' AND company_id IS NULL)
  ),
  CONSTRAINT chk_subscription_gift_origin CHECK (is_gift = false OR origin = 'B2C'),
  CONSTRAINT chk_subscription_gift_fields CHECK (
    (is_gift=false AND gift_sender_name IS NULL AND gift_token IS NULL) OR
    (is_gift=true AND gift_sender_name IS NOT NULL AND gift_recipient_email IS NOT NULL AND gift_token IS NOT NULL)
  ),
  CONSTRAINT chk_subscription_billed_snapshot CHECK (
    (billed_amount IS NULL AND billed_currency_id IS NULL) OR
    (billed_amount IS NOT NULL AND billed_currency_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_gift_token
  ON subscription(gift_token) WHERE gift_token IS NOT NULL;
CREATE TRIGGER trg_subscription_updated_at BEFORE UPDATE ON subscription
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION trg_subscription_status_domain()
RETURNS trigger AS $$ BEGIN
  PERFORM enforce_status_domain('subscription', NEW.subscription_status_id); RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_subscription_status_domain ON subscription;
CREATE TRIGGER trg_subscription_status_domain BEFORE INSERT OR UPDATE ON subscription
  FOR EACH ROW EXECUTE FUNCTION trg_subscription_status_domain();

-- Órdenes de pago (de Walvy — idempotencia de webhooks)
CREATE TABLE IF NOT EXISTS payment_order (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  subscription_id   UUID          NULL REFERENCES subscription(subscription_id),
  commerce_order    TEXT          NOT NULL UNIQUE,  -- Idempotencia ante webhooks duplicados
  provider          VARCHAR(50)   NOT NULL,
  provider_token    TEXT          NULL,             -- Token del proveedor (Flow, Stripe, etc.)
  provider_order_ref TEXT         NULL,
  amount            NUMERIC(19,4) NOT NULL CHECK (amount > 0),
  currency_id       BIGINT        NOT NULL REFERENCES currency(currency_id),
  status            VARCHAR(20)   NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','expired','refunded')),
  provider_response JSONB         NULL,
  paid_at           TIMESTAMPTZ   NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_user_created ON payment_order(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_provider_token ON payment_order(provider_token) WHERE provider_token IS NOT NULL;
CREATE TRIGGER trg_payment_order_updated_at BEFORE UPDATE ON payment_order
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 14 — GAMIFICACIÓN (de Walvy — diferenciador de producto)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gamification_rules (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type          TEXT        NOT NULL UNIQUE,
  points              INT         NOT NULL DEFAULT 0,
  label               TEXT        NOT NULL,
  description         TEXT        NULL,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  updated_by_admin_id UUID        NULL,  -- FK a admin_users (declarada después)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Log inmutable de eventos de gamificación
CREATE TABLE IF NOT EXISTS gamification_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  event_type     TEXT        NOT NULL,
  points         INT         NOT NULL,
  reference_type TEXT        NULL,
  reference_id   UUID        NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ge_user_created ON gamification_events(user_id, created_at DESC);

-- Caché de puntos y nivel del usuario (1:1)
CREATE TABLE IF NOT EXISTS user_gamification_stats (
  user_id          UUID        PRIMARY KEY REFERENCES app_user(user_id) ON DELETE CASCADE,
  total_points     INT         NOT NULL DEFAULT 0,
  level            INT         NOT NULL DEFAULT 1,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historial de puntos por período
CREATE TABLE IF NOT EXISTS user_score_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  period_start DATE        NOT NULL,
  period_end   DATE        NOT NULL,
  points       INT         NOT NULL,
  level        INT         NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ush_user_period ON user_score_history(user_id, period_start DESC);

-- ============================================================================
-- LAYER 15 — MENSAJERÍA Y RECOMENDACIONES
-- ============================================================================

-- Reglas de mensajería (de Edificate — más estructurado que recommendation_events de Walvy)
CREATE TABLE IF NOT EXISTS message_rule (
  message_rule_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(80) NOT NULL UNIQUE,   -- Ej: leaks_detected, pay_next, debt_idle
  name_es         VARCHAR(150) NOT NULL,
  description_es  TEXT        NULL,
  context         VARCHAR(20) NULL
    CHECK (context IN ('home','budget','debt','payments','profile','global')),
  deep_link       TEXT        NULL,              -- Ruta de acción en la app
  priority        SMALLINT    NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_message_rule_updated_at BEFORE UPDATE ON message_rule
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Eventos/mensajes generados para el usuario
CREATE TABLE IF NOT EXISTS message_event (
  message_event_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  message_rule_id        UUID        NOT NULL REFERENCES message_rule(message_rule_id),
  context_period_month   DATE        NULL,
  payload                JSONB       NOT NULL,   -- Evidencia/valores (sin datos sensibles)
  message_event_status_id BIGINT     NOT NULL REFERENCES status(status_id),  -- dominio: message_event
  shown_at               TIMESTAMPTZ NULL,
  suppressed_until       TIMESTAMPTZ NULL,       -- Re-mostrar después de esta fecha
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_me_user_status ON message_event(user_id, message_event_status_id, created_at DESC);
CREATE TRIGGER trg_message_event_updated_at BEFORE UPDATE ON message_event
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION trg_message_event_status_domain()
RETURNS trigger AS $$ BEGIN
  PERFORM enforce_status_domain('message_event', NEW.message_event_status_id); RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_message_event_status_domain ON message_event;
CREATE TRIGGER trg_message_event_status_domain BEFORE INSERT OR UPDATE ON message_event
  FOR EACH ROW EXECUTE FUNCTION trg_message_event_status_domain();

-- Interacciones del usuario con mensajes
CREATE TABLE IF NOT EXISTS user_message_interaction (
  interaction_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  message_event_id UUID        NOT NULL REFERENCES message_event(message_event_id) ON DELETE CASCADE,
  action           VARCHAR(20) NOT NULL CHECK (action IN ('opened','dismissed','snoozed','completed')),
  action_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  note             TEXT        NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_umi_user_event ON user_message_interaction(user_id, message_event_id);
CREATE TRIGGER trg_user_message_interaction_updated_at BEFORE UPDATE ON user_message_interaction
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 16 — ASISTENTE IA Y SOPORTE (de Walvy — diferenciador de producto)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  title      TEXT        NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ac_user_updated ON ai_conversations(user_id, updated_at DESC);
CREATE TRIGGER trg_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            VARCHAR(10) NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT        NOT NULL,
  token_usage     JSONB       NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_am_conv_created ON ai_messages(conversation_id, created_at ASC);

CREATE TABLE IF NOT EXISTS ai_tool_invocations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID        NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
  tool_name  TEXT        NOT NULL,
  args       JSONB       NULL,
  result     JSONB       NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ati_message_id ON ai_tool_invocations(message_id);

-- Snapshot del contexto financiero al iniciar conversación
CREATE TABLE IF NOT EXISTS ai_context_snapshots (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID        NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  snapshot_date     DATE        NOT NULL,
  financial_summary JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acs_conversation ON ai_context_snapshots(conversation_id);

-- Base de conocimiento para el asistente
CREATE TABLE IF NOT EXISTS faq_articles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        NOT NULL UNIQUE,
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  locale     TEXT        NOT NULL DEFAULT 'es',
  tags       TEXT[]      NULL,
  sort_order INT         NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_faq_fulltext ON faq_articles
  USING gin(to_tsvector('spanish', title || ' ' || body));
CREATE TRIGGER trg_faq_articles_updated_at BEFORE UPDATE ON faq_articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 17 — ADMINISTRACIÓN Y AUDITORÍA (de Walvy)
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  role          VARCHAR(15) NOT NULL DEFAULT 'operator'
    CHECK (role IN ('super_admin','operator')),
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- FK diferidas a admin_users (tablas creadas antes)
ALTER TABLE app_config
  ADD CONSTRAINT fk_app_config_admin
  FOREIGN KEY (updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE gamification_rules
  ADD CONSTRAINT fk_gr_admin
  FOREIGN KEY (updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;

-- Log de acciones de administradores
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID        NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  entity      TEXT        NOT NULL,
  entity_id   UUID        NULL,
  before_data JSONB       NULL,
  after_data  JSONB       NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aal_admin_created ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aal_entity ON admin_audit_log(entity, entity_id);

-- Log de acciones de usuarios finales
CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NULL REFERENCES app_user(user_id) ON DELETE SET NULL,
  action     TEXT        NOT NULL,
  entity     TEXT        NOT NULL,
  entity_id  UUID        NULL,
  diff       JSONB       NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_al_user_created ON audit_log(user_id, created_at DESC);

-- Reportes pre-computados para backoffice
CREATE TABLE IF NOT EXISTS report_snapshots (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type           TEXT        NOT NULL,
  period_start          DATE        NOT NULL,
  period_end            DATE        NOT NULL,
  payload               JSONB       NOT NULL DEFAULT '{}',
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by_admin_id UUID        NULL REFERENCES admin_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_rs_report_type ON report_snapshots(report_type, period_start DESC);

-- ============================================================================
-- LAYER 18 — READ MODELS CQRS (de Edificate)
-- ============================================================================
-- Estas tablas son calculadas por jobs batch. NUNCA se leen desde la BD operacional;
-- son el modelo de lectura para las pantallas de Home, Deudas y Pagos.

CREATE TABLE IF NOT EXISTS user_month_diagnosis_summary (
  user_id                        UUID          NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  month                          DATE          NOT NULL,   -- Primer día del mes
  computed_at                    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  source_watermark_at            TIMESTAMPTZ   NOT NULL,
  rule_version                   VARCHAR(50)   NOT NULL,
  traffic_light_status           VARCHAR(6)    NOT NULL CHECK (traffic_light_status IN ('green','yellow','red')),
  traffic_light_reason_codes     TEXT[]        NOT NULL DEFAULT '{}',
  visible_savings_capacity_amount NUMERIC(19,4) NOT NULL DEFAULT 0,
  visible_savings_capacity_pct   NUMERIC(10,4) NULL,
  uncategorized_movements_count  INTEGER       NOT NULL DEFAULT 0,
  data_quality_level             VARCHAR(6)    NOT NULL CHECK (data_quality_level IN ('high','medium','low')),
  data_source_mix                VARCHAR(8)    NOT NULL CHECK (data_source_mix IN ('document','manual','both')),
  next_action_type               VARCHAR(15)   NULL
    CHECK (next_action_type IN ('pay','debt','budget','categorize','import')),
  next_action_ref_id             UUID          NULL,
  created_at                     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);
CREATE TRIGGER trg_user_month_diagnosis_summary_updated_at
  BEFORE UPDATE ON user_month_diagnosis_summary
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS user_month_debt_priority_summary (
  user_id                  UUID          NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  month                    DATE          NOT NULL,
  debt_id                  UUID          NOT NULL REFERENCES debt(debt_id) ON DELETE CASCADE,
  priority_rank            INTEGER       NOT NULL CHECK (priority_rank > 0),
  priority_score           NUMERIC(10,4) NOT NULL,
  min_payment_amount       NUMERIC(19,4) NOT NULL DEFAULT 0,
  estimated_payoff_date    DATE          NULL,
  released_cashflow_amount NUMERIC(19,4) NULL,
  computed_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  source_watermark_at      TIMESTAMPTZ   NOT NULL,
  rule_version             VARCHAR(50)   NOT NULL,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month, debt_id)
);
CREATE TRIGGER trg_user_month_debt_priority_summary_updated_at
  BEFORE UPDATE ON user_month_debt_priority_summary
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS user_upcoming_payments_summary (
  user_id                UUID          NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  window_start           DATE          NOT NULL,
  window_end             DATE          NOT NULL,
  user_payment_id        UUID          NOT NULL REFERENCES user_payment(user_payment_id) ON DELETE CASCADE,
  due_date               DATE          NOT NULL,
  amount                 NUMERIC(19,4) NOT NULL,
  user_payment_status_id BIGINT        NOT NULL REFERENCES status(status_id),
  computed_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  source_watermark_at    TIMESTAMPTZ   NOT NULL,
  rule_version           VARCHAR(50)   NOT NULL,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, window_start, window_end, user_payment_id)
);
CREATE TRIGGER trg_user_upcoming_payments_summary_updated_at
  BEFORE UPDATE ON user_upcoming_payments_summary
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS user_month_leaks_summary (
  user_id             UUID          NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  month               DATE          NOT NULL,
  leaks_total_amount  NUMERIC(19,4) NOT NULL DEFAULT 0,
  leaks_count         INTEGER       NOT NULL DEFAULT 0,
  ant_expense_total   NUMERIC(19,4) NOT NULL DEFAULT 0,  -- Gastos hormiga del mes
  top_categories      JSONB         NULL,
  computed_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  source_watermark_at TIMESTAMPTZ   NOT NULL,
  rule_version        VARCHAR(50)   NOT NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month)
);
CREATE TRIGGER trg_user_month_leaks_summary_updated_at BEFORE UPDATE ON user_month_leaks_summary
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- LAYER 19 — VISTAS DE NEGOCIO
-- ============================================================================

-- Modo de acceso del usuario (subscription / trial / none)
CREATE OR REPLACE VIEW v_user_access AS
WITH active_sub AS (
  SELECT s.user_id, TRUE AS has_active_subscription, s.origin, s.subscription_status_id
  FROM subscription s
  JOIN status st ON st.status_id = s.subscription_status_id
  JOIN status_domain d ON d.status_domain_id = st.status_domain_id
  WHERE d.code = 'subscription' AND st.code = 'active'
    AND (s.ends_at IS NULL OR s.ends_at > now())
),
trial AS (
  SELECT u.user_id,
    (u.trial_started_at IS NOT NULL AND u.trial_ends_at IS NOT NULL AND now() <= u.trial_ends_at) AS is_in_trial,
    u.trial_ends_at
  FROM app_user u
  WHERE u.deleted_at IS NULL
)
SELECT u.user_id,
  COALESCE(a.has_active_subscription, FALSE) AS has_active_subscription,
  a.origin AS subscription_origin,
  a.subscription_status_id,
  t.is_in_trial,
  t.trial_ends_at,
  CASE
    WHEN COALESCE(a.has_active_subscription, FALSE) THEN 'subscription'
    WHEN t.is_in_trial THEN 'trial'
    ELSE 'none'
  END AS access_mode
FROM app_user u
LEFT JOIN active_sub a ON a.user_id = u.user_id
LEFT JOIN trial t ON t.user_id = u.user_id
WHERE u.deleted_at IS NULL;

-- Última suscripción del usuario (para soporte/UI)
CREATE OR REPLACE VIEW v_user_current_subscription AS
SELECT s.*
FROM subscription s
JOIN LATERAL (
  SELECT subscription_id FROM subscription s2
  WHERE s2.user_id = s.user_id
  ORDER BY s2.created_at DESC LIMIT 1
) last ON last.subscription_id = s.subscription_id;

-- Estado efectivo de suscripción (detecta expiradas por tiempo sin depender de job)
CREATE OR REPLACE VIEW v_subscription_effective_state AS
SELECT s.*,
  CASE
    WHEN s.ends_at IS NOT NULL AND s.ends_at <= now() THEN 'expired_by_time'
    ELSE 'as_stored'
  END AS expiry_evaluation
FROM subscription s;

-- Home mensual unificado: diagnóstico + Walvy + acceso (para la pantalla principal)
CREATE OR REPLACE VIEW v_user_home_month AS
SELECT
  d.user_id,
  d.month,
  d.traffic_light_status,
  d.traffic_light_reason_codes,
  d.visible_savings_capacity_amount,
  d.uncategorized_movements_count,
  d.data_quality_level,
  d.next_action_type,
  d.next_action_ref_id,
  u.current_financial_health_level_id,
  fhl.name_es            AS financial_health_name_es,
  fhl.asset_path         AS financial_health_asset_path,
  a.access_mode,
  a.trial_ends_at,
  d.computed_at,
  d.source_watermark_at
FROM user_month_diagnosis_summary d
JOIN app_user u ON u.user_id = d.user_id
LEFT JOIN financial_health_level fhl
  ON fhl.financial_health_level_id = u.current_financial_health_level_id
LEFT JOIN v_user_access a ON a.user_id = d.user_id;

-- ============================================================================
-- SEEDS IDEMPOTENTES
-- ============================================================================

-- Países y monedas (LATAM-first)
INSERT INTO country(country_code, name) VALUES
  ('CL','Chile'),('CO','Colombia'),('AR','Argentina'),('PE','Perú'),('MX','México')
ON CONFLICT DO NOTHING;

INSERT INTO currency(currency_code, name, minor_units) VALUES
  ('CLP','Peso chileno',0),('COP','Peso colombiano',0),
  ('ARS','Peso argentino',2),('PEN','Sol peruano',2),
  ('MXN','Peso mexicano',2),('USD','Dólar estadounidense',2)
ON CONFLICT DO NOTHING;

INSERT INTO document_type(code, name, country_id, subject_scope) VALUES
  ('RUT','Rol Único Tributario', (SELECT country_id FROM country WHERE country_code='CL'), 'both'),
  ('DNI','Documento Nacional de Identidad', NULL, 'person'),
  ('PASSPORT','Pasaporte', NULL, 'person'),
  ('NIT','Número de Identificación Tributaria', (SELECT country_id FROM country WHERE country_code='CO'), 'both'),
  ('RUC','Registro Único de Contribuyentes', (SELECT country_id FROM country WHERE country_code='PE'), 'both'),
  ('RFC','Registro Federal de Contribuyentes', (SELECT country_id FROM country WHERE country_code='MX'), 'both')
ON CONFLICT DO NOTHING;

-- Dominios de estado
INSERT INTO status_domain(code, name) VALUES
  ('user','Estado de usuario'),
  ('movement','Estado de movimiento'),
  ('review_queue','Estado cola de revisión'),
  ('debt','Estado de deuda'),
  ('user_payment','Estado de pago agendado'),
  ('subscription','Estado de suscripción'),
  ('payment_method','Estado de método de pago'),
  ('message_event','Estado de evento/mensaje'),
  ('file_upload','Estado de carga de archivo')
ON CONFLICT DO NOTHING;

-- Estados por dominio
WITH d AS (SELECT status_domain_id, code FROM status_domain)
INSERT INTO status(status_domain_id, code, name, sort_order)
SELECT d.status_domain_id, s.code, s.name, s.sort_order
FROM d JOIN (VALUES
  ('user','active','Activo',1),
  ('user','suspended','Suspendido',2),
  ('user','deleted','Eliminado lógico',9),
  ('movement','posted','Registrado / confirmado',1),
  ('movement','pending_review','Pendiente de revisión',2),
  ('movement','excluded','Excluido de analíticas',9),
  ('review_queue','pending','Pendiente',1),
  ('review_queue','resolved','Resuelto',2),
  ('review_queue','dismissed','Descartado',9),
  ('debt','active','Activa',1),
  ('debt','paid','Pagada',2),
  ('debt','closed','Cerrada',3),
  ('user_payment','upcoming','Próximo',1),
  ('user_payment','overdue','Vencido',2),
  ('user_payment','paid','Pagado',3),
  ('user_payment','cancelled','Cancelado',9),
  ('subscription','trialing','En período de prueba',1),
  ('subscription','active','Activa',2),
  ('subscription','past_due','Atrasada',3),
  ('subscription','cancelled','Cancelada',8),
  ('subscription','expired','Expirada',9),
  ('payment_method','active','Activo',1),
  ('payment_method','inactive','Inactivo',9),
  ('message_event','created','Creado',1),
  ('message_event','shown','Mostrado',2),
  ('message_event','suppressed','Suprimido',3),
  ('message_event','dismissed','Descartado',4),
  ('message_event','acted','Accionado',5),
  ('file_upload','uploaded','Subido',1),
  ('file_upload','processing','Procesando',2),
  ('file_upload','processed','Procesado',3),
  ('file_upload','failed','Fallido',9)
) AS s(domain_code, code, name, sort_order) ON s.domain_code = d.code
ON CONFLICT DO NOTHING;

-- Roles y permisos RBAC
INSERT INTO role(code, name, description) VALUES
  ('super_admin','Super Administrador','Acceso total al sistema.'),
  ('operator','Operador','Soporte y configuración limitados.'),
  ('user','Usuario','Usuario final de la app.')
ON CONFLICT DO NOTHING;

INSERT INTO permission(code, name, path_pattern, http_methods) VALUES
  ('movements.read','Leer movimientos','/api/movements*','GET'),
  ('movements.write','Escribir movimientos','/api/movements*','POST,PUT,PATCH,DELETE'),
  ('debts.read','Leer deudas','/api/debts*','GET'),
  ('debts.write','Escribir deudas','/api/debts*','POST,PUT,PATCH,DELETE'),
  ('payments.read','Leer pagos','/api/payments*','GET'),
  ('payments.write','Escribir pagos','/api/payments*','POST,PUT,PATCH,DELETE'),
  ('budget.read','Leer presupuesto','/api/budget*','GET'),
  ('budget.write','Escribir presupuesto','/api/budget*','POST,PUT,PATCH,DELETE'),
  ('subscription.read','Leer suscripción','/api/subscription*','GET'),
  ('subscription.write','Gestionar suscripción','/api/subscription*','POST,PUT,PATCH'),
  ('admin.config','Configurar sistema','/api/admin/config*','GET,POST,PUT,PATCH'),
  ('admin.reports','Ver reportes','/api/admin/reports*','GET')
ON CONFLICT DO NOTHING;

-- Niveles de salud financiera (el avatar Walvy)
INSERT INTO financial_health_level(code, name_es, description_es, asset_path) VALUES
  ('overwhelmed','Desordenado / sobrepasado',
   'Baja claridad, presión financiera, pagos o fugas sin ordenar.',
   '/assets/walvy/overwhelmed.png'),
  ('transitioning','Ordenándose / transición',
   'Empieza a ordenar, priorizar y tomar acción.',
   '/assets/walvy/transitioning.png'),
  ('in_control','Ordenado / en control',
   'Claridad financiera, prioridades definidas y capacidad de ajustar.',
   '/assets/walvy/in_control.png')
ON CONFLICT DO NOTHING;

-- Planes de suscripción
INSERT INTO plan(code, name_es, billing_period) VALUES
  ('free','Plan Gratuito', NULL),
  ('monthly','Plan Pro Mensual','monthly'),
  ('annual','Plan Pro Anual','annual')
ON CONFLICT DO NOTHING;

-- Precios iniciales para Chile (ajustar por negocio)
WITH p AS (SELECT plan_id, code FROM plan WHERE code IN ('monthly','annual')),
     c AS (SELECT country_id FROM country WHERE country_code='CL'),
     cur AS (SELECT currency_id FROM currency WHERE currency_code='CLP')
INSERT INTO plan_price(plan_id, country_id, currency_id, price_amount, valid_from, is_active)
SELECT p.plan_id, c.country_id, cur.currency_id,
       CASE WHEN p.code='monthly' THEN 4990 ELSE 49900 END,
       CURRENT_DATE, true
FROM p, c, cur
ON CONFLICT DO NOTHING;

-- Reglas de gamificación
INSERT INTO gamification_rules(event_type, points, label) VALUES
  ('register_transaction','5','Registró un movimiento'),
  ('pay_on_time','20','Pagó a tiempo'),
  ('stay_under_budget','30','Se mantuvo bajo el presupuesto'),
  ('register_debt','10','Registró una deuda'),
  ('debt_paid','50','Pagó una deuda completa'),
  ('complete_onboarding','25','Completó el onboarding'),
  ('import_statement','15','Importó un estado de cuenta'),
  ('categorize_movements','10','Categorizó movimientos pendientes')
ON CONFLICT (event_type) DO NOTHING;

-- Reglas de mensajería iniciales
INSERT INTO message_rule(code, name_es, description_es, context, priority) VALUES
  ('budget_80pct','Llevas el 80% de tu presupuesto','El gasto mensual supera el 80% del presupuesto.','budget',2),
  ('payment_due_3d','Pago vence en 3 días','Un pago agendado está por vencer.','payments',1),
  ('debt_idle','Sin movimientos en tus deudas','No se han registrado abonos en los últimos 30 días.','debt',3),
  ('leaks_detected','Detectamos posibles fugas','Gastos pequeños frecuentes suman más de lo esperado.','home',2),
  ('uncategorized_movements','Movimientos sin categorizar','Tienes movimientos pendientes de revisión.','home',3),
  ('no_import_30d','Sin datos nuevos','No has importado movimientos en 30 días.','home',4),
  ('goal_progress','Progreso en tu meta','Tu meta financiera avanzó este mes.','profile',5)
ON CONFLICT (code) DO NOTHING;

-- Configuración global inicial
INSERT INTO app_config(key, value, value_type, description) VALUES
  ('budget.threshold.yellow_pct', '80', 'integer', 'Porcentaje de gasto que activa semáforo amarillo'),
  ('budget.threshold.red_pct', '100', 'integer', 'Porcentaje de gasto que activa semáforo rojo'),
  ('ant_expense.default_max_clp', '5000', 'integer', 'Monto máximo en CLP para considerar gasto hormiga'),
  ('gamification.enabled', 'true', 'boolean', 'Activa/desactiva el sistema de gamificación'),
  ('gamification.level_thresholds', '[0,100,300,600,1000,2000]', 'json', 'Puntos necesarios por nivel'),
  ('payment_reminder.days_before', '[7,3,1]', 'json', 'Días de anticipación para recordatorios de pagos'),
  ('snowball.default_extra_payment', '0', 'decimal', 'Pago extra mensual por defecto en simulación bola de nieve'),
  ('ai.context_refresh_messages', '10', 'integer', 'Cada cuántos mensajes se refresca el contexto de IA'),
  ('diagnosis.recalc_trigger', '"on_movement_change"', 'text', 'Cuándo recalcular el read model de diagnóstico')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ============================================================================
-- NOTA SOBRE MIGRACIONES
-- ============================================================================
-- Este archivo es el schema v2.0 inicial. Para producción:
--   1. Convertir a V001__initial_schema.sql (Flyway) o migración TypeORM/Prisma
--   2. Habilitar Row Level Security (RLS) en tablas financieras:
--        ALTER TABLE financial_movement ENABLE ROW LEVEL SECURITY;
--        CREATE POLICY user_isolation ON financial_movement USING (user_id = current_setting('app.current_user_id')::uuid);
--   3. Definir política de retención para user_month_diagnosis_summary y audit_log
-- ============================================================================
