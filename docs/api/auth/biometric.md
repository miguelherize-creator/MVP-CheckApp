# PATCH /auth/biometric

Activa o desactiva la autenticación biométrica del usuario en el dispositivo actual.

**Auth:** Requerida — Bearer access token.

---

## Request

**URL:** `PATCH /auth/biometric`

### Headers

```
Content-Type: application/json
Authorization: Bearer <accessToken>
```

### Body

| Campo      | Tipo      | Requerido              | Descripción                                                  |
|------------|-----------|------------------------|--------------------------------------------------------------|
| `enabled`  | `boolean` | ✅                     | `true` para activar, `false` para desactivar.                |
| `method`   | `string`  | ✅ si `enabled: true`  | Método biométrico: `face_id`, `fingerprint`, `device_pin`.   |
| `deviceId` | `string`  | ❌                     | Identificador del dispositivo (para soporte multi-dispositivo futuro). |

### Ejemplo — activar

```json
{
  "enabled": true,
  "method": "face_id",
  "deviceId": "iPhone-UUID-123"
}
```

### Ejemplo — desactivar

```json
{
  "enabled": false
}
```

---

## Response

### 200 — Preferencias actualizadas

```json
{
  "enabled": true,
  "method": "face_id",
  "deviceId": "iPhone-UUID-123",
  "updatedAt": "2026-05-12T15:30:00.000Z"
}
```

Al desactivar:

```json
{
  "enabled": false,
  "method": null,
  "deviceId": null,
  "updatedAt": "2026-05-12T15:35:00.000Z"
}
```

---

## Errores

| Status | Cuándo ocurre                                                        |
|--------|----------------------------------------------------------------------|
| `400`  | Body inválido, `enabled: true` sin `method`, o `method` no válido.  |
| `401`  | Access token ausente o expirado.                                     |
| `404`  | El registro de preferencias biométricas no existe para el usuario.   |

---

## Flujo de activación

```
Usuario activa biométrico en la app
  ↓
App detecta método soportado (Face ID, huella, PIN de dispositivo)
  ↓
App llama PATCH /auth/biometric { enabled: true, method: "face_id", deviceId: "..." }
  ↓ 200 { enabled: true, method: "face_id", ... }
App guarda preferencia local
Backend marca biometric_prompted = true en user_onboarding_state
```

## Flujo de desactivación

```
Usuario desactiva biométrico en la app
  ↓
App llama PATCH /auth/biometric { enabled: false }
  ↓ 200 { enabled: false, method: null, deviceId: null }
App elimina credencial biométrica local (KeyStore / SecureEnclave)
```

---

## Notas

- `biometric_prompted` en `user_onboarding_state` se marca `true` **siempre** — tanto al activar como al saltar. Representa que el usuario ya pasó por la pantalla y tomó una decisión, no que activó la biometría.
- Al desactivar, `method` y `deviceId` se limpian en el backend.
- Tras recibir el 200, la app debe llamar `PATCH /auth/onboarding/step { currentStep: 'profile_basic', resumeSurface: 'onboarding' }` para avanzar el flujo.
- Multi-dispositivo (múltiples registros biométricos) es roadmap post-MVP — por ahora un registro por usuario.
