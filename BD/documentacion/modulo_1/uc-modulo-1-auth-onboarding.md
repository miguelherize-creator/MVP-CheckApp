# Casos de Uso — Módulo 1: Enrolamiento y Onboarding

**Tablas involucradas:** `users`, `refresh_tokens`, `password_reset_tokens`, `email_verification_tokens`, `biometric_preferences`, `onboarding_state`

---

## Actores

| Actor | Descripción |
|-------|-------------|
| **Usuario nuevo** | No tiene cuenta en Walvy |
| **Usuario registrado** | Tiene cuenta y sesión activa o expirada |
| **Sistema (job)** | Limpieza automática de tokens vencidos |

---

## Schema requerido — tabla `users`

La tabla `users` debe soportar tres tipos de identificador de login. El campo `username` es el identificador único de acceso y el campo de búsqueda en cada login.

```dbml
Table users {
  id uuid [pk]
  username text [not null, unique, note: 'Login único (email/RUT/username).']
  email text [null, unique, note: 'Solo para email; verificado post-registro.']
  identifier_type text [not null, note: '"email" | "rut" | "username"']
  password_hash text [not null]
  name text [null, note: 'Se completa en onboarding (M2), no en el registro.']
  accepted_terms_at timestamptz
  email_verified_at timestamptz [note: 'null = correo no verificado']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}
```

## Schema requerido — tabla `email_verification_tokens`

Tabla nueva. Almacena los tokens de verificación de correo, tanto para el flujo de email directo como para el flujo de RUT/username que vincula un correo post-registro.

```dbml
Table email_verification_tokens {
  id         uuid        [pk]
  user_id    uuid        [not null, ref: > users.id]
  email      text        [not null, note: 'El correo que se está verificando']
  token_hash text        [not null, unique, note: 'SHA-256 del código de 6 dígitos o token opaco']
  expires_at timestamptz [not null, note: 'Expira en 15 minutos']
  used_at    timestamptz [note: 'null = pendiente de uso']
  created_at timestamptz [not null]
}
```

---

## UC-01: Registro con identificador flexible (correo, RUT o username)

**Actor:** Usuario nuevo
**Precondición:** La app está abierta en la pantalla de bienvenida

### Clasificación del identificador al registrarse

```mermaid
flowchart TD
    INPUT([Input del usuario]) --> AT{¿Contiene @?}

    AT --> |Sí| EMAIL_VAL{¿Formato email válido?}
    EMAIL_VAL --> |No| ERR1[Error: correo inválido]
    EMAIL_VAL --> |Sí| TYPE_EMAIL[identifier_type = 'email'\nusername = tu@correo.cl\nemail = tu@correo.cl]

    AT --> |No| RUT_VAL{¿Patrón RUT chileno?\n7-8 dígitos guión dígito-k}
    RUT_VAL --> |Sí| TYPE_RUT[identifier_type = 'rut'\nusername = 12345678-9\nemail = null]

    RUT_VAL --> |No| USR_VAL{¿3-32 chars válidos?}
    USR_VAL --> |No| ERR2[Error: username inválido]
    USR_VAL --> |Sí| TYPE_USR[identifier_type = 'username'\nusername = userwalvy\nemail = null]

    TYPE_EMAIL --> FLUJO_A[Flujo A\nEnvío directo de código]
    TYPE_RUT --> FLUJO_B[Flujo B\nPantalla EmailVerification]
    TYPE_USR --> FLUJO_B
```

---

## UC-02: Flujo A — Registro con email (verificación directa)

**Actor:** Usuario nuevo que se registra con correo electrónico
**Precondición:** El identificador ingresado es un email válido

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant Mail as Mail Service

    U->>FE: Ingresa "tu@correo.cl" + contraseña + acepta términos
    FE->>BE: POST /auth/register {   username: "tu@correo.cl",   password,   acceptTerms: true }

    BE->>DB: SELECT id FROM users WHERE username = 'tu@correo.cl'
    DB-->>BE: (vacío)
    BE->>BE: bcrypt.hash(password)
    BE->>DB: INSERT INTO users (   username = 'tu@correo.cl',   email = 'tu@correo.cl',   identifier_type = 'email',   name = null,   password_hash,   accepted_terms_at = NOW() )
    DB-->>BE: user { id }
    BE->>DB: INSERT INTO onboarding_state (user_id, current_step = 'email_verification')

    BE->>BE: genera código de 6 dígitos aleatorio
    BE->>DB: INSERT INTO email_verification_tokens (   user_id,   email = 'tu@correo.cl',   token_hash = SHA256(código),   expires_at = NOW() + 15min )
    BE->>Mail: sendVerificationEmail("tu@correo.cl", código)

    BE->>BE: genera access_token + refresh_token
    BE->>DB: INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    BE-->>FE: 201 {   access_token,   refresh_token,   user: { id, username, identifier_type: 'email' },   next_step: 'email_verification' }

    FE->>U: Redirige a pantalla "Revisa tu correo" "Te enviamos un código a tu@correo.cl"
```

---

## UC-03: Flujo B — Registro con RUT o username (pantalla EmailVerification)

**Actor:** Usuario nuevo que se registra con RUT o username
**Precondición:** El identificador ingresado no es un email

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant Mail as Mail Service

    U->>FE: Ingresa "12345678-9" o "userwalvy" + contraseña + acepta términos
    FE->>BE: POST /auth/register {   username: "12345678-9",   password,   acceptTerms: true }

    BE->>DB: SELECT id FROM users WHERE username = '12345678-9'
    DB-->>BE: (vacío)
    BE->>BE: bcrypt.hash(password)
    BE->>DB: INSERT INTO users (   username = '12345678-9',   email = null,   identifier_type = 'rut',   name = null,   password_hash,   accepted_terms_at = NOW() )
    DB-->>BE: user { id }
    BE->>DB: INSERT INTO onboarding_state (user_id, current_step = 'email_collection')

    BE->>BE: genera access_token + refresh_token
    BE->>DB: INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    BE-->>FE: 201 {   access_token,   refresh_token,   user: { id, username, identifier_type: 'rut' },   next_step: 'email_collection' }

    FE->>U: Redirige a pantalla "EmailVerification" "Agrega tu correo para verificar tu cuenta"

    U->>FE: Ingresa "tu@correo.cl"
    FE->>BE: POST /auth/email-verification/request {   email: "tu@correo.cl" }

    BE->>DB: SELECT id FROM users WHERE email = 'tu@correo.cl'
    alt Correo ya en uso
        DB-->>BE: { id: 'otro-user' }
        BE-->>FE: 409 "Este correo ya está registrado en otra cuenta"
        FE->>U: Muestra error, pide otro correo
    else Correo disponible
        DB-->>BE: (vacío)
        BE->>DB: UPDATE users SET email = 'tu@correo.cl' WHERE id = $user_id
        BE->>BE: genera código de 6 dígitos
        BE->>DB: INSERT INTO email_verification_tokens (   user_id,   email = 'tu@correo.cl',   token_hash = SHA256(código),   expires_at = NOW() + 15min )
        BE->>Mail: sendVerificationEmail("tu@correo.cl", código)
        BE-->>FE: 200 { email_sent: true }
        FE->>U: Redirige a pantalla "Revisa tu correo" "Te enviamos un código a tu@correo.cl"
    end
```

---

## UC-04: Verificar correo electrónico ("Revisa tu correo")

**Actor:** Usuario nuevo (Flujo A o Flujo B)
**Precondición:** Código enviado al correo, pantalla "Revisa tu correo" activa

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    FE->>U: Pantalla "Revisa tu correo"\nCampo para ingresar código de 6 dígitos

    U->>FE: Ingresa el código recibido
    FE->>BE: POST /auth/email-verification/confirm { code }

    BE->>BE: SHA256(code)
    BE->>DB: SELECT * FROM email_verification_tokens\nWHERE user_id = $1\nAND token_hash = $hash\nAND used_at IS NULL\nAND expires_at > NOW()

    alt Código inválido o expirado
        DB-->>BE: (vacío)
        BE-->>FE: 400 "Código inválido o expirado"
        FE->>U: Muestra error + opción "Reenviar código"
    else Código válido
        DB-->>BE: token { id, email }
        BE->>DB: UPDATE users\nSET email_verified_at = NOW()\nWHERE id = $user_id
        BE->>DB: UPDATE email_verification_tokens\nSET used_at = NOW()\nWHERE id = $token_id
        BE->>DB: UPDATE onboarding_state\nSET current_step = 'profile'\nWHERE user_id = $1
        BE-->>FE: 200 { email_verified: true }
        FE->>U: Redirige al paso siguiente del onboarding
    end

    Note over U,FE: Opción "Reenviar código"
    U->>FE: Tap "Reenviar código"
    FE->>BE: POST /auth/email-verification/resend
    BE->>DB: UPDATE email_verification_tokens\nSET used_at = NOW()\nWHERE user_id = $1 AND used_at IS NULL
    BE->>BE: genera nuevo código de 6 dígitos
    BE->>DB: INSERT INTO email_verification_tokens (   user_id, email, token_hash, expires_at = NOW()+15min )
    BE->>Mail: sendVerificationEmail(email, nuevo_código)
    BE-->>FE: 200 { resent: true }
    FE->>U: "Código reenviado"
```

### Pantallas involucradas en los flujos A y B

```mermaid
flowchart LR
    REG[RegisterScreen] --> |identifier_type = email| REVISA[Revisa tu correo\nIngresa código de 6 dígitos]
    REG --> |identifier_type = rut o username| EV[EmailVerification\nIngresa tu correo]
    EV --> REVISA
    REVISA --> |Código correcto| ONB[Onboarding paso siguiente]
    REVISA --> |Código incorrecto| REVISA
    REVISA --> |Reenviar| REVISA
```

---

## UC-05: Login con identificador flexible

**Actor:** Usuario registrado
**Precondición:** Cuenta activa con contraseña establecida

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Ingresa su identificador + contraseña
    FE->>BE: POST /auth/login { username: "lo que ingresó", password }

    BE->>BE: Normaliza el username: - email → toLowerCase - RUT → elimina puntos, toLowerCase - username → toLowerCase

    BE->>DB: SELECT id, password_hash, identifier_type, email_verified_at\nFROM users\nWHERE username = $normalizado

    alt Usuario no encontrado
        BE-->>FE: 401 "Credenciales inválidas"
    else Usuario encontrado
        BE->>BE: bcrypt.compare(password, hash)
        alt Contraseña incorrecta
            BE-->>FE: 401 "Credenciales inválidas"
        else Contraseña correcta
            BE->>BE: genera access_token + refresh_token
            BE->>DB: INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
            BE-->>FE: 200 {   access_token,   refresh_token,   user,   email_verified: email_verified_at IS NOT NULL }
            FE->>BE: GET /onboarding/state
            BE->>DB: SELECT * FROM onboarding_state WHERE user_id = $1
            alt current_step != 'completed'
                FE->>U: Redirige al paso de onboarding pendiente
            else Onboarding completo
                FE->>U: Redirige a /(tabs)/home
            end
        end
    end
```

### Normalización del identificador (misma regla en registro y login)

| Lo que escribe el usuario | Normalizado | Se busca en `users.username` |
|--------------------------|-------------|------------------------------|
| `Tu@Correo.CL` | `tu@correo.cl` | ✅ |
| `12.345.678-9` | `12345678-9` | ✅ |
| `UserWalvy` | `userwalvy` | ✅ |

---

## UC-06: Refresh de token (sesión persistente)

**Actor:** Sistema (interceptor del cliente)
**Precondición:** Access token expirado, refresh token vigente

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL

    FE->>BE: Cualquier request con access_token expirado
    BE-->>FE: 401 Unauthorized
    FE->>FE: Interceptor detecta 401
    FE->>BE: POST /auth/refresh { refresh_token }
    BE->>BE: SHA256(refresh_token)
    BE->>DB: SELECT * FROM refresh_tokens\nWHERE token_hash = $1 AND revoked_at IS NULL
    alt Token expirado o revocado
        BE-->>FE: 401 "Sesión expirada"
        FE->>FE: logout() → borra SecureStore → redirige a /login
    else Token válido
        BE->>DB: UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1
        BE->>BE: genera nuevo access_token + nuevo refresh_token
        BE->>DB: INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        BE-->>FE: 200 { access_token, refresh_token }
        FE->>FE: Reintenta el request original con nuevos tokens
    end
```

---

## UC-07: Recuperar contraseña

**Actor:** Usuario registrado
**Precondición:** El usuario olvidó su contraseña

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant BE as Backend
    participant DB as PostgreSQL
    participant Mail as Mail Service

    U->>FE: Ingresa su identificador en "Olvidé mi contraseña"
    FE->>BE: POST /auth/forgot-password { username }
    BE->>BE: Normaliza el username
    BE->>DB: SELECT id, email FROM users WHERE username = $normalizado

    alt Usuario no encontrado
        Note over BE: Respuesta idéntica — no revelar si existe
        BE-->>FE: 200 "Si el correo existe, recibirás un link"
    else Usuario encontrado, email IS NULL
        Note over BE: Usuario sin correo vinculado — no puede resetear por email
        BE-->>FE: 200 "Si el correo existe, recibirás un link"
        Note over FE: En la pantalla: sugerir agregar un correo desde el perfil
    else Usuario encontrado, email verificado
        BE->>BE: genera token = crypto.randomBytes(32)
        BE->>DB: INSERT INTO password_reset_tokens (   user_id, token_hash = SHA256(token), expires_at = NOW()+1h )
        BE->>Mail: sendPasswordResetEmail(user.email, token)
        BE-->>FE: 200 "Si el correo existe, recibirás un link"
    end

    FE->>U: Pantalla de confirmación genérica

    U->>FE: Abre link del correo → ingresa nueva contraseña
    FE->>BE: POST /auth/reset-password { token, newPassword }
    BE->>DB: SELECT * FROM password_reset_tokens\nWHERE token_hash = SHA256(token)\nAND used_at IS NULL\nAND expires_at > NOW()
    alt Token inválido o expirado
        BE-->>FE: 400 "Token inválido o expirado"
    else Token válido
        BE->>DB: UPDATE users SET password_hash = $nuevo WHERE id = $1
        BE->>DB: UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1
        BE->>DB: UPDATE refresh_tokens SET revoked_at = NOW()\nWHERE user_id = $1 AND revoked_at IS NULL
        BE-->>FE: 200 "Contraseña actualizada"
        FE->>U: Redirige a /login
    end
```

> **Limitación:** Usuarios sin correo vinculado (`email IS NULL`) no pueden recuperar su contraseña por este flujo. El onboarding debe promover la vinculación de correo durante el registro.

---

## UC-08: Activar autenticación biométrica

**Actor:** Usuario registrado
**Precondición:** Dispositivo soporta Face ID o huella

```mermaid
sequenceDiagram
    actor U as Usuario
    participant FE as Frontend
    participant OS as Device Biometrics API
    participant BE as Backend
    participant DB as PostgreSQL

    U->>FE: Activa "Usar biometría"
    FE->>OS: LocalAuthentication.authenticateAsync()
    OS-->>FE: success = true
    FE->>BE: POST /auth/biometric { enabled: true, method: "face_id", device_id }
    BE->>DB: INSERT INTO biometric_preferences (user_id, enabled, method, device_id)\nON CONFLICT (user_id) DO UPDATE SET enabled = true, method = $3
    BE->>DB: UPDATE onboarding_state SET biometric_prompted = true WHERE user_id = $1
    BE-->>FE: 200 { enabled: true }
```

---

## UC-09: Completar onboarding paso a paso

**Actor:** Usuario nuevo (post-registro y verificación de correo)

```mermaid
flowchart TD
    START([Registro completado]) --> EMAIL_VER{¿email_verified_at\nno es null?}
    EMAIL_VER --> |No verificado| VER_STEP[Pantalla: Revisa tu correo\nUC-04]
    EMAIL_VER --> |Verificado| STEP1
    VER_STEP --> |Código correcto| STEP1

    STEP1[Onboarding: Perfil financiero\nM2 → user_financial_profile] --> MARK1
    MARK1[UPDATE onboarding_state\nfinancial_profile_completed = true] --> STEP2

    STEP2[Onboarding: Metas globales\nM2 → user_goals] --> MARK2
    MARK2[UPDATE onboarding_state\ngoals_set = true] --> STEP3

    STEP3{¿Importar cartola?} --> |Intenta| IMPORT[M4: statement_imports]
    STEP3 --> |Salta| BIO
    IMPORT --> MARK3[UPDATE onboarding_state\nimport_attempted = true]
    MARK3 --> BIO

    BIO[Ofrecer biometría] --> |Activa| BIO_ON[INSERT biometric_preferences\nbiometric_prompted = true]
    BIO --> |Omite| BIO_SKIP[biometric_prompted = true]
    BIO_ON --> DONE
    BIO_SKIP --> DONE

    DONE[UPDATE onboarding_state\ncurrent_step = 'completed'\ncompleted_at = NOW()] --> HOME([Redirige a home])
```

### Estados de `onboarding_state`

| Campo | Valor inicial | Se actualiza cuando |
|-------|--------------|---------------------|
| `current_step` | `'email_verification'` o `'email_collection'` | Avanza con cada paso |
| `financial_profile_completed` | `false` | Usuario guarda perfil financiero (M2) |
| `goals_set` | `false` | Usuario define al menos 1 meta (M2) |
| `import_attempted` | `false` | Usuario intenta importar cartola (M4) |
| `biometric_prompted` | `false` | Se le ofreció biometría (aceptó o rechazó) |
| `completed_at` | `null` | Al terminar todos los pasos |

---

## Diagrama de relación entre tablas — M1

```mermaid
erDiagram
    users {
        uuid id PK
        text username UK "correo | RUT sin puntos | username"
        text email UK "null si no es email"
        text identifier_type "email | rut | username"
        text password_hash
        text name "null al registrarse"
        timestamp accepted_terms_at
        timestamp email_verified_at
    }
    email_verification_tokens {
        uuid id PK
        uuid user_id FK
        text email "correo a verificar"
        text token_hash UK
        timestamp expires_at
        timestamp used_at
    }
    refresh_tokens {
        uuid id PK
        uuid user_id FK
        text token_hash UK
        timestamp expires_at
        timestamp revoked_at
    }
    password_reset_tokens {
        uuid id PK
        uuid user_id FK
        text token_hash UK
        timestamp expires_at
        timestamp used_at
    }
    biometric_preferences {
        uuid user_id PK,FK "1:1 con users"
        boolean enabled
        text method "face_id | fingerprint | device_pin"
        text device_id "informativo — multi-device es roadmap"
    }
    onboarding_state {
        uuid user_id PK,FK "1:1 con users"
        text current_step
        boolean financial_profile_completed
        boolean goals_set
        boolean import_attempted
        boolean biometric_prompted
        timestamp completed_at
    }

    users ||--o{ email_verification_tokens : "verifica correo"
    users ||--o{ refresh_tokens : "tiene sesiones"
    users ||--o{ password_reset_tokens : "solicita reset"
    users ||--|| biometric_preferences : "configura biometría"
    users ||--|| onboarding_state : "tiene estado"
```
