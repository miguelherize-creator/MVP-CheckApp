# PATCH /users/profile

Persiste el nombre y alias del usuario. Usado en el paso "¿Cómo quieres que te llamemos?" del onboarding y reutilizable desde el perfil.

**Auth:** Requerida — Bearer access token.

---

## Request

**URL:** `PATCH /users/profile`

### Headers

```
Content-Type: application/json
Authorization: Bearer <accessToken>
```

### Mapeo de campos UI → backend

La pantalla tiene 3 campos; el backend recibe 2:

| Campo UI | Campo API | Columna DB | Notas |
|---|---|---|---|
| Nombre | `fullName` | `full_name VARCHAR(200)` | La app concatena nombre + apellido antes de enviar |
| Apellido | `fullName` | `full_name VARCHAR(200)` | Mismo campo — concatenado por la app |
| Nombre preferido | `username` | `username VARCHAR(80)` | Alias de experiencia, no identificador |

### Body

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `fullName` | `string` | ❌ | Nombre completo (nombre + apellido concatenados) |
| `username` | `string` | ❌ | Alias de experiencia. No único. |

**Al menos uno debe llegar con valor no vacío.** Si ambos llegan vacíos o solo con espacios, el backend retorna 400.

```
✅  { "fullName": "Ana Pérez" }
✅  { "username": "Ani" }
✅  { "fullName": "Ana Pérez", "username": "Ani" }
❌  {}
❌  { "fullName": "  ", "username": "" }
```

### Ejemplo

```json
{
  "fullName": "Ana Pérez",
  "username": "Ani"
}
```

---

## Response

### 200 — Datos guardados

```json
{
  "id": "uuid-v4",
  "fullName": "Ana Pérez",
  "username": "Ani",
  "email": "ana@example.com",
  "avatarUrl": null,
  "emailVerified": true,
  "trialEndsAt": "2026-05-27T00:00:00.000Z",
  "createdAt": "2026-05-13T09:00:00.000Z"
}
```

---

## Errores

| Status | Cuándo |
|---|---|
| `400` | Ningún campo enviado, o todos los campos llegan vacíos / solo espacios |
| `401` | Access token ausente o expirado |
| `404` | Usuario no encontrado |

---

## Comportamiento por botón (pantalla onboarding)

El endpoint es el mismo para ambos botones. La diferencia está en la llamada posterior a `PATCH /auth/onboarding/step`:

| Botón | Llamada posterior | Navegación |
|---|---|---|
| "Guardar y continuar" | `PATCH /auth/onboarding/step { currentStep: 'welcome', resumeSurface: 'onboarding' }` | → Welcome |
| "Guardar y salir" | `PATCH /auth/onboarding/step { currentStep: 'welcome', resumeSurface: 'home' }` | → Home |

---

## Notas

- `fullName` preserva el formato original (mayúsculas/minúsculas tal como lo envía la app).
- `username` preserva el formato original — es un alias de experiencia, no un handle técnico.
- Este endpoint no modifica email ni avatar. Para eso usar `PATCH /users/me`.
