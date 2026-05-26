# SQL Queries — Desarrollo

Queries de uso frecuente durante desarrollo y pruebas. Ejecutar en pgAdmin → Query Tool.

---

## Usuarios

### Ver usuario por email
```sql
SELECT
    user_id,
    email,
    first_name,
    last_name,
    username,
    email_verified_at,
    user_status_id,
    deleted_at,
    created_at
FROM app_user
WHERE email = 'test@example.com';
```

### Ver todos los usuarios (sin borrados)
```sql
SELECT
    user_id,
    email,
    first_name,
    last_name,
    username,
    email_verified_at IS NOT NULL AS email_verified,
    created_at
FROM app_user
WHERE deleted_at IS NULL
ORDER BY created_at DESC;
```

### Ver usuarios con soft-delete
```sql
SELECT user_id, email, deleted_at
FROM app_user
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;
```

### Resumen completo de un usuario (JOIN todas las tablas módulo 1)
```sql
SELECT
    u.user_id,
    u.email,
    u.first_name,
    u.last_name,
    u.username,
    u.email_verified_at IS NOT NULL   AS email_verified,
    s.code                            AS user_status,
    o.onboarding_status,
    o.current_step,
    o.resume_surface,
    o.biometric_prompted,
    o.import_attempted,
    o.financial_profile_completed,
    b.enabled                         AS biometric_enabled,
    b.method                          AS biometric_method,
    g.total_points,
    g.level,
    u.trial_ends_at,
    u.created_at
FROM app_user u
LEFT JOIN status           s ON s.status_id    = u.user_status_id
LEFT JOIN user_onboarding_state o ON o.user_id = u.user_id
LEFT JOIN biometric_preferences b ON b.user_id = u.user_id
LEFT JOIN user_gamification_stats g ON g.user_id = u.user_id
WHERE u.email = 'test@example.com';
```

### Borrar usuario completo (todas las tablas)
```sql
DO $$
DECLARE v_id UUID;
BEGIN
    SELECT user_id INTO v_id FROM app_user WHERE email = 'test@example.com';

    DELETE FROM refresh_tokens             WHERE user_id = v_id;
    DELETE FROM email_verification_tokens  WHERE user_id = v_id;
    DELETE FROM password_reset_tokens      WHERE user_id = v_id;
    DELETE FROM user_gamification_stats    WHERE user_id = v_id;
    DELETE FROM user_onboarding_state      WHERE user_id = v_id;
    DELETE FROM biometric_preferences      WHERE user_id = v_id;
    DELETE FROM app_user                   WHERE user_id = v_id;

    RAISE NOTICE 'Usuario % eliminado', v_id;
END $$;
```

### Restaurar usuario con soft-delete
```sql
UPDATE app_user
SET deleted_at = NULL
WHERE email = 'test@example.com';
```

---

## Onboarding

### Ver estado de onboarding de un usuario
```sql
SELECT
    o.*
FROM user_onboarding_state o
JOIN app_user u ON u.user_id = o.user_id
WHERE u.email = 'test@example.com';
```

### Resetear onboarding (para re-testear el flujo desde cero)
```sql
DO $$
DECLARE v_id UUID;
BEGIN
    SELECT user_id INTO v_id FROM app_user WHERE email = 'test@example.com';

    UPDATE user_onboarding_state SET
        onboarding_status          = 'not_started',
        current_step               = 'email_verification',
        resume_surface             = NULL,
        resume_context             = NULL,
        financial_profile_completed = false,
        goals_set                  = false,
        import_attempted           = false,
        biometric_prompted         = false,
        min_doc_threshold_met      = false,
        completed_at               = NULL
    WHERE user_id = v_id;

    UPDATE app_user SET email_verified_at = NULL WHERE user_id = v_id;

    RAISE NOTICE 'Onboarding reseteado para %', v_id;
END $$;
```

### Forzar email como verificado (saltar OTP en pruebas)
```sql
UPDATE app_user
SET email_verified_at = NOW()
WHERE email = 'test@example.com';

UPDATE user_onboarding_state
SET onboarding_status = 'in_progress',
    current_step      = 'biometric_setup'
WHERE user_id = (SELECT user_id FROM app_user WHERE email = 'test@example.com');
```

---

## Sesiones / Tokens

### Ver código OTP de recuperación de contraseña activo
```sql
SELECT
    token_hash,
    expires_at,
    used_at,
    attempts,
    created_at
FROM password_reset_tokens
WHERE user_id = (SELECT user_id FROM app_user WHERE email = 'test@example.com')
ORDER BY created_at DESC;
```

### Limpiar código de recuperación (forzar re-solicitud)
```sql
DELETE FROM password_reset_tokens
WHERE user_id = (SELECT user_id FROM app_user WHERE email = 'test@example.com');
```

### Ver refresh tokens activos de un usuario
```sql
SELECT
    token_hash,
    expires_at,
    revoked_at,
    created_at
FROM refresh_tokens
WHERE user_id = (SELECT user_id FROM app_user WHERE email = 'test@example.com')
ORDER BY created_at DESC;
```

### Revocar todas las sesiones de un usuario (sin borrarlas)
```sql
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE user_id  = (SELECT user_id FROM app_user WHERE email = 'test@example.com')
  AND revoked_at IS NULL;
```

### Limpiar tokens expirados y revocados (limpieza de tabla)
```sql
DELETE FROM refresh_tokens
WHERE revoked_at IS NOT NULL
   OR expires_at < NOW();
```

### Ver tokens OTP de verificación activos
```sql
SELECT
    e.email,
    e.expires_at,
    e.used_at,
    e.attempts,
    e.created_at
FROM email_verification_tokens e
WHERE user_id = (SELECT user_id FROM app_user WHERE email = 'test@example.com')
ORDER BY created_at DESC;
```

### Invalidar OTP activo (forzar re-solicitud)
```sql
UPDATE email_verification_tokens
SET used_at = NOW()
WHERE user_id  = (SELECT user_id FROM app_user WHERE email = 'test@example.com')
  AND used_at IS NULL;
```

---

## Catálogo / Seeds

### Ver todos los estados de usuario disponibles
```sql
SELECT status_id, code, name, domain
FROM status
WHERE domain = 'user'
ORDER BY status_id;
```

### Ver roles disponibles
```sql
SELECT role_id, code, name
FROM role
ORDER BY role_id;
```

### Ver tipos de documento
```sql
SELECT document_type_id, code, name, validation_regex
FROM document_type
ORDER BY document_type_id;
```

### Ver configuración global (app_config)
```sql
SELECT key, value, description
FROM app_config
ORDER BY key;
```

---

## Diagnóstico

### Contar usuarios por estado
```sql
SELECT
    s.code    AS estado,
    COUNT(u.user_id) AS total
FROM app_user u
JOIN status s ON s.status_id = u.user_status_id
WHERE u.deleted_at IS NULL
GROUP BY s.code
ORDER BY total DESC;
```

### Usuarios registrados hoy
```sql
SELECT user_id, email, created_at
FROM app_user
WHERE created_at >= CURRENT_DATE
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

### Ver sesiones activas (tokens no revocados y no expirados)
```sql
SELECT
    u.email,
    r.created_at AS session_start,
    r.expires_at
FROM refresh_tokens r
JOIN app_user u ON u.user_id = r.user_id
WHERE r.revoked_at IS NULL
  AND r.expires_at > NOW()
ORDER BY r.created_at DESC;
```
