# POST /auth/refresh

Rota el par de tokens: revoca el refresh token presentado y emite un nuevo access token + nuevo refresh token.

**Auth:** No requerida — el `refreshToken` en el body es la credencial.

---

## Request

**URL:** `POST /auth/refresh`

### Headers

```
Content-Type: application/json
```

### Body

| Campo          | Tipo     | Requerido | Descripción                                        |
|----------------|----------|-----------|----------------------------------------------------|
| `refreshToken` | `string` | ✅        | Refresh token recibido en login, register o refresh.|

### Ejemplo

```json
{
  "refreshToken": "opaque-refresh-token-string"
}
```

---

## Response

### 200 — Tokens renovados

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "nuevo-opaque-refresh-token-string",
  "expiresIn": "15m"
}
```

| Campo          | Tipo     | Descripción                               |
|----------------|----------|-------------------------------------------|
| `accessToken`  | `string` | Nuevo JWT firmado. Expira en 15 minutos.  |
| `refreshToken` | `string` | Nuevo token opaco. Expira en 30 días.     |
| `expiresIn`    | `string` | Duración del access token (`"15m"`).      |

> Reemplazar ambos tokens en SecureStore inmediatamente. El refresh token anterior queda revocado.

---

## Errores

| Status | Cuándo ocurre                                                                             |
|--------|-------------------------------------------------------------------------------------------|
| `400`  | Body inválido o `refreshToken` ausente.                                                   |
| `401`  | Token no encontrado, expirado, o ya revocado. En caso de token revocado, todas las sesiones activas del usuario son cerradas automáticamente. |

---

## Flujo normal

```
App hace request a cualquier endpoint
  ↓ 401 (access token expirado)
App llama POST /auth/refresh con el refreshToken guardado
  ↓ 200 { accessToken, refreshToken }
App guarda los nuevos tokens en SecureStore
App reintenta la request original con el nuevo accessToken
```

## Flujo replay attack

```
Token revocado presentado al backend
  ↓
Backend revoca TODAS las sesiones activas del usuario
  ↓ 401
App elimina tokens locales y navega a login
Usuario debe autenticarse de nuevo en todos sus dispositivos
```

---

## Notas

- Cada refresh token es de **un solo uso** — al usarlo queda revocado y se emite uno nuevo.
- Si se detecta que un token ya revocado está siendo usado, el backend asume que el token fue robado y cierra todas las sesiones del usuario como medida de seguridad.
- La app debe manejar el 401 del refresh navegando al login, sin reintentar.
