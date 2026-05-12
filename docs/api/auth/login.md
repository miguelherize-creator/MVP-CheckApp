# POST /auth/login

Autentica a un usuario con email (o username) y contraseña. Retorna un access token JWT y un refresh token opaco.

---

## Request

**URL:** `POST /auth/login`  
**Auth:** No requerida  
**Rate limit:** 5 requests / minuto por IP

### Headers

```
Content-Type: application/json
```

### Body

| Campo      | Tipo     | Requerido | Descripción                   |
|------------|----------|-----------|-------------------------------|
| `email`    | `string` | ✅        | Correo electrónico del usuario.|
| `password` | `string` | ✅        | Contraseña del usuario.        |

### Ejemplo

```json
{
  "email": "ana@example.com",
  "password": "Walvy2024"
}
```

---

## Response

### 200 — Login exitoso (email verificado)

```json
{
  "user": {
    "id": "3f1b2c4d-...",
    "fullName": null,
    "email": "ana@example.com",
    "username": null,
    "avatarUrl": null,
    "emailVerified": true,
    "trialEndsAt": "2026-05-25T00:00:00.000Z",
    "createdAt": "2026-05-11T12:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "opaque-refresh-token-string",
  "expiresIn": "15m"
}
```

### 200 — Login con email pendiente de verificación

Cuando el usuario se registró pero no verificó su correo. El backend emite tokens igual que en un login normal **y envía automáticamente un nuevo código OTP** al correo. La app debe redirigir a la pantalla de verificación.

```json
{
  "user": {
    "id": "3f1b2c4d-...",
    "fullName": null,
    "email": "ana@example.com",
    "username": null,
    "avatarUrl": null,
    "emailVerified": false,
    "trialEndsAt": "2026-05-25T00:00:00.000Z",
    "createdAt": "2026-05-11T12:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "opaque-refresh-token-string",
  "expiresIn": "15m",
  "nextStep": "email_verification"
}
```

| Campo          | Tipo     | Descripción                                                        |
|----------------|----------|--------------------------------------------------------------------|
| `user`         | `object` | Datos públicos del usuario (sin `passwordHash` ni `documentNumber`)|
| `accessToken`  | `string` | JWT firmado. Expira en 15 minutos.                                 |
| `refreshToken` | `string` | Token opaco de un solo uso. Expira en 30 días.                     |
| `expiresIn`    | `string` | Duración del access token (`"15m"`).                               |
| `nextStep`     | `string` | Solo presente si hay una acción pendiente. Valor: `"email_verification"`. |

> **Almacenar el `refreshToken` de forma segura** (SecureStore en React Native). El backend lo guarda hasheado — la versión en claro solo viaja en esta respuesta.

---

## Errores

| Status | Cuándo ocurre                                                                |
|--------|------------------------------------------------------------------------------|
| `400`  | Body inválido o campos faltantes.                                            |
| `401`  | Credenciales incorrectas o usuario no encontrado.                            |
| `403`  | La cuenta está suspendida o no disponible. Mostrar mensaje de soporte.       |
| `429`  | Rate limit superado (5 intentos / minuto). Reintentar después de un minuto. |

**401 — Credenciales inválidas**
```json
{
  "statusCode": 401,
  "message": "Credenciales inválidas",
  "error": "Unauthorized"
}
```

**403 — Cuenta suspendida**
```json
{
  "statusCode": 403,
  "message": "Tu cuenta ha sido suspendida. Contacta soporte.",
  "error": "Forbidden"
}
```

---

## Flujo post-login

```
Login
  ↓ 200
Guardar accessToken + refreshToken en SecureStore
  ↓
¿nextStep = "email_verification"?
  ├── Sí → Navegar a pantalla de verificación de email
  │         (el backend ya envió un nuevo código automáticamente)
  └── No → Navegar a Home
```

---

## Notas

- El `username` es un alias de experiencia de usuario (no único, no usado para autenticación). El login solo acepta `email`.
- Los mensajes de error para "email no encontrado" y "contraseña incorrecta" son idénticos (`"Credenciales inválidas"`) para no revelar qué campo falló.
- El `accessToken` debe enviarse en el header `Authorization: Bearer <token>` en todos los endpoints autenticados.
- Si el usuario tiene email sin verificar, el backend envía el código automáticamente en el login — la app **no necesita llamar a `/resend`** al llegar a la pantalla de verificación.
