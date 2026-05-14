# Onboarding — GET y PATCH

Endpoints para leer y actualizar el estado del flujo de onboarding del usuario.

**Auth:** Requerida — Bearer access token.

---

## Registry de steps

Valores válidos de `current_step`. La columna es `VARCHAR(80)` — el backend no valida el valor, pero estos son los únicos reconocidos por app y backend.

| `current_step` | Quién lo escribe | Checkpoint asociado |
|---|---|---|
| `email_verification` | Backend — `register()` | — |
| `biometric_setup` | Backend — `confirmEmailVerification()` | — |
| `profile_basic` | App | `biometric_prompted = true` |
| `welcome` | App | — |
| `document_upload` | App | — |
| `document_processing` | App | `import_attempted = true` |
| `null` | Backend — auto-completion | todos los checkpoints |

> **Escalabilidad:** Un nuevo step sin checkpoint propio no requiere cambio de backend — la app lo envía en `PATCH /auth/onboarding/step` y el backend lo persiste.

---

## GET /auth/onboarding

Retorna el estado completo del onboarding. La app lo consulta al abrir para decidir a qué pantalla navegar.

**URL:** `GET /auth/onboarding`

### Lógica de navegación (frontend)

```
onboarding_status == 'completed'  → Home (tabs)
resume_surface == 'home'          → Home (tabs)
resume_surface == 'onboarding'    → pantalla correspondiente a current_step
resume_surface == null            → primer acceso post-registro: email_verification
```

### Response 200

```json
{
  "onboardingStatus": "in_progress",
  "currentStep": "document_upload",
  "resumeSurface": "home",
  "resumeContext": { "pendingStep": "document_upload" },
  "financialProfileCompleted": false,
  "goalsSet": false,
  "importAttempted": false,
  "biometricPrompted": true,
  "minDocThresholdMet": false,
  "completedAt": null
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `onboardingStatus` | `string` | `not_started`, `in_progress`, `completed` |
| `currentStep` | `string \| null` | Paso activo — ver registry arriba |
| `resumeSurface` | `string \| null` | `onboarding`, `home`, o `null` en primer acceso |
| `resumeContext` | `object \| null` | Datos para retomar (JSON libre) |
| `financialProfileCompleted` | `boolean` | Marcado por el módulo de análisis al finalizar |
| `goalsSet` | `boolean` | Pendiente de asignación en el flujo UI |
| `importAttempted` | `boolean` | Marcado al enviar documentos a análisis |
| `biometricPrompted` | `boolean` | Marcado al salir de la pantalla de biometría (activa o salta) |
| `minDocThresholdMet` | `boolean` | Marcado por el módulo de análisis |
| `completedAt` | `string \| null` | Fecha en que el onboarding quedó `completed` |

### Errores

| Status | Cuándo |
|---|---|
| `401` | Access token ausente o expirado |
| `404` | No existe registro de onboarding para el usuario |

---

## PATCH /auth/onboarding/step

Actualiza uno o varios campos del estado. Solo los campos enviados son modificados.

**URL:** `PATCH /auth/onboarding/step`

Cuando `biometricPrompted`, `importAttempted`, `financialProfileCompleted` y `minDocThresholdMet` son todos `true`, el backend avanza automáticamente a `onboardingStatus = completed`, limpia `currentStep` y pone `resumeSurface = home`.

### Body (todos opcionales)

| Campo | Tipo | Descripción |
|---|---|---|
| `currentStep` | `string` | Valor del registry de steps |
| `resumeSurface` | `string` | `onboarding` o `home` |
| `resumeContext` | `object` | JSON libre para retoma |
| `importAttempted` | `boolean` | `true` al enviar documentos a análisis |
| `biometricPrompted` | `boolean` | Reservado — lo escribe `PATCH /auth/biometric` automáticamente |
| `financialProfileCompleted` | `boolean` | Reservado — lo escribe el módulo de análisis |
| `minDocThresholdMet` | `boolean` | Reservado — lo escribe el módulo de análisis |
| `goalsSet` | `boolean` | Pendiente de asignación en el flujo UI |

### Ejemplos

**Al tocar "¡Comencemos!" en Welcome:**
```json
{ "currentStep": "document_upload", "resumeSurface": "onboarding" }
```

**Al salir desde Welcome o Carga de docs ("Guardar y salir" / "Continuar más tarde"):**
```json
{
  "currentStep": "document_upload",
  "resumeSurface": "home",
  "resumeContext": { "pendingStep": "document_upload" }
}
```

**Al enviar documentos (entra a Analizando):**
```json
{
  "currentStep": "document_processing",
  "resumeSurface": "onboarding",
  "importAttempted": true
}
```

**Al salir desde Analizando — "Vuelvo después":**
```json
{
  "currentStep": "document_processing",
  "resumeSurface": "home",
  "resumeContext": { "jobId": "job-uuid-123" }
}
```

### Response 200

Estado completo actualizado (misma estructura que `GET /auth/onboarding`).

### Errores

| Status | Cuándo |
|---|---|
| `400` | Body inválido (tipo incorrecto) |
| `401` | Access token ausente o expirado |
| `404` | No existe registro de onboarding |

---

## Flujo completo de integración

```
1. POST /auth/register
   ← { nextStep: 'email_verification' }
   → navegar a email_verification

2. POST /auth/email-verification/confirm
   ← 200
   → GET /auth/onboarding → { currentStep: 'biometric_setup' }
   → navegar a biometric_setup

3. PATCH /auth/biometric { enabled: true/false, method?, deviceId? }
   ← 200  (biometric_prompted = true automático)
   → PATCH /auth/onboarding/step { currentStep: 'profile_basic', resumeSurface: 'onboarding' }
   → navegar a profile_basic

4. PATCH /users/profile { firstName?, lastName?, username? }
   ← 200
   → PATCH /auth/onboarding/step { currentStep: 'welcome', resumeSurface: 'onboarding' }
   → navegar a welcome

5a. [Toca "¡Comencemos!"]
   → PATCH /auth/onboarding/step { currentStep: 'document_upload', resumeSurface: 'onboarding' }
   → navegar a document_upload

5b. [Toca "Continuar más tarde" desde welcome o document_upload]
   → PATCH /auth/onboarding/step { currentStep: 'document_upload', resumeSurface: 'home',
                                    resumeContext: { pendingStep: 'document_upload' } }
   → navegar a Home

6. [Envía documentos]
   → PATCH /auth/onboarding/step { currentStep: 'document_processing',
                                    resumeSurface: 'onboarding', importAttempted: true }
   → navegar a document_processing

7a. [Análisis completa — módulo cashflow marca financial_profile_completed + min_doc_threshold_met]
   → onboarding_status = completed automático
   → GET /auth/onboarding → { onboardingStatus: 'completed', resumeSurface: 'home' }
   → navegar a Home

7b. [Sale desde Analizando — "Vuelvo después"]
   → PATCH /auth/onboarding/step { currentStep: 'document_processing',
                                    resumeSurface: 'home', resumeContext: { jobId: '...' } }
   → navegar a Home (análisis sigue en servidor)
```
