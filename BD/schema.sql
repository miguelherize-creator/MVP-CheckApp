-- =============================================================================
-- Walvy MVP — Schema completo M1–M9
-- PostgreSQL 15+
-- Generado: 2026-04-14 | Basado en DB/schema-mvp-completo.dbml
-- Uso: referencia DDL manual. TypeORM crea/sincroniza las tablas con DB_SYNC=true.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE movement_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE flow_type AS ENUM ('fixed', 'variable');
CREATE TYPE funding_source_kind AS ENUM ('checking', 'credit_line', 'credit_card', 'investment', 'cash', 'other');
CREATE TYPE debt_type AS ENUM ('consumer', 'mortgage', 'credit_card', 'line', 'other');
CREATE TYPE debt_record_status AS ENUM ('active', 'paid', 'closed');
CREATE TYPE bill_payable_status AS ENUM ('pending', 'paid', 'overdue');
CREATE TYPE traffic_light AS ENUM ('green', 'yellow', 'red');
CREATE TYPE suggestion_source AS ENUM ('movement_pattern', 'import');
CREATE TYPE recurring_suggestion_status AS ENUM ('pending_user_confirm', 'accepted', 'dismissed');
CREATE TYPE import_status AS ENUM ('pending', 'processing', 'parsed', 'failed', 'cancelled');
CREATE TYPE import_line_review_status AS ENUM ('pending', 'accepted', 'rejected', 'edited');
CREATE TYPE classification_target AS ENUM ('debt_plan', 'bills_payable');
CREATE TYPE classification_decision AS ENUM ('accepted', 'ignored', 'corrected');
CREATE TYPE goal_type AS ENUM ('reduce_debt', 'save_amount', 'improve_savings_capacity', 'avoid_late_payments', 'meet_budget', 'other');
CREATE TYPE alert_channel AS ENUM ('in_app', 'push', 'email');
CREATE TYPE ai_message_role AS ENUM ('user', 'assistant', 'system');
CREATE TYPE recommendation_context AS ENUM ('home', 'budget', 'debt', 'payments', 'profile');
CREATE TYPE admin_role AS ENUM ('super_admin', 'operator');
CREATE TYPE identifier_type AS ENUM ('email', 'rut', 'username');

-- =============================================================================
-- G1 — Core Identity & Auth   [Módulo 1]
-- =============================================================================

CREATE TABLE users (
  id                UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  username          TEXT            NOT NULL UNIQUE,
  -- 'email'    → username = tu@correo.cl, email = tu@correo.cl
  -- 'rut'      → username = 12345678-9,   email = null (hasta verificar)
  -- 'username' → username = userwalvy,    email = null (hasta verificar)
  identifier_type   identifier_type NOT NULL DEFAULT 'email',
  email             TEXT            UNIQUE,
  password_hash     TEXT            NOT NULL,
  name              TEXT,
  accepted_terms_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email      ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(created_at);

-- ─── refresh_tokens ───────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rt_user_id    ON refresh_tokens(user_id);
CREATE INDEX idx_rt_expires_at ON refresh_tokens(expires_at);

-- ─── password_reset_tokens ────────────────────────────────────────────────────
CREATE TABLE password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prt_user_id ON password_reset_tokens(user_id);

-- ─── email_verification_tokens ────────────────────────────────────────────────
-- Códigos de 6 dígitos para verificar correo post-registro. TTL: 15 minutos.
-- Flow A: email → código enviado automáticamente al registrarse.
-- Flow B: RUT/username → usuario ingresa correo en pantalla EmailVerification.
CREATE TABLE email_verification_tokens (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email      TEXT        NOT NULL,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evt_user_id ON email_verification_tokens(user_id);

-- ─── biometric_preferences ────────────────────────────────────────────────────
-- Relación 1:1 con users (user_id es PK). Se crea con enabled=false al registrarse.
CREATE TABLE biometric_preferences (
  user_id    UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled    BOOLEAN     NOT NULL DEFAULT false,
  method     TEXT,
  device_id  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- G2 — Onboarding   [Módulos 1, 2]
-- =============================================================================

-- Relación 1:1 con users (user_id es PK).
-- current_step: 'email_verification' | 'email_collection' | 'profile' | 'goals' | 'completed'
CREATE TABLE onboarding_state (
  user_id                     UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_step                TEXT        NOT NULL DEFAULT 'email_verification',
  financial_profile_completed BOOLEAN     NOT NULL DEFAULT false,
  goals_set                   BOOLEAN     NOT NULL DEFAULT false,
  import_attempted            BOOLEAN     NOT NULL DEFAULT false,
  biometric_prompted          BOOLEAN     NOT NULL DEFAULT false,
  completed_at                TIMESTAMPTZ,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- G3 — Perfil Financiero & Metas   [Módulo 2]
-- =============================================================================

-- Relación 1:1 con users (user_id es PK).
CREATE TABLE user_financial_profile (
  user_id                    UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monthly_income_estimate    NUMERIC(19,4),
  stable_expenses_note       TEXT,
  estimated_payment_capacity NUMERIC(19,4),
  currency                   TEXT        NOT NULL DEFAULT 'CLP',
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_goals (
  id             UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_type      goal_type NOT NULL,
  target_value   NUMERIC(19,4),
  declared_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  progress_cache JSONB,
  is_active      BOOLEAN   NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ug_user_id ON user_goals(user_id);

-- =============================================================================
-- G4 — Alertas & Notificaciones   [Módulos 2, 7]
-- =============================================================================

CREATE TABLE alert_preferences (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type   TEXT          NOT NULL,
  channel      alert_channel NOT NULL,
  enabled      BOOLEAN       NOT NULL DEFAULT true,
  intensity    TEXT,
  cadence_days INT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, alert_type, channel)
);

CREATE INDEX idx_ap_user_id ON alert_preferences(user_id);

CREATE TABLE notification_queue (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel          alert_channel NOT NULL,
  payload          JSONB         NOT NULL,
  scheduled_for    TIMESTAMPTZ   NOT NULL,
  sent_at          TIMESTAMPTZ,
  bills_payable_id UUID,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nq_user_scheduled ON notification_queue(user_id, scheduled_for) WHERE sent_at IS NULL;

-- =============================================================================
-- G5 — Taxonomía: Fuentes & Categorías   [Módulos 4, 6]
-- =============================================================================

CREATE TABLE funding_sources (
  id         UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       TEXT                NOT NULL,
  name       TEXT                NOT NULL,
  type       funding_source_kind NOT NULL,
  is_active  BOOLEAN             NOT NULL DEFAULT true,
  metadata   JSONB               NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fs_user_id ON funding_sources(user_id);

CREATE TABLE categories (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  slug       TEXT,
  icon       TEXT,
  color      TEXT,
  sort_order INT         NOT NULL DEFAULT 0,
  is_system  BOOLEAN     NOT NULL DEFAULT false,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cat_user_active ON categories(user_id, is_active);
CREATE INDEX idx_cat_slug        ON categories(slug) WHERE slug IS NOT NULL;

CREATE TABLE subcategories (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  slug        TEXT,
  icon        TEXT,
  color       TEXT,
  sort_order  INT         NOT NULL DEFAULT 0,
  is_system   BOOLEAN     NOT NULL DEFAULT false,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sub_cat_active  ON subcategories(category_id, is_active);
CREATE INDEX idx_sub_user_active ON subcategories(user_id, is_active);

-- =============================================================================
-- G6 — Transacciones   [Módulos 4, 6, 7]
-- =============================================================================

CREATE TABLE statement_imports (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_key          TEXT          NOT NULL,
  original_filename TEXT,
  status            import_status NOT NULL DEFAULT 'pending',
  parsed_at         TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_si_user_id ON statement_imports(user_id);

CREATE TABLE transactions (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movement_type     movement_type NOT NULL,
  flow_type         flow_type     NOT NULL,
  funding_source_id UUID          REFERENCES funding_sources(id) ON DELETE SET NULL,
  category_id       UUID          REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id    UUID          REFERENCES subcategories(id) ON DELETE SET NULL,
  amount            NUMERIC(19,4) NOT NULL,
  occurred_on       DATE          NOT NULL,
  description       TEXT,
  is_ant_expense    BOOLEAN       NOT NULL DEFAULT false,
  external_ref      TEXT,
  import_id         UUID          REFERENCES statement_imports(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_tx_user_occurred ON transactions(user_id, occurred_on DESC);
CREATE INDEX idx_tx_user_category ON transactions(user_id, category_id);
CREATE INDEX idx_tx_funding        ON transactions(funding_source_id);
CREATE INDEX idx_tx_import         ON transactions(import_id);

CREATE TABLE ant_expense_rules (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  max_amount  NUMERIC(19,4),
  category_id UUID        REFERENCES categories(id) ON DELETE SET NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aer_user_id ON ant_expense_rules(user_id);

-- =============================================================================
-- G7 — Presupuesto   [Módulo 6]
-- =============================================================================

CREATE TABLE budget_periods (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year       INT         NOT NULL,
  month      INT         NOT NULL CHECK (month BETWEEN 1 AND 12),
  currency   TEXT        NOT NULL DEFAULT 'CLP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, month)
);

CREATE INDEX idx_bp_user_id ON budget_periods(user_id);

CREATE TABLE budget_lines (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_period_id UUID        NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  category_id      UUID        REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id   UUID        REFERENCES subcategories(id) ON DELETE SET NULL,
  planned_amount   NUMERIC(19,4) NOT NULL,
  planned_min      NUMERIC(19,4),
  planned_max      NUMERIC(19,4),
  suggested_by_app BOOLEAN     NOT NULL DEFAULT false,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bl_period    ON budget_lines(budget_period_id);
CREATE INDEX idx_bl_period_cat ON budget_lines(budget_period_id, category_id);

-- =============================================================================
-- G8 — Motor de Deudas: Bola de Nieve   [Módulo 4]
-- =============================================================================

CREATE TABLE debts (
  id                     UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                   TEXT               NOT NULL,
  creditor_label         TEXT,
  debt_type              debt_type          NOT NULL,
  principal_initial      NUMERIC(19,4),
  current_balance        NUMERIC(19,4)      NOT NULL,
  currency               TEXT               NOT NULL DEFAULT 'CLP',
  apr_annual             NUMERIC(7,4),
  minimum_payment        NUMERIC(19,4),
  installments_total     INT,
  installments_remaining INT,
  due_day                INT                CHECK (due_day BETWEEN 1 AND 31),
  next_due_date          DATE,
  funding_source_id      UUID               REFERENCES funding_sources(id) ON DELETE SET NULL,
  snowball_priority      INT,
  status                 debt_record_status NOT NULL DEFAULT 'active',
  metadata               JSONB              NOT NULL DEFAULT '{}',
  created_at             TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ
);

CREATE INDEX idx_debts_user_status    ON debts(user_id, status);
CREATE INDEX idx_debts_user_snowball  ON debts(user_id, snowball_priority ASC);

CREATE TABLE debt_schedules (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id           UUID        NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  installment_no    INT         NOT NULL,
  due_date          DATE        NOT NULL,
  planned_principal NUMERIC(19,4),
  planned_interest  NUMERIC(19,4),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ds_debt_id ON debt_schedules(debt_id);

CREATE TABLE debt_payments (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id        UUID        NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  paid_at        TIMESTAMPTZ NOT NULL,
  amount         NUMERIC(19,4) NOT NULL,
  transaction_id UUID        REFERENCES transactions(id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dp_debt_paid ON debt_payments(debt_id, paid_at DESC);

CREATE TABLE debt_attachments (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  debt_id           UUID        REFERENCES debts(id) ON DELETE SET NULL,
  storage_key       TEXT        NOT NULL,
  mime_type         TEXT,
  original_filename TEXT,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parsed_summary    JSONB
);

CREATE INDEX idx_da_user_id ON debt_attachments(user_id);
CREATE INDEX idx_da_debt_id ON debt_attachments(debt_id);

CREATE TABLE debt_snowball_plan (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ordered_debt_ids      UUID[]      NOT NULL,
  extra_monthly_payment NUMERIC(19,4) NOT NULL DEFAULT 0,
  lump_sum_payment      NUMERIC(19,4),
  estimated_completion  JSONB       NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_dsp_user_computed ON debt_snowball_plan(user_id, computed_at DESC);

-- =============================================================================
-- G9 — Pipeline de Importación & Clasificación   [Módulo 4]
-- =============================================================================

CREATE TABLE import_line_items (
  id                 UUID                      PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_id          UUID                      NOT NULL REFERENCES statement_imports(id) ON DELETE CASCADE,
  row_index          INT,
  raw_row            JSONB,
  normalized         JSONB,
  user_review_status import_line_review_status NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMPTZ               NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ               NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ili_import_status ON import_line_items(import_id, user_review_status);

CREATE TABLE movement_classification_suggestions (
  id               UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id   UUID                    REFERENCES transactions(id) ON DELETE SET NULL,
  import_line_id   UUID                    REFERENCES import_line_items(id) ON DELETE SET NULL,
  suggested_target classification_target  NOT NULL,
  confidence       NUMERIC(4,3),
  rule_matched     TEXT,
  user_decision    classification_decision,
  decided_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcs_user_id ON movement_classification_suggestions(user_id);

-- =============================================================================
-- G10 — Pagos & Cuentas por Pagar   [Módulo 7]
-- =============================================================================

CREATE TABLE bills_payable (
  id                      UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                   TEXT                NOT NULL,
  amount                  NUMERIC(19,4)       NOT NULL,
  due_date                DATE                NOT NULL,
  status                  bill_payable_status NOT NULL DEFAULT 'pending',
  funding_source_id       UUID                REFERENCES funding_sources(id) ON DELETE SET NULL,
  notes                   TEXT,
  is_recurring            BOOLEAN             NOT NULL DEFAULT false,
  recurrence_interval_days INT,
  paid_at                 TIMESTAMPTZ,
  linked_transaction_id   UUID                REFERENCES transactions(id) ON DELETE SET NULL,
  traffic_light_state     traffic_light,
  created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bill_user_status  ON bills_payable(user_id, status);
CREATE INDEX idx_bill_user_due     ON bills_payable(user_id, due_date ASC);

-- FK diferida: notification_queue.bills_payable_id → bills_payable.id
-- (no declarada como FK para evitar dependencia circular en creación)

CREATE TABLE recurring_payment_suggestions (
  id                UUID                        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID                        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source            suggestion_source           NOT NULL,
  suggested_payload JSONB                       NOT NULL,
  status            recurring_suggestion_status NOT NULL DEFAULT 'pending_user_confirm',
  created_at        TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rps_user_id ON recurring_payment_suggestions(user_id);

-- =============================================================================
-- G11 — Gamificación   [Módulos 3, 9]
-- =============================================================================

CREATE TABLE gamification_rules (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type          TEXT        NOT NULL UNIQUE,
  points              INT         NOT NULL DEFAULT 0,
  label               TEXT        NOT NULL,
  description         TEXT,
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  updated_by_admin_id UUID,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gamification_events (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type     TEXT        NOT NULL,
  points         INT         NOT NULL,
  reference_type TEXT,
  reference_id   UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ge_user_created ON gamification_events(user_id, created_at DESC);

-- Relación 1:1 con users (user_id es PK)
CREATE TABLE user_gamification_stats (
  user_id          UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_points     INT         NOT NULL DEFAULT 0,
  level            INT         NOT NULL DEFAULT 1,
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_score_history (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE        NOT NULL,
  period_end   DATE        NOT NULL,
  points       INT         NOT NULL,
  level        INT         NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ush_user_period ON user_score_history(user_id, period_start DESC);

-- =============================================================================
-- G12 — Salud Financiera & Recomendaciones   [Módulos 3, 8]
-- =============================================================================

CREATE TABLE financial_health_snapshots (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date DATE          NOT NULL,
  traffic_light traffic_light NOT NULL,
  score         NUMERIC(5,2),
  payload       JSONB         NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fhs_user_date ON financial_health_snapshots(user_id, snapshot_date DESC);

CREATE TABLE recommendation_events (
  id           UUID                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID                   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  context      recommendation_context NOT NULL,
  rule_key     TEXT                   NOT NULL,
  payload      JSONB                  NOT NULL DEFAULT '{}',
  shown_at     TIMESTAMPTZ            NOT NULL,
  dismissed_at TIMESTAMPTZ,
  actioned_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_re_user_context ON recommendation_events(user_id, context, shown_at DESC);

-- =============================================================================
-- G13 — IA & Soporte   [Módulo 8]
-- =============================================================================

CREATE TABLE ai_conversations (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ac_user_updated ON ai_conversations(user_id, updated_at DESC);

CREATE TABLE ai_messages (
  id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID            NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            ai_message_role NOT NULL,
  content         TEXT            NOT NULL,
  token_usage     JSONB,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_am_conv_created ON ai_messages(conversation_id, created_at ASC);

CREATE TABLE ai_tool_invocations (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID        NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
  tool_name  TEXT        NOT NULL,
  args       JSONB,
  result     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ati_message_id ON ai_tool_invocations(message_id);

CREATE TABLE ai_context_snapshots (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   UUID        NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  snapshot_date     DATE        NOT NULL,
  financial_summary JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acs_conversation ON ai_context_snapshots(conversation_id);

CREATE TABLE faq_articles (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug       TEXT        NOT NULL UNIQUE,
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  locale     TEXT        NOT NULL DEFAULT 'es',
  tags       TEXT[],
  sort_order INT         NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- G14 — Administración   [Módulo 9]
-- =============================================================================

CREATE TABLE admin_users (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  role          admin_role  NOT NULL DEFAULT 'operator',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configuración global ajustable desde el backoffice.
-- key = "budget.threshold.yellow_pct", value = 80, etc.
CREATE TABLE app_config (
  key                 TEXT        PRIMARY KEY,
  value               JSONB       NOT NULL,
  description         TEXT,
  updated_by_admin_id UUID        REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK diferidas que requieren admin_users (declaradas aquí)
ALTER TABLE gamification_rules
  ADD CONSTRAINT fk_gr_admin
  FOREIGN KEY (updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;

CREATE TABLE admin_audit_log (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID        REFERENCES admin_users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  entity      TEXT        NOT NULL,
  entity_id   UUID,
  before_data JSONB,
  after_data  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aal_admin_created ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_aal_entity        ON admin_audit_log(entity, entity_id);

CREATE TABLE audit_log (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT        NOT NULL,
  entity     TEXT        NOT NULL,
  entity_id  UUID,
  diff       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_al_user_created  ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_al_entity        ON audit_log(entity, created_at DESC);

CREATE TABLE report_snapshots (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type           TEXT        NOT NULL,
  period_start          DATE        NOT NULL,
  period_end            DATE        NOT NULL,
  payload               JSONB       NOT NULL DEFAULT '{}',
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by_admin_id UUID        REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_rs_report_type ON report_snapshots(report_type, period_start DESC);
