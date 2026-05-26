# Recuperación de contraseña — OTP

Flujo de 2 pasos: solicitar código → verificar código y cambiar contraseña.

**Auth:** No requerida en ninguno de los dos endpoints.

---

## Paso 1 — POST /auth/forgot-password

Envía un código OTP de 6 dígitos al correo del usuario.

### Request

```
POST /auth/forgot-password
Content-Type: application/json
```

```json
{ "email": "usuario@ejemplo.com" }
```

### Response — 200 (siempre, incluso si el email no existe)

```json
{
  "message": "Si el correo existe en nuestro sistema, recibirás un código para restablecer tu contraseña."
}
```

La respuesta es siempre la misma para evitar enumerar cuentas.

### Comportamiento

- Invalida cualquier código anterior pendiente del mismo usuario.
- Genera un código OTP de 6 dígitos.
- Expira en `PASSWORD_RESET_EXPIRES_MINUTES` minutos (default: **15 min**).
- Máximo de intentos de verificación: **5** (ver Paso 2).

### Rate limiting

`@Throttle short` — 5 solicitudes / minuto por IP.

---

## Paso 2 — POST /auth/reset-password

Verifica el código y actualiza la contraseña.

### Request

```
POST /auth/reset-password
Content-Type: application/json
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `email` | `string` | ✅ | Correo del usuario |
| `code` | `string` | ✅ | Código OTP de 6 dígitos numéricos |
| `newPassword` | `string` | ✅ | Mínimo 8 caracteres, una mayúscula, un número |

```json
{
  "email": "usuario@ejemplo.com",
  "code": "123456",
  "newPassword": "NuevaClave1"
}
```

### Response — 200

```json
{ "message": "Contraseña actualizada correctamente" }
```

Al actualizar la contraseña, todas las sesiones activas del usuario quedan revocadas (refresh tokens invalidados).

---

## Errores

| Status | Cuándo |
|---|---|
| `400` | Código incorrecto (incluye intentos restantes en el mensaje) |
| `400` | Código expirado o ya usado |
| `400` | Más de 5 intentos fallidos — solicitar nuevo código |
| `400` | Contraseña no cumple requisitos de seguridad |

### Ejemplos de respuesta 400

**Código incorrecto (quedan intentos):**
```json
{ "statusCode": 400, "message": "Código incorrecto. Te quedan 4 intentos." }
```

**Intentos agotados:**
```json
{ "statusCode": 400, "message": "Demasiados intentos fallidos. Solicita un nuevo código." }
```

---

## Flujo completo

```
App                         Backend                      Email
 │                              │                           │
 │  POST /auth/forgot-password  │                           │
 │ ─────────────────────────>   │                           │
 │                              │── envía OTP ──────────>   │
 │  { message: "Si existe..." } │                           │
 │ <─────────────────────────   │                           │
 │                              │                           │
 │  [usuario ingresa código]    │                           │
 │                              │                           │
 │  POST /auth/reset-password   │                           │
 │  { email, code, newPassword }│                           │
 │ ─────────────────────────>   │                           │
 │                              │── invalida sesiones       │
 │  { message: "Contraseña..." }│                           │
 │ <─────────────────────────   │                           │
```

---

## Notas

- El correo se valida solo para buscar el token; la respuesta de `forgot-password` no revela si el usuario existe.
- El código se almacena hasheado (SHA-256) — el backend nunca guarda el código en claro.
- La app debe mostrar cuántos intentos quedan cuando el backend responde con el mensaje de intentos restantes.
