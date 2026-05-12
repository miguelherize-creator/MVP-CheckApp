# POST /auth/logout-all

Revoca todos los refresh tokens activos del usuario, cerrando sesión en todos los dispositivos.

**Auth:** Requerida — Bearer access token.

---

## Request

**URL:** `POST /auth/logout-all`

### Headers

```
Authorization: Bearer <accessToken>
```

Sin body.

---

## Response

### 200 — Todas las sesiones cerradas

```json
{
  "ok": true
}
```

---

## Errores

| Status | Cuándo ocurre                          |
|--------|----------------------------------------|
| `401`  | Access token ausente o expirado.       |

---

## Flujo

```
Usuario toca "Cerrar sesión en todos los dispositivos"
  ↓
App llama POST /auth/logout-all con el accessToken actual
  ↓ 200 { ok: true }
App elimina tokens locales y navega a login
Todos los demás dispositivos quedarán con sesión inválida en su próximo refresh
```

---

## Notas

- Útil cuando el usuario cree que su cuenta fue comprometida.
- Los access tokens ya emitidos siguen siendo válidos hasta su expiración (máx 15 min) — la protección es que el siguiente refresh fallará.
- Para cerrar solo el dispositivo actual usar `POST /auth/logout`.
