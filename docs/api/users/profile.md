# PATCH /users/profile

Persiste nombre, apellido y/o alias del usuario. Usado en el paso "¿Cómo quieres que te llamemos?" del onboarding.

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

La pantalla tiene 3 campos y el backend los recibe por separado:

| Campo UI | Campo API | Columna DB | Notas |
|---|---|---|---|
| Nombre | `firstName` | `first_name VARCHAR(100)` | Opcional, mín. 1 car. |
| Apellido | `lastName` | `last_name VARCHAR(100)` | Opcional, mín. 1 car. |
| Nombre preferido | `username` | `username VARCHAR(80)` | Alias de experiencia, no identificador |

### Body

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `firstName` | `string` | ❌ | Nombre del usuario |
| `lastName` | `string` | ❌ | Apellido del usuario |
| `username` | `string` | ❌ | Alias de experiencia. No único. |

**Al menos uno debe llegar con valor no vacío.** Si todos llegan vacíos o solo con espacios, el backend retorna 400.

```
✅  { "firstName": "Ana" }
✅  { "username": "Ani" }
✅  { "firstName": "Ana", "lastName": "Pérez", "username": "Ani" }
❌  {}
❌  { "firstName": "  ", "lastName": "", "username": "" }
```

### Ejemplo

```json
{
  "firstName": "Ana",
  "lastName": "Pérez",
  "username": "Ani"
}
```

---

## Response

### 200 — Datos guardados

```json
{
  "id": "uuid-v4",
  "firstName": "Ana",
  "lastName": "Pérez",
  "email": "ana@example.com",
  "username": "Ani",
  "avatarUrl": null,
  "documentNumber": "12345678-9",
  "emailVerified": true,
  "trialEndsAt": "2026-06-14T00:00:00.000Z",
  "createdAt": "2026-05-14T09:00:00.000Z"
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

- `firstName` y `lastName` preservan el formato original (mayúsculas/minúsculas tal como los envía la app).
- `username` preserva el formato original — es un alias de experiencia, no un handle técnico.
- Este endpoint no modifica email ni avatar. Para eso usar `PATCH /users/me`.
