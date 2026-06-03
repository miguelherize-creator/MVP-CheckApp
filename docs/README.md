# Walvy Backend — Estado del API (MVP)

**Última actualización:** 2026-05-14  
**Repo:** `Backend/MVP-CheckApp`  
**Swagger (local):** `http://localhost:3000/api`

Este documento es el índice de referencia para contexto avance. Describe qué endpoints están **operativos hoy**, qué hace cada uno en términos de negocio, y qué está pendiente de implementar.

---

## Resumen ejecutivo


| Módulo                               | Estado                | Endpoints listos |
| ------------------------------------ | --------------------- | ---------------- |
| Módulo 1 — Auth & Onboarding         | ✅ Funcional           | 13 endpoints     |
| Módulo 2 — Perfil & Suscripciones    | ✅ Funcional (parcial) | 6 endpoints      |
| Módulo 2 — Alertas y notificaciones  | ❌ Pendiente           | —                |
| Módulo 2 — Perfil financiero y metas | ❌ Pendiente           | —                |
| Módulos 3–7                          | ❌ Sin iniciar         | —                |


---

## Módulo 1 — Autenticación y Onboarding

Todo el flujo de registro, verificación, sesiones y progreso del onboarding está implementado y probado.

### Registro y sesión


| Método | Endpoint           | Auth                 | Qué hace                                                                               | Doc                         |
| ------ | ------------------ | -------------------- | -------------------------------------------------------------------------------------- | --------------------------- |
| `POST` | `/auth/register`   | ❌ Público            | Crea cuenta nueva. Envía código OTP de 6 dígitos al correo. Retorna tokens de sesión.  | [→](api/auth/register.md)   |
| `POST` | `/auth/login`      | ❌ Público            | Inicia sesión. Si el correo no está verificado, reenvía OTP automáticamente.           | [→](api/auth/login.md)      |
| `POST` | `/auth/refresh`    | ❌ (usa refreshToken) | Renueva el access token. El refresh token es de un solo uso — se rota en cada llamada. | [→](api/auth/refresh.md)    |
| `POST` | `/auth/logout`     | ❌ (usa refreshToken) | Cierra la sesión del dispositivo actual. Revoca el refresh token.                      | [→](api/auth/logout.md)     |
| `POST` | `/auth/logout-all` | ✅ JWT                | Cierra todas las sesiones activas del usuario (todos los dispositivos).                | [→](api/auth/logout-all.md) |


> **Token de acceso:** expira en 15 minutos. **Refresh token:** expira en 30 días, de un solo uso (se rota).

---

### Verificación de correo


| Método | Endpoint                           | Auth  | Qué hace                                                                      | Doc                                 |
| ------ | ---------------------------------- | ----- | ----------------------------------------------------------------------------- | ----------------------------------- |
| `POST` | `/auth/email-verification/request` | ✅ JWT | Genera y envía un nuevo código OTP al correo indicado. Máx. 3 veces por hora. | [→](api/auth/email-verification.md) |
| `POST` | `/auth/email-verification/confirm` | ✅ JWT | Valida el código de 6 dígitos. Activa la cuenta. Máx. 5 intentos fallidos.    | [→](api/auth/email-verification.md) |
| `POST` | `/auth/email-verification/resend`  | ✅ JWT | Reenvía el código (mismo comportamiento que `/request`).                      | [→](api/auth/email-verification.md) |


> El OTP se invalida automáticamente tras 15 minutos o 5 intentos fallidos.

---

### Recuperación de contraseña


| Método | Endpoint                | Auth      | Qué hace                                                                                                               | Doc                             |
| ------ | ----------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `POST` | `/auth/forgot-password` | ❌ Público | Envía código OTP de 6 dígitos al correo para resetear contraseña. Siempre responde 200 (no revela si el email existe). | [→](api/auth/password-reset.md) |
| `POST` | `/auth/reset-password`  | ❌ Público | Valida el OTP y establece la nueva contraseña. Revoca todas las sesiones activas.                                      | [→](api/auth/password-reset.md) |


---

### Biometría


| Método  | Endpoint          | Auth  | Qué hace                                                                                                                                                             | Doc                        |
| ------- | ----------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `PATCH` | `/auth/biometric` | ✅ JWT | Activa o desactiva la biometría del dispositivo (`face_id`, `fingerprint`, `device_pin`). Al llamarlo (activen o no), marca el onboarding como "biometría mostrada". | [→](api/auth/biometric.md) |


---

### Onboarding


| Método  | Endpoint                | Auth  | Qué hace                                                                                                                                                              | Doc                         |
| ------- | ----------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `GET`   | `/auth/onboarding`      | ✅ JWT | Retorna el estado completo del onboarding: paso actual, checkpoints completados, superficie de retoma. La app lo consulta al abrir para saber a qué pantalla navegar. | [→](api/auth/onboarding.md) |
| `PATCH` | `/auth/onboarding/step` | ✅ JWT | Actualiza el paso actual, la superficie de retoma y los checkpoints. Cuando todos los checkpoints están en `true`, el backend completa el onboarding automáticamente. | [→](api/auth/onboarding.md) |


**Pasos del onboarding:**


| Step (interno)        | Pantalla en la app             | Lo escribe                   |
| --------------------- | ------------------------------ | ---------------------------- |
| `email_verification`  | Verificar correo               | Backend (al registrar)       |
| `biometric_setup`     | Activar biometría              | Backend (al verificar email) |
| `profile_basic`       | ¿Cómo quieres que te llamemos? | App                          |
| `welcome`             | Bienvenida                     | App                          |
| `document_upload`     | Subir documentos               | App                          |
| `document_processing` | Analizando documentos          | App                          |
| `null`                | Home (completado)              | Backend (auto)               |


**Checkpoints que completan el onboarding:**


| Checkpoint                  | Quién lo activa                             |
| --------------------------- | ------------------------------------------- |
| `biometricPrompted`         | Backend — al llamar `PATCH /auth/biometric` |
| `importAttempted`           | App — al enviar documentos                  |
| `financialProfileCompleted` | Módulo de análisis (pendiente — Módulo 3)   |
| `minDocThresholdMet`        | Módulo de análisis (pendiente — Módulo 3)   |


> ⚠️ Mientras los Módulos 3/4 no estén listos, el onboarding **no puede auto-completarse**. El usuario puede llegar a Home con `resumeSurface: 'home'` pero el estado no pasará a `completed`.

---

## Módulo 2 — Perfil y Suscripciones

### Perfil de usuario


| Método  | Endpoint             | Auth  | Qué hace                                                                                                                               | Doc                       |
| ------- | -------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `GET`   | `/users/me`          | ✅ JWT | Retorna los datos públicos del usuario: nombre, apellido, email, username, avatar, documento, estado de verificación, fecha de prueba. | [→](api/users/me.md)      |
| `PATCH` | `/users/me`          | ✅ JWT | Actualiza `firstName`, `lastName`, `username` y/o `avatarUrl`.                                                                         | [→](api/users/me.md)      |
| `PATCH` | `/users/profile`     | ✅ JWT | Igual a `/users/me` pero orientado al paso de onboarding "¿Cómo te llamamos?". Acepta `firstName`, `lastName`, `username`.             | [→](api/users/profile.md) |
| `PATCH` | `/users/me/password` | ✅ JWT | Cambia la contraseña usando la contraseña actual. Revoca todas las sesiones activas (el usuario debe volver a iniciar sesión).         | [→](api/users/me.md)      |


> El correo electrónico **no se puede cambiar** desde la app en el MVP. Es inmutable después del registro.

---

### Suscripciones


| Método | Endpoint                  | Auth      | Qué hace                                                                                                                                           | Doc                                     |
| ------ | ------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `GET`  | `/subscriptions/plans`    | ❌ Público | Lista los planes disponibles con precio, intervalo de cobro y beneficios. Disponible sin iniciar sesión (para mostrar pricing antes del registro). | [→](api/subscriptions/subscriptions.md) |
| `GET`  | `/subscriptions/me`       | ✅ JWT     | Retorna la suscripción activa del usuario autenticado. Si no tiene suscripción, retorna `null`.                                                    | [→](api/subscriptions/subscriptions.md) |
| `POST` | `/subscriptions/checkout` | ✅ JWT     | Inicia el proceso de pago. Retorna la URL de Flow donde el usuario completa el pago.                                                               | [→](api/subscriptions/subscriptions.md) |
| `POST` | `/subscriptions/webhook`  | ❌ Flow    | Endpoint interno — Flow notifica al backend cuando el pago se confirma. Activa la suscripción automáticamente.                                     | [→](api/subscriptions/subscriptions.md) |


**Planes actuales:**


| Plan                        | Precio      | Ciclo   | Ahorro vs mensual  |
| --------------------------- | ----------- | ------- | ------------------ |
| Pro Mensual (`pro_monthly`) | $5.000 CLP  | Mensual | —                  |
| Pro Anual (`pro_annual`)    | $50.000 CLP | Anual   | $10.000 CLP al año |


> Los precios son configurables sin tocar código (variables de entorno). Un cambio de precio solo requiere actualizar la configuración y reiniciar el servidor.

---

## Pendiente — Módulo 2

Las siguientes funcionalidades están identificadas como deuda técnica. No tienen pantalla de diseño aprobada o dependen de módulos posteriores.


| Funcionalidad                                        | Por qué está pendiente                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Perfil financiero (`GET/PUT /profile/financial`)     | Sin pantalla aprobada por diseño. La entidad en DB está lista.                                                |
| Metas financieras (`GET/POST /profile/goals`)        | Diseño en borrador. Regla de negocio sin definir (¿una o varias metas activas?).                              |
| Alertas y notificaciones (`GET/PUT /profile/alerts`) | Sin pantalla asignada. Depende del worker de notificaciones.                                                  |
| Worker de notificaciones                             | Canales de envío no definidos para MVP (`push` requiere FCM/APNs).                                            |
| Backoffice — gestión de usuarios                     | Sin prioridad MVP frontend. Endpoints `PATCH /admin/users/:id/status` y `DELETE /admin/users/:id` pendientes. |


Para el detalle completo de la deuda técnica, ver el documento de trabajo del equipo de backend.

---

## Referencia rápida — Seguridad y reglas de negocio


| Regla                 | Detalle                                                  |
| --------------------- | -------------------------------------------------------- |
| **Contraseña**        | Mínimo 8 caracteres, al menos una mayúscula y un número  |
| **OTP**               | 6 dígitos numéricos, válido 15 minutos, máx. 5 intentos  |
| **Access token**      | JWT, expira en 15 minutos                                |
| **Refresh token**     | Opaco, expira en 30 días, de un solo uso (se rota)       |
| **Período de prueba** | 14 días desde el registro (configurable)                 |
| **RUT**               | Validación modulo-11. Formato: `12345678-5` (sin puntos) |
| **Soft-delete**       | Las cuentas nunca se borran físicamente del sistema      |


---

## Documentación detallada por endpoint

```
docs/
├── README.md                        ← este archivo (índice)
├── api/
│   ├── auth/
│   │   ├── register.md
│   │   ├── login.md
│   │   ├── refresh.md
│   │   ├── logout.md
│   │   ├── logout-all.md
│   │   ├── email-verification.md
│   │   ├── password-reset.md
│   │   ├── biometric.md
│   │   └── onboarding.md
│   ├── users/
│   │   ├── me.md
│   │   └── profile.md
│   └── subscriptions/
│       └── subscriptions.md
├── postman/
│   └── Walvy-Modulo1.postman_collection.json   ← colección lista para importar
└── sql/
    └── dev-queries.md               ← queries útiles para debugging en pgAdmin
```

