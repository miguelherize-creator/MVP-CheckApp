# POST /auth/logout

Revoca el refresh token del dispositivo actual. La sesión queda cerrada en el backend.

**Auth:** No requerida — el `refreshToken` en el body es la credencial. Funciona aunque el access token haya expirado.

---

## Request

**URL:** `POST /auth/logout`

### Headers

```
Content-Type: application/json
```

### Body

| Campo          | Tipo     | Requerido | Descripción                                      |
|----------------|----------|-----------|--------------------------------------------------|
| `refreshToken` | `string` | ✅        | Refresh token recibido en login o register.      |

### Ejemplo

```json
{
  "refreshToken": "opaque-refresh-token-string"
}
```

---

## Response

### 200 — Sesión cerrada

```json
{
  "ok": true
}
```

Siempre retorna 200, incluso si el token no existe o ya estaba revocado — no revela información sobre el estado del token.

---

## Errores

| Status | Cuándo ocurre                              |
|--------|--------------------------------------------|
| `400`  | Body inválido o `refreshToken` ausente.    |

---

## Flujo

```
Usuario toca "Cerrar sesión"
  ↓
App llama POST /auth/logout con el refreshToken guardado
  ↓ 200 { ok: true }
App elimina accessToken y refreshToken del SecureStore
  ↓
App navega a la pantalla de login
```

---

## Notas

- El `accessToken` sigue siendo válido hasta su expiración natural (15 min). El backend no tiene una lista de revocación para access tokens — la ventana corta de expiración es la protección.
- Si el usuario quiere cerrar sesión en todos sus dispositivos, usar `POST /auth/logout-all` (pendiente de implementar).
