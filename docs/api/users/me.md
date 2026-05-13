# GET /users/me y PATCH /users/me

Perfil del usuario autenticado: consulta y actualización general.

**Auth:** Requerida — Bearer access token.

---

## GET /users/me

Retorna los datos públicos del usuario autenticado.

### Request

```
GET /users/me
Authorization: Bearer <accessToken>
```

### Response — 200

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

### Errores

| Status | Cuándo |
|---|---|
| `401` | Access token ausente o expirado |
| `404` | Usuario no encontrado (inconsistencia de datos) |

---

## PATCH /users/me

Actualiza nombre, alias y avatar del usuario autenticado.

El email **no es modificable** desde este endpoint — el correo queda fijo tras el registro.

### Request

```
PATCH /users/me
Content-Type: application/json
Authorization: Bearer <accessToken>
```

### Body

Todos los campos son opcionales. Solo se actualizan los que se envían.

| Campo | Tipo | Descripción |
|---|---|---|
| `fullName` | `string` | Nombre completo (nombre + apellido) |
| `username` | `string` | Alias de experiencia |
| `avatarUrl` | `string` | URL pública del avatar |

```json
{
  "fullName": "Ana Pérez",
  "username": "aniux",
  "avatarUrl": "https://cdn.walvy.app/avatars/uuid.jpg"
}
```

### Response — 200

```json
{
  "id": "uuid-v4",
  "fullName": "Ana Pérez",
  "username": "aniux",
  "email": "ana@example.com",
  "avatarUrl": "https://cdn.walvy.app/avatars/uuid.jpg",
  "emailVerified": true,
  "trialEndsAt": "2026-05-27T00:00:00.000Z",
  "createdAt": "2026-05-13T09:00:00.000Z"
}
```

### Errores

| Status | Cuándo |
|---|---|
| `400` | Validación de campo inválida |
| `401` | Access token ausente o expirado |
| `404` | Usuario no encontrado |

---

## Diferencia entre /users/me y /users/profile

| | `PATCH /users/me` | `PATCH /users/profile` |
|---|---|---|
| **Uso** | Perfil general (post-onboarding) | Paso de onboarding "¿Cómo te llamamos?" |
| **Campos** | `fullName`, `username`, `avatarUrl` | `fullName`, `username` |
| **Email** | No modificable | No modificable |
| **Validación cross-field** | Ninguna (todo opcional) | Al menos uno no vacío |
