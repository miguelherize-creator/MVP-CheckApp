# POST /auth/register

Crea una cuenta nueva. Al completar el registro el usuario queda en estado `pending_verification` y recibe un código OTP de 6 dígitos por email para confirmar su cuenta.

---

## Request

```
POST /auth/register
Content-Type: application/json
```

```json
{
  "email": "ana@example.com",
  "documentNumber": "12345678-5",
  "password": "Segura@123",
  "acceptTerms": true,
  "acceptPrivacy": true
}
```

| Campo | Tipo | Requerido | Reglas |
|---|---|---|---|
| `email` | string | ✅ | Formato email válido, único en el sistema |
| `documentNumber` | string | ✅ | RUT chileno u otro documento, máx 50 chars |
| `password` | string | ✅ | Mín 8 chars, al menos una mayúscula y un número |
| `acceptTerms` | boolean | ✅ | Debe ser `true` |
| `acceptPrivacy` | boolean | ✅ | Debe ser `true` |

---

## Response — 201 Created

```json
{
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "fullName": null,
    "email": "ana@example.com",
    "username": null,
    "avatarUrl": null,
    "emailVerified": false,
    "trialEndsAt": "2026-05-25T12:00:00.000Z",
    "createdAt": "2026-05-11T12:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a1b2c3d4e5f6...",
  "expiresIn": "15m",
  "nextStep": "email_verification"
}
```

| Campo | Descripción |
|---|---|
| `user.fullName` | `null` al registrarse. Se completa en el paso `profile` del onboarding. |
| `user.emailVerified` | Siempre `false` al registrarse. Pasa a `true` tras confirmar el OTP. |
| `user.trialEndsAt` | Fecha de fin del período de prueba (14 días por defecto). |
| `accessToken` | JWT. Expira en `expiresIn` (15 min). Header: `Authorization: Bearer <token>`. |
| `refreshToken` | Token opaco. Expira en 7 días. Usar en `POST /auth/refresh` para renovar. |
| `nextStep` | Siempre `"email_verification"` al registrar. La app navega a la pantalla de código OTP. |

---

## Errores

| Status | Cuándo ocurre | Mensaje |
|---|---|---|
| `400` | `acceptTerms: false` | `"Debes aceptar los términos para registrarte"` |
| `400` | `acceptPrivacy: false` | `"Debes aceptar la política de privacidad para registrarte"` |
| `400` | Campos inválidos (email mal formado, password débil, etc.) | Array de errores de validación |
| `409` | El email ya existe en el sistema | `"Ya existe una cuenta con este correo electrónico"` |

---

## Flujo post-registro

```
1. POST /auth/register → 201 { nextStep: "email_verification" }
2. App navega a pantalla "Ingresa el código que enviamos a tu correo"
3. Usuario ingresa el código de 6 dígitos
4. POST /auth/email-verification/confirm { email, code }
   → emailVerified: true, onboarding avanza a nextStep: "profile"
5. App navega a pantalla de perfil (completar fullName)
```

---

## Uso de tokens

```
# Autenticar requests subsiguientes
Authorization: Bearer <accessToken>

# Cuando el accessToken expira (401), renovar con:
POST /auth/refresh
{ "refreshToken": "<refreshToken>" }
```

Referencia: [`RF-01`](../../../DB/modulo1/requerimientos.md) · [`CU-01`](../../../DB/modulo1/casos-de-uso.md)
