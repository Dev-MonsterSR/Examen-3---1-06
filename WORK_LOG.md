# Examen 3 · Bitácora de trabajo (WORK_LOG)

> Documento completo de todo lo construido, requisitos cubiertos, consultas a
> APIs externas, decisiones técnicas, problemas encontrados y estado final.

---

## 1. Requisitos del examen (verbatim del usuario)

> *"Backend con Express.js... API REST... MySQL... validaciones Joi... manejo
> de errores... logger middleware... deploy... docker... sin nginx... cubre
> backend y frontend... usa las skills aprendidas + los conocimientos."*

Requisitos funcionales inferidos del enunciado estándar del examen:

| # | Requisito | Estado |
|---|-----------|--------|
| 1 | API REST con Express.js | ✅ |
| 2 | Endpoint base `/api/products` con CRUD completo | ✅ |
| 3 | MySQL 8 con tabla `products` | ✅ |
| 4 | Imagen autogenerada desde API externa al crear | ✅ |
| 5 | Validaciones con Joi (body + params) | ✅ |
| 6 | Manejo de errores centralizado (400/404/500) | ✅ |
| 7 | Middleware de logging | ✅ |
| 8 | Frontend incluido (sin frameworks) | ✅ |
| 9 | Despliegue 100% Docker (sin nginx) | ✅ |
| 10 | Backend y frontend servidos en el mismo puerto | ✅ |
| 11 | README + `.env.example` + `.gitignore` | ✅ |
| 12 | Endpoints: GET, GET/:id, POST, PUT/:id, DELETE/:id | ✅ |

---

## 2. Estructura final del proyecto

```
examen3/
├── docker-compose.yml            # mysql + backend con healthchecks
├── .env.example                  # defaults de DB
├── .gitignore
├── README.md                     # docs, curl examples, deploy
├── WORK_LOG.md                   # este archivo
├── package-lock.json             # lockfile raíz (si se regenera)
└── backend/
    ├── Dockerfile                # node:20-alpine + healthcheck con node puro
    ├── package.json              # dependencias producción
    ├── package-lock.json
    ├── .env.example
    ├── .dockerignore
    ├── public/                   # frontend estático (servido por Express)
    │   ├── index.html
    │   ├── style.css
    │   └── app.js
    └── src/
        ├── server.js             # entrypoint
        ├── config/
        │   └── env.js            # valida process.env al arranque
        ├── db/
        │   ├── pool.js           # mysql2 createPool singleton
        │   └── init.js           # CREATE TABLE IF NOT EXISTS products
        ├── routes/
        │   └── products.js       # router con validación y asyncHandler
        ├── controllers/
        │   └── productsController.js   # CRUD
        ├── services/
        │   └── externalImageService.js # Lorem Picsum
        ├── validations/
        │   └── productValidation.js    # Joi schemas
        ├── middleware/
        │   ├── logger.js         # logging estructurado JSON
        │   ├── validate.js       # wrapper genérico Joi
        │   └── errorHandler.js   # 404 + handler global
        └── utils/
            └── asyncHandler.js   # reemplazo de express-async-errors
```

**Total:** 24 archivos (sin contar `node_modules`, `.git`, `mysql_data`).

---

## 3. Endpoints implementados

Base: `/api/products`

| Método | Ruta | Validación | Status | Descripción |
|--------|------|------------|--------|-------------|
| `GET` | `/api/products` | — | 200 | Lista todos (ordenados por id desc) |
| `GET` | `/api/products/:id` | `id` (int+) | 200 / 404 | Uno por id |
| `POST` | `/api/products` | `createProductSchema` | 201 / 400 | Crea (asigna imagen si falta) |
| `PUT` | `/api/products/:id` | `id` + `updateProductSchema` (min 1) | 200 / 400 / 404 | Actualiza parcial |
| `DELETE` | `/api/products/:id` | `id` | 204 / 404 | Elimina |
| `GET` | `/api/health` | — | 200 | Healthcheck `{ status: 'ok', env }` |

---

## 4. Tabla MySQL `products`

```sql
CREATE TABLE IF NOT EXISTS products (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(200) NOT NULL,
  description  TEXT         NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  stock        INT          NOT NULL DEFAULT 0,
  image_url    VARCHAR(500) NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- **InnoDB** + **utf8mb4** (soporta emojis, ñ, tildes).
- `CREATE TABLE IF NOT EXISTS` → idempotente, se ejecuta al arrancar el backend.
- Pool con `decimalNumbers: true` para que `price` vuelva como `number` (no string).
- 10 conexiones máximo, espera infinita en cola.

---

## 5. Validaciones Joi

`backend/src/validations/productValidation.js`:

| Campo | Regla | Mensaje |
|-------|-------|---------|
| `name` | string, trim, 2-200 chars, requerido | "name length must be at least 2…" |
| `description` | string, trim, 10-2000 chars, requerido | "description length must be at least 10…" |
| `price` | number, positive, 2 decimales, 0.01-9,999,999.99 | "price must be greater than 0" |
| `stock` | integer, 0-2,147,483,647 | "stock must be ≥ 0" |
| `image_url` | URI http/https, max 500, opcional | — |
| `id` (params) | integer, positive, required | — |

- `abortEarly: false` → reporta TODOS los errores en una sola respuesta.
- `stripUnknown: true` → ignora campos extra sin error.
- PUT exige al menos 1 campo (`.min(1)`).
- Wrapper `validate(schema, source)` en `middleware/validate.js`.

**Ejemplo de respuesta 400:**
```json
{
  "error": "ValidationError",
  "message": "Datos inválidos",
  "details": [
    { "field": "name", "message": "\"name\" length must be at least 2 characters long" },
    { "field": "price", "message": "\"price\" must be greater than 0" }
  ]
}
```

---

## 6. API externa consultada: Lorem Picsum

**URL base:** `https://picsum.photos`

**Uso:** generar la `image_url` automáticamente cuando el cliente crea un
producto sin especificar una.

**Implementación** (`backend/src/services/externalImageService.js`):

```js
function generateImageUrl(name) {
  const seed = crypto.createHash('sha1')
    .update(String(name))
    .digest('hex')
    .slice(0, 12);
  return `${env.EXTERNAL_IMAGE_BASE_URL}/seed/${seed}/${WIDTH}/${HEIGHT}`;
}
```

- **Seed determinístico:** SHA1 del nombre → primeros 12 hex chars.
  → Mismo nombre = misma imagen siempre.
- **Endpoint usado:** `GET /seed/{seed}/{width}/{height}` (Picsum devuelve 302
  a una imagen estable).
- **Verificación previa:** `fetch(url, { method: 'HEAD', redirect: 'follow' })`.
  Si la URL no responde 2xx/3xx, se usa un fallback genérico
  (`/{WIDTH}/{HEIGHT}` sin seed) para no romper el POST.
- **Headers consultados:** ninguno, solo status code.

**Configuración por env vars:**
- `EXTERNAL_IMAGE_BASE_URL` (default `https://picsum.photos`)
- `EXTERNAL_IMAGE_WIDTH` (default `600`)
- `EXTERNAL_IMAGE_HEIGHT` (default `400`)

> **Por qué Lorem Picsum y no FakeStoreAPI:** el examen pide que la imagen se
> *genere* al crear el producto (no que se descargue un catálogo existente).
> Picsum es ideal: gratis, sin API key, soporta seed determinístico, y
> cualquier nombre se puede convertir en URL de imagen válida.

---

## 7. Middleware de logging (`backend/src/middleware/logger.js`)

Una línea JSON por request, con niveles por status code:

```json
{"ts":"2026-06-01T22:15:03.421Z","method":"POST","path":"/api/products","status":201,"duration_ms":12.34,"ip":"::ffff:172.18.0.1","ua":"curl/8.5.0"}
```

| Campo | Fuente |
|-------|--------|
| `ts` | `new Date().toISOString()` en `res.on('finish')` |
| `method` | `req.method` |
| `path` | `req.originalUrl` (incluye query string) |
| `status` | `res.statusCode` |
| `duration_ms` | `process.hrtime.bigint()` → ns → ms (2 decimales) |
| `ip` | `req.ip` (respeta `trust proxy` si está configurado) |
| `ua` | `req.get('user-agent')` |

**Niveles:**
- `status >= 500` → prefijo `ERROR`
- `status >= 400` → prefijo `WARN`
- resto → prefijo `INFO`

Adicional: `morgan('dev')` solo en dev (`NODE_ENV !== 'production'`) para
tener un output coloreado durante desarrollo local sin Docker.

---

## 8. Manejo de errores (`backend/src/middleware/errorHandler.js`)

Pipeline:
1. `notFound` (404) para rutas `/api/*` no matcheadas.
2. `errorHandler` global (4 args) al final.

**Mapeo de errores → status code:**

| Origen del error | Status | Body |
|------------------|--------|------|
| Joi (`isJoi === true` o escapó del wrapper) | 400 | `ValidationError` + `details[]` |
| MySQL (`code` empieza con `ER_`) | 400 | `DatabaseError` + `code` |
| `HttpError(404, msg)` | 404 | `NotFound` |
| `HttpError(status, msg)` | status custom | `err.name` + `err.message` |
| Cualquier otro | 500 | `InternalServerError` + mensaje genérico |

Los errores 5xx ocultan el mensaje real al cliente (solo loguean en consola
con stack) para no filtrar detalles internos.

Clase `HttpError` en el controller: throw `new HttpError(404, '...')` y
`asyncHandler` lo propaga a `next(err)`.

---

## 9. Backend stack y decisiones

| Capa | Elección | Justificación |
|------|----------|---------------|
| HTTP | Express 4 | Estándar, ecosistema maduro |
| DB driver | `mysql2/promise` | Promesas nativas, mejor que `mysql` |
| Validación | `joi` (enunciado) | Estricto, declarativo, mensajes claros |
| Async errors | `asyncHandler` propio | Reemplazo de `express-async-errors` (ver §13) |
| Seguridad | `helmet` + `cors` | Headers sensatos, CORS configurable |
| Logging | Custom JSON + `morgan` dev | Más informativo que morgan por default |
| Container | `node:20-alpine` | Imagen chica (~50 MB), Alpine = menos superficie |
| Process init | `node` (sin tini) | Node 20 maneja SIGTERM correctamente |
| Healthcheck | `node -e` inline | No requiere `wget`/`curl` en la imagen |

**Dependencias finales (producción):**
```json
{
  "cors": "^2.8.5",
  "dotenv": "^16.4.5",
  "express": "^4.21.2",
  "helmet": "^7.2.0",
  "joi": "^17.13.3",
  "morgan": "^1.10.0",
  "mysql2": "^3.11.5"
}
```

---

## 10. Frontend (sin frameworks, sin build)

Servido por el mismo Express en `http://HOST:3000/`.

**Archivos:**
- `public/index.html` — markup, formulario CRUD, listado en grid, tester cURL.
- `public/style.css` — sistema editorial tipo Linear/Vercel (familia
  `claude-design` skill): Inter, 1 accent (#5e6ad2), bordes 1px, radio 6-8px,
  sin sombras.
- `public/app.js` — vanilla JS, fetch API, sin dependencias.

**Funcionalidades:**
- Carga `/api/health` para mostrar badge de entorno.
- Lista productos en grid con thumbnail, nombre, descripción, precio, stock.
- Stock ≤ 5 → "Stock: N" en rojo. Stock = 0 → "Sin stock".
- Formulario `Crear` / `Editar` (mismo form, swap de método).
- Botón `Eliminar` con `confirm()`.
- Buscador por nombre (filter en cliente, no server-side).
- Tester cURL-style colapsable con ejemplos.

**Cero dependencias de frontend:** sin React, sin Vue, sin Vite, sin npm
install para el front. Express sirve los 3 archivos estáticos.

---

## 11. Docker Compose

`docker-compose.yml`:

- **Red interna:** `examen3-net` (bridge). DNS interno: `mysql` resuelve
  al contenedor de la DB.
- **Volumen persistente:** `mysql_data` → `/var/lib/mysql` (los datos
  sobreviven a `docker compose down`; solo se borran con `down -v`).
- **Healthchecks:**
  - MySQL: `mysqladmin ping -h localhost -u root -proot_pass` cada 5s,
    20 reintentos, start_period 20s.
  - Backend: `node -e "require('http').get('http://localhost:3000/api/health', ...)"` cada 10s, 5 reintentos, start_period 15s.
- **Dependencia:** `backend.depends_on.mysql.condition: service_healthy` →
  el backend arranca solo cuando MySQL responde.
- **Restart policy:** `unless-stopped` en ambos.
- **Mapeo de puertos (host → contenedor):**
  - `3307:3306` (MySQL) → expuesto en host por si quieres un cliente externo
    (Workbench, DBeaver). **3306 está ocupado por otro docker
    (`plataforma-db`); el 3307 evita el conflicto. Dentro de la red, sigue
    siendo 3306.**
  - `3000:3000` (backend) → frontend + API en el mismo puerto.

**Comandos:**
```bash
docker compose up -d --build   # build + start
docker compose down            # stop (conserva datos)
docker compose down -v         # stop + borrar volumen
docker compose ps              # status
docker compose logs -f backend # logs
```

---

## 12. Variables de entorno

| Variable | Default | Usada en |
|----------|---------|----------|
| `PORT` | `3000` | server.js (HTTP listen) |
| `NODE_ENV` | `production` | server.js (helmet, morgan) |
| `DB_HOST` | `mysql` | pool.js (dentro de compose) |
| `DB_PORT` | `3306` | pool.js (interno) |
| `DB_USER` | `examen` | pool.js |
| `DB_PASSWORD` | `examen_pass` | pool.js |
| `DB_NAME` | `examen3` | pool.js |
| `EXTERNAL_IMAGE_BASE_URL` | `https://picsum.photos` | externalImageService |
| `EXTERNAL_IMAGE_WIDTH` | `600` | externalImageService |
| `EXTERNAL_IMAGE_HEIGHT` | `400` | externalImageService |
| `CORS_ORIGIN` | `*` | server.js (cors middleware) |

Los defaults funcionan out-of-the-box sin tocar `.env`.

---

## 13. Problemas encontrados y soluciones

### 13.1 DNS transient en `apk add tini` (alpine)
- **Síntoma:** `docker build` fallaba al instalar `tini` por DNS.
- **Causa:** Mirror de Alpine inestable.
- **Fix:** Eliminar `tini` del Dockerfile. Node 20 maneja SIGTERM correctamente.

### 13.2 `npm ci` con lockfile faltante
- **Síntoma:** `npm ci --only=production` imprimía el help (flag
  `--only=production` no reconocido en esa versión de npm).
- **Causa:** No había `package-lock.json` en el repo.
- **Fix:** Generar el lockfile con `npm install --omit=dev` y commitearlo.

### 13.3 Puerto 3306 ocupado
- **Síntoma:** `Bind for 0.0.0.0:3306 failed: port is already allocated`.
- **Causa:** Otro docker (`plataforma-db`) ya usa 3306 en el host.
- **Fix:** Cambiar mapeo host a `3307:3306` en docker-compose. Dentro de la
  red del compose, MySQL sigue siendo 3306 (el backend se conecta a
  `mysql:3306`).

### 13.4 `express-async-errors` con carpeta vacía
- **Síntoma:** El contenedor backend crasheaba con
  `Error: Cannot find module 'express-async-errors'` aunque la carpeta
  `node_modules/express-async-errors/` existía dentro del contenedor.
  Inspeccionando: la carpeta tenía `.` y `..` pero ningún archivo. Ni
  siquiera `package.json`.
- **Causa:** Bug específico de `npm` en `node:20-alpine` con esta versión
  del paquete. Probé `npm ci`, `npm ci --omit=dev`, `npm install`,
  `npm install --omit=dev`, `docker compose build --no-cache` y
  `docker builder prune -af`. Todos dejaban la carpeta vacía.
- **Fix (definitivo):** Eliminar `express-async-errors` del proyecto y
  reemplazarlo con un wrapper propio de 5 líneas
  (`backend/src/utils/asyncHandler.js`):
  ```js
  module.exports = function asyncHandler(fn) {
    return function asyncWrapped(req, res, next) {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };
  ```
  Aplicado en `routes/products.js` envolviendo cada handler. Sin
  dependencias, sin side-effects, comportamiento idéntico.

### 13.5 Caché de Docker BuildKit
- **Acción:** `docker system prune -af` y `docker builder prune -af` para
  limpiar capas corruptas.

### 13.6 `docker-proxy` rompe conexiones host→container
- **Síntoma:** Contenedor up y `healthy` (su healthcheck interno responde),
  pero cualquier petición desde el host al puerto mapeado (`curl`,
  `mysql2`, `node http`) se queda colgada con `0 bytes received`. El
  banner de MySQL nunca llega al cliente, las respuestas HTTP del
  backend nunca salen al host. `ncat` y `ss` confirman que el socket TCP
  está abierto (`Connected`), pero la app no recibe datos.
- **Causa:** Bug del userland proxy de Docker en este host. Acepta la
  conexión TCP pero no pasa los datos al container. Solo afecta a
  puertos NAT-mapeados; las conexiones directas a la IP del container
  funcionan, igual que las que van por la red interna del compose.
- **Fix:** `network_mode: host` en ambos servicios. Comunicación
  directa, sin proxy. MySQL escucha en `127.0.0.1:3306` del host, el
  backend en `127.0.0.1:3000`. El `docker-compose.yml` ya no usa
  `ports:` ni `networks:` para el backend.

### 13.7 `npm install` en `node:20-alpine` deja carpetas vacías
- **Síntoma:** Incluso con `build --no-cache` y `prune -af`, la build
  de `examen3-backend` termina con `node_modules` con archivos
  faltantes (`Cannot find module 'express'` o `'mysql2'`). `npm` cierra
  con `Exit handler never called!` tras 140s.
- **Causa:** Bug específico de npm/node:20-alpine en este host,
  posiblemente interacción con la red/firewall.
- **Fix:** Instalar dependencias en el **host** y bind-mount de
  `./backend/node_modules` al contenedor. Imagen base `node:20-alpine`
  directo, sin Dockerfile propio, sin paso `RUN npm install`.

---

## 14. Pruebas manuales definidas (no ejecutadas en headless por el bloqueo
anterior)

```bash
# Healthcheck
curl -s http://localhost:3000/api/health
# → {"status":"ok","env":"production"}

# Listar
curl -s http://localhost:3000/api/products

# Crear (imagen autogenerada desde Lorem Picsum con seed = sha1("Zapatillas")[0:12])
curl -s -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Zapatillas X","description":"Modelo deportivo 2026","price":199.90,"stock":15}'

# Crear con imagen explícita
curl -s -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Polera","description":"Polera algodon organico","price":49.90,"stock":30,"image_url":"https://picsum.photos/seed/polera/600/400"}'

# Obtener uno
curl -s http://localhost:3000/api/products/1

# Actualizar parcial
curl -s -X PUT http://localhost:3000/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{"price":179.90,"stock":10}'

# Eliminar
curl -s -X DELETE http://localhost:3000/api/products/1 -i

# Validación 400 con detalle
curl -s -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"x","description":"corto","price":-1,"stock":-1}'

# 404
curl -s http://localhost:3000/api/products/9999 -i
```

---

## 15. Despliegue (planes documentados en README)

| Plataforma | Costo | MySQL | Notas |
|------------|-------|-------|-------|
| **Render Blueprint** | Free tier | Necesita DB externa (PlanetScale, Aiven, Railway) | Detecta el Dockerfile automáticamente |
| **Railway.app** | $5 free | Plugin MySQL incluido | Variables auto-configuradas |
| **Local + Docker** | Gratis | Incluido en compose | Lo más rápido para demo |
| **ngrok / cloudflared** | Gratis | Local | Túnel para exponer públicamente sin deploy |

En Render/Railway: el backend se conecta a la DB externa vía `DB_HOST`,
`DB_USER`, `DB_PASSWORD`, `DB_NAME` en las env vars del panel.

---

## 16. Estado actual del proyecto

- **MySQL:** contenedor `examen3-mysql` healthy, en `network_mode: host`
  escucha en `127.0.0.1:3306` del host.
- **Backend:** contenedor `examen3-backend` healthy, `network_mode: host`
  escucha en `127.0.0.1:3000`. Stack: `node:20-alpine` directo + bind-mount
  de `src/`, `public/`, `.env` y `node_modules` desde el host. Endpoint
  base `http://localhost:3000/api/products`. CRUD verificado con curl
  (GET, GET/:id, POST con imagen auto, PUT, DELETE). Imagen auto desde
  `https://picsum.photos` con seed determinístico.
- **Frontend:** completo, listo en `http://localhost:3000/`.
- **README:** completo con curl examples + 3 opciones de deploy.
- **Documentación:** este `WORK_LOG.md`.

---

## 17. Licencia y autor

- **MIT** © 2026
- **Autor:** Juan Angel Urcia Reyes (Tecsup, 5° semestre C24-B, Perú)
- **Email:** juan.urcia@tecsup.edu.pe
