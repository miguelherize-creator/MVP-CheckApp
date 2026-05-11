# Módulo 1 — Identidad, Autenticación y Acceso

**Layers cubiertos:** 0 (Catálogos ISO) · 1 (Status centralizado) · 2 (RBAC) · 3 (Configuración) · 4 (Identidad y Auth)

---

## 1. Propósito del módulo

Este módulo es el cimiento de todo el sistema. Define quién puede existir en Walvy, cómo se autentica, qué puede hacer dentro de la plataforma y en qué país/moneda opera. Todos los demás módulos dependen de él.

---

## 2. Diagrama de dependencias

```
country ──────────────────────────────────────────┐
currency ─────────────────────────────────────────┤
document_type ────────────────────────────────────┤
                                                  ▼
status_domain ──► status ──────────────────► app_user ──► refresh_tokens
                                                 │       ──► password_reset_tokens
role ──► permission ──► role_permission ─────────┤       ──► email_verification_tokens
                                                 │       ──► biometric_preferences
financial_health_level ──────────────────────────┤       ──► user_onboarding_state
app_config ──────────────────────────────────────┘
```

---

## 3. Diagrama ERD

Ver archivo: [`modulo1.dbml`](./modulo1.dbml)

Cubre las 17 tablas del módulo agrupadas en 5 capas (Layers 0–4) con todas las Foreign Keys y cardinalidades.

---

## 4. Tablas del módulo

### 3.1 `country`

Catálogo de países según ISO-3166-1 alpha-2.

| Columna | Tipo | Notas |
|---------|------|-------|
| `country_id` | BIGSERIAL PK | |
| `country_code` | CHAR(2) UNIQUE | Ej: `CL`, `CO`, `AR` |
| `name` | VARCHAR(100) UNIQUE | Nombre legible |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-set por trigger |

**Seeds:** Chile, Colombia, Argentina, Perú, México.  
**Relaciones salientes:** `currency` (vía `country_currency`), `document_type`, `app_user`, `financial_institution`, `company`, `plan_price`.

---

### 3.2 `currency`

Catálogo de monedas según ISO-4217.

| Columna | Tipo | Notas |
|---------|------|-------|
| `currency_id` | BIGSERIAL PK | |
| `currency_code` | CHAR(3) UNIQUE | Ej: `CLP`, `USD`, `COP` |
| `name` | VARCHAR(100) | Nombre legible |
| `minor_units` | SMALLINT | Dígitos decimales. CLP = 0, USD = 2 |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-set por trigger |

**Seeds:** CLP, COP, ARS, PEN, MXN, USD.

---

### 3.3 `country_currency`

Relación N:M entre países y monedas. Una moneda puede usarse en varios países y viceversa.

| Columna | Tipo | Notas |
|---------|------|-------|
| `country_id` | BIGINT FK → country | PK compuesta |
| `currency_id` | BIGINT FK → currency | PK compuesta |
| `is_primary` | BOOLEAN | Moneda principal del país |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Índice único:** `(country_id) WHERE is_primary = true` — garantiza que cada país tenga como máximo una moneda primaria.

---

### 3.4 `document_type`

Tipos de documento de identidad normalizados por país.

| Columna | Tipo | Notas |
|---------|------|-------|
| `document_type_id` | BIGSERIAL PK | |
| `code` | VARCHAR(30) UNIQUE | Ej: `RUT`, `DNI`, `PASSPORT` |
| `name` | VARCHAR(100) | Nombre legible |
| `country_id` | BIGINT FK → country NULL | NULL = aplica globalmente |
| `subject_scope` | VARCHAR(10) | `person`, `company`, `both` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Constraint:** `UNIQUE (country_id, name)` — mismo nombre no puede repetirse en el mismo país.  
**Seeds:** RUT (CL), DNI (CO/AR/PE/MX), PASSPORT (global), RUT Empresa (CL), NIT (CO), CUIT (AR).

---

### 3.5 `status_domain`

Dominios que agrupan estados relacionados. Reemplaza los ENUMs de PostgreSQL.

| Columna | Tipo | Notas |
|---------|------|-------|
| `status_domain_id` | BIGSERIAL PK | |
| `code` | VARCHAR(50) UNIQUE | Ej: `user`, `debt`, `subscription` |
| `name` | VARCHAR(100) | Nombre legible |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Seeds:** 9 dominios (user, movement, debt, subscription, user_payment, review_queue, message_event, file_upload, payment_method).

---

### 3.6 `status`

Estados individuales, agrupados por dominio.

| Columna | Tipo | Notas |
|---------|------|-------|
| `status_id` | BIGSERIAL PK | |
| `status_domain_id` | BIGINT FK → status_domain | |
| `code` | VARCHAR(50) | Ej: `active`, `trialing` |
| `name` | VARCHAR(100) | Nombre en español |
| `is_active` | BOOLEAN | Permite desactivar estados obsoletos |
| `sort_order` | SMALLINT | Orden de display |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Constraint:** `UNIQUE (status_domain_id, code)` — código único dentro de su dominio.

**Función de validación:** `enforce_status_domain(expected_domain_code, p_status_id)` — valida que un `status_id` pertenezca al dominio correcto. Usada en triggers de todas las tablas con `*_status_id`. Lanza `SQLSTATE 23514` si falla.

---

### 3.7 `role`

Roles del sistema de acceso (RBAC).

| Columna | Tipo | Notas |
|---------|------|-------|
| `role_id` | BIGSERIAL PK | |
| `code` | VARCHAR(50) UNIQUE | Ej: `admin`, `support`, `user` |
| `name` | VARCHAR(100) | |
| `description` | TEXT NULL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Seeds:** `admin`, `support`, `user`.

---

### 3.8 `permission`

Permisos atómicos del sistema. Cada permiso representa un recurso + acción.

| Columna | Tipo | Notas |
|---------|------|-------|
| `permission_id` | BIGSERIAL PK | |
| `code` | VARCHAR(120) UNIQUE | Ej: `movements.read`, `debts.write` |
| `name` | VARCHAR(150) | Descripción breve |
| `description` | TEXT NULL | |
| `path_pattern` | VARCHAR(200) NULL | Ej: `/api/movements*` |
| `http_methods` | VARCHAR(50) NULL | Ej: `GET,POST` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Seeds:** 12 permisos base (movements, debts, payments, budget, profile, reports — con read/write cada uno).

---

### 3.9 `role_permission`

Tabla pivot que asigna permisos a roles.

| Columna | Tipo | Notas |
|---------|------|-------|
| `role_id` | BIGINT FK → role | PK compuesta |
| `permission_id` | BIGINT FK → permission | PK compuesta |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Seeds:**
- `admin` → todos los permisos
- `support` → todos los permisos de lectura
- `user` → lectura/escritura sobre sus propios recursos

---

### 3.10 `financial_health_level`

Niveles del avatar de salud financiera de Walvy.

| Columna | Tipo | Notas |
|---------|------|-------|
| `financial_health_level_id` | BIGSERIAL PK | |
| `code` | VARCHAR(50) UNIQUE | `overwhelmed`, `transitioning`, `in_control` |
| `name_es` | VARCHAR(120) | Nombre mostrado al usuario |
| `description_es` | TEXT NULL | Texto motivacional |
| `asset_path` | VARCHAR(500) NULL | Ruta del asset del avatar |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Seeds:** 3 niveles con textos motivacionales en español.

---

### 3.11 `app_config`

Configuración operacional global. Clave-valor tipado. Ajustable desde backoffice sin deploy.

| Columna | Tipo | Notas |
|---------|------|-------|
| `key` | TEXT PK | Ej: `trial_days_default` |
| `value` | JSONB | Valor tipado |
| `value_type` | VARCHAR(10) | `integer`, `decimal`, `boolean`, `json`, `text` |
| `description` | TEXT NULL | |
| `updated_by_admin_id` | UUID NULL FK → admin_users | Trazabilidad |
| `updated_at` | TIMESTAMPTZ | |

**Seeds:**

| Key | Valor | Tipo |
|-----|-------|------|
| `trial_days_default` | 14 | integer |
| `max_import_rows_per_upload` | 5000 | integer |
| `ant_expense_max_amount_clp` | 3000 | integer |
| `feature_ai_enabled` | true | boolean |
| `feature_b2b_enabled` | false | boolean |
| `feature_gift_subscriptions_enabled` | false | boolean |
| `min_password_length` | 8 | integer |
| `max_login_attempts` | 5 | integer |
| `session_timeout_hours` | 24 | integer |

---

### 3.12 `app_user`

Tabla central de usuarios. Combina autenticación local (Walvy) con capacidades multi-país, multi-rol y trial (Edificate).

| Columna | Tipo | Notas |
|---------|------|-------|
| `user_id` | UUID PK | `gen_random_uuid()` |
| `email` | VARCHAR(320) UNIQUE NULL | NULL si usa solo auth externa |
| `password_hash` | TEXT NULL | NULL si usa solo OAuth |
| `auth_provider` | VARCHAR(50) NULL | `google`, `apple`, `auth0` |
| `auth_provider_user_id` | VARCHAR(200) NULL | ID en el proveedor externo |
| `identifier_type` | VARCHAR(20) | `email`, `rut`, `username` |
| `full_name` | VARCHAR(200) NULL | Nombre completo para mostrar |
| `username` | VARCHAR(80) UNIQUE NULL | Alias visible del usuario |
| `avatar_url` | VARCHAR(500) NULL | URL de la foto de perfil (S3/storage) |
| `notification_email` | VARCHAR(320) NULL | Email de notificaciones (puede diferir del login) |
| `notification_email_verified_at` | TIMESTAMPTZ NULL | NULL hasta confirmar el nuevo email de notificaciones |
| `document_type_id` | BIGINT NULL FK → document_type | |
| `document_number` | VARCHAR(50) NULL | |
| `country_id` | BIGINT NOT NULL FK → country | |
| `default_currency_id` | BIGINT NOT NULL FK → currency | |
| `role_id` | BIGINT NOT NULL FK → role | |
| `user_status_id` | BIGINT NOT NULL FK → status | Dominio: `user` |
| `trial_started_at` | TIMESTAMPTZ NULL | |
| `trial_ends_at` | TIMESTAMPTZ NULL | |
| `current_financial_health_level_id` | BIGINT NULL FK → financial_health_level | |
| `financial_health_updated_at` | TIMESTAMPTZ NULL | |
| `email_verified_at` | TIMESTAMPTZ NULL | |
| `accepted_terms_at` | TIMESTAMPTZ NULL | |
| `deleted_at` | TIMESTAMPTZ NULL | Soft delete |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-set por trigger |

**Constraints:**
- `chk_trial_pair` — `trial_started_at` y `trial_ends_at` son ambos NULL o ambos NOT NULL, y `ends_at > started_at`.
- Trigger `trg_app_user_status_domain` — valida que `user_status_id` pertenezca al dominio `user`.

**Índices:**
- `idx_app_user_email (email) WHERE email IS NOT NULL`
- `idx_app_user_role (role_id)`
- `idx_app_user_username (username) WHERE username IS NOT NULL`

---

### 3.13 `refresh_tokens`

JWT refresh tokens almacenados como hash (nunca el token en claro).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → app_user | CASCADE DELETE |
| `token_hash` | TEXT UNIQUE | SHA-256 del token real |
| `expires_at` | TIMESTAMPTZ | |
| `revoked_at` | TIMESTAMPTZ NULL | Revocado explícitamente |
| `created_at` | TIMESTAMPTZ | |

**Índice:** `(user_id, expires_at)` — para limpiar tokens expirados por usuario.  
**Comportamiento:** Al hacer refresh, el token antiguo se revoca (`revoked_at = now()`) y se genera uno nuevo (rotación).

---

### 3.14 `password_reset_tokens`

Tokens de un solo uso para el flujo de reset de contraseña.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → app_user | CASCADE DELETE |
| `token_hash` | TEXT UNIQUE | |
| `expires_at` | TIMESTAMPTZ | Típicamente 1 hora |
| `used_at` | TIMESTAMPTZ NULL | Marcado al usar |
| `created_at` | TIMESTAMPTZ | |

---

### 3.15 `email_verification_tokens`

Códigos de verificación de email de un solo uso. La app no tiene página web de respaldo, por lo que el flujo usa un **código de 6 dígitos** enviado al email que el usuario ingresa directamente en la app (no un link).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → app_user | CASCADE DELETE |
| `email` | TEXT | Email a verificar (puede diferir del actual si el usuario lo está cambiando) |
| `token_hash` | TEXT UNIQUE | Hash del código de 6 dígitos (nunca se guarda el código en claro) |
| `expires_at` | TIMESTAMPTZ | **15 minutos** — códigos cortos expiran antes que links |
| `attempts` | SMALLINT | Intentos fallidos. Al llegar a 5 se invalida el token (`used_at = now()`) |
| `used_at` | TIMESTAMPTZ NULL | NULL = código aún válido |
| `created_at` | TIMESTAMPTZ | |

---

### 3.16 `biometric_preferences`

Preferencias de autenticación biométrica del usuario (1:1 con `app_user`).

| Columna | Tipo | Notas |
|---------|------|-------|
| `user_id` | UUID PK FK → app_user | CASCADE DELETE |
| `enabled` | BOOLEAN | |
| `method` | TEXT NULL | `face_id`, `touch_id`, `fingerprint` |
| `device_id` | TEXT NULL | Identificador del dispositivo vinculado |
| `updated_at` | TIMESTAMPTZ | |

---

### 3.17 `user_onboarding_state`

Estado del flujo de onboarding del usuario. Combina checkpoints de Walvy con la capacidad de retomar el flujo desde cualquier pantalla (Edificate).

| Columna | Tipo | Notas |
|---------|------|-------|
| `user_id` | UUID PK FK → app_user | CASCADE DELETE |
| `onboarding_status` | VARCHAR(20) | `not_started`, `in_progress`, `completed` |
| `current_step` | VARCHAR(80) NULL | Paso actual: `email_verification`, `profile`, `goals`, `import` |
| `resume_surface` | VARCHAR(80) NULL | Pantalla donde retomar: `home`, `onboarding` |
| `resume_context` | JSONB NULL | Datos de contexto para retomar (ej: paso previo completado) |
| `financial_profile_completed` | BOOLEAN | |
| `goals_set` | BOOLEAN | |
| `import_attempted` | BOOLEAN | |
| `biometric_prompted` | BOOLEAN | |
| `min_doc_threshold_met` | BOOLEAN | El usuario subió al menos 1 cartola |
| `last_checkpoint_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ NULL | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-set por trigger |

---

## 5. Triggers del módulo

| Trigger | Tabla | Función | Evento |
|---------|-------|---------|--------|
| `trg_country_updated_at` | `country` | `set_updated_at()` | BEFORE UPDATE |
| `trg_currency_updated_at` | `currency` | `set_updated_at()` | BEFORE UPDATE |
| `trg_country_currency_updated_at` | `country_currency` | `set_updated_at()` | BEFORE UPDATE |
| `trg_document_type_updated_at` | `document_type` | `set_updated_at()` | BEFORE UPDATE |
| `trg_status_domain_updated_at` | `status_domain` | `set_updated_at()` | BEFORE UPDATE |
| `trg_status_updated_at` | `status` | `set_updated_at()` | BEFORE UPDATE |
| `trg_role_updated_at` | `role` | `set_updated_at()` | BEFORE UPDATE |
| `trg_permission_updated_at` | `permission` | `set_updated_at()` | BEFORE UPDATE |
| `trg_role_permission_updated_at` | `role_permission` | `set_updated_at()` | BEFORE UPDATE |
| `trg_fin_health_level_updated_at` | `financial_health_level` | `set_updated_at()` | BEFORE UPDATE |
| `trg_app_user_updated_at` | `app_user` | `set_updated_at()` | BEFORE UPDATE |
| `trg_app_user_status_domain` | `app_user` | `enforce_status_domain('user', ...)` | BEFORE INSERT OR UPDATE |
| `trg_user_onboarding_state_updated_at` | `user_onboarding_state` | `set_updated_at()` | BEFORE UPDATE |

---

## 6. Funciones globales del módulo

### `set_updated_at()`
```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
Usada en todos los triggers de `updated_at` del sistema.

### `enforce_status_domain(expected_domain_code, p_status_id)`
```sql
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
```
Usada por triggers en todas las tablas con columna `*_status_id`.

---

## 7. Relaciones con otros módulos

| Módulo destino | Tabla que referencia | Columna |
|----------------|---------------------|---------|
| Módulo 2 — B2B | `company` | `country_id` |
| Módulo 3 — Perfil | `user_financial_profile` | `user_id`, `currency_id` |
| Módulo 7 — Catálogos financieros | `financial_institution` | `country_id` |
| Módulo 7 — Catálogos financieros | `category` | `owner_user_id` |
| Módulo 9 — Movimientos | `financial_movement` | `user_id`, `currency_id` |
| Módulo 11 — Deudas | `debt` | `user_id`, `currency_id` |
| Módulo 13 — Monetización | `subscription` | `user_id` |
| Módulo 13 — Monetización | `plan_price` | `country_id`, `currency_id` |
| Módulo 14 — Gamificación | `user_gamification_stats` | `user_id` |
| Módulo 16 — IA | `ai_conversations` | `user_id` |
