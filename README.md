# Examen 3 · API REST de Productos

> **API RESTful** de productos con **Express.js + MySQL 8**, imágenes autogeneradas desde **Lorem Picsum**, validaciones **Joi**, manejo de errores, middleware de logging y **despliegue 100% Docker** (sin nginx).

[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)]()
[![Express](https://img.shields.io/badge/express-4.x-000?logo=express&logoColor=white)]()
[![MySQL](https://img.shields.io/badge/mysql-8.0-4479A1?logo=mysql&logoColor=white)]()
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?logo=docker&logoColor=white)]()
[![License: MIT](https://img.shields.io/badge/license-MIT-green)]()

## 🌐 Demo en línea

- **Frontend + API:** [[https://examen3-api.onrender.com](https://examen3-api.onrender.com](https://examen3.juanangel.me/ ))


> Si el deploy no está activo todavía, ver la sección [Despliegue](#-despliegue) más abajo.

---

## 📋 Descripción

Aplicación full-stack minimalista que implementa un CRUD de productos sobre MySQL, con un frontend HTML/CSS/JS plano servido por el mismo backend. Las imágenes se generan automáticamente desde [Lorem Picsum](https://picsum.photos) cada vez que se crea un producto, usando el nombre como seed determinístico (el mismo nombre → la misma imagen).

### Características

- ✅ **CRUD completo** sobre `/api/products` (GET, GET/:id, POST, PUT/:id, DELETE/:id)
- ✅ **MySQL 8** con tabla `products` auto-creada al arranque
- ✅ **Imagen automática** desde Lorem Picsum (verificada con HEAD, con fallback)
- ✅ **Validaciones Joi** (body + params, con stripUnknown)
- ✅ **Manejo de errores** centralizado con códigos HTTP correctos (400/404/500)
- ✅ **Middleware de logging** estructurado (timestamp, método, status, duración, IP)
- ✅ **CORS + Helmet** para seguridad
- ✅ **Docker Compose** con healthchecks, volumen persistente, red interna
- ✅ **Frontend** incluido (HTML/CSS/JS plano, sin frameworks, look editorial Linear-style)
- ✅ **Probador cURL** integrado en la UI
- ✅ **Sin nginx** — el backend Express sirve la API y los estáticos en el mismo puerto

---

## 🏗️ Arquitectura

```
┌─────────────────────┐   ┌──────────────────────┐
│  Browser (cliente)  │   │  Lorem Picsum        │
│  /index.html        │   │  (API externa        │
│  /app.js /style.css │   │   de imágenes)       │
└──────────┬──────────┘   └──────────┬───────────┘
           │                         │ fetch (HEAD)
           │  http://:3000          │
           ▼                         ▼
┌──────────────────────────────────────────────┐
│  Express (container: examen3-backend)        │
│   • GET    /api/health                       │
│   • GET    /api/products                     │
│   • GET    /api/products/:id                 │
│   • POST   /api/products   ← genera imagen  │
│   • PUT    /api/products/:id                 │
│   • DELETE /api/products/:id                 │
│   • GET    /             ← frontend estático│
└──────────────────┬───────────────────────────┘
                   │  mysql2 (pool, puerto 3306)
                   ▼
┌──────────────────────────────────────────────┐
│  MySQL 8.0 (container: examen3-mysql)        │
│   db: examen3 / table: products              │
│   volumen: mysql_data (persiste entre runs)  │
└──────────────────────────────────────────────┘
```

Sin proxy reverso. El backend publica en `http://HOST:3000` y sirve tanto `/api/*` como el frontend en `/`.

---

## 🚀 Instalación local (con Docker)

### Requisitos
- Docker 20+ y docker compose v2
- 2 GB de RAM libre (MySQL + Node)

### Pasos

```bash
# 1. Clonar
git clone https://github.com/TU_USUARIO/examen3.git
cd examen3

# 2. (Opcional) Copiar variables de entorno — los defaults ya funcionan
cp .env.example .env

# 3. Levantar (build + healthcheck + ready)
docker compose up -d --build

# 4. Esperar ~15s a que MySQL quede healthy y el backend arranque
docker compose ps
docker compose logs -f backend
```

### Accesos

| Servicio | URL |
|----------|-----|
| Frontend + API | http://localhost:3000 |
| Healthcheck | http://localhost:3000/api/health |
| Listar productos (JSON) | http://localhost:3000/api/products |
| MySQL (cliente) | `localhost:3307` (user `examen`, pass `examen_pass`) |

### Apagar

```bash
docker compose down            # detiene contenedores, conserva datos
docker compose down -v         # detiene + borra volumen (datos perdidos)
```

---

## 🧪 Pruebas manuales (cURL)

```bash
# Listar todos los productos
curl -s http://localhost:3000/api/products | jq

# Obtener uno
curl -s http://localhost:3000/api/products/1 | jq

# Crear (la imagen se asigna automáticamente desde Lorem Picsum)
curl -s -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Zapatillas deportivas X",
    "description": "Modelo 2026 con amortiguación premium",
    "price": 199.90,
    "stock": 15
  }' | jq

# Crear con imagen explícita
curl -s -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Polera algodón",
    "description": "Polera 100% algodón orgánico, talla M",
    "price": 49.90,
    "stock": 30,
    "image_url": "https://picsum.photos/seed/polera/600/400"
  }' | jq

# Actualizar (parcial)
curl -s -X PUT http://localhost:3000/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{"price": 179.90, "stock": 10}' | jq

# Eliminar
curl -s -X DELETE http://localhost:3000/api/products/1 -i

# Validación: 400 con detalle
curl -s -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"x","description":"corto","price":-1,"stock":-1}' | jq
# → {
#     "error": "ValidationError",
#     "message": "Datos inválidos",
#     "details": [
#       {"field": "name",         "message": "\"name\" length must be at least 2 characters long"},
#       {"field": "description",  "message": "\"description\" length must be at least 10 characters long"},
#       {"field": "price",        "message": "\"price\" must be greater than 0"},
#       {"field": "stock",        "message": "\"stock\" must be greater than or equal to 0"}
#     ]
#   }

# 404
curl -s http://localhost:3000/api/products/9999 -i
```

---

## 📁 Estructura del proyecto

```
examen3/
├── docker-compose.yml        # mysql + backend con healthchecks
├── .env.example
├── .gitignore
├── README.md                 # este archivo
└── backend/
    ├── Dockerfile            # node:20-alpine + tini
    ├── package.json
    ├── .dockerignore
    ├── .env.example
    ├── public/               # frontend estático (servido por Express)
    │   ├── index.html
    │   ├── style.css
    │   └── app.js
    └── src/
        ├── server.js         # arranque + middleware global
        ├── config/
        │   └── env.js        # carga y valida process.env
        ├── db/
        │   ├── pool.js       # mysql2 pool
        │   └── init.js       # CREATE TABLE IF NOT EXISTS
        ├── routes/
        │   └── products.js
        ├── controllers/
        │   └── productsController.js   # CRUD
        ├── services/
        │   └── externalImageService.js # Lorem Picsum
        ├── validations/
        │   └── productValidation.js    # Joi
        └── middleware/
            ├── logger.js
            ├── validate.js
            └── errorHandler.js
```

---

## 🛠️ Stack y decisiones técnicas

| Capa | Elección | Por qué |
|------|-----------|----------|
| HTTP | Express 4 | Estándar del examen, ecosistema maduro |
| DB driver | `mysql2/promise` | Soporte nativo de promesas, mejor que `mysql` |
| Validación | `joi` | Explícito en el examen; validamos body y params |
| Async errors | `express-async-errors` | Permite `throw` dentro de `async` handlers |
| Seguridad | `helmet` + `cors` | Defaults sensatos; CORS configurable |
| Imagen ext. | Lorem Picsum | Gratis, sin API key, estable, soporta seed determinístico |
| Logger | Custom (JSON one-liner) | Más informativo que morgan por default; morgan queda en dev |
| Frontend | HTML/CSS/JS plano | Cero build, cero dependencias, sirve el propósito |
| Container | `node:20-alpine` + `tini` | Imagen chica, manejo correcto de señales |
| Orquestación | Docker Compose v2 | Healthchecks + `depends_on: condition: service_healthy` |

---

## 📦 Despliegue (hosting gratuito)

### Opción A — Render (recomendado)

1. Subir el repo a GitHub.
2. En Render → **New + → Blueprint** → conectar el repo.
3. Render detecta el `Dockerfile` de `./backend` automáticamente.
4. Configurar env vars en el panel:
   - `DB_HOST` → host interno de tu MySQL gestionado
   - `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `NODE_ENV=production`
5. Add **MySQL** (Render tiene free tier para MySQL) o usar uno externo (PlanetScale, Aiven, Railway).

> **Importante:** Render免费的MySQL ya no está disponible; usá una DB externa gratuita. Para una opción 100% free, considerar Railway.app con el plugin de MySQL.

### Opción B — Railway.app

1. New Project → Deploy from GitHub.
2. Agregar el plugin **MySQL** (gratis los primeros $5 de uso).
3. Variables de entorno auto-configuradas por Railway para el plugin MySQL.
4. Deploy automático.

### Opción C — Local (lo más rápido para demo)

```bash
docker compose up -d --build
# → http://localhost:3000
```

> Renderizar con `ngrok`/`cloudflared` para exponer públicamente sin deploy.

---

## 🔒 Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3000` | Puerto HTTP del backend |
| `NODE_ENV` | `production` | `development` activa morgan dev |
| `DB_HOST` | `mysql` | Host de MySQL (nombre del servicio en compose) |
| `DB_PORT` | `3306` | Puerto MySQL |
| `DB_USER` | `examen` | Usuario MySQL |
| `DB_PASSWORD` | `examen_pass` | Password MySQL |
| `DB_NAME` | `examen3` | Schema |
| `EXTERNAL_IMAGE_BASE_URL` | `https://picsum.photos` | API de imágenes |
| `EXTERNAL_IMAGE_WIDTH` | `600` | Ancho imagen auto |
| `EXTERNAL_IMAGE_HEIGHT` | `400` | Alto imagen auto |
| `CORS_ORIGIN` | `*` | Orígenes permitidos (CSV) |

---

## 📜 Licencia

MIT © 2026 — Juan Angel Urcia Reyes (Tecsup, Perú)

---

## 👤 Autor

**Juan Angel Urcia Reyes** — [@juan.urcia@tecsup.edu.pe](mailto:juan.urcia@tecsup.edu.pe)
Estudiante 5° semestre C24-B · Tecsup
# Examen-3---1-06
