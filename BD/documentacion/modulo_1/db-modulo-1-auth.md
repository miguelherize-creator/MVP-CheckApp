# DB — Módulo 1: Auth y Onboarding

## Tablas propias (escribe principalmente)

| Tabla | Rol |
|-------|-----|
| `users` | Alta de cuenta, login, cambio de contraseña |
| `email_verification_tokens` | Verificación de correo post-registro (código 6 dígitos, TTL 15 min) |
| `refresh_tokens` | Emisión y rotación del token de refresh |
| `password_reset_tokens` | Generación del enlace de recuperación de contraseña |
| `biometric_preferences` | Activar/desactivar autenticación biométrica |
| `onboarding_state` | Inicializar y avanzar el progreso del onboarding |

---

## Detalle por tabla

### `users`
Tabla central. Se crea al registrar la cuenta.

El campo **`username`** es el identificador único de login — se normaliza antes de almacenar:
- Email → `lowercase` (ej: `tu@correo.cl`)
- RUT → sin puntos, `lowercase` (ej: `12345678-9`)
- Username → `lowercase` (ej: `userwalvy`)

| Campo | Descripción |
|-------|-------------|
| `username` | Identificador único de login. Nunca cambia. |
| `identifier_type` | `'email'` \| `'rut'` \| `'username'` — cómo se normalizó el username |
| `email` | Copiado de `username` si `identifier_type='email'`. `null` para RUT/username hasta vincular. |
| `password_hash` | bcrypt (12 rounds). Regla: ≥8 chars, upper+lower+number+special. |
| `name` | `null` al registrarse — se completa en onboarding (M2). |
| `accepted_terms_at` | Timestamp al aceptar los términos. |
| `email_verified_at` | `null` = correo no verificado. Se establece en UC-04. |

**Operaciones:**
- `INSERT` al crear cuenta
- `UPDATE email + email_verified_at` al confirmar código de verificación
- `UPDATE password_hash` al cambiar o restablecer contraseña

---

### `email_verification_tokens`
Tabla nueva. Flujo post-registro para verificar el correo del usuario.

| Campo | Descripción |
|-------|-------------|
| `email` | Correo a verificar (puede ser distinto del `users.email` actual en Flow B) |
| `token_hash` | SHA-256 del código de 6 dígitos enviado al correo |
| `expires_at` | TTL: 15 minutos desde `created_at` |
| `used_at` | `null` = vigente. Se estampa al confirmar o al invalidar por reenvío. |

**Flujo A (registro con email):**
`register` → `INSERT email_verification_tokens` → envío de código → usuario confirma → `UPDATE users.email_verified_at`.

**Flujo B (registro con RUT/username):**
`email-verification/request` → `INSERT email_verification_tokens` → envío de código → `UPDATE users.email + email_verified_at`.

---

### `refresh_tokens`
Soporta sesiones persistentes con rotación en cada uso.

| Campo | Descripción |
|-------|-------------|
| `token_hash` | SHA-256 del token opaco enviado al cliente |
| `expires_at` | Ventana de validez (default: 7 días) |
| `revoked_at` | Se estampa al hacer logout o al rotar el token |

**Flujo:** login exitoso → `INSERT` refresh_token → cliente almacena el token opaco en SecureStore.

---

### `password_reset_tokens`
Flujo "Olvidé mi contraseña". Solo disponible para usuarios con `email` vinculado.

| Campo | Descripción |
|-------|-------------|
| `token_hash` | SHA-256 del token opaco enviado por email |
| `expires_at` | TTL: 1 hora |
| `used_at` | Se estampa al usarlo (token de un solo uso) |

**Flujo:** `forgot-password` → `INSERT` token → email con link → usuario hace click → `reset-password` → `UPDATE users.password_hash` + `UPDATE used_at` + revocar todos los refresh_tokens del usuario.

---

### `biometric_preferences`
Preferencia de autenticación biométrica por usuario y dispositivo.

| Campo | Descripción |
|-------|-------------|
| `enabled` | Toggle principal: `true` = biometría activa |
| `method` | `'face_id'` \| `'fingerprint'` \| `'device_pin'` |
| `device_id` | Identificador del dispositivo (soporte multi-device futuro) |

**Reglas:**
- Se crea con `enabled=false` durante el registro.
- El usuario activa desde el primer login o desde ajustes de perfil.
- Siempre existe fallback a contraseña — nunca se deshabilita el login base.
- Relación 1:1 con `users` — `user_id` es la PK. Un registro por usuario.
- `device_id` es informativo; soporte multi-device es roadmap post-MVP.

---

### `onboarding_state`
Seguimiento del progreso del onboarding — relación 1:1 con `users`.

| Campo | Valor inicial | Se actualiza cuando |
|-------|--------------|---------------------|
| `current_step` | `'email_verification'` (Flow A) o `'email_collection'` (Flow B) | Avanza con cada paso |
| `financial_profile_completed` | `false` | Usuario guarda perfil financiero (M2) |
| `goals_set` | `false` | Usuario define al menos 1 meta (M2) |
| `import_attempted` | `false` | Usuario intenta importar cartola (M4) |
| `biometric_prompted` | `false` | Se le ofreció biometría (aceptó o rechazó) |
| `completed_at` | `null` | Al terminar todos los pasos |

**Pasos de `current_step`:**
```
'email_verification'  → Flow A: código enviado al email de registro
'email_collection'    → Flow B: esperando que el usuario ingrese su correo
'profile'             → Email verificado; completa perfil financiero (M2)
'goals'               → Perfil listo; define metas (M2)
'completed'           → Onboarding terminado
```

---

## Flujos de datos principales

```
REGISTRO (Flow A — email)
  → INSERT users { identifier_type='email', email=username }
  → INSERT onboarding_state { current_step='email_verification' }
  → INSERT biometric_preferences { enabled=false }
  → INSERT email_verification_tokens { código 6 dígitos, TTL 15min }
  → sendVerificationEmail(email, código)
  → INSERT refresh_tokens
  → RETURN { user, access_token, refresh_token, next_step: 'email_verification' }

REGISTRO (Flow B — RUT/username)
  → INSERT users { identifier_type='rut'/'username', email=null }
  → INSERT onboarding_state { current_step='email_collection' }
  → INSERT biometric_preferences { enabled=false }
  → INSERT refresh_tokens
  → RETURN { user, access_token, refresh_token, next_step: 'email_collection' }

VERIFICACIÓN DE CORREO
  → INSERT email_verification_tokens (request/resend)
  → UPDATE users { email_verified_at=NOW() } (confirm)
  → UPDATE onboarding_state { current_step='profile' } (confirm)

LOGIN
  → SELECT users WHERE username = $normalizado
  → bcrypt.compare(password, password_hash)
  → INSERT refresh_tokens
  → RETURN { user, access_token, refresh_token }

RECUPERAR CONTRASEÑA
  → INSERT password_reset_tokens
  → sendPasswordResetEmail(email, token)
  → UPDATE users.password_hash (reset-password)
  → UPDATE password_reset_tokens.used_at
  → UPDATE refresh_tokens SET revoked_at (todos los del usuario)
```

---

## Índices críticos

| Tabla | Columna | Tipo | Motivo |
|-------|---------|------|--------|
| `users` | `username` | UNIQUE | Login — búsqueda principal |
| `users` | `email` | UNIQUE (nullable) | Recovery + verificación de duplicados |
| `refresh_tokens` | `token_hash` | UNIQUE | Validar token en cada request |
| `refresh_tokens` | `expires_at` | INDEX | Limpieza de tokens expirados |
| `email_verification_tokens` | `token_hash` | UNIQUE | Validar código de verificación |
| `email_verification_tokens` | `user_id` | INDEX | Invalidar tokens previos |
| `password_reset_tokens` | `token_hash` | UNIQUE | Validar enlace de recuperación |

---

## Tablas excluidas del MVP

| Tabla | Por qué no está en V1 |
|-------|----------------------|
| `user_identities` | No hay login social (Google, Apple, Facebook) |
| `user_profiles` | Perfil extendido es roadmap; MVP usa columnas en `users` |
