# Módulo 1 — Casos de Uso

**Módulo:** Identidad, Autenticación y Acceso  
**Fuente de verdad MVP:** `MVP_Walvy_VF_10032026_alineado_estrategia - Alcance MVP.csv` — Módulo 1 (Enrolamiento y onboarding)

**Actores:**
- **Usuario** — persona que usa la app Walvy (iOS/Android/Web)
- **Sistema** — procesos automáticos del backend (jobs, triggers, guards)
- **Administrador** — operador del backoffice interno de Walvy

> **Nota de alcance:** Los casos de uso en este documento corresponden exclusivamente al **MVP**. Las columnas `auth_provider` y `auth_provider_user_id` existen en la tabla `app_user` como capacidad arquitectónica futura, pero la integración con Google / Apple / Facebook está **explícitamente fuera del MVP** según el CSV de alcance.

---

## CU-01 — Registrarse con email y contraseña

**Actor principal:** Usuario  
**Precondiciones:** El email no está registrado en el sistema.

### Flujo principal

```
1. Usuario ingresa email, contraseña, país y acepta términos.
2. Sistema valida:
   a. Email tiene formato válido.
   b. Contraseña cumple política (8+ chars, mayúscula, número, especial).
   c. Email no existe en app_user.
3. Sistema genera password_hash con bcrypt.
4. Sistema crea app_user con:
   - user_status_id = pending_verification
   - role_id = user
   - accepted_terms_at = now()
   - trial_started_at = now()
   - trial_ends_at = now() + app_config['trial_days_default']
5. Sistema crea user_onboarding_state (onboarding_status = not_started).
6. Sistema crea user_gamification_stats (total_points = 0, level = 1).
7. Sistema genera email_verification_token y envía email de verificación.
8. Sistema retorna access_token + refresh_token.
9. App lleva al usuario al paso 1 del onboarding.
```

### Flujos alternativos

**2c — Email ya existe:**
```
→ Sistema retorna error 409 "El email ya está registrado".
```

**2b — Contraseña débil:**
```
→ Sistema retorna error 422 con detalle de qué regla incumple.
```

### Postcondiciones
- Existe un registro en `app_user` con `deleted_at IS NULL`.
- Existe un registro en `user_onboarding_state`.
- Se envió email de verificación.
- El usuario tiene un refresh token activo.

---


## CU-02 — Iniciar sesión

**Actor principal:** Usuario  
**Precondiciones:** El usuario tiene cuenta registrada y activa.

### Flujo principal

```
1. Usuario ingresa email y contraseña.
2. Sistema busca app_user por email.
3. Sistema verifica:
   a. deleted_at IS NULL.
   b. user_status_id = active.
   c. bcrypt.compare(password, password_hash) = true.
4. Sistema crea refresh_token con expires_at = now() + 30 days.
5. Sistema retorna { access_token (15 min), refresh_token }.
6. App almacena tokens y lleva a Home.
```

### Flujos alternativos

**2 — Email no encontrado:**
```
→ Error 401 "Credenciales inválidas" (no revelar si existe o no el email).
```

**3a — Usuario eliminado (deleted_at IS NOT NULL):**
```
→ Error 401 "Credenciales inválidas".
```

**3b — Usuario suspendido:**
```
→ Error 403 "Tu cuenta ha sido suspendida. Contacta soporte."
```

**3c — Contraseña incorrecta:**
```
→ Error 401 "Credenciales inválidas".
→ Sistema incrementa contador de intentos fallidos.
→ Si supera app_config['max_login_attempts']: bloquear IP por 15 min.
```

### Postcondiciones
- Existe nuevo registro en `refresh_tokens` asociado al usuario.
- El usuario tiene acceso a la app según su `role_id` y `user_status_id`.

---

## CU-03 — Renovar sesión (refresh)

**Actor principal:** Sistema (llamado automáticamente por la app cuando el access token expira)  
**Precondiciones:** El usuario tiene un refresh token no expirado y no revocado.

### Flujo principal

```
1. App detecta que el access token expiró (401 del backend).
2. App envía el refresh_token al endpoint /auth/refresh.
3. Sistema calcula hash del token y busca en refresh_tokens.
4. Sistema verifica: revoked_at IS NULL y expires_at > now().
5. Sistema marca el token viejo con revoked_at = now().
6. Sistema crea nuevo refresh_token.
7. Sistema retorna nuevo { access_token, refresh_token }.
8. App reintenta la request original con el nuevo access token.
```

### Flujo alternativo — Replay attack detectado

```
4. Token ya tiene revoked_at → posible robo de token.
5. Sistema revoca TODOS los refresh_tokens activos del usuario.
6. Sistema retorna error 401.
7. Usuario debe hacer login nuevamente.
```

### Postcondiciones
- El refresh token presentado tiene `revoked_at = now()`.
- Existe un nuevo refresh token activo para el usuario.

---

## CU-04 — Recuperar contraseña

**Actor principal:** Usuario  
**Precondiciones:** El usuario tiene cuenta con email verificado.

### Paso 1 — Solicitar reset

```
1. Usuario ingresa su email en la pantalla "¿Olvidaste tu contraseña?".
2. Sistema busca app_user por email.
3. Sistema genera token aleatorio y calcula su hash.
4. Sistema crea password_reset_token con expires_at = now() + 1 hour.
5. Sistema envía email con link que incluye el token en claro.
6. Sistema retorna éxito (siempre, aunque el email no exista — no revelar info).
```

### Paso 2 — Cambiar contraseña

```
1. Usuario hace clic en el link del email.
2. App envía (token, nueva_contraseña) al backend.
3. Sistema calcula hash del token y busca en password_reset_tokens.
4. Sistema verifica: used_at IS NULL y expires_at > now().
5. Sistema valida política de contraseña.
6. Sistema actualiza app_user.password_hash.
7. Sistema marca password_reset_token.used_at = now().
8. Sistema revoca todos los refresh_tokens activos del usuario.
9. Sistema retorna éxito.
10. App lleva al usuario al login.
```

### Flujo alternativo — Token expirado o ya usado

```
4. Expirado o used_at IS NOT NULL:
→ Error 410 "El link de recuperación expiró o ya fue usado."
```

---

## CU-05 — Verificar email

**Actor principal:** Usuario  
**Precondiciones:** El usuario se registró.

### Flujo principal

```
1. Al registrarse, el sistema genera código de 6 dígitos aleatorio.
2. Sistema calcula token_hash = hash(codigo) y guarda en email_verification_tokens
   con expires_at = now() + 15 min, attempts = 0.
3. Sistema envía el código por email.
4. App muestra pantalla "Ingresa el código que enviamos a tu email".
5. Usuario escribe los 6 dígitos en la app.
6. App envía el código al endpoint POST /auth/email-verification/confirm.
7. Sistema calcula hash del código recibido y busca en email_verification_tokens.
8. Sistema verifica: used_at IS NULL, expires_at > now(), attempts < 5.
9. Sistema actualiza app_user.email_verified_at = now().
10. Sistema actualiza app_user.user_status_id = active.
11. Sistema marca email_verification_tokens.used_at = now().
12. Sistema actualiza user_onboarding_state.current_step = 'profile'.
13. App avanza al siguiente paso del onboarding.
```

### Flujo alternativo A — Código incorrecto

```
8. hash no coincide:
→ Sistema incrementa email_verification_tokens.attempts += 1.
→ Si attempts < 5: retorna error 422 "Código incorrecto. X intentos restantes."
→ Si attempts >= 5: retorna error 429 "Demasiados intentos. Solicita un nuevo código."
   y marca used_at = now() para invalidar el token.
```

### Flujo alternativo B — Código expirado

```
8. expires_at <= now():
→ Error 410 "El código expiró. Solicita uno nuevo."
```

### Flujo alternativo C — Reenvío del código

```
1. Usuario toca "Reenviar código".
2. App llama a POST /auth/email-verification/resend.
3. Sistema verifica rate limit: máximo 3 reenvíos por email en 1 hora.
4. Sistema invalida token anterior (used_at = now()).
5. Sistema genera nuevo código, nuevo email_verification_tokens.
6. Sistema envía nuevo email.
7. App muestra "Enviamos un nuevo código a tu email."
```

---

## CU-06 — Configurar autenticación biométrica

**Actor principal:** Usuario  
**Precondiciones:** El usuario tiene sesión activa.

### Flujo principal

```
1. Durante onboarding (o desde Configuración), usuario acepta activar biometría.
2. App realiza verificación biométrica local en el dispositivo.
3. App envía al backend: { method: 'face_id'|'touch_id', device_id }.
4. Sistema crea/actualiza biometric_preferences con enabled = true.
5. Sistema marca user_onboarding_state.biometric_prompted = true.
6. Sistema retorna éxito.
```

### Flujo alternativo — Desactivar biometría

```
1. Usuario desactiva biometría desde Configuración.
2. App envía al backend: { enabled: false }.
3. Sistema actualiza biometric_preferences.enabled = false.
```

---

## CU-07 — Completar onboarding

**Actor principal:** Usuario  
**Precondiciones:** Usuario recién registrado con `onboarding_status = not_started` o `in_progress`.

### Flujo principal

```
1. App abre → Sistema consulta user_onboarding_state.
2. Si resume_surface = 'onboarding': App muestra el paso pendiente.
3. Usuario completa cada paso:
   Paso 1: Verificar email → email_verified_at poblado → financial_profile_completed → false → siguiente
   Paso 2: Completar perfil → user_financial_profile creado → financial_profile_completed = true
   Paso 3: Declarar metas → user_goals creado → goals_set = true
   Paso 4: Importar cartola → import_attempted = true
   Paso 5: Activar biometría → biometric_prompted = true
4. Al completar todos los checkpoints:
   → onboarding_status = completed
   → completed_at = now()
   → resume_surface = 'home'
5. App navega a Home.
```

### Flujo alternativo — Usuario abandona a la mitad

```
3. Usuario cierra la app en el paso 3.
4. Sistema guarda current_step = 'goals', resume_surface = 'onboarding'.
5. Al volver a abrir: Sistema retorna resume_surface = 'onboarding', current_step = 'goals'.
6. App lleva directamente al paso pendiente.
```

---

## CU-08 — Cerrar sesión

**Actor principal:** Usuario  
**Precondiciones:** El usuario tiene sesión activa.

### Flujo A — Logout del dispositivo actual

```
1. Usuario toca "Cerrar sesión".
2. App envía refresh_token al endpoint /auth/logout.
3. Sistema busca el token y marca revoked_at = now().
4. App elimina tokens locales.
5. App navega a pantalla de login.
```

### Flujo B — Cerrar todas las sesiones

```
1. Usuario toca "Cerrar sesión en todos los dispositivos".
2. Sistema marca revoked_at = now() en TODOS los refresh_tokens activos del usuario.
3. App elimina tokens locales y navega a login.
```

---

## CU-09 — Suspender usuario (backoffice)

**Actor principal:** Administrador  
**Precondiciones:** El administrador tiene rol `admin` o `super_admin` en `admin_users`.

### Flujo principal

```
1. Administrador busca al usuario por email o ID.
2. Administrador selecciona "Suspender cuenta" con motivo.
3. Sistema actualiza app_user.user_status_id = suspended.
4. Sistema revoca todos los refresh_tokens activos del usuario.
5. Sistema registra acción en admin_audit_log con before_data y after_data.
6. Administrador ve confirmación.
```

### Postcondiciones
- El usuario no puede iniciar sesión.
- Las sesiones activas quedan inválidas de inmediato (siguiente request retorna 401).
- Queda registro en `admin_audit_log` con el motivo y el administrador que actuó.

---

## CU-10 — Gestionar configuración global (backoffice)

**Actor principal:** Administrador  
**Precondiciones:** Administrador autenticado en backoffice.

### Flujo principal

```
1. Administrador navega a "Configuración del sistema".
2. Sistema muestra tabla app_config con key, value, value_type y description.
3. Administrador edita un valor (ej: cambia trial_days_default de 14 a 21).
4. Sistema valida que el nuevo valor sea compatible con value_type.
5. Sistema actualiza app_config.value y registra updated_by_admin_id = admin.id.
6. Sistema registra en admin_audit_log.
7. El cambio toma efecto inmediatamente (próximo registro que use esa key).
```

### Ejemplo: Habilitar funcionalidad de IA

```
1. Administrador cambia feature_ai_enabled de false a true.
2. Sistema actualiza app_config.
3. El backend ya lee app_config en cada request que requiere esa feature.
4. Todos los usuarios ven la funcionalidad habilitada sin redeploy.
```

---

## CU-11 — Agregar nuevo estado al sistema (sin deploy)

**Actor principal:** Administrador  
**Precondiciones:** Se necesita un nuevo estado que no existe en ningún ENUM.

### Flujo principal

```
1. Administrador detecta que necesita estado "paused_by_bank" en dominio "debt".
2. Administrador inserta en status:
   INSERT INTO status (status_domain_id, code, name, sort_order)
   SELECT sd.status_domain_id, 'paused_by_bank', 'Pausada por banco', 10
   FROM status_domain sd WHERE sd.code = 'debt';
3. El nuevo estado está disponible de inmediato para el backend.
4. No se requiere ALTER TYPE ni redeploy del backend.
```

---

## Resumen de Casos de Uso

| ID | Caso de uso | Actor | RF relacionado | MVP |
|----|-------------|-------|----------------|-----|
| CU-01 | Registrarse con email y contraseña | Usuario | RF-01, RF-05 | ✅ |
| CU-02 | Iniciar sesión | Usuario | RF-02 | ✅ |
| CU-03 | Renovar sesión (refresh) | Sistema | RF-03 | ✅ |
| CU-04 | Recuperar contraseña | Usuario | RF-04 | ✅ |
| CU-05 | Verificar email | Usuario | RF-05 | ✅ |
| CU-06 | Configurar biometría | Usuario | RF-06 | ✅ |
| CU-07 | Completar onboarding | Usuario | RF-08 | ✅ |
| CU-08 | Cerrar sesión | Usuario | RF-07 | ✅ |
| CU-09 | Suspender usuario | Administrador | RF-09 | ✅ |
| CU-10 | Gestionar configuración global | Administrador | RF-11, RNF-08 | ✅ |
| CU-11 | Agregar estado sin deploy | Administrador | RF-09, RF-11 | ✅ |
