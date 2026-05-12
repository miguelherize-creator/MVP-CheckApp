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

### 200 — Login exitoso

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

| Campo          | Tipo     | Descripción                                                        |
|----------------|----------|--------------------------------------------------------------------|
| `user`         | `object` | Datos públicos del usuario (sin `passwordHash` ni `documentNumber`)|
| `accessToken`  | `string` | JWT firmado. Expira en 15 minutos.                                 |
| `refreshToken` | `string` | Token opaco de un solo uso. Expira en 30 días.                     |
| `expiresIn`    | `string` | Duración del access token (`"15m"`).                               |

> **Almacenar el `refreshToken` de forma segura** (SecureStore en React Native). El backend lo guarda hasheado — la versión en claro solo viaja en esta respuesta.

---

## Errores

| Status | Cuándo ocurre                                                                   |
|--------|---------------------------------------------------------------------------------|
| `400`  | Body inválido o campos faltantes.                                               |
| `401`  | Credenciales incorrectas, usuario no encontrado, o email sin verificar.         |
| `403`  | La cuenta está suspendida. Mostrar mensaje para contactar soporte.              |
| `429`  | Rate limit superado (5 intentos / minuto). Reintentar después de un minuto.    |

### Ejemplos de errores

**401 — Credenciales inválidas**
```json
{
  "statusCode": 401,
  "message": "Credenciales inválidas",
  "error": "Unauthorized"
}
```

**401 — Email sin verificar**
```json
{
  "statusCode": 401,
  "message": "Debes verificar tu correo antes de iniciar sesión",
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
Login exitoso
  ↓
Guardar accessToken + refreshToken en SecureStore
  ↓
Navegar a Home (si emailVerified = true)
  ↓ — o —
Navegar a verificación de email (si emailVerified = false)
```

> El campo `emailVerified` en el objeto `user` indica si el email fue confirmado.  
> Si es `false`, el usuario debería ser redirigido al flujo de verificación (`POST /auth/email-verification/resend`).

---

## Notas

- El `username` es un alias de experiencia de usuario (no único, no usado para autenticación). El login solo acepta `email`.
- Los mensajes de error para "email no encontrado" y "contraseña incorrecta" son idénticos (`"Credenciales inválidas"`) para no revelar qué campo falló.
- El `accessToken` debe enviarse en el header `Authorization: Bearer <token>` en todos los endpoints autenticados.
