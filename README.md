# Microservicio de Autenticación

<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
</p>

## Descripción

Este microservicio de autenticación está construido con [NestJS](https://github.com/nestjs/nest) y proporciona una solución robusta para la gestión de autenticación y autorización de usuarios. Utiliza JWT para la autenticación, Redis para caché y rate limiting, y una base de datos MySQL para el almacenamiento persistente.

## Características

- ✅ Autenticación basada en JWT
- ✅ Gestión de usuarios (registro, login, actualización)
- ✅ Caché de tokens con Redis
- ✅ Blacklisting de tokens revocados
- ✅ Rate limiting para protección contra ataques
- ✅ Caché de datos de usuario
- ✅ Gestión de sesiones

## Arquitectura

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   NestJS App        │    │   Redis Server      │    │   MySQL             │
│   (Puerto 3000)     │◄──►│   (Puerto 6379)     │    │   (Puerto 3306)     │
│                     │    │                     │    │                     │
│ • Auth Controllers  │    │ • Token Cache       │    │ • User Data         │
│ • JWT Guards        │    │ • Rate Limiting     │    │ • Persistent Data   │
│ • Rate Limiting     │    │ • Session Cache     │    │ • Audit Logs        │
│ • Business Logic    │    │ • Blacklisted IDs   │    │ • User Preferences  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## Requisitos previos

- Node.js (v16 o superior)
- MySQL
- Redis
- Docker (opcional, para contenedores)

## Configuración del entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```
# Database Configurations
DATABASE_URL="mysql://root:root@localhost:3306/auth_db"

# Server Configurations
PORT=3000

# JWT Configurations
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=1h

# Redis Configurations
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL_DEFAULT=300
REDIS_MAX_MEMORY=256mb
```

## Instalación

```bash
# Instalar dependencias
$ npm install

# Configurar Redis con Docker (opcional)
$ docker run -d --name redis-auth -p 6379:6379 redis:7-alpine

# Verificar conexión a Redis
$ docker exec -it redis-auth redis-cli ping
# Debería responder: PONG
```

## Ejecución

```bash
# Desarrollo
$ npm run start

# Modo observador (desarrollo)
$ npm run start:dev

# Producción
$ npm run start:prod
```

## Endpoints de API

### Autenticación

- `POST /auth/register` - Registro de nuevo usuario
- `POST /auth/login` - Inicio de sesión
- `POST /auth/logout` - Cierre de sesión (revoca token)
- `GET /auth/profile` - Obtener perfil del usuario autenticado
- `POST /auth/refresh` - Refrescar token JWT

### Usuarios

- `GET /users` - Listar usuarios (admin)
- `GET /users/:id` - Obtener usuario por ID
- `PATCH /users/:id` - Actualizar usuario
- `DELETE /users/:id` - Eliminar usuario

## Implementación de Redis

El proyecto utiliza Redis para:

1. **Caché de tokens**: Almacenamiento y validación rápida de tokens JWT
2. **Blacklisting de tokens**: Lista negra de tokens revocados
3. **Rate limiting**: Protección contra ataques de fuerza bruta
4. **Caché de usuarios**: Mejora de rendimiento en consultas frecuentes
5. **Gestión de sesiones**: Control de sesiones activas

## Pruebas

```bash
# Pruebas unitarias
$ npm run test

# Pruebas e2e
$ npm run test:e2e

# Cobertura de pruebas
$ npm run test:cov
```

## Estructura del proyecto

```
auth-service/
├── src/
│   ├── auth/               # Módulo de autenticación
│   ├── cache/              # Módulo de caché con Redis
│   ├── common/             # Utilidades y decoradores comunes
│   ├── config/             # Configuraciones
│   ├── guards/             # Guards de autenticación
│   ├── prisma/             # Cliente de base de datos
│   ├── users/              # Módulo de usuarios
│   ├── app.module.ts       # Módulo principal
│   └── main.ts             # Punto de entrada
├── docs/                   # Documentación
├── prisma/                 # Esquemas de Prisma
└── test/                   # Pruebas
```

## Licencia

Este proyecto está licenciado bajo la licencia MIT.
