# Implementación de Redis para Microservicio de Autenticación

## 📋 Introducción

Esta guía detalla la implementación completa de Redis como sistema de cache para un microservicio de autenticación desarrollado en NestJS. Redis funcionará como un servidor independiente que manejará cache de tokens, rate limiting, sesiones de usuario y blacklist de tokens revocados.

## 🏗️ Arquitectura Propuesta

### Estructura General
```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   NestJS App        │    │   Redis Server      │    │   PostgreSQL        │
│   (Puerto 3000)     │◄──►│   (Puerto 6379)     │    │   (Puerto 5432)     │
│                     │    │                     │    │                     │
│ • Auth Controllers  │    │ • Token Cache       │    │ • User Data         │
│ • JWT Guards        │    │ • Rate Limiting     │    │ • Persistent Data   │
│ • Rate Limiting     │    │ • Session Cache     │    │ • Audit Logs        │
│ • Business Logic    │    │ • Blacklisted IDs   │    │ • User Preferences  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### Distribución de Datos en Redis

```
Redis Key Structure:
├── token:{tokenId}           # Tokens válidos
├── blacklist:{tokenId}       # Tokens revocados
├── rate_limit:{identifier}   # Contadores de rate limiting
├── user:{userId}             # Datos de usuario cacheados
├── session:{userId}          # Información de sesión activa
├── public_key:{keyId}        # Claves públicas para JWT
└── metrics:*                 # Métricas de performance
```

## 📦 Plan de Implementación - 15 Días

### **Fase 1: Configuración Base (Días 1-2)**

#### Día 1: Instalación y Setup Inicial
```bash
# 1. Instalar dependencias del cliente Redis
npm install @nestjs/cache-manager cache-manager
npm install cache-manager-redis-store redis
npm install @types/cache-manager --save-dev

# 2. Levantar Redis Server con Docker
docker run -d --name redis-auth -p 6379:6379 redis:7-alpine

# 3. Verificar conexión
docker exec -it redis-auth redis-cli ping
# Esperado: PONG
```

#### Día 2: Configuración de Ambiente
```typescript
// .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL_DEFAULT=300
REDIS_MAX_MEMORY=256mb

// src/config/redis.config.ts
export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB) || 0,
  ttl: parseInt(process.env.REDIS_TTL_DEFAULT) || 300,
}));
```

### **Fase 2: Servicios Base (Días 3-4)**

#### Día 3: Módulo Central de Cache
```typescript
// src/cache/cache.module.ts
@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('redis.host'),
        port: configService.get('redis.port'),
        ttl: configService.get('redis.ttl'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [BaseCacheService],
  exports: [CacheModule, BaseCacheService],
})
export class RedisCacheModule {}
```

#### Día 4: Servicio Base de Cache
- Implementar `BaseCacheService` con operaciones CRUD básicas
- Crear helpers para construcción de keys
- Implementar manejo de errores y logging

### **Fase 3: Cache de Tokens (Días 5-6)**

#### Día 5: Servicio de Cache de Tokens
```typescript
// Funcionalidades a implementar:
• cacheValidToken(tokenId, userId, expiresAt)
• getValidToken(tokenId)
• blacklistToken(tokenId, expiresAt)
• isTokenBlacklisted(tokenId)
• batchBlacklistTokens(tokenIds[])
```

#### Día 6: Integración con JWT Strategy
- Modificar JWT Guard para consultar cache antes que DB
- Implementar cache-aside pattern para tokens
- Configurar TTL dinámico basado en expiración del token

### **Fase 4: Rate Limiting (Días 7-8)**

#### Día 7: Servicio de Rate Limiting
```typescript
// Algoritmo de ventana deslizante
• checkRateLimit(identifier, limit, windowMs)
• getRemainingRequests(identifier, limit, windowMs)
• resetRateLimit(identifier)

// Límites por endpoint:
• /auth/login: 5 requests/min
• /auth/register: 3 requests/5min
• /auth/forgot-password: 2 requests/5min
```

#### Día 8: Guard de Rate Limiting
- Implementar `@RateLimit()` decorator
- Configurar headers informativos (X-RateLimit-*)
- Manejo de excepciones con retry-after

### **Fase 5: Cache de Usuario y Sesiones (Días 9-10)**

#### Día 9: Cache de Datos de Usuario
```typescript
// Estrategias de cache:
• Write-through: Actualizar cache al modificar usuario
• Cache-aside: Consultar cache, luego DB si no existe
• TTL: 1 hora para datos de usuario
• Invalidación: Al logout o cambio de permisos
```

#### Día 10: Gestión de Sesiones
- Cache de información de sesión activa
- Múltiples sesiones por usuario
- Revocación masiva de sesiones

### **Fase 6: Optimización de Guards (Días 11-12)**

#### Día 11: JWT Guard Optimizado
```typescript
// Flujo optimizado:
1. Extraer token del header
2. Verificar blacklist (Redis)
3. Consultar token válido (Redis)
4. Si no está en cache, validar con JWT library
5. Cachear resultado para próximas consultas
```

#### Día 12: Performance Testing
- Benchmarks de latencia con/sin cache
- Pruebas de carga con múltiples usuarios
- Optimización de queries Redis

### **Fase 7: Monitoreo y Métricas (Días 13-14)**

#### Día 13: Sistema de Métricas
```typescript
// Métricas a trackear:
• Cache hit ratio por tipo de operación
• Latencia promedio de operaciones Redis
• Número de tokens cacheados vs blacklisted
• Rate limit violations por endpoint
• Memory usage de Redis
```

#### Día 14: Health Checks y Alertas
- Health check endpoint para Redis
- Monitoreo de conexión y latencia
- Alertas por high memory usage
- Dashboard básico de métricas

### **Fase 8: Testing y Deployment (Día 15)**

#### Testing Completo
```typescript
// Tests de integración:
• Token caching scenarios
• Rate limiting edge cases
• Blacklist functionality
• Session management
• Error handling y fallbacks
```

#### Configuración de Producción
```yaml
# docker-compose.prod.yml
redis:
  image: redis:7-alpine
  command: >
    redis-server 
    --appendonly yes 
    --maxmemory 512mb 
    --maxmemory-policy allkeys-lru
  volumes:
    - redis_data:/data
  deploy:
    replicas: 1
    resources:
      limits:
        memory: 512M
      reservations:
        memory: 256M
```

## 🔧 Estructura de Archivos Propuesta

```
src/
├── cache/
│   ├── cache.module.ts                 # Módulo principal de Redis
│   ├── services/
│   │   ├── base-cache.service.ts       # Servicio base con operaciones CRUD
│   │   ├── token-cache.service.ts      # Cache específico para tokens
│   │   ├── rate-limit-cache.service.ts # Rate limiting con Redis
│   │   ├── user-cache.service.ts       # Cache de usuarios y sesiones
│   │   └── cache-metrics.service.ts    # Métricas y monitoreo
│   ├── decorators/
│   │   └── cache-key.decorator.ts      # Decorador para generar keys
│   ├── interfaces/
│   │   └── cache.interfaces.ts         # Tipos TypeScript
│   └── testing/
│       └── redis-testing.module.ts     # Configuración para tests
├── auth/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts          # Guard optimizado con cache
│   │   └── rate-limit.guard.ts        # Guard de rate limiting
│   └── strategies/
│       └── jwt.strategy.ts            # Strategy que usa cache
├── config/
│   └── redis.config.ts                # Configuración de Redis
└── health/
    └── redis.health.ts                # Health check para Redis
```

## ⚡ Optimizaciones de Performance

### 1. **TTL Inteligente**
```typescript
// TTL dinámico basado en expiración del token
const calculateTTL = (expiresAt: Date): number => {
  return Math.floor((expiresAt.getTime() - Date.now()) / 1000);
};
```

### 2. **Batch Operations**
```typescript
// Usar pipeline para operaciones múltiples
const pipeline = redis.pipeline();
tokenIds.forEach(id => pipeline.del(`token:${id}`));
await pipeline.exec();
```

### 3. **Memory Management**
```typescript
// Configuración optimizada para auth
maxmemory: '512mb',
maxmemory-policy: 'allkeys-lru',  // Eliminar keys menos usadas
save: '900 1 300 10 60 10000',    // Persistencia inteligente
```

## 🔒 Consideraciones de Seguridad

### 1. **Separación de Namespaces**
- Prefijos únicos para cada tipo de dato
- Evitar colisiones entre diferentes servicios
- TTL apropiado para datos sensibles

### 2. **Validación de Datos**
```typescript
// Siempre validar datos antes de cachear
if (!tokenId || !userId || !expiresAt) {
  throw new InvalidCacheDataException();
}
```

### 3. **Limpieza Automática**
- TTL automático en todos los keys sensibles
- Limpieza proactiva de tokens expirados
- Rotación de claves de encriptación

## 📊 Métricas Clave a Monitorear

| Métrica | Objetivo | Alerta |
|---------|----------|--------|
| Cache Hit Ratio | > 80% | < 70% |
| Latencia Redis | < 1ms p95 | > 5ms |
| Memory Usage | < 80% | > 90% |
| Conexiones Activas | Stable | Picos >100 |
| Rate Limit Violations | < 1% requests | > 5% |

## 🚀 Comandos de Deployment

### Desarrollo Local
```bash
# Levantar stack completo
docker-compose up -d

# Ver logs de Redis
docker logs redis-auth -f

# Conectar a Redis CLI
docker exec -it redis-auth redis-cli

# Monitorear operaciones en tiempo real
docker exec -it redis-auth redis-cli monitor
```

### Producción
```bash
# Build y deploy
docker-compose -f docker-compose.prod.yml up -d

# Backup de Redis
docker exec redis-auth redis-cli --rdb /backup/dump.rdb

# Monitoreo de memoria
docker exec redis-auth redis-cli info memory
```

## ✅ Checklist de Implementación

### Configuración Base
- [ ] Redis Server instalado y funcionando
- [ ] Cliente Redis configurado en NestJS
- [ ] Variables de entorno configuradas
- [ ] Módulo de cache registrado globalmente

### Servicios Core
- [ ] BaseCacheService implementado
- [ ] TokenCacheService con todas las operaciones
- [ ] RateLimitCacheService funcional
- [ ] UserCacheService para sesiones

### Integración
- [ ] Guards optimizados con cache
- [ ] JWT Strategy usando cache
- [ ] Rate limiting aplicado a endpoints críticos
- [ ] Error handling robusto

### Monitoreo
- [ ] Health checks implementados
- [ ] Métricas de performance configuradas
- [ ] Logging estructurado
- [ ] Alertas básicas configuradas

### Testing
- [ ] Tests unitarios de servicios
- [ ] Tests de integración con Redis
- [ ] Tests de carga y performance
- [ ] Tests de fallback sin Redis

### Producción
- [ ] Configuración de producción optimizada
- [ ] Backups automatizados
- [ ] Monitoreo continuo
- [ ] Documentación completa

## 🎯 Resultados Esperados

Al completar esta implementación, tu microservicio de autenticación tendrá:

- **Performance mejorado**: Reducción de 70-90% en latencia de validación de tokens
- **Escalabilidad**: Capacidad de manejar 10x más requests concurrentes
- **Seguridad robusta**: Rate limiting efectivo y blacklist en tiempo real
- **Observabilidad**: Métricas detalladas y monitoreo proactivo
- **Reliability**: Fallbacks automáticos y recovery de errores

---

*Esta guía proporciona un roadmap completo para implementar Redis de manera profesional en tu microservicio de autenticación, asegurando tanto performance como maintainability a largo plazo.*