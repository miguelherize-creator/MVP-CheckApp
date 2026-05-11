# Módulo 1 — Requerimientos

**Módulo:** Identidad, Autenticación y Acceso  
**Layers:** 0 (ISO) · 1 (Status) · 2 (RBAC) · 3 (Config) · 4 (Auth)  
**Fuente de verdad MVP:** `MVP_Walvy_VF_10032026_alineado_estrategia - Alcance MVP.csv` — Módulo 1 (Enrolamiento y onboarding)

---

## Alcance MVP — resumen rápido

| Funcionalidad | MVP |
|---------------|-----|
| Registro con email y contraseña | ✅ Incluido |
| Login con email y contraseña | ✅ Incluido |
| Recuperación de contraseña vía email | ✅ Incluido |
| Cambio de contraseña desde perfil | ✅ Incluido |
| Autenticación biométrica (Face ID / huella — si el dispositivo lo permite) | ✅ Incluido |
| Onboarding informativo básico | ✅ Incluido |
| Verificación de email | ✅ Implícito en creación de cuenta |
| Login con Google / Apple / Facebook | ❌ No incluido en MVP (post-MVP) |
| OTP / MFA por SMS | ❌ No incluido en MVP |
| KYC financiero | ❌ No incluido en MVP |

> **Nota sobre el schema:** La tabla `app_user` incluye columnas `auth_provider` y `auth_provider_user_id` como **capacidad arquitectónica** para soportar OAuth en el futuro sin una migración disruptiva. Su presencia en el DB no implica implementación en el MVP.

---

## Requerimientos Funcionales

### RF-01 — Registro de usuario

| Campo | Detalle |
|-------|---------|
| **ID** | RF-01 |
| **Nombre** | Registro de usuario nuevo |
| **Descripción** | El sistema debe permitir registrar un nuevo usuario con email y contraseña. |
| **Inputs** | email, password, country_id, accepted_terms_at |
| **Reglas** | - Password mínimo 8 caracteres, mayúscula, número, carácter especial. - Email único en el sistema. - `accepted_terms_at` debe registrarse en el momento del registro. - Se crea automáticamente `user_onboarding_state` con `status = not_started`. - Se crea automáticamente `user_gamification_stats` con `total_points = 0`. |
| **Output** | `app_user` creado con `user_status_id = active`, `role_id = user`, access token + refresh token. |

---

### RF-02 — Autenticación con email y contraseña

| Campo | Detalle |
|-------|---------|
| **ID** | RF-02 |
| **Nombre** | Login con credenciales locales |
| **Descripción** | El usuario puede autenticarse con su email y contraseña para obtener un JWT access token y un refresh token. |
| **Reglas** | - Verificar que `user_status_id` corresponda al código `active`. - Verificar que `deleted_at IS NULL`. - Insertar registro en `refresh_tokens` con `expires_at = now() + 30 days`. - El access token expira en 15 minutos. - Aplicar rate limiting (ver `app_config.max_login_attempts`). |
| **Output** | `{ access_token, refresh_token, user_id }` |

---

### RF-03 — Rotación de refresh token

| Campo | Detalle |
|-------|---------|
| **ID** | RF-04 |
| **Nombre** | Renovar sesión |
| **Descripción** | Al presentar un refresh token válido, el sistema emite un nuevo par de tokens y revoca el anterior. |
| **Reglas** | - Verificar que `token_hash` exista y `revoked_at IS NULL` y `expires_at > now()`. - Marcar `revoked_at = now()` en el token viejo. - Crear nuevo registro en `refresh_tokens`. - Si el token ya fue revocado (replay attack), revocar TODOS los refresh tokens del usuario. |
| **Output** | Nuevo `{ access_token, refresh_token }` |

---

### RF-04 — Reset de contraseña

| Campo | Detalle |
|-------|---------|
| **ID** | RF-05 |
| **Nombre** | Recuperar contraseña |
| **Descripción** | El usuario puede solicitar un email con link de reset. El link contiene un token de un solo uso. |
| **Reglas** | - Insertar en `password_reset_tokens` con `expires_at = now() + 1 hour`. - Al usar el token: verificar `used_at IS NULL` y `expires_at > now()`. - Marcar `used_at = now()`. - Actualizar `password_hash` en `app_user`. - Revocar todos los `refresh_tokens` activos del usuario. |

---

### RF-05 — Verificación de Email

| Campo | Detalle |
|---|---|
| **ID** | RF-05 |
| **Nombre** | Confirmar dirección de email mediante código de 6 dígitos |
| **Descripción** | Al registrarse, el usuario recibe un email con un código numérico de 6 dígitos que ingresa directamente en la app. |
| **Flujo** | **1. Registro de cuenta**<br>El sistema genera un código OTP de 6 dígitos.<br>**2. Generación segura del token**<br>Se calcula `token_hash = hash(codigo)` y se almacena en `email_verification_tokens` junto con `expires_at = now() + 15 min`.<br>**3. Envío del código**<br>El sistema envía el código al correo electrónico del usuario.<br>**4. Verificación en la app**<br>El usuario ingresa el código en la pantalla de verificación.<br>**5. Validación backend**<br>El backend calcula el hash del código recibido y lo compara con `token_hash`.<br>**6. Confirmación exitosa**<br>Si el código es válido:<br>- `used_at = now()`<br>- `app_user.email_verified_at = now()`<br>**7. Avance del onboarding**<br>Se actualiza `user_onboarding_state.current_step = 'profile'`. |
| **Reglas** | - El código expira en **15 minutos**.<br>- Máximo **5 intentos fallidos** antes de invalidar el código.<br>- Si expira o supera los intentos permitidos, el usuario puede solicitar un reenvío.<br>- Cada reenvío genera un nuevo registro en `email_verification_tokens` e invalida el anterior mediante `used_at = now()`.<br>- El código nunca se almacena en texto plano, únicamente su hash.<br>- `email_verification_tokens.email` almacena el email verificado, incluso si el usuario cambia de email durante el flujo. |
| **Implicación en schema** | La tabla `email_verification_tokens` puede reutilizarse sin cambios estructurales importantes. `token_hash` almacenará el hash del código OTP de la misma forma que un token largo. Se recomienda agregar: `attempts INT NOT NULL DEFAULT 0` para contabilizar intentos fallidos. |
| **Endpoints** | `POST /auth/email-verification/request` — solicita el código (post-registro o tras cambio de email). <br>`POST /auth/email-verification/confirm` — valida el código de 6 dígitos (throttle: 5 intentos/min). <br>`POST /auth/email-verification/resend` — reenvía e invalida el anterior (throttle: 3 reenvíos/min). |

---

### RF-06 — Autenticación biométrica

| Campo | Detalle |
|-------|---------|
| **ID** | RF-07 |
| **Nombre** | Configurar y usar biometría |
| **Descripción** | El usuario puede habilitar el login biométrico en su dispositivo. |
| **Reglas** | - Crear/actualizar registro en `biometric_preferences` con `enabled = true`, `method` y `device_id`. - El backend no almacena datos biométricos; solo el flag de habilitación y el device_id para validar el origen. - Al activar, marcar `user_onboarding_state.biometric_prompted = true`. |

---

### RF-07 — Cierre de sesión

| Campo | Detalle |
|-------|---------|
| **ID** | RF-08 |
| **Nombre** | Logout |
| **Descripción** | El usuario puede cerrar su sesión actual o todas sus sesiones activas. |
| **Reglas** | - Logout individual: marcar `revoked_at = now()` en el refresh token presentado. - Logout global: marcar `revoked_at = now()` en TODOS los refresh tokens activos del usuario. |

---

### RF-08 — Onboarding guiado

| Campo | Detalle |
|-------|---------|
| **ID** | RF-09 |
| **Nombre** | Flujo de onboarding |
| **Descripción** | Al registrarse, el usuario es guiado por un flujo de pasos. El sistema recuerda el último paso completado para retomar si abandona la app. |
| **Pasos del flujo** | 1. Verificación de email → 2. Perfil básico → 3. Metas financieras → 4. Importar primera cartola → 5. Activar biometría |
| **Reglas** | - `current_step` se actualiza al completar cada paso. - `resume_surface` y `resume_context` se guardan para redirigir al usuario al abrir la app. - Al completar todos: `onboarding_status = completed`, `completed_at = now()`. |

---

### RF-09 — Gestión de estado del usuario

| Campo | Detalle |
|-------|---------|
| **ID** | RF-10 |
| **Nombre** | Cambiar estado de usuario |
| **Descripción** | El backoffice puede cambiar el estado de un usuario (suspender, reactivar, eliminar). |
| **Reglas** | - El estado se modifica cambiando `user_status_id` a un `status.code` válido del dominio `user`. - El trigger `trg_app_user_status_domain` valida el dominio en la DB. - Suspender: `user_status_id = suspended` + revocar todos los refresh tokens. - Eliminar: soft delete con `deleted_at = now()` (nunca DELETE físico). |

---

### RF-10 — Período de trial

| Campo | Detalle |
|-------|---------|
| **ID** | RF-11 |
| **Nombre** | Activar y gestionar trial gratuito |
| **Descripción** | Al registrarse, el usuario puede acceder a funcionalidades premium sin tarjeta durante N días (configurable). |
| **Reglas** | - `trial_started_at = now()` al activar. - `trial_ends_at = now() + app_config['trial_days_default']`. - La vista `v_user_access` determina si el trial está activo comparando `now() <= trial_ends_at`. - Un usuario no puede tener dos trials consecutivos. |

---

### RF-11 — Configuración RBAC

| Campo | Detalle |
|-------|---------|
| **ID** | RF-12 |
| **Nombre** | Gestión de roles y permisos |
| **Descripción** | El sistema resuelve qué puede hacer un usuario a partir de su `role_id`. |
| **Reglas** | - El backend valida permisos haciendo JOIN: `app_user → role → role_permission → permission`. - Los permisos pueden evaluarse por `code` (semántico) o por `path_pattern` + `http_methods` (para middleware de rutas). - Agregar un permiso nuevo = INSERT en `permission` + INSERT en `role_permission`. No requiere código. |

---

### RF-12 — Nivel de salud financiera

| Campo | Detalle |
|-------|---------|
| **ID** | RF-13 |
| **Nombre** | Actualizar avatar de salud financiera |
| **Descripción** | El sistema actualiza el nivel de salud financiera del usuario basado en sus datos. |
| **Reglas** | - El job de cálculo escribe `current_financial_health_level_id` y `financial_health_updated_at` en `app_user`. - Los niveles son: `overwhelmed` (en problemas), `transitioning` (mejorando), `in_control` (saludable). - El frontend muestra el avatar correspondiente según `financial_health_level.asset_path`. |

---

## Requerimientos No Funcionales

### RNF-01 — Seguridad de contraseñas
Las contraseñas deben almacenarse con bcrypt (cost factor ≥ 12). Nunca en texto plano ni en formato reversible.

### RNF-02 — Seguridad de tokens
Los refresh tokens se almacenan como hash SHA-256. El token real solo viaja en la respuesta HTTP (no se persiste).

### RNF-03 — Rate limiting
El endpoint de login debe limitar intentos fallidos a `app_config['max_login_attempts']` (default: 5) por IP + email en una ventana de 15 minutos.

### RNF-04 — Soft delete obligatorio
El campo `deleted_at` en `app_user` no puede ser eliminado físicamente (requisito legal y de auditoría). La baja de un usuario es siempre lógica.

### RNF-05 — Consistencia de status
Toda escritura en `user_status_id` es validada por el trigger `trg_app_user_status_domain` antes de llegar al disco. El backend no puede omitir esta validación.

### RNF-06 — Idempotencia de tokens
Los endpoints de verificación de email y reset de contraseña deben ser idempotentes: múltiples usos del mismo token retornan error (no generan efectos secundarios adicionales).

### RNF-07 — Multi-país desde el inicio
Cada usuario tiene `country_id` y `default_currency_id` obligatorios. El backend no debe asumir CLP como moneda ni CL como país. Toda lógica monetaria debe usar la moneda del usuario.

### RNF-08 — Trazabilidad de configuración
Cualquier cambio en `app_config` debe registrar `updated_by_admin_id`. El backoffice debe exigir autenticación antes de modificar configuración global.

### RNF-09 — Privacidad del document_number
El número de documento (`app_user.document_number`) no debe exponerse en logs ni en respuestas de API públicas. Solo accesible en endpoints autenticados del propio usuario o del backoffice.

### RNF-10 — Tiempo de respuesta
Los endpoints de autenticación (`/auth/login`, `/auth/refresh`) deben responder en menos de 300ms en condiciones normales (excluye latencia de red).
