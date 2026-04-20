# Casos de Uso — Módulo 2: Perfil y Configuración

**Tablas involucradas:** `user_financial_profile`, `user_goals`, `alert_preferences`, `onboarding_state`, `users`

---

## Actores

| Actor | Descripción |
|-------|-------------|
| **Usuario** | Configura su perfil financiero y preferencias |
| **Sistema** | Lee el perfil para calcular capacidad de pago, sugerencias de presupuesto |

---

## UC-01: Configurar perfil financiero

**Actor:** Usuario
**Precondición:** Usuario autenticado. Puede ser el primer acceso (onboarding) o una actualización posterior.

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Llena formulario de perfil financiero\n(ingreso mensual, gastos fijos, fecha de corte)
    FE->>FE: Valida campos (ingreso > 0, gastos_fijos < ingreso)
    FE->>BE: POST /profile/financial { monthly_income, stable_expenses, pay_day }
    BE->>DB: SELECT * FROM user_financial_profile WHERE user_id = $1
    alt Perfil no existe (primera vez)
        BE->>DB: INSERT INTO user_financial_profile\n(user_id, monthly_income, stable_expenses,\nestimated_payment_capacity, pay_day)
        Note over BE,DB: estimated_payment_capacity =\nmonthly_income - stable_expenses
    else Perfil ya existe
        BE->>DB: UPDATE user_financial_profile SET\nmonthly_income=$1, stable_expenses=$2,\nestimated_payment_capacity=$3\nWHERE user_id=$4
    end
    DB-->>BE: profile actualizado
    BE->>DB: UPDATE onboarding_state\nSET financial_profile_completed=true\nWHERE user_id=$1
    BE-->>FE: 200 { profile, estimated_payment_capacity }
    FE->>U: Muestra capacidad de pago calculada\n"Puedes destinar $X/mes a deudas"
```

### Campo clave: `estimated_payment_capacity`

Este valor es consumido por múltiples módulos:

```mermaid
flowchart LR
    FP[user_financial_profile\nestimated_payment_capacity] --> M4[M4: debt_snowball_plan\nextra_monthly_payment sugerido]
    FP --> M6[M6: budget_lines\nplanificación de montos]
    FP --> M3[M3: financial_health_snapshots\ncapacidad de ahorro visible]
```

---

## UC-02: Definir metas globales

**Actor:** Usuario
**Precondición:** Usuario tiene perfil financiero configurado

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Selecciona tipo de meta y completa datos
    Note over U,FE: Tipos: reduce_debt, save_amount,\nimprove_savings_capacity, avoid_late_payments,\nmeet_budget, other
    FE->>BE: POST /goals { goal_type, description, target_amount?, target_date? }
    BE->>DB: INSERT INTO user_goals\n(user_id, goal_type, description,\ntarget_amount, target_date, is_active=true)
    DB-->>BE: goal { id, goal_type }
    BE->>DB: UPDATE onboarding_state SET goals_set=true WHERE user_id=$1
    BE-->>FE: 201 { goal }
    FE->>U: Muestra meta creada con progreso inicial 0%

    Note over U,FE: El usuario puede tener múltiples metas activas

    U->>FE: Solicita ver progreso de metas
    FE->>BE: GET /goals
    BE->>DB: SELECT g.*,\n  -- Para reduce_debt:\n  (SELECT SUM(current_balance) FROM debts WHERE user_id=$1) as current_debt,\n  -- Para save_amount:\n  (SELECT SUM(amount) FROM transactions WHERE type='income'...) as current_saved\nFROM user_goals g WHERE user_id=$1 AND is_active=true
    DB-->>BE: goals con progreso calculado
    BE-->>FE: 200 { goals: [{...progress_pct}] }
    FE->>U: Lista de metas con barras de progreso
```

### Regla de progreso por tipo de meta

| `goal_type` | Fórmula de progreso | Fuente de datos |
|-------------|---------------------|----------------|
| `reduce_debt` | `(initial_debt - current_debt) / initial_debt` | `debts.current_balance` |
| `save_amount` | `current_saved / target_amount` | `transactions` (ingresos) |
| `improve_savings_capacity` | `current_capacity / target_capacity` | `user_financial_profile` |
| `avoid_late_payments` | `meses_sin_vencimiento / target_months` | `bills_payable` |
| `meet_budget` | `meses_dentro_presupuesto / target_months` | `budget_lines` + `transactions` |

---

## UC-03: Configurar preferencias de alertas

**Actor:** Usuario
**Precondición:** Usuario autenticado, perfil básico completo

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    Note over BE,DB: Al crear el usuario, se insertan alertas por defecto
    BE->>DB: INSERT INTO alert_preferences (user_id, alert_type, channel, is_active, cadence_days)\nVALUES\n  ($1, 'budget_threshold', 'in_app', true, null),\n  ($1, 'payment_due', 'push', true, null),\n  ($1, 'payment_due', 'email', true, null),\n  ($1, 'import_reminder', 'push', true, 7),\n  ($1, 'traffic_light', 'in_app', true, null),\n  ($1, 'weekly_summary', 'email', true, 7)

    U->>FE: Abre sección de alertas en perfil
    FE->>BE: GET /profile/alerts
    BE->>DB: SELECT * FROM alert_preferences WHERE user_id=$1
    DB-->>BE: lista de preferencias
    BE-->>FE: 200 { alerts: [...] }
    FE->>U: Muestra switches por tipo y canal

    U->>FE: Desactiva "Resumen semanal por email"
    FE->>BE: PATCH /profile/alerts { alert_type: 'weekly_summary', channel: 'email', is_active: false }
    BE->>DB: UPDATE alert_preferences\nSET is_active=false\nWHERE user_id=$1 AND alert_type='weekly_summary' AND channel='email'
    DB-->>BE: OK
    BE-->>FE: 200 { updated: true }

    U->>FE: Cambia cadencia de "Recordatorio de importación" a 14 días
    FE->>BE: PATCH /profile/alerts { alert_type: 'import_reminder', cadence_days: 14 }
    BE->>DB: UPDATE alert_preferences SET cadence_days=14\nWHERE user_id=$1 AND alert_type='import_reminder'
    DB-->>BE: OK
```

### Matriz de alertas por defecto

| `alert_type` | `channel` | `is_active` | `cadence_days` | Cuándo se dispara |
|-------------|----------|-------------|---------------|-------------------|
| `budget_threshold` | `in_app` | `true` | `null` | Cuando categoría supera 80% del presupuesto |
| `payment_due` | `push` | `true` | `null` | 7, 3 y 1 día antes del vencimiento |
| `payment_due` | `email` | `true` | `null` | 7, 3 y 1 día antes del vencimiento |
| `import_reminder` | `push` | `true` | `7` | Cada 7 días si no ha importado cartola |
| `traffic_light` | `in_app` | `true` | `null` | Cuando el semáforo cambia de estado |
| `weekly_summary` | `email` | `true` | `7` | Cada domingo |

---

## UC-04: Actualizar email o contraseña

**Actor:** Usuario
**Precondición:** Usuario autenticado

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Ingresa contraseña actual + nueva contraseña
    FE->>BE: PATCH /users/password { currentPassword, newPassword }
    BE->>DB: SELECT password_hash FROM users WHERE id=$1
    BE->>BE: bcrypt.compare(currentPassword, hash)
    alt Contraseña actual incorrecta
        BE-->>FE: 400 "Contraseña actual incorrecta"
    else Correcta
        BE->>BE: bcrypt.hash(newPassword)
        BE->>DB: UPDATE users SET password_hash=$1 WHERE id=$2
        BE->>DB: UPDATE refresh_tokens SET revoked_at=NOW()\nWHERE user_id=$1 AND revoked_at IS NULL
        BE-->>FE: 200 "Contraseña actualizada. Inicia sesión nuevamente."
        FE->>FE: logout() → /login
    end

    Note over U,FE: Cambio de email
    U->>FE: Ingresa nuevo email
    FE->>BE: PATCH /users/email { newEmail, currentPassword }
    BE->>DB: SELECT COUNT(*) FROM users WHERE email=$1
    alt Email ya en uso
        BE-->>FE: 409 "Email ya registrado"
    else Email disponible
        BE->>DB: UPDATE users SET email=$1, email_verified_at=NULL WHERE id=$2
        Note over BE,DB: Se resetea la verificación
        BE-->>FE: 200 "Email actualizado. Verifica tu nuevo correo."
    end
```

---

## UC-05: Estimar capacidad de pago mensual

Este cálculo es central para M4 (Bola de Nieve). El backend lo ejecuta cada vez que cambia el perfil financiero.

```mermaid
flowchart TD
    INPUT[user_financial_profile\nmonthly_income\nstable_expenses] --> CALC

    CALC{Cálculo\nestimated_payment_capacity}
    CALC --> |monthly_income - stable_expenses| RESULT[estimated_payment_capacity]

    RESULT --> |Alimenta| M4A[debt_snowball_plan\nextra_monthly_payment sugerido]
    RESULT --> |Alimenta| M6A[Budget suggestion\nen primera generación]
    RESULT --> |Muestra en UI| HOME[Home: 'Puedes destinar $X a deudas este mes']

```

### Reglas de negocio aplicadas

- Si `estimated_payment_capacity <= 0`: alerta de advertencia al usuario ("Tus gastos fijos superan tu ingreso")
- El valor se recalcula automáticamente cada vez que se modifica `monthly_income` o `stable_expenses`
- El `pay_day` determina el día de corte del período del presupuesto en M6

---

## Diagrama de relación entre tablas — M2

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email
        varchar name
    }
    user_financial_profile {
        uuid id PK
        uuid user_id FK
        numeric monthly_income
        numeric stable_expenses
        numeric estimated_payment_capacity
        int pay_day
    }
    user_goals {
        uuid id PK
        uuid user_id FK
        varchar goal_type
        text description
        numeric target_amount
        date target_date
        boolean is_active
    }
    alert_preferences {
        uuid id PK
        uuid user_id FK
        varchar alert_type
        varchar channel
        boolean is_active
        int cadence_days
    }
    onboarding_state {
        uuid id PK
        uuid user_id FK
        boolean financial_profile_completed
        boolean goals_set
    }

    users ||--o| user_financial_profile : "tiene perfil"
    users ||--o{ user_goals : "define metas"
    users ||--o{ alert_preferences : "configura alertas"
    users ||--|| onboarding_state : "progreso"
```
