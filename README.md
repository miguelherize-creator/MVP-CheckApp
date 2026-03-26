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

3. Levanta **API + PostgreSQL** con Docker (recomendado para probar igual que en servidor):

   ```bash
   docker compose up --build
   ```

   La API queda en `http://localhost:3000` (Swagger: `/api`). `DATABASE_URL` dentro del contenedor apunta al servicio `postgres`.

4. TypeORM: con `NODE_ENV=development` se sincroniza el esquema automáticamente. En **producción** (`NODE_ENV=production`) la sincronización está **desactivada** por defecto. Mientras no tengas migraciones, puedes usar **`DB_SYNC=true`** solo como parche temporal en el primer deploy; luego quítala y usa migraciones.

## Docker (imagen de producción)

- **`Dockerfile`**: build multi-stage; ejecuta `node dist/main.js` con usuario no root y `dumb-init`.
- **`.dockerignore`**: reduce contexto de build.

Construir y ejecutar solo la imagen (necesitas una `DATABASE_URL` alcanzable):

```bash
docker build -t checkapp-api .
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  -e DB_SYNC=true \
  checkapp-api
```

## Deploy en Render (Docker)

1. Crea un **Web Service** con **Docker** y define:
   - **Dockerfile path:** `backend/Dockerfile`
   - **Docker build context:** `backend`
2. Crea **PostgreSQL** y asigna `DATABASE_URL` al servicio (o usa el blueprint `render.yaml` en la raíz del repo).
3. Variables mínimas: `JWT_SECRET`, `DATABASE_URL`, `NODE_ENV=production`. Opcional: `CORS_ORIGIN`, `PASSWORD_RESET_URL_TEMPLATE`.
4. Si aún no hay migraciones, añade temporalmente `DB_SYNC=true` en el dashboard; cuando existan migraciones, elimínala.

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
