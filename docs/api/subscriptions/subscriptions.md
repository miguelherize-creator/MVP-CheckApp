# Suscripciones

Gestión de planes y pagos. Integración con Flow.cl como pasarela de pago.

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/subscriptions/plans` | ❌ Público | Lista planes activos |
| `GET` | `/subscriptions/me` | ✅ JWT | Suscripción activa del usuario |
| `POST` | `/subscriptions/checkout` | ✅ JWT | Inicia pago — devuelve URL de Flow |
| `POST` | `/subscriptions/webhook` | ❌ Flow firma | Confirma pago y activa suscripción |
| `GET\|POST` | `/subscriptions/return` | ❌ Público | Página HTML de resultado (redirige Flow) |

---

## GET /subscriptions/plans

Lista todos los planes activos. No requiere autenticación — disponible antes del login para mostrar pricing.

### Request

```
GET /subscriptions/plans
```

### Response — 200

```json
[
  {
    "id": "uuid-plan-mensual",
    "name": "Pro Mensual",
    "slug": "pro_monthly",
    "price": 5000,
    "currency": "CLP",
    "billingIntervalDays": 30,
    "features": [
      "Registro y categorización de transacciones",
      "Importación de cartolas",
      "Diagnóstico financiero",
      "Motor de deudas (Bola de Nieve)",
      "Presupuesto avanzado",
      "Asistente financiero IA"
    ],
    "isActive": true,
    "createdAt": "2026-05-14T00:00:00.000Z",
    "updatedAt": "2026-05-14T00:00:00.000Z"
  },
  {
    "id": "uuid-plan-anual",
    "name": "Pro Anual",
    "slug": "pro_annual",
    "price": 50000,
    "currency": "CLP",
    "billingIntervalDays": 365,
    "features": [
      "Todo lo del plan Pro Mensual",
      "Ahorra 10.000 CLP al año"
    ],
    "isActive": true,
    "createdAt": "2026-05-14T00:00:00.000Z",
    "updatedAt": "2026-05-14T00:00:00.000Z"
  }
]
```

> El ahorro anual se calcula automáticamente: `(5.000 × 12) − 50.000 = 10.000 CLP`.  
> Si los precios cambian vía env vars, el label se recalcula en el próximo restart.

### Slugs de planes

| Slug | Descripción |
|---|---|
| `pro_monthly` | Plan Pro mensual — cobro cada 30 días |
| `pro_annual` | Plan Pro anual — cobro cada 365 días |

---

## GET /subscriptions/me

Retorna la suscripción activa del usuario autenticado. Devuelve `null` si el usuario no tiene suscripción (está en período de prueba o nunca pagó).

### Request

```
GET /subscriptions/me
Authorization: Bearer <accessToken>
```

### Response — 200 (con suscripción)

```json
{
  "id": "uuid-suscripcion",
  "userId": "uuid-usuario",
  "plan": {
    "id": "uuid-plan-mensual",
    "name": "Pro Mensual",
    "slug": "pro_monthly",
    "price": 5000,
    "currency": "CLP",
    "billingIntervalDays": 30,
    "features": ["..."],
    "isActive": true,
    "createdAt": "2026-05-14T00:00:00.000Z",
    "updatedAt": "2026-05-14T00:00:00.000Z"
  },
  "status": "active",
  "currentPeriodStart": "2026-05-14",
  "currentPeriodEnd": "2026-06-13",
  "cancelledAt": null,
  "createdAt": "2026-05-14T09:00:00.000Z",
  "updatedAt": "2026-05-14T09:00:00.000Z"
}
```

### Response — 200 (sin suscripción)

```json
null
```

### Valores de `status`

| Valor | Significado |
|---|---|
| `trialing` | En período de prueba |
| `active` | Suscripción activa y al día |
| `past_due` | Cobro fallido — pendiente de reintento |
| `cancelled` | Cancelada por el usuario |
| `expired` | Vencida sin renovación |

### Errores

| Status | Cuándo |
|---|---|
| `401` | Access token ausente o expirado |

---

## POST /subscriptions/checkout

Inicia el proceso de pago en Flow. El usuario es redirigido a la URL retornada para completar el pago en el navegador.

### Request

```
POST /subscriptions/checkout
Content-Type: application/json
Authorization: Bearer <accessToken>
```

### Body

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `planId` | `string (uuid)` | ✅ | ID del plan obtenido de `GET /subscriptions/plans` |

```json
{
  "planId": "uuid-plan-mensual"
}
```

### Response — 201

```json
{
  "paymentUrl": "https://sandbox.flow.cl/app/web/pay.php?token=abc123"
}
```

El frontend abre esta URL en el navegador del dispositivo (`Linking.openURL`).  
Tras completar el pago, Flow redirige al usuario a `GET /subscriptions/return`.

### Errores

| Status | Cuándo |
|---|---|
| `400` | El `planId` corresponde a un plan gratuito (precio 0) |
| `401` | Access token ausente o expirado |
| `404` | Plan no encontrado o inactivo |
| `500` | Error al comunicarse con la API de Flow |

---

## POST /subscriptions/webhook

Endpoint interno llamado por Flow para confirmar el resultado del pago.  
**No requiere JWT** — Flow autentica la request con firma HMAC SHA-256.

```
POST /subscriptions/webhook
Content-Type: application/x-www-form-urlencoded
```

El backend verifica la firma, consulta el estado del pago a Flow y activa (o rechaza) la suscripción:

| Estado Flow | Acción backend |
|---|---|
| `2` (pagado) | Activa o renueva `subscriptions`, marca `payment_orders.status = paid` |
| `3` (rechazado) | Marca `payment_orders.status = rejected` |
| `4` (anulado) | Marca `payment_orders.status = cancelled` |

> Este endpoint siempre retorna `200 OK` para que Flow reciba el ACK correctamente, incluso si ocurre un error interno.

---

## Flujo completo de pago

```
App                          Backend                    Flow
 │                              │                         │
 ├─ GET /subscriptions/plans ──►│                         │
 │◄─ [lista de planes] ─────────┤                         │
 │                              │                         │
 ├─ POST /subscriptions/checkout planId ──────────────────►│
 │                              │── payment/create ───────►│
 │                              │◄─ { token, url } ────────┤
 │◄─ { paymentUrl } ────────────┤                         │
 │                              │                         │
 ├─ Linking.openURL(paymentUrl) ────────────────────────► │
 │                              │                         │
 │  (usuario paga en Flow)      │                         │
 │                              │◄── POST /webhook ────────┤
 │                              │── activa suscripción    │
 │                              │── 200 OK ───────────────►│
 │                              │                         │
 │◄── redirige a /return ───────────────────────────────── │
```

---

## Variables de entorno relevantes

| Variable | Descripción | Ejemplo |
|---|---|---|
| `PLAN_PRO_MONTHLY_PRICE` | Precio mensual en CLP — upsert al restart | `5000` |
| `PLAN_PRO_ANNUAL_PRICE` | Precio anual en CLP — upsert al restart | `50000` |
| `FLOW_API_URL` | URL base de la API de Flow | `https://sandbox.flow.cl/api` |
| `FLOW_API_KEY` | API key de Flow | — |
| `FLOW_SECRET_KEY` | Secret para firma HMAC SHA-256 | — |
| `FLOW_CONFIRM_URL` | URL del webhook (debe ser accesible por Flow) | `https://api.walvy.app/subscriptions/webhook` |
| `FLOW_RETURN_URL` | URL de retorno tras el pago | `https://api.walvy.app/subscriptions/return` |

> **Para cambiar precios:** actualizar `PLAN_PRO_MONTHLY_PRICE` y/o `PLAN_PRO_ANNUAL_PRICE` + reiniciar la API. El seed hace upsert automático — no requiere SQL manual.
