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

**Estructura del proyecto**  
```

jobsy_api-main/
├── .gitignore
├── README.md
├── package.json
├── package-lock.json
└── src/
    ├── app.js                  # Configuración de la app Express
    ├── index.js                # Punto de entrada del servidor
    ├── Controllers/
    │   ├── User_Controller.js
    │   ├── Service_Controller.js
    │   └── FavService_Controller.js
    ├── Models/
    │   ├── User_Model.js
    │   ├── Service_Model.js
    │   └── FavService_Model.js
    └── utils/
        ├── authMiddleware.js   # Middleware de autenticación
        ├── constants.js        # Constantes globales
        └── jwt.js              # Funciones para generar/verificar JWT


```

**Endpoints Principales**
Estos están definidos en los controladores:

`/users`: Registro, login, y gestión de usuarios.

`/services`: CRUD de servicios.

`/favorites`: Gestión de servicios favoritos por usuario.

**Seguridad**

Autenticación basada en *JWT*.

Middleware personalizado en `utils/authMiddleware.js`.

