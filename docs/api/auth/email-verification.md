# Email Verification — Endpoints

Flujo de verificación de correo electrónico mediante código OTP de 6 dígitos.

**Todos los endpoints requieren JWT** (`Authorization: Bearer <accessToken>`).

---

## POST /auth/email-verification/request

Genera un nuevo código OTP y lo envía al email indicado. Invalida cualquier código previo pendiente del usuario.

Usar en dos escenarios:
- Post-registro, cuando la app lleva al usuario a la pantalla de verificación.
- Tras un cambio de correo electrónico.

**Rate limit:** 3 requests / hora por usuario.

### Headers

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Body

| Campo   | Tipo     | Requerido | Descripción                        |
|---------|----------|-----------|------------------------------------|
| `email` | `string` | ✅        | Correo al que se enviará el código.|

### Ejemplo

```json
{
  "email": "ana@example.com"
}
```

### Response 200

```json
{
  "message": "Código de verificación enviado a ana@example.com"
}
```

### Errores

| Status | Cuándo ocurre                                                        |
|--------|----------------------------------------------------------------------|
| `401`  | Token JWT inválido o expirado.                                       |
| `409`  | El email ya está registrado por otra cuenta.                         |
| `429`  | Rate limit superado (3 por hora). Reintentar después de una hora.   |

---

## POST /auth/email-verification/confirm

Valida el código de 6 dígitos ingresado por el usuario. Máximo 5 intentos fallidos; al superarlos el código se invalida automáticamente.

**Rate limit:** 5 requests / minuto por usuario.

### Headers

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Body

| Campo    | Tipo     | Requerido | Descripción                                        |
|----------|----------|-----------|----------------------------------------------------|
| `email`  | `string` | ✅        | Correo que se está verificando.                    |
| `code`   | `string` | ✅        | Código de 6 dígitos numéricos recibido por correo. |

### Ejemplo

```json
{
  "email": "ana@example.com",
  "code": "482910"
}
```

### Response 200

```json
{
  "message": "Correo verificado correctamente",
  "user": {
    "id": "3f1b2c4d-...",
    "firstName": null,
    "lastName": null,
    "email": "ana@example.com",
    "username": null,
    "avatarUrl": null,
    "documentNumber": "12345678-5",
    "emailVerified": true,
    "trialEndsAt": "2026-05-25T00:00:00.000Z",
    "createdAt": "2026-05-11T12:00:00.000Z"
  }
}
```

> Tras una respuesta 200, el `user_status_id` pasa a `active` y el onboarding avanza al paso `profile`. La app debe navegar al siguiente paso del onboarding.

### Errores

| Status | Mensaje                                              | Cuándo ocurre                                              |
|--------|------------------------------------------------------|------------------------------------------------------------|
| `400`  | `"No hay un código pendiente. Solicita uno nuevo."`  | No existe un código vigente para el usuario.               |
| `400`  | `"El código expiró. Solicita uno nuevo."`            | El código superó los 15 minutos de validez.                |
| `400`  | `"Código incorrecto. X intentos restantes."`         | Código equivocado; quedan X intentos antes del bloqueo.    |
| `400`  | `"Demasiados intentos. Solicita un nuevo código."`   | Se superaron los 5 intentos fallidos; código invalidado.   |
| `400`  | `"El correo no coincide con el código enviado."`     | El `email` del body no coincide con el del token activo.   |
| `401`  | —                                                    | Token JWT inválido o expirado.                             |
| `422`  | —                                                    | Body inválido (email con formato incorrecto, código no es exactamente 6 dígitos numéricos). |
| `429`  | —                                                    | Rate limit superado (5 por minuto).                        |

---

## POST /auth/email-verification/resend

Reenvía el código OTP al email indicado. Invalida el código anterior e inicia uno nuevo con 15 minutos de validez.

Usar cuando el usuario no recibió el correo o el código expiró.

**Rate limit:** 3 requests / hora por usuario.

### Headers

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Body

| Campo   | Tipo     | Requerido | Descripción                         |
|---------|----------|-----------|-------------------------------------|
| `email` | `string` | ✅        | Correo al que se reenviará el código.|

### Ejemplo

```json
{
  "email": "ana@example.com"
}
```

### Response 200

```json
{
  "message": "Código de verificación enviado a ana@example.com"
}
```

### Errores

| Status | Cuándo ocurre                                                        |
|--------|----------------------------------------------------------------------|
| `401`  | Token JWT inválido o expirado.                                       |
| `409`  | El email ya está registrado por otra cuenta.                         |
| `429`  | Rate limit superado (3 por hora). Reintentar después de una hora.   |

---

## Flujo completo

```
POST /auth/register
  ↓ accessToken + nextStep: "email_verification"
POST /auth/email-verification/request  ← envía código automáticamente al registrar
  ↓
App muestra pantalla "Ingresa el código de 6 dígitos"
  ↓
Usuario ingresa código
  ↓
POST /auth/email-verification/confirm
  ↓ 200 → emailVerified: true
App avanza al paso "profile" del onboarding

Si el código no llega o expira:
  ↓
POST /auth/email-verification/resend   ← máximo 3 veces por hora
```

---

## Notas

- El código OTP **nunca se almacena en texto plano** — solo su hash SHA-256.
- El código expira en **15 minutos** (configurable en `EMAIL_VERIFICATION_EXPIRES_MINUTES`).
- Cada reenvío invalida el código anterior aunque no haya expirado.
- El `email` en el body de `/confirm` debe coincidir con el email al que se envió el código. Si el usuario cambió de email entre el request y el confirm, debe solicitar un nuevo código con el email correcto.
