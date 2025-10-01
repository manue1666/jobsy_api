# JOBSY API
JOBSY API es una API desarrollada con *Node.js* y *Express.js* para manejar la lógica de negocio y la gestión de usuarios y servicios de la aplicación **JOBSY**.

**Tecnologías utilizadas**

Node.js

Express.js

JWT

MongoDB

## Proceso de instalacion

**Clona el repositorio**
```sh

git clone https://github.com/manue1666/jobsy_api.git

```

**Accede al proyecto**
```sh

cd /jobsy_api

```
**Instalar dependencias**
```sh
npm install

```

**Configurar variables** ***(.env)***
```js

MONGO_URI="tu_url_de_mongo/jobsy_api"
JWT_SECRET = "tu clave jwt"

```

**Ejecutar proyecto de forma local**  
```sh

npm start

```

## Estructura actual del proyecto

```
jobsy_api/
├── .gitignore
├── README.md
├── package.json
├── package-lock.json
└── src/
    ├── app.js                    # Configuración principal de la aplicación Express
    ├── index.js                  # Punto de entrada del servidor (conexión y arranque)
    ├── Controllers/              # Lógica y endpoints de la API agrupados por dominio
    │   ├── user_controllers/     # Controladores de usuario (registro, login, perfil, premium, etc.)
    │   ├── services_controllers/ # Controladores de servicios (CRUD, búsqueda, promoción, etc.)
    │   ├── fav_services_controller/ # Controladores de favoritos
    │   ├── comments_controller/  # Controladores de comentarios
    │   └── emailController/      # Envío y recuperación de correos electrónicos
    ├── Models/                   # Modelos de datos (Mongoose)
    │   ├── User_Model.js
    │   ├── Service_Model.js
    │   └── FavService_Model.js
    └── utils/                    # Utilidades y helpers
        ├── authMiddleware.js     # Middleware para autenticación JWT
        ├── constants.js          # Constantes globales (categorías, planes, etc.)
        ├── jwt.js                # Funciones para generar/verificar JWT
        ├── stripeWebHook.js      # Integración con Stripe Webhooks
        ├── cron.js               # Tareas programadas (cron jobs)
        ├── cloudinary.js         # Configuración de Cloudinary
        ├── imageService.js       # Procesamiento y subida de imágenes
```

Esta estructura refleja la separación lógica por dominios (usuarios, servicios, favoritos, comentarios, email) y la organización por modelos y utilidades.

## Principales Endpoints del API

**Usuarios**
- `GET /user/get`: Obtener todos los usuarios.
- `POST /user/regist`: Registrar nuevo usuario.
- `POST /user/login`: Iniciar sesión.
- `PATCH /user/patch/:id`: Actualizar datos de usuario.
- `DELETE /user/delete/:id`: Eliminar usuario.
- `GET /user/me`: Obtener perfil del usuario autenticado.
- `POST /user/premium`: Activar usuario premium.
- `POST /user/premium/setup-intent`: Intento de pago para premium.
- `POST /user/premium/cancel`: Cancelar suscripción premium.
- `GET /user/premium/status`: Estado premium.
- `PATCH /user/password`: Cambiar contraseña.
- `GET /user/data/:id`: Obtener datos y servicios del usuario.

**Servicios**
- `POST /service/post`: Crear servicio.
- `GET /service/get/:id`: Obtener servicio por ID.
- `GET /service/user`: Servicios publicados por usuario autenticado.
- `PATCH /service/patch/:id`: Actualizar servicio.
- `DELETE /service/delete/:id`: Eliminar servicio.
- `GET /service/search`: Buscar servicios.
- `GET /service/nearby`: Buscar servicios cercanos según ubicación.
- `POST /service/boost/:id`: Promocionar servicio.

**Servicios Favoritos**
- `POST /fav/post/:id`: Agregar servicio a favoritos.
- `DELETE /fav/delete/:id`: Eliminar servicio de favoritos.
- `GET /fav/get`: Obtener servicios favoritos del usuario.

**Comentarios**
- `POST /comment/post/:id`: Agregar comentario a servicio.
- `GET /comments/:id`: Obtener comentarios de un servicio.
- `DELETE /comment/delete/:id`: Eliminar comentario.

**Email**
- `POST /email/post`: Enviar correo (requiere autenticación).
- `POST /email/recover`: Recuperar contraseña por correo electrónico.

**Webhooks**
- `POST /webhook`: Webhook de Stripe para pagos y suscripciones.

---

## Principales Librerías Utilizadas

- **express**: Framework principal para la API.
- **mongoose**: Conexión y modelado de datos con MongoDB.
- **cors**: Permitir solicitudes cross-origin.
- **jsonwebtoken**: Autenticación con JWT.
- **dotenv**: Manejo de variables de entorno.
- **bcrypt**: Hash de contraseñas.
- **stripe**: Pagos y suscripciones premium.
- **sharp**: Procesamiento y compresión de imágenes.
- **fs-extra**: Manejo avanzado de archivos.
- **cloudinary**: Almacenamiento y gestión de imágenes en la nube.
- **resend**: Envío de correos electrónicos.
- **multer**: Manejo de archivos en los endpoints de imágenes.

Estas librerías cubren la autenticación, gestión de usuarios, servicios, favoritos, comentarios, pagos, carga de imágenes y envío de correos electrónicos en la API JOBSY.

