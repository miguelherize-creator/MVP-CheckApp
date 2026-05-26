# Módulo 2 — Requerimientos

**Módulo:** Perfil y Configuración  
**Layer:** 6 (Perfil de usuario y alertas)  
**Fuente de verdad MVP:** `MVP_Walvy_VF_10032026_alineado_estrategia - Alcance MVP.csv` — Módulo 2 (Perfil y configuración)

---

## Alcance MVP — resumen rápido

| Funcionalidad | MVP |
|---------------|-----|
| Edición de nombre, alias y foto | ✅ Incluido |
| Cambio de email de notificaciones (distinto al login) | ✅ Incluido |
| Cambio de contraseña desde perfil | ✅ Incluido (ver Módulo 1 RF-04) |
| Configuración de notificaciones y alertas | ✅ Incluido |
| Perfil financiero básico (ingreso, gastos fijos, capacidad estimada) | ✅ Incluido |
| Definición de metas financieras globales | ✅ Incluido |
| Notificaciones push inteligentes con IA predictiva | ❌ No incluido en MVP |
| Envío masivo vía SMS | ❌ No incluido en MVP |

---

## Requerimientos Funcionales

### RF-01 — Editar perfil de usuario

| Campo | Detalle |
|-------|---------|
| **ID** | RF-01 |
| **Nombre** | Actualizar datos básicos del perfil |
| **Descripción** | El usuario puede actualizar su alias, foto de perfil y email de notificaciones desde la pantalla de perfil. |
| **Inputs** | `username`, `avatar_url`, `notification_email` |
| **Reglas** | - `username` debe ser único (`UNIQUE`); si ya existe, retornar error 409. - `avatar_url` se genera externamente tras subir la imagen a S3/storage; el endpoint de perfil solo recibe la URL resultante. - `notification_email` es independiente del email de login (`app_user.email`). Al cambiarlo, se dispara un flujo de verificación (código OTP al nuevo email) reutilizando `email_verification_tokens`. Hasta que el usuario confirme, `notification_email_verified_at` permanece NULL y el sistema sigue enviando notificaciones al email anterior. - El email de login (`app_user.email`) se gestiona por separado (ver Módulo 1 RF-05). |
| **Output** | `app_user` actualizado. `notification_email_verified_at = NULL` si se cambió `notification_email`. |

---

### RF-02 — Configurar perfil financiero básico

| Campo | Detalle |
|-------|---------|
| **ID** | RF-02 |
| **Nombre** | Registrar perfil financiero del usuario |
| **Descripción** | El usuario declara su ingreso mensual estimado y una nota sobre gastos fijos. El sistema calcula la capacidad estimada de pago. |
| **Inputs** | `monthly_income_estimate`, `stable_expenses_note`, `currency_id` |
| **Reglas** | - Se crea o actualiza `user_financial_profile` (upsert por `user_id`). - `estimated_payment_capacity` = `monthly_income_estimate` − estimación de gastos fijos (cálculo del backend; no lo ingresa el usuario directamente). - `currency_id` debe corresponder a la moneda del usuario (default: `app_user.default_currency_id`). - El perfil puede actualizarse en cualquier momento desde Configuración. |
| **Output** | `user_financial_profile` creado/actualizado. |

---

### RF-03 — Definir metas financieras

| Campo | Detalle |
|-------|---------|
| **ID** | RF-03 |
| **Nombre** | Crear meta financiera global |
| **Descripción** | El usuario selecciona una o más metas globales que orientan las recomendaciones de la app. |
| **Inputs** | `goal_type`, `target_value` (opcional según tipo) |
| **Reglas** | - `goal_type` debe ser uno de los valores del CHECK: `reduce_debt`, `save_amount`, `improve_savings_capacity`, `avoid_late_payments`, `meet_budget`, `other`. - `target_value` es requerido para metas cuantitativas (`save_amount`, `reduce_debt`). - Un usuario puede tener varias metas activas simultáneamente (`is_active = true`). - Desactivar una meta: `is_active = false` (no se borra). - `progress_cache` es calculado por un job periódico; el usuario no lo escribe. |
| **Output** | `user_goals` creado con `is_active = true`. |

---

### RF-04 — Configurar alertas y notificaciones

| Campo | Detalle |
|-------|---------|
| **ID** | RF-04 |
| **Nombre** | Ajustar preferencias de alerta |
| **Descripción** | El usuario puede activar, desactivar o ajustar la intensidad/cadencia de cada tipo de alerta y canal. |
| **Canales disponibles** | `in_app` (popup contextual), `push` (notificación móvil), `email` |
| **Tipos de alerta (base)** | `budget_threshold` — umbral de presupuesto por categoría (50 %, 80 %, 100 %+) |
| | `payment_due` — vencimiento próximo de pago |
| | `weekly_reminder` — recordatorio semanal de importar movimientos |
| | `semaphore_alert` — señal de semáforo financiero (rojo/amarillo) |
| **Reglas** | - La app viene con alertas base activas por defecto (definidas en `app_config`). Esta tabla solo persiste las sobreescrituras del usuario. - `UNIQUE (user_id, alert_type, channel)` — una preferencia por combinación. - El usuario no puede crear nuevos tipos de alerta; solo ajustar los existentes. - `intensity` acepta valores como `low`, `medium`, `high` según cada tipo. - `cadence_days` controla la frecuencia mínima de recordatorios repetitivos. |
| **Output** | `alert_preferences` creado o actualizado. |

---

### RF-05 — Encolar notificación

| Campo | Detalle |
|-------|---------|
| **ID** | RF-05 |
| **Nombre** | Producir notificación en cola |
| **Descripción** | Cualquier módulo del backend puede encolar una notificación para un usuario. Un worker la despacha por el canal indicado en el momento programado. |
| **Inputs** | `user_id`, `channel`, `payload` (JSON con título, cuerpo, deep link), `scheduled_for`, `reference_type`, `reference_id` |
| **Reglas** | - Antes de encolar, el backend debe verificar que el usuario tiene activa la preferencia correspondiente (`alert_preferences.enabled = true`). - Si el usuario no tiene preferencia explícita, aplica el default del `app_config`. - `sent_at` permanece NULL hasta que el worker confirma el despacho. - El worker consulta `notification_queue WHERE sent_at IS NULL AND scheduled_for <= now()`. - Para notificaciones por `email`: el worker usa `notification_email` si `notification_email_verified_at IS NOT NULL`; de lo contrario usa `app_user.email` como fallback. |
| **Output** | `notification_queue` creado; el worker lo procesa en el siguiente ciclo. |

---

## Requerimientos No Funcionales

### RNF-01 — Cálculo de capacidad de pago
`estimated_payment_capacity` debe recalcularse automáticamente cada vez que se actualiza `user_financial_profile`. Si el resultado es negativo, el sistema debe almacenar `0` y registrar un warning (no bloquear al usuario).

### RNF-02 — Defaults de alertas en app_config
Los tipos de alerta activos por defecto y sus parámetros base (umbrales, cadencia mínima) deben vivir en `app_config`, no hardcodeados. Cambiar un default = INSERT/UPDATE en `app_config`, sin deploy.

### RNF-03 — Cola de notificaciones idempotente
El worker debe ser idempotente: si una notificación ya tiene `sent_at IS NOT NULL`, no la reenvía. La clave de deduplicación puede ser `(user_id, reference_type, reference_id, scheduled_for)` si el productor requiere garantía de unicidad.

### RNF-04 — Privacidad del ingreso
`monthly_income_estimate` y `estimated_payment_capacity` no deben exponerse en logs ni en endpoints públicos. Solo accesibles en endpoints autenticados del propio usuario.

### RNF-05 — Moneda consistente
`user_financial_profile.currency_id` debe coincidir con `app_user.default_currency_id` en la mayoría de los casos. Si difieren, el backend debe mostrar un aviso al usuario; no bloquear.

### RNF-06 — Canales aprobados
El MVP solo soporta `in_app`, `push` y `email`. El campo `channel` tiene CHECK constraint que lo hace cumplir a nivel de DB. No agregar SMS como canal hasta que exista decisión de producto y proveedor aprobado.
