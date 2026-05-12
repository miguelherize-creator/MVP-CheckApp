# Onboarding — GET y PATCH

Endpoints para leer y actualizar el estado del flujo de onboarding del usuario.

**Auth:** Requerida en ambos endpoints — Bearer access token.

---

## GET /auth/onboarding

Retorna el estado actual del onboarding. La app lo consulta al abrirse para saber si debe mostrar el flujo pendiente.

### Response 200

```json
{
  "onboardingStatus": "in_progress",
  "currentStep": "goals",
  "resumeSurface": "onboarding",
  "resumeContext": null,
  "financialProfileCompleted": true,
  "goalsSet": false,
  "importAttempted": false,
  "biometricPrompted": false,
  "minDocThresholdMet": false,
  "completedAt": null
}
```

| Campo                       | Tipo               | Descripción                                                    |
|-----------------------------|--------------------|----------------------------------------------------------------|
| `onboardingStatus`          | `string`           | `not_started`, `in_progress`, `completed`                      |
| `currentStep`               | `string \| null`   | Paso activo: `email_verification`, `profile`, `goals`, `import`, `biometric` |
| `resumeSurface`             | `string \| null`   | Pantalla donde retomar: `onboarding`, `home`                   |
| `resumeContext`             | `object \| null`   | Datos extra para retomar (libre)                               |
| `financialProfileCompleted` | `boolean`          | Paso 2 completado                                              |
| `goalsSet`                  | `boolean`          | Paso 3 completado                                              |
| `importAttempted`           | `boolean`          | Paso 4 completado                                              |
| `biometricPrompted`         | `boolean`          | Paso 5 completado (también se marca en `PATCH /auth/biometric`)|
| `minDocThresholdMet`        | `boolean`          | Documentos mínimos cargados                                    |
| `completedAt`               | `string \| null`   | Fecha de completion del onboarding                             |

### Errores

| Status | Cuándo ocurre                          |
|--------|----------------------------------------|
| `401`  | Access token ausente o expirado.       |
| `404`  | No existe registro de onboarding para el usuario. |

---

## PATCH /auth/onboarding/step

Actualiza uno o varios campos del estado del onboarding. Solo los campos enviados son modificados.

Cuando `financialProfileCompleted`, `goalsSet`, `importAttempted`, `biometricPrompted` y `minDocThresholdMet` son todos `true`, el backend avanza automáticamente a `onboardingStatus = completed`.

### Body

Todos los campos son opcionales:

| Campo                       | Tipo      | Descripción                                         |
|-----------------------------|-----------|-----------------------------------------------------|
| `currentStep`               | `string`  | Paso al que avanzó el usuario                       |
| `resumeSurface`             | `string`  | Pantalla donde retomar si el usuario abandona       |
| `resumeContext`             | `object`  | Contexto extra (JSON libre)                         |
| `financialProfileCompleted` | `boolean` | Marcar perfil financiero como completado            |
| `goalsSet`                  | `boolean` | Marcar metas como declaradas                        |
| `importAttempted`           | `boolean` | Marcar que intentó importar cartola                 |
| `biometricPrompted`         | `boolean` | Marcar que activó biometría                         |
| `minDocThresholdMet`        | `boolean` | Marcar que alcanzó el mínimo de documentos          |

### Ejemplo — avanzar al paso 3

```json
{
  "financialProfileCompleted": true,
  "currentStep": "goals",
  "resumeSurface": "onboarding"
}
```

### Ejemplo — guardar progreso al abandonar

```json
{
  "currentStep": "goals",
  "resumeSurface": "onboarding",
  "resumeContext": { "scrollPosition": 240 }
}
```

### Response 200

Retorna el estado actualizado (misma estructura que `GET /auth/onboarding`).

### Errores

| Status | Cuándo ocurre                          |
|--------|----------------------------------------|
| `400`  | Body inválido (tipo incorrecto).        |
| `401`  | Access token ausente o expirado.        |
| `404`  | No existe registro de onboarding.       |

---

## Flujo de referencia

```
App abre
  ↓
GET /auth/onboarding
  ↓ { onboardingStatus: "in_progress", currentStep: "goals", resumeSurface: "onboarding" }
App navega directamente al paso "goals"

Usuario completa metas
  ↓
PATCH /auth/onboarding/step { goalsSet: true, currentStep: "import", resumeSurface: "onboarding" }
  ↓ 200 { ..., goalsSet: true, currentStep: "import" }
App navega al paso "import"

...todos los checkpoints en true...
  ↓
Backend retorna { onboardingStatus: "completed", resumeSurface: "home" }
App navega a Home
```

---

## Pasos del flujo

| # | Step              | Checkpoint                    | Quién lo marca                        |
|---|-------------------|-------------------------------|---------------------------------------|
| 1 | `email_verification` | `email_verified_at` en user  | `POST /auth/email-verification/confirm` |
| 2 | `profile`         | `financialProfileCompleted`   | `PATCH /auth/onboarding/step`         |
| 3 | `goals`           | `goalsSet`                    | `PATCH /auth/onboarding/step`         |
| 4 | `import`          | `importAttempted`             | `PATCH /auth/onboarding/step`         |
| 5 | `biometric`       | `biometricPrompted`           | `PATCH /auth/biometric` (automático)  |
