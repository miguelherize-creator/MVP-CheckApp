# Walvy DB — Documentación General del Esquema

**PostgreSQL 15+**

---

## Resumen ejecutivo

Esquema de base de datos de Walvy: 19 capas funcionales que cubren identidad, cashflow, deudas, presupuesto, pagos, gamificación, IA y monetización.

**Archivo principal:** `schema.sql`  
**Ejecución:** `psql -d walvy -f schema.sql`

---

## Principios de diseño

| Principio | Decisión |
|-----------|----------|
| Status centralizado | `status_domain` + `status` en lugar de ENUMs PostgreSQL. Agregar un nuevo estado = `INSERT`, sin deploy. |
| Multi-país / multi-moneda | Catálogos ISO-3166 (`country`) e ISO-4217 (`currency`) desde el inicio. |
| RBAC granular | `role` + `permission` + `role_permission`. El campo `role_id` vive en `app_user`. |
| Deduplicación de movimientos | `source_fingerprint UNIQUE` en `financial_movement`. Evita dobles importaciones. |
| Historial de clasificación | `movement_classification_history` para auditoría completa de recategorizaciones. |
| Precios versionados | `plan_price` con `valid_from`/`valid_to` (patrón bitemporal). El precio cobrado queda congelado en `subscription.billed_amount`. |
| B2B corporativo | `company` + `company_benefit_contract` + `company_eligible_employee` + `benefit_invitation`. |
| Read models CQRS | 4 tablas de summary calculadas por jobs batch. Las pantallas de Home leen de estas tablas, no de las operacionales. |
| Soft deletes | `deleted_at TIMESTAMPTZ NULL` en `app_user`, `financial_movement` y `debt`. |
| Idempotencia de webhooks | `payment_order.commerce_order UNIQUE`. |
| Gamificación completa | Layer 14 — diferenciador de producto Walvy. |
| Asistente IA | Layer 16 — diferenciador de producto Walvy. |
| Validación de dominio en DB | Trigger `enforce_status_domain()` en todas las tablas con `*_status_id`. |

---

## Estructura general — 19 Layers

```
Layer 0  — Catálogos base ISO (country, currency, document_type)
Layer 1  — Status centralizado (status_domain, status)
Layer 2  — RBAC (role, permission, role_permission)
Layer 3  — Configuración global (financial_health_level, app_config)
Layer 4  — Identidad y autenticación (app_user, tokens, onboarding)
Layer 5  — B2B corporativo (company, contracts, invitaciones)
Layer 6  — Perfil y alertas de usuario (financial_profile, goals, notificaciones)
Layer 7  — Catálogos financieros (instituciones, instrumentos, categorías, nodos cashflow)
Layer 8  — Pipeline de ingesta (file_upload, import_line_items, sugerencias de clasificación)
Layer 9  — Movimientos financieros (financial_movement, review_queue, historial)
Layer 10 — Presupuesto (budget_plan, budget_plan_item)
Layer 11 — Motor de deudas (debt, schedules, payments, attachments, simulaciones)
Layer 12 — Agenda de pagos (user_payment, sugerencias recurrentes)
Layer 13 — Monetización (plan, plan_price, payment_method, subscription, payment_order)
Layer 14 — Gamificación (rules, events, stats, historial)
Layer 15 — Mensajería y recomendaciones (message_rule, message_event, interacciones)
Layer 16 — Asistente IA (conversations, messages, tool invocations, snapshots, FAQ)
Layer 17 — Administración y auditoría (admin_users, audit_log, report_snapshots)
Layer 18 — Read models CQRS (4 tablas de summary para pantallas de Home)
Layer 19 — Vistas de negocio (4 views SQL reutilizables)
```

---

## Descripción detallada por Layer

---

### Layer 0 — Catálogos Base ISO

**Propósito:** Fundamento inmutable del esquema. Permite operar en cualquier país o moneda sin cambios de código.

| Tabla | Descripción |
|-------|-------------|
| `country` | ISO-3166-1 alpha-2. Ej: `CL`, `CO`, `AR`. Semilla con 5 países LATAM. |
| `currency` | ISO-4217. Ej: `CLP`, `USD`, `COP`. Incluye `minor_units` para formateo. |
| `country_currency` | Relación N:M con flag `is_primary`. Un país puede tener múltiples monedas (ej. Panamá → USD + PAB). |
| `document_type` | Tipos de documento normalizados por país (`RUT`, `DNI`, `PASSPORT`). El campo `subject_scope` distingue persona/empresa/ambos. |

**Seeds incluidos:** Chile, Colombia, Argentina, Perú, México + sus monedas nacionales y USD.

---

### Layer 1 — Status Centralizado

**Propósito:** Reemplaza los 13 ENUMs rígidos del esquema original de Walvy. Agregar un nuevo estado no requiere `ALTER TYPE` ni deploy.

| Tabla | Descripción |
|-------|-------------|
| `status_domain` | Dominios de estado. Ej: `user`, `movement`, `debt`, `subscription`, `file_upload`. |
| `status` | Estados individuales con `code`, `name_es`, `is_active`, `sort_order`. Ej: `active`, `inactive`, `trialing`. |

**Dominios semillados:**
- `user` → active, inactive, suspended, pending_verification
- `movement` → confirmed, pending, duplicated, rejected, deleted
- `debt` → active, paused, closed, refinanced, disputed
- `subscription` → active, trialing, past_due, cancelled, expired, gifted, pending
- `user_payment` → pending, paid, overdue, cancelled, waived
- `review_queue` → pending, in_review, resolved, dismissed
- `message_event` → pending, shown, dismissed, snoozed, completed
- `file_upload` → uploaded, processing, processed, failed, rejected
- `payment_method` → active, expired, revoked

**Validación en DB:** Cada tabla con `*_status_id` tiene un trigger `BEFORE INSERT OR UPDATE` que llama a `enforce_status_domain(expected_domain, status_id)`. Si el status no pertenece al dominio correcto, lanza `SQLSTATE 23514`.

---

### Layer 2 — RBAC (Roles y Permisos)

**Propósito:** Control de acceso granular para usuarios finales y backoffice. Reemplaza el ENUM `user_role` del esquema original.

| Tabla | Descripción |
|-------|-------------|
| `role` | Roles disponibles. Semilla: `admin`, `support`, `user`. |
| `permission` | Permisos por recurso/método. Ej: `movements.read`, `/api/movements* GET`. |
| `role_permission` | Tabla pivot (muchos a muchos) que asigna permisos a roles. |

El campo `role_id` vive en `app_user`. El backend puede resolver permisos haciendo JOIN `app_user → role → role_permission → permission`.

---

### Layer 3 — Configuración y Estado de Salud

| Tabla | Descripción |
|-------|-------------|
| `financial_health_level` | Niveles del avatar Walvy. Ej: `overwhelmed`, `transitioning`, `in_control`. Incluye `asset_path` para la imagen del avatar. |
| `app_config` | Configuración operacional clave-valor. El campo `value_type` (integer/decimal/boolean/json/text) permite tipar el contenido de `value` (JSONB). Modificable desde backoffice sin deploy. |

**Ejemplos de `app_config`:** `trial_days_default` (14), `max_import_rows_per_upload` (5000), `ant_expense_max_amount_clp` (3000), `feature_ai_enabled` (true).

---

### Layer 4 — Identidad y Autenticación

**Propósito:** Tabla unificada `app_user` que combina la autenticación local de Walvy con las capacidades multi-país y multi-rol de Edificate.

| Tabla | Descripción |
|-------|-------------|
| `app_user` | Usuario principal. Combina: email/password local, OAuth provider, `identifier_type` (email/rut/username), país, moneda por defecto, rol RBAC, estado (dominio `user`), trial, nivel de salud financiera, soft delete. |
| `refresh_tokens` | JWT refresh tokens almacenados como hash. Rotación en cada uso. |
| `password_reset_tokens` | Tokens de un solo uso para reset de contraseña. |
| `email_verification_tokens` | Tokens de un solo uso para verificar el email. |
| `biometric_preferences` | Preferencias de autenticación biométrica (1:1 con `app_user`). |
| `user_onboarding_state` | Estado del flujo de onboarding. Combina el `resume_surface`/`resume_context` de Edificate (para retomar el onboarding desde cualquier pantalla) + los checkpoints de Walvy (`financial_profile_completed`, `goals_set`, `import_attempted`, `biometric_prompted`). |

**Nota sobre `identifier_type`:** Permite que en Chile el identificador sea el RUT, en otros países sea email o username, sin ENUMs separados por país.

---

### Layer 5 — B2B Corporativo

**Propósito:** Canal de distribución empresarial. Una empresa contrata Walvy para sus empleados; los empleados reciben una invitación y activan su cuenta con plan pre-pagado.

| Tabla | Descripción |
|-------|-------------|
| `company` | Empresa contratante. `UNIQUE (country_id, document_number)`. |
| `company_benefit_contract` | Contrato empresa-Walvy con código de plan y fechas de vigencia. |
| `company_eligible_employee` | Lista blanca de empleados elegibles por contrato (email o documento). El campo `activated_user_id` se llena cuando el empleado activa su cuenta. |
| `benefit_invitation` | Invitación individual con ciclo de vida: `created → sent → accepted / expired / revoked`. Solo una invitación activa por empleado (índice parcial `WHERE invitation_status IN ('created','sent')`). |

---

### Layer 6 — Perfil y Alertas de Usuario

| Tabla | Descripción |
|-------|-------------|
| `user_financial_profile` | Perfil declarado (1:1). Ingreso mensual estimado, capacidad de pago, gastos estables. |
| `user_goals` | Metas financieras del usuario (reduce_debt, save_amount, avoid_late_payments, etc.). El campo `progress_cache` guarda métricas calculadas sin queries pesados. |
| `alert_preferences` | Qué alertas quiere recibir el usuario, por canal (in_app, push, email). |
| `notification_queue` | Cola de notificaciones pendientes. Índice parcial `WHERE sent_at IS NULL` para el worker de envío. El campo `reference_type`/`reference_id` permite trazar a qué objeto refiere la notificación. |

---

### Layer 7 — Catálogos Financieros

**Propósito:** Modelos de dominio para clasificar y enrutar los movimientos financieros.

| Tabla | Descripción |
|-------|-------------|
| `financial_institution` | Catálogo de bancos, billeteras, retail, brokers. Con flags `has_api` / `api_base_url` para futuras integraciones Open Banking. |
| `user_financial_instrument` | Cuentas, tarjetas, créditos del usuario. Asociados a una institución. |
| `cashflow_node` | Abstracción semántica del origen/destino del dinero. Tipos: `origin`, `destination`, `instrument`, `third_party`, `pocket`. Permite representar "dinero que entra del sueldo" vs "dinero que sale a Banco Estado". |
| `category` | Jerarquía recursiva de categorías (reemplaza `categories` + `subcategories`). `parent_category_id` FK auto-referencial. `governance_scope` distingue categorías del sistema (`system`), personalizadas por usuario (`user`), sugeridas por la app (`suggested`), aprobadas por admin (`approved`). |
| `ant_expense_rules` | Reglas configuradas por el usuario para marcar gastos hormiga (ej: "todo lo menor a $3.000 en categoría cafetería"). |

---

### Layer 8 — Pipeline de Ingesta

**Propósito:** Gestión completa del ciclo de vida de un archivo importado (cartola bancaria, CSV) hasta que los movimientos quedan clasificados.

| Tabla | Descripción |
|-------|-------------|
| `file_upload` | Registro de cada archivo cargado. Estado gestionado por dominio `file_upload`. Incluye `records_total`, `records_success`, `records_failed` con constraint que verifica `total = success + failed`. |
| `import_line_items` | Ítems individuales del archivo. Permiten que el usuario revise y acepte/rechace/edite cada fila antes de que se genere el movimiento. |
| `movement_classification_suggestions` | Sugerencias automáticas de la app para clasificar un ítem: ¿es un pago de deuda? ¿una factura recurrente? ¿una transacción normal? El usuario siempre tiene la decisión final. |

---

### Layer 9 — Movimientos Financieros

**Propósito:** Fuente de verdad transaccional. Toda entrada o salida de dinero del usuario.

| Tabla | Descripción |
|-------|-------------|
| `financial_movement` | Movimiento individual. Combina lo mejor de ambos esquemas: `source_fingerprint` (deduplicación), `amount_in`/`amount_out` + `movement_direction` (dirección explícita con constraint que valida consistencia), `is_ant_expense`, `bank_description`, `deleted_at`, FKs a `cashflow_node`, `financial_institution`, `user_financial_instrument`. El estado se gestiona por dominio `movement`. |
| `movement_review_queue` | Cola priorizada de movimientos que requieren atención del usuario (sin categoría, posible duplicado, conflicto de instrumento). Prioridad 1–5. |
| `movement_classification_history` | Log inmutable de cada cambio de categoría. Registra old/new category, quién cambió, cuándo. Fundamental para auditoría y para entrenar el motor de sugerencias. |

**Deduplicación:** `UNIQUE INDEX (user_id, source_fingerprint) WHERE source_fingerprint IS NOT NULL AND deleted_at IS NULL`. Si se importa el mismo archivo dos veces, los movimientos duplicados son rechazados a nivel de DB.

---

### Layer 10 — Presupuesto

| Tabla | Descripción |
|-------|-------------|
| `budget_plan` | Presupuesto mensual del usuario. `period_month DATE` (primer día del mes) es más limpio que columnas `year` + `month` INTEGER separadas. |
| `budget_plan_item` | Ítem por categoría dentro del presupuesto. `amount_limit` + rangos opcionales `planned_min`/`planned_max`. El flag `suggested_by_app` permite distinguir ítems que el usuario creó de los que la app sugirió basado en su historial. |

---

### Layer 11 — Motor de Deudas (Bola de Nieve)

**Propósito:** Gestión completa del ciclo de vida de deudas con soporte para la estrategia de pago "bola de nieve" (avalanche/snowball).

| Tabla | Descripción |
|-------|-------------|
| `debt` | Deuda individual. Combina: `debt_type` (consumer/mortgage/credit_card/line), `debt_source_type` (bank/retail/person), campos operacionales de Walvy (`apr_annual`, `minimum_payment`, `installments_total/remaining`, `due_day`, `snowball_priority`), campos de Edificate (`released_cashflow_amount` — cuánto flujo libre queda al cerrar esta deuda), `current_balance`, estado por dominio `debt`, soft delete. |
| `debt_schedules` | Cronograma de cuotas proyectadas (fecha + capital + interés por cuota). |
| `debt_payments` | Log inmutable de abonos realizados. Cada pago puede linkearse a un `financial_movement` para conciliación. |
| `debt_attachments` | Archivos adjuntos a la deuda (contratos, cartolas de saldo). El campo `parsed_summary` guarda el resultado de parsing automático del documento. |
| `debt_payoff_simulation` | Simulación de estrategia de pago. El usuario puede probar diferentes montos de abono extra o pago inicial. |
| `debt_payoff_schedule` | Detalle por deuda de la simulación: orden de pago, meses estimados para cerrar, flujo liberado tras cierre. |

**Flujo típico del motor bola de nieve:**
1. Usuario ingresa sus deudas con `snowball_priority` y `minimum_payment`.
2. El backend crea una `debt_payoff_simulation` con el extra mensual disponible.
3. Se calculan `debt_payoff_schedule` por cada deuda en orden de prioridad.
4. Al realizarse un pago, se crea un registro en `debt_payments` y se linkea al `financial_movement` correspondiente.

---

### Layer 12 — Agenda de Pagos

| Tabla | Descripción |
|-------|-------------|
| `user_payment` | Pago programado (vencimiento de cuenta de luz, cuota de deuda, arriendo). Tiene `traffic_light_state` (verde/amarillo/rojo según cercanía al vencimiento), recurrencia (`is_recurring` + `recurrence_interval_days`), conciliación con `movement_id` al pagarse. El estado se gestiona por dominio `user_payment`. El campo `source` distingue pagos creados por el usuario (`user`) de los generados automáticamente por el sistema para deudas (`system`). |
| `recurring_payment_suggestions` | Pagos recurrentes detectados automáticamente por la app a partir de patrones de movimientos. El usuario decide si los agrega a su agenda. |

---

### Layer 13 — Monetización

**Propósito:** Gestión completa del ciclo de vida de suscripciones con soporte para B2B, gift subscriptions y múltiples proveedores de pago.

| Tabla | Descripción |
|-------|-------------|
| `plan` | Planes disponibles (`free`, `monthly`, `annual`). |
| `plan_price` | Precio versionado por país y moneda. El patrón bitemporal (`valid_from`/`valid_to`) permite cambiar precios sin afectar suscripciones activas. El índice `UNIQUE WHERE is_active AND valid_to IS NULL` garantiza un único precio vigente por combinación plan+país+moneda. |
| `payment_method` | Métodos de pago guardados (tokenizados). Sin datos PCI. Soporta usuario o empresa como propietario. Estado por dominio `payment_method`. |
| `subscription` | Suscripción del usuario. Campos clave: `origin` (B2B/B2C), `billed_amount` (snapshot inmutable del precio cobrado), `is_gift` + `gift_token UNIQUE` (regalo de suscripción). Estado por dominio `subscription` (incluye `trialing` que faltaba en el esquema Edificate). |
| `payment_order` | Orden de pago para webhooks de proveedores (Flow.cl, Stripe, etc.). `commerce_order UNIQUE` garantiza idempotencia: si el webhook llega dos veces, el segundo `INSERT` falla silenciosamente. |

---

### Layer 14 — Gamificación

**Propósito:** Sistema de puntos y niveles que incentiva hábitos financieros saludables. Diferenciador de producto Walvy. Se mantiene íntegro del esquema original.

| Tabla | Descripción |
|-------|-------------|
| `gamification_rules` | Catálogo de eventos que otorgan puntos. Ej: `debt_payment_registered` (50 pts), `budget_respected` (100 pts), `all_movements_categorized` (30 pts). Modificable desde backoffice. |
| `gamification_events` | Log inmutable de cada evento de gamificación disparado para un usuario. Incluye referencia al objeto que originó el evento (`reference_type`, `reference_id`). |
| `user_gamification_stats` | Caché de puntos totales y nivel actual del usuario (1:1). Se actualiza incrementalmente en lugar de recalcularse desde cero. |
| `user_score_history` | Historial de puntos por período para gráficos de progreso. |

---

### Layer 15 — Mensajería y Recomendaciones

**Propósito:** Sistema de mensajes contextuales que guían al usuario según su situación financiera. Más estructurado que el `recommendation_events` del esquema original.

| Tabla | Descripción |
|-------|-------------|
| `message_rule` | Reglas de mensajería con código semántico (`leaks_detected`, `pay_next`, `debt_idle`), contexto de pantalla (`home`, `budget`, `debt`, `payments`), `deep_link` para acción directa y prioridad 1–5. |
| `message_event` | Instancia de un mensaje generado para un usuario específico. Contiene `payload` JSONB con evidencia (sin datos sensibles), `context_period_month` para mensajes mensuales, `suppressed_until` para control de frecuencia. Estado por dominio `message_event`. |
| `user_message_interaction` | Log de cómo el usuario interactuó con el mensaje: `opened`, `dismissed`, `snoozed`, `completed`. Permite afinar el motor de mensajería. |

---

### Layer 16 — Asistente IA

**Propósito:** Asistente conversacional financiero personalizado. Diferenciador de producto Walvy. Se mantiene íntegro del esquema original.

| Tabla | Descripción |
|-------|-------------|
| `ai_conversations` | Conversación (sesión) entre el usuario y el asistente. |
| `ai_messages` | Mensajes individuales de la conversación. Roles: `user`, `assistant`, `system`. Incluye `token_usage` para seguimiento de costos. |
| `ai_tool_invocations` | Registro de cada tool call del asistente (ej: `get_monthly_summary`, `list_upcoming_payments`). Permite debugging y auditoría. |
| `ai_context_snapshots` | Snapshot del estado financiero del usuario al inicio de cada conversación. Permite al asistente tener contexto sin consultar todas las tablas operacionales en tiempo real. |
| `faq_articles` | Base de conocimiento con soporte full-text search en español (`to_tsvector('spanish', ...)`). El asistente puede buscar respuestas estructuradas antes de generar respuestas libres. |

---

### Layer 17 — Administración y Auditoría

**Propósito:** Backoffice interno para el equipo de Walvy.

| Tabla | Descripción |
|-------|-------------|
| `admin_users` | Usuarios del backoffice con roles `super_admin` u `operator`. Separados de `app_user` por seguridad. |
| `admin_audit_log` | Log de acciones administrativas con `before_data` y `after_data` JSONB. Trazabilidad completa. |
| `audit_log` | Log de acciones de usuarios finales (creación, edición, eliminación de movimientos, deudas, etc.). |
| `report_snapshots` | Reportes pre-computados para dashboards del backoffice (MRR, churn, usuarios activos, etc.). |

Las tablas `app_config` y `gamification_rules` tienen FK diferida a `admin_users(id)` para registrar quién realizó el último cambio.

---

### Layer 18 — Read Models CQRS

**Propósito:** Tablas calculadas por jobs batch (no por queries en tiempo real). Las pantallas de Home, Deudas y Pagos leen de estas tablas para respuesta instantánea. **Nunca se alimentan desde la BD operacional durante la request del usuario.**

Cada tabla incluye `source_watermark_at` (hasta qué punto en el tiempo fue calculada) y `rule_version` (qué versión del algoritmo la calculó), lo que permite invalidar y recalcular selectivamente.

| Tabla | Alimenta |
|-------|---------|
| `user_month_diagnosis_summary` | Home: semáforo del mes, capacidad de ahorro, calidad del dato, próxima acción recomendada. |
| `user_month_debt_priority_summary` | Pantalla de Deudas: ranking bola de nieve con monto mínimo, fecha estimada de cierre y flujo libre proyectado. |
| `user_upcoming_payments_summary` | Home / Pagos: próximos vencimientos en una ventana temporal configurable. |
| `user_month_leaks_summary` | Home: total de gastos "fuga" del mes, gastos hormiga (`ant_expense_total`), top categorías problemáticas. |

---

### Layer 19 — Vistas de Negocio

Vistas SQL reutilizables para el backend, evitando repetir JOINs complejos en cada query.

| Vista | Descripción |
|-------|-------------|
| `v_user_access` | Modo de acceso del usuario: `subscription` / `trial` / `none`. Detecta trial activo o suscripción activa en tiempo real. |
| `v_user_current_subscription` | Última suscripción de cada usuario. Útil para soporte y pantalla de perfil. |
| `v_subscription_effective_state` | Suscripciones con estado efectivo detectado: marca como `expired_by_time` las que tienen `ends_at` en el pasado aunque su `status_code` no haya sido actualizado aún (tolerancia a lag del job de expiración). |
| `v_user_home_month` | Vista compuesta para la pantalla Home: cruza el summary del mes, el acceso del usuario y el nivel de salud financiera actual. |

---

## Funciones Globales

### `set_updated_at()`
Trigger function que establece `NEW.updated_at = now()` antes de cada `UPDATE`. Aplicada a todas las tablas con columna `updated_at`.

### `enforce_status_domain(expected_domain_code, p_status_id)`
Valida que un `status_id` pertenezca al dominio correcto. Si no, lanza `RAISE EXCEPTION` con `SQLSTATE 23514`. Llamada desde triggers en todas las tablas con `*_status_id`.

**Ejemplo:** Si se intenta insertar en `debt` con un `status_id` del dominio `subscription`, la DB rechaza la operación antes de que llegue al backend.

---

## Seeds Incluidos

El esquema incluye seeds idempotentes (`ON CONFLICT DO NOTHING`) al final del archivo:

| Seed | Contenido |
|------|-----------|
| Países | Chile (CL), Colombia (CO), Argentina (AR), Perú (PE), México (MX) |
| Monedas | CLP, COP, ARS, PEN, MXN, USD |
| Relaciones país-moneda | Con `is_primary = true` para la moneda local de cada país |
| Tipos de documento | RUT (CL), DNI (CO/AR/PE/MX), PASSPORT (global), RUT Empresa (CL), NIT (CO), CUIT (AR) |
| Dominios de status | 9 dominios con sus estados |
| Roles | admin, support, user |
| Permisos | 12 permisos base (movements.read/write, debts.read/write, etc.) |
| Asignación permisos | admin → todos, support → read, user → read/write propio |
| Niveles de salud | overwhelmed, transitioning, in_control |
| Planes | free, monthly, annual |
| Precios (CLP) | $0 free, $4.990/mes, $44.990/año |
| Reglas de gamificación | 8 eventos (registro, categorización, pago de deuda, etc.) |
| Reglas de mensajería | 7 reglas (leaks_detected, pay_next, debt_idle, etc.) |
| app_config | 9 entradas operacionales (trial_days, max_import_rows, feature flags, etc.) |

---

## Diferencias clave vs Walvy DB v1

| Aspecto | v1 (schema.sql original) | v2 (este esquema) |
|---------|--------------------------|-------------------|
| Status | 13 ENUMs PostgreSQL rígidos | `status_domain` + `status` flexible |
| Usuario | `users` con ENUM `identifier_type` | `app_user` con CHECK + multi-país + RBAC |
| Categorías | `categories` + `subcategories` (2 tablas) | `category` recursiva (1 tabla, N niveles) |
| Transacciones | `transactions` | `financial_movement` + deduplicación + historial |
| Facturación | `bills_payable` | `user_payment` + conciliación con movimiento |
| Planes | `subscription_plans` (precio fijo) | `plan` + `plan_price` bitemporal |
| Importación | `statement_imports` | `file_upload` (más rico) |
| IDs | `uuid_generate_v4()` (uuid-ossp) | `gen_random_uuid()` (pgcrypto) |
| B2B | No existe | Layer 5 completo |
| Multi-país | Solo CLP implícito | Layer 0 ISO completo |
| CQRS | No existe | 4 tablas Read Model |
| Vistas | No existen | 4 vistas de negocio |
| Deduplicación | No existe | `source_fingerprint UNIQUE` |

---

## Notas Operacionales

### Migraciones
Este esquema es la versión de referencia. Para entornos productivos, cada cambio posterior debe implementarse como una migración incremental (TypeORM migrations o Flyway), **no** re-ejecutando este archivo completo.

### Row Level Security (RLS)
El esquema no implementa RLS todavía. Se recomienda habilitar para `financial_movement`, `debt` y `user_payment` en entornos multi-tenant:
```sql
ALTER TABLE financial_movement ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON financial_movement
  USING (user_id = current_setting('app.current_user_id')::uuid);
```

### TypeORM
Para usar con TypeORM en modo development, mantener `synchronize: false` y usar este SQL como base. El backend NestJS debe leer `DATABASE_URL` desde `.env`. Para producción, generar migraciones TypeORM a partir de las entidades.

### Índices parciales
El esquema usa extensivamente índices parciales (`WHERE deleted_at IS NULL`, `WHERE sent_at IS NULL`, etc.) para mantener el tamaño de los índices acotado en tablas con muchas filas soft-deleted.

---

## Conteo de objetos

| Tipo | Cantidad |
|------|---------|
| Tablas | ~55 |
| Vistas | 4 |
| Funciones | 2 globales + N trigger functions |
| Triggers | ~45 |
| Índices (adicionales a PK/UNIQUE) | ~35 |
| Layers | 19 (0 a 18) + vistas (19) |
