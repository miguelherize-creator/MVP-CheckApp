# Módulo 2 — Casos de Uso

**Módulo:** Perfil y Configuración  
**Fuente de verdad MVP:** `MVP_Walvy_VF_10032026_alineado_estrategia - Alcance MVP.csv` — Módulo 2

**Actores:**
- **Usuario** — persona que usa la app Walvy
- **Sistema** — procesos automáticos del backend (jobs, workers)
- **Administrador** — operador del backoffice (solo para configuración de defaults)

---

## CU-01 — Completar perfil financiero (onboarding)

**Actor principal:** Usuario  
**Precondiciones:** Usuario con `user_onboarding_state.current_step = 'profile'` (avanzó desde la verificación de email).

### Flujo principal

```
1. App muestra pantalla "Cuéntanos sobre tu situación financiera".
2. Usuario ingresa:
   a. Ingreso mensual estimado.
   b. Nota de gastos fijos (opcional — ej: "arriendo + colegiaturas").
   c. Moneda (pre-rellena con app_user.default_currency_id).
3. Sistema hace upsert en user_financial_profile.
4. Sistema calcula estimated_payment_capacity = income - estimación de gastos.
5. Sistema actualiza user_onboarding_state.current_step = 'goals'.
6. App avanza al siguiente paso del onboarding.
```

### Flujo alternativo — El usuario omite el paso

```
2. Usuario toca "Omitir por ahora".
→ user_financial_profile no se crea (o queda con valores NULL).
→ Sistema actualiza current_step = 'goals' de todas formas.
→ Los módulos que dependen de estimated_payment_capacity muestran
   "Completa tu perfil para ver este dato" hasta que el usuario lo llene.
```

### Postcondiciones
- `user_financial_profile` existe (o queda pendiente si se omitió).
- `user_onboarding_state.current_step = 'goals'`.

---

## CU-02 — Declarar metas financieras (onboarding)

**Actor principal:** Usuario  
**Precondiciones:** `user_onboarding_state.current_step = 'goals'`.

### Flujo principal

```
1. App muestra opciones predefinidas de metas:
   - Bajar mis deudas (reduce_debt)
   - Ahorrar un monto específico (save_amount)
   - Mejorar mi capacidad de ahorro (improve_savings_capacity)
   - Evitar atrasos en pagos (avoid_late_payments)
   - Cumplir mi presupuesto (meet_budget)
   - Otro (other)
2. Usuario selecciona una o más metas.
3. Para metas cuantitativas (save_amount, reduce_debt):
   App solicita target_value (monto objetivo).
4. Sistema crea un registro en user_goals por cada meta seleccionada
   con is_active = true, declared_at = now().
5. Sistema actualiza user_onboarding_state.current_step = 'import'.
6. App avanza al siguiente paso.
```

### Flujo alternativo — El usuario no selecciona ninguna meta

```
2. Usuario toca "Continuar" sin seleccionar nada.
→ No se crean registros en user_goals.
→ El sistema avanza current_step = 'import' de todas formas.
→ La app muestra un estado vacío en "Mis metas" con CTA para agregar.
```

### Postcondiciones
- Existen registros en `user_goals` con `is_active = true` (si el usuario seleccionó metas).
- `user_onboarding_state.current_step = 'import'`.

---

## CU-03 — Actualizar perfil desde configuración

**Actor principal:** Usuario  
**Precondiciones:** Usuario con sesión activa.

### Flujo A — Actualizar alias y foto

```
1. Usuario navega a Configuración → Perfil.
2. Usuario puede editar: username, avatar_url (foto de perfil).
3. Sistema valida:
   a. username único en el sistema (UNIQUE); error 409 si ya existe.
   b. avatar_url: la app sube la imagen a S3/storage y envía solo la URL resultante.
4. Sistema actualiza app_user.
```

### Flujo D — Cambiar email de notificaciones

```
1. Usuario navega a Configuración → Perfil → "Email de notificaciones".
2. App muestra el notification_email actual (o vacío si no tiene).
3. Usuario ingresa el nuevo email de notificaciones.
4. Sistema genera código OTP y crea email_verification_tokens
   con email = nuevo_notification_email, expires_at = now() + 15 min.
5. Sistema envía el código al nuevo email.
6. App muestra pantalla "Ingresa el código que enviamos a [nuevo email]".
7. Usuario ingresa el código.
8. Sistema valida el código (mismo flujo que Módulo 1 CU-05).
9. Sistema actualiza:
   app_user.notification_email = nuevo_email
   app_user.notification_email_verified_at = now()
10. A partir de este momento, las notificaciones por email
    se envían a notification_email en lugar de app_user.email.
```

### Comportamiento mientras notification_email no está verificado

```
- notification_email_verified_at = NULL.
- El worker de notificaciones usa app_user.email como fallback.
- La app muestra badge "Pendiente de verificación" junto al email de notificaciones.
```

### Flujo B — Actualizar correo electrónico

```
1. Usuario ingresa nuevo email.
2. Sistema verifica que el email no exista en otro app_user.
3. Sistema dispara flujo de verificación de email (Módulo 1 CU-05):
   genera email_verification_token y envía código de 6 dígitos.
4. Hasta que el usuario verifique el nuevo email:
   app_user.email permanece sin cambio.
   app_user.email_verified_at se mantiene válido.
5. Al confirmar el código:
   Sistema actualiza app_user.email y app_user.email_verified_at = now().
```

### Flujo C — Cambio de contraseña

```
→ Ver Módulo 1 CU-04 (recuperar contraseña) o el flujo de
  cambio autenticado desde perfil:
  1. Usuario ingresa contraseña actual + nueva contraseña.
  2. Sistema verifica bcrypt.compare(actual, password_hash).
  3. Sistema valida política de la nueva contraseña.
  4. Sistema actualiza password_hash.
  5. Sistema NO revoca refresh tokens (el usuario sigue logueado).
```

---

## CU-04 — Configurar alertas y notificaciones

**Actor principal:** Usuario  
**Precondiciones:** Usuario con sesión activa.

### Flujo principal

```
1. Usuario navega a Configuración → Alertas.
2. App muestra bloques por tipo:
   - Presupuesto (budget_threshold)
   - Pagos (payment_due)
   - Recordatorios (weekly_reminder)
   - Semáforo (semaphore_alert)
3. Cada bloque muestra estado actual (activo/inactivo) y canal.
   Los defaults vienen de app_config si no hay preferencia guardada.
4. Usuario ajusta toggles, canales o cadencia.
5. Sistema hace upsert en alert_preferences
   (UNIQUE user_id + alert_type + channel).
6. App confirma el cambio visualmente.
```

### Flujo alternativo — Usuario desactiva todos los canales de un tipo

```
→ Sistema registra enabled = false para cada canal afectado.
→ El backend omite esa alerta al producir notificaciones para el usuario.
```

### Postcondiciones
- `alert_preferences` refleja la preferencia del usuario.
- Los defaults de `app_config` siguen vigentes para los tipos no sobreescritos.

---

## CU-05 — Recibir notificación

**Actor principal:** Sistema (worker de notificaciones)  
**Precondiciones:** Existe al menos una entrada en `notification_queue` con `sent_at IS NULL` y `scheduled_for <= now()`.

### Flujo principal

```
1. Worker consulta:
   SELECT * FROM notification_queue
   WHERE sent_at IS NULL AND scheduled_for <= now()
   ORDER BY scheduled_for
   LIMIT N
2. Para cada notificación:
   a. Verifica que alert_preferences.enabled = true para ese
      user_id + alert_type + channel (o que aplique el default).
   b. Despacha por el canal:
      - in_app: inserta en tabla de notificaciones in-app del usuario.
      - push: llama a servicio de push (FCM/APNs).
      - email: encola en servicio de email (SendGrid u otro).
   c. Actualiza sent_at = now() en notification_queue.
3. Si el despacho falla (timeout, error del proveedor):
   Deja sent_at = NULL para reintento en el siguiente ciclo.
   Registra el error en logs.
```

### Postcondiciones
- `notification_queue.sent_at` está poblado para las entradas procesadas.

---

## CU-06 — Gestionar metas desde perfil

**Actor principal:** Usuario  
**Precondiciones:** Usuario con sesión activa, al menos una meta en `user_goals`.

### Flujo A — Agregar nueva meta

```
1. Usuario navega a Perfil → Mis Metas → "Agregar meta".
2. Selecciona tipo y (si aplica) ingresa target_value.
3. Sistema crea user_goals con is_active = true.
```

### Flujo B — Desactivar meta

```
1. Usuario selecciona una meta activa y toca "Desactivar".
2. Sistema actualiza user_goals.is_active = false.
3. La meta deja de influir en recomendaciones y cálculos.
4. El histórico queda visible en "Metas pasadas".
```

### Flujo C — Ver progreso de una meta

```
1. Usuario toca una meta activa.
2. App muestra progress_cache (calculado por job periódico).
3. Si progress_cache es NULL o desactualizado:
   App muestra "Calculando..." y el job lo actualizará en el próximo ciclo.
```

---

## Resumen de Casos de Uso

| ID | Caso de uso | Actor | RF relacionado | MVP |
|----|-------------|-------|----------------|-----|
| CU-01 | Completar perfil financiero (onboarding) | Usuario | RF-02 | ✅ |
| CU-02 | Declarar metas financieras (onboarding) | Usuario | RF-03 | ✅ |
| CU-03 | Actualizar perfil desde configuración | Usuario | RF-01, RF-02 | ✅ |
| CU-04 | Configurar alertas y notificaciones | Usuario | RF-04 | ✅ |
| CU-05 | Recibir notificación (worker) | Sistema | RF-05 | ✅ |
| CU-06 | Gestionar metas desde perfil | Usuario | RF-03 | ✅ |
