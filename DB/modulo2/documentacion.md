# Módulo 2 — Perfil y Configuración

**Layer cubierto:** 6 (Perfil de usuario y alertas)  
**Alcance:** MVP ✅

---

## 1. Propósito del módulo

Gestiona la información financiera declarada por el usuario, sus metas globales y sus preferencias de alerta/notificación. Es la capa de configuración personal que alimenta al resto de los módulos: el perfil financiero genera la capacidad estimada de pago, las metas orientan las recomendaciones y las preferencias de alerta controlan qué y cómo se avisa al usuario.

Sin este módulo, Walvy no puede calcular capacidad de pago, generar recomendaciones contextuales ni enviar alertas útiles al usuario.

---

## 2. Diagrama de dependencias

```
app_user (M1·L4) ──────────────────► user_financial_profile
                                              │
app_user (M1·L4) ──────────────────► user_goals
                                              │
app_user (M1·L4) ──────────────────► alert_preferences ──► notification_queue
currency (M1·L0) ──────────────────► user_financial_profile
```

**Dependencias entrantes desde otros módulos:**
- `app_user` (Módulo 1) — todos los registros de este módulo son 1:1 o 1:N con el usuario
- `currency` (Módulo 1) — moneda del perfil financiero

**Dependencias salientes hacia otros módulos:**
- `user_financial_profile.estimated_payment_capacity` → Módulo 4 (Motor de Deudas) — calcula capacidad de pago para la Bola de Nieve
- `user_goals` → Módulo 3 (Home) — muestra avance de metas en el dashboard
- `notification_queue` → todos los módulos que generan eventos (pagos, presupuesto, deudas)

---

## 3. Diagrama ERD

Ver archivo: [`modulo2.dbml`](./modulo2.dbml)

Cubre las 4 tablas del módulo con sus Foreign Keys y las referencias a Módulo 1.

---

## 4. Tablas del módulo

### 4.1 `user_financial_profile`

Perfil financiero declarado por el usuario. Relación 1:1 con `app_user`. Se crea durante el onboarding y puede actualizarse desde el perfil.

| Columna | Tipo | Notas |
|---------|------|-------|
| `user_id` | UUID PK FK → app_user | Clave compartida (no genera UUID propio) |
| `monthly_income_estimate` | NUMERIC(19,4) NULL | Ingreso mensual estimado declarado |
| `stable_expenses_note` | TEXT NULL | Nota libre sobre gastos fijos (ej: arriendo, colegiaturas) |
| `estimated_payment_capacity` | NUMERIC(19,4) NULL | Calculado: ingreso − gastos fijos estimados |
| `currency_id` | BIGINT FK → currency NULL | Moneda del perfil |
| `updated_at` | TIMESTAMPTZ | Auto-set por trigger |

**Nota:** No tiene `created_at` propio; la fecha de creación se infiere del `app_user`. El PK es `user_id` directamente (no genera UUID adicional).

---

### 4.2 `user_goals`

Metas financieras globales declaradas por el usuario. Un usuario puede tener múltiples metas activas simultáneamente.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | UUID FK → app_user | |
| `goal_type` | VARCHAR(40) | `reduce_debt`, `save_amount`, `improve_savings_capacity`, `avoid_late_payments`, `meet_budget`, `other` |
| `target_value` | NUMERIC(19,4) NULL | Valor objetivo (ej: monto a ahorrar). NULL para metas cualitativas |
| `declared_at` | TIMESTAMPTZ | Cuando el usuario declaró la meta |
| `progress_cache` | JSONB NULL | Cache del progreso calculado por jobs periódicos |
| `is_active` | BOOLEAN | Permite desactivar metas sin borrarlas |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-set por trigger |

**Nota:** `progress_cache` es un snapshot calculado por el backend (no lo escribe el usuario). Evita recalcular el progreso en cada lectura del home.

---

### 4.3 `alert_preferences`

Preferencias de alerta configuradas por el usuario. Controla qué tipos de alerta recibe, por qué canal y con qué intensidad/cadencia.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → app_user | |
| `alert_type` | TEXT | Tipo semántico. Ej: `budget_threshold`, `payment_due`, `weekly_reminder` |
| `channel` | VARCHAR(10) | `in_app`, `push`, `email` |
| `enabled` | BOOLEAN | Default `true` |
| `intensity` | TEXT NULL | Ej: `low`, `medium`, `high`. Define cuán seguido o prominente es la alerta |
| `cadence_days` | INT NULL | Días entre recordatorios del mismo tipo |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-set por trigger |

**Constraint:**
- `UNIQUE (user_id, alert_type, channel)` — una preferencia por combinación usuario + tipo + canal

**Nota:** Los defaults del sistema (alertas activas sin que el usuario configure nada) viven en `app_config`, no en esta tabla. Esta tabla solo almacena las **sobreescrituras** del usuario.

---

### 4.4 `notification_queue`

Cola de notificaciones pendientes de envío. El backend produce entradas aquí; un worker las consume y las despacha por el canal correspondiente.

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → app_user | |
| `channel` | VARCHAR(10) | `in_app`, `push`, `email` |
| `payload` | JSONB | Contenido de la notificación (título, cuerpo, deep link) |
| `scheduled_for` | TIMESTAMPTZ | Momento en que debe despacharse |
| `sent_at` | TIMESTAMPTZ NULL | Nulo hasta que el worker confirma el envío |
| `reference_type` | TEXT NULL | Entidad origen. Ej: `user_payment`, `debt` |
| `reference_id` | UUID NULL | ID de la entidad origen |
| `created_at` | TIMESTAMPTZ | |

**Índices:**
- `idx_nq_pending` — sobre `scheduled_for WHERE sent_at IS NULL` — el worker consulta solo pendientes
- `idx_nq_user_scheduled` — sobre `(user_id, scheduled_for) WHERE sent_at IS NULL` — para ver notificaciones pendientes de un usuario específico

---

## 5. Triggers del módulo

| Trigger | Tabla | Función | Evento |
|---------|-------|---------|--------|
| `trg_user_goals_updated_at` | `user_goals` | `set_updated_at()` | BEFORE UPDATE |
| `trg_alert_preferences_updated_at` | `alert_preferences` | `set_updated_at()` | BEFORE UPDATE |

**Nota:** `user_financial_profile` no tiene trigger de `updated_at` con nombre propio porque su `updated_at` se puede manejar en el UPDATE directamente (es la única columna temporal, no hay `created_at`).

---

## 6. Relaciones con otros módulos

| Módulo destino | Tabla que referencia | Uso |
|----------------|---------------------|-----|
| Módulo 1 — Auth | `user_financial_profile`, `user_goals`, `alert_preferences`, `notification_queue` | `user_id → app_user` |
| Módulo 1 — Catálogos ISO | `user_financial_profile` | `currency_id → currency` |
| Módulo 3 — Home | `user_goals` | Muestra avance de metas en dashboard |
| Módulo 4 — Motor de Deudas | `user_financial_profile` | `estimated_payment_capacity` alimenta la Bola de Nieve |
| Módulo 7 — Pagos | `notification_queue` | Encola recordatorios de vencimiento |
| Módulo 5 — Presupuestos | `alert_preferences` | Lee preferencias para disparar alertas de umbral |
