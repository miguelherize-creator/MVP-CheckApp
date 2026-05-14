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
  "firstName": "Ana",
  "lastName": "Pérez",
  "email": "ana@example.com",
  "username": "aniux",
  "avatarUrl": null,
  "documentNumber": "12345678-9",
  "emailVerified": true,
  "trialEndsAt": "2026-06-14T00:00:00.000Z",
  "createdAt": "2026-05-14T09:00:00.000Z"
}
```

### Errores

| Status | Cuándo |
|---|---|
| `401` | Access token ausente o expirado |
| `404` | Usuario no encontrado (inconsistencia de datos) |

---

## PATCH /users/me

Actualiza nombre, apellido, alias y avatar del usuario autenticado.

El email **no es modificable** desde este endpoint — el correo queda fijo tras el registro.

### Request

```
PATCH /users/me
Content-Type: application/json
Authorization: Bearer <accessToken>
```

### Body

Todos los campos son opcionales. Solo se actualizan los que se envían.

| Campo | Tipo | Validación | Descripción |
|---|---|---|---|
| `firstName` | `string` | Mín. 1 car., máx. 100 | Nombre del usuario |
| `lastName` | `string` | Mín. 1 car., máx. 100 | Apellido del usuario |
| `username` | `string` | Mín. 3 car., máx. 50, solo `a-z0-9_.-` | Alias de experiencia |
| `avatarUrl` | `string` | URL válida, máx. 500 car. | URL pública del avatar |

```json
{
  "firstName": "Ana",
  "lastName": "Pérez",
  "username": "aniux",
  "avatarUrl": "https://cdn.walvy.app/avatars/uuid.jpg"
}
```

### Response — 200

```json
{
  "id": "uuid-v4",
  "firstName": "Ana",
  "lastName": "Pérez",
  "email": "ana@example.com",
  "username": "aniux",
  "avatarUrl": "https://cdn.walvy.app/avatars/uuid.jpg",
  "documentNumber": "12345678-9",
  "emailVerified": true,
  "trialEndsAt": "2026-06-14T00:00:00.000Z",
  "createdAt": "2026-05-14T09:00:00.000Z"
}
```

### Errores

| Status | Cuándo |
|---|---|
| `400` | Valor de campo inválido (URL mal formada, alias con caracteres no permitidos, etc.) |
| `401` | Access token ausente o expirado |
| `404` | Usuario no encontrado |

---

## Diferencia entre /users/me y /users/profile

| | `PATCH /users/me` | `PATCH /users/profile` |
|---|---|---|
| **Uso** | Pantalla "Mis datos" (post-onboarding) | Paso "¿Cómo te llamamos?" del onboarding |
| **Campos** | `firstName`, `lastName`, `username`, `avatarUrl` | `firstName`, `lastName`, `username` |
| **Validación cross-field** | Ninguna — todos opcionales | Al menos uno no vacío |
| **Email** | No modificable | No modificable |
