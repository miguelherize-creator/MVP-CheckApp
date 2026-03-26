# CheckApp — API (MVP auth)

API **REST** en **NestJS** + **PostgreSQL** para registro, login, refresh token, recuperación y cambio de contraseña. Documentación interactiva en **`/api`** (Swagger).

## Requisitos

- Node.js 18+
- PostgreSQL 14+ (o Docker)

## Configuración

1. Copia variables de entorno:

   ```bash
   cp .env.example .env
   ```

2. Ajusta `DATABASE_URL`, `JWT_SECRET` y, si aplica, `PASSWORD_RESET_URL_TEMPLATE` (debe incluir `{{token}}` para el enlace de recuperación).

3. Levanta PostgreSQL (ejemplo con Docker):

   ```bash
   docker compose up -d
   ```

4. En **desarrollo**, TypeORM crea tablas automáticamente (`synchronize` activo si `NODE_ENV !== production`). En **producción** desactiva `synchronize` y usa migraciones.

## Scripts

| Comando        | Descripción        |
|----------------|--------------------|
| `npm run start:dev` | Desarrollo con hot reload |
| `npm run build`     | Compilar            |
| `npm run start:prod`| Ejecutar `dist/`    |

## Contraseñas (validación)

- Mínimo **8** caracteres.
- Al menos una **mayúscula**, una **minúscula** y un **número**.

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/register` | Registro |
| `POST` | `/auth/login` | Login (límite 5 req/min) |
| `POST` | `/auth/refresh` | Nuevo access token |
| `POST` | `/auth/logout` | Revoca refresh token |
| `POST` | `/auth/forgot-password` | Solicita reset (respuesta genérica; límite 5 req/min) |
| `POST` | `/auth/reset-password` | Token + nueva contraseña |
| `GET` | `/users/me` | Perfil (Bearer JWT) |
| `PATCH` | `/users/me` | Actualizar nombre/email |
| `PATCH` | `/users/me/password` | Cambiar contraseña |

## Prueba rápida con curl

```bash
# Registro
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test\",\"email\":\"test@example.com\",\"password\":\"Abcd1234\",\"acceptTerms\":true}"

# Login
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"Abcd1234\"}"
```

## Convenciones

- Mensajes de error en **español** donde aplica.
- Errores HTTP: filtro global devuelve `statusCode`, `message`, `path`, `timestamp`.

## Swagger

Con el servidor en marcha: [http://localhost:3000/api](http://localhost:3000/api)
