# DB — Módulo 2: Perfil y Configuración

## Tablas propias (escribe principalmente)

| Tabla | Rol |
|-------|-----|
| `user_financial_profile` | Renta, gastos fijos, capacidad estimada de pago |
| `user_goals` | Metas globales del usuario |
| `alert_preferences` | Preferencias de alertas por tipo y canal |
| `onboarding_state` | Marcar hitos de configuración completados |

## Tablas que lee (sin escribir)

| Tabla | Para qué |
|-------|----------|
| `users` | Editar nombre y correo |
| `budget_lines` | Mostrar qué metas de categoría están activas |
| `financial_health_snapshots` | Semáforo visible desde perfil |

---

## Detalle por tabla

### `user_financial_profile`
Datos de ingresos y capacidad de pago. Se completa durante onboarding y es editable.

| Campo | Qué hace aquí |
|-------|---------------|
| `monthly_income_estimate` | Renta mensual declarada (base para capacidad de pago) |
| `stable_expenses_note` | Texto libre sobre gastos fijos conocidos |
| `estimated_payment_capacity` | `ingreso - gastos_fijos` — se recalcula al guardar |

**Downstream:** `estimated_payment_capacity` alimenta:
- `debt_snowball_plan.extra_monthly_payment` (M4)
- Los indicadores del semáforo en `financial_health_snapshots` (M3)

---

### `user_goals`
Metas globales declaradas (no son las metas de categoría del presupuesto).

| Campo | Qué hace aquí |
|-------|---------------|
| `goal_type` | `reduce_debt`, `save_amount`, `improve_savings_capacity`, `avoid_late_payments`, `meet_budget` |
| `target_value` | Monto objetivo (solo para `reduce_debt` y `save_amount`) |
| `progress_cache` | Snapshot de progreso; se recalcula periódicamente |
| `is_active` | Una meta puede desactivarse sin eliminarse |

**Reglas de negocio:**
- El progreso de `reduce_debt` se calcula desde `debts.current_balance` total.
- El progreso de `meet_budget` desde cumplimiento en `budget_lines` vs `transactions`.
- `progress_cache` es un campo computado — no la fuente de verdad.

---

### `alert_preferences`
Una fila por combinación `(user_id, alert_type, channel)`.

| Campo | Qué hace aquí |
|-------|---------------|
| `alert_type` | `budget_threshold`, `payment_due`, `import_reminder`, `traffic_light`, `weekly_summary` |
| `channel` | `in_app`, `push`, `email` |
| `enabled` | Toggle por combinación |
| `cadence_days` | Frecuencia (7 = semanal). `null` = event-driven |

**Defaults activos al crear cuenta:**

| alert_type | channel | cadence_days |
|------------|---------|--------------|
| `budget_threshold` | `in_app` | null (event) |
| `payment_due` | `push` | null (event) |
| `payment_due` | `email` | null (event) |
| `import_reminder` | `push` | 7 |
| `traffic_light` | `in_app` | null (event) |
| `weekly_summary` | `email` | 7 |

**Regla:** El usuario puede cambiar `enabled`, `channel` o `cadence_days` dentro de opciones acotadas. No puede definir umbrales libres (esos están en `app_config`).

---

## Flujos de datos principales

```
CONFIGURAR PERFIL FINANCIERO
  → UPSERT user_financial_profile
  → recalcular estimated_payment_capacity
  → UPDATE onboarding_state.financial_profile_completed = true

CREAR META GLOBAL
  → INSERT user_goals
  → UPDATE onboarding_state.goals_set = true

AJUSTAR ALERTA
  → UPDATE alert_preferences WHERE user_id AND alert_type AND channel

EDITAR NOMBRE/CORREO
  → UPDATE users.name / users.email
```

---

## Índices críticos

| Tabla | Índice | Motivo |
|-------|--------|--------|
| `alert_preferences` | `(user_id, alert_type, channel)` UNIQUE | Evitar duplicados por tipo/canal |
| `user_goals` | `(user_id, is_active)` | Listar metas activas rápido |
| `user_financial_profile` | `user_id` (PK, 1:1) | Siempre lookup por usuario |

---

## Dependencias cross-módulo

| Módulo destino | Campo que origina | Tabla destino |
|----------------|------------------|---------------|
| M4 — Deudas | `estimated_payment_capacity` | `debt_snowball_plan.extra_monthly_payment` |
| M3 — Home | `estimated_payment_capacity` | `financial_health_snapshots.payload` |
| M3 — Home | `user_goals.progress_cache` | Dashboard de metas |
| M7 — Pagos | `alert_preferences` | Orquesta `notification_queue` |
