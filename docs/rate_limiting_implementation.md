# Implementación de Rate Limiting en el Microservicio de Autenticación

## Introducción

Este documento explica la implementación y funcionamiento del sistema de rate limiting (limitación de tasa) en el microservicio de autenticación. El rate limiting es una técnica de seguridad crucial que protege la API contra ataques de fuerza bruta, denegación de servicio (DoS) y uso abusivo de los recursos.

## ¿Qué es Rate Limiting?

El rate limiting es una estrategia que limita el número de solicitudes que un cliente puede realizar a una API en un período de tiempo determinado. Cuando se excede este límite, las solicitudes adicionales son rechazadas temporalmente hasta que finalice el período de limitación.

## Arquitectura General

La implementación de rate limiting en este microservicio utiliza el módulo `@nestjs/throttler` de NestJS, que proporciona una solución robusta y configurable para limitar las tasas de solicitudes.

### Componentes Principales

1. **ThrottlerModule**: Configuración global del rate limiting
2. **Decorador @Throttle**: Configuración específica por controlador o ruta
3. **ThrottlerExceptionFilter**: Manejo personalizado de excepciones de rate limiting

## Configuración Global

El rate limiting está configurado a nivel global en el módulo principal de la aplicación (`AppModule`):

```typescript
// src/app.module.ts
@Module({
  imports: [
    // Otros módulos...
    ThrottlerModule.forRoot({
      throttlers: [{
        ttl: 60,
        limit: 10,
      }],
    }),
  ],
  // ...
})
export class AppModule {}
```

Esta configuración establece un límite global de **10 solicitudes por minuto (60 segundos)** para todas las rutas de la API.

## Configuración por Controlador

Además de la configuración global, el controlador de autenticación (`AuthController`) tiene su propia configuración de rate limiting:

```typescript
// src/auth/auth.controller.ts
@Throttle({ default: { limit: 10, ttl: 60 } })
@Controller('auth')
export class AuthController {
  // ...
}
```

Esta configuración específica sobrescribe la configuración global para todas las rutas dentro del controlador de autenticación, manteniendo el mismo límite de **10 solicitudes por minuto**.

## Manejo de Excepciones

Cuando un cliente excede el límite de solicitudes, el sistema genera una excepción `ThrottlerException`. Esta excepción es capturada por un filtro personalizado (`ThrottlerExceptionFilter`) que devuelve una respuesta HTTP 429 (Too Many Requests) con un mensaje amigable:

```typescript
// src/common/guards/throttler-exception.filter.ts
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    res.status(429).json({
      statusCode: 429,
      error: 'Demasiadas peticiones',
      message: 'Por favor, espera unos segundos antes de volver a intentarlo.',
    });
  }
}
```

Este filtro está registrado globalmente en la aplicación:

```typescript
// src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useGlobalFilters(new ThrottlerExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
```

## Funcionamiento Interno

### Algoritmo de Ventana Deslizante

El módulo `@nestjs/throttler` utiliza un algoritmo de ventana deslizante (sliding window) para controlar las tasas de solicitudes. Este algoritmo funciona de la siguiente manera:

1. Cada vez que un cliente realiza una solicitud, se registra la marca de tiempo de la solicitud.
2. Se cuenta el número de solicitudes realizadas en el período de tiempo definido (TTL).
3. Si el número de solicitudes excede el límite configurado, se rechaza la solicitud.
4. A medida que pasa el tiempo, las solicitudes más antiguas salen de la ventana, permitiendo nuevas solicitudes.

### Identificación de Clientes

Los clientes se identifican principalmente por su dirección IP. Esto permite aplicar los límites de tasa de manera individual a cada cliente, evitando que un cliente abusivo afecte a otros usuarios legítimos.

## Beneficios de Seguridad

La implementación de rate limiting proporciona varios beneficios de seguridad:

1. **Protección contra ataques de fuerza bruta**: Limita los intentos de adivinar credenciales de usuario.
2. **Mitigación de ataques DoS**: Reduce el impacto de los ataques de denegación de servicio.
3. **Prevención de scraping abusivo**: Evita la extracción masiva de datos de la API.
4. **Estabilidad del servicio**: Garantiza que ningún cliente pueda consumir recursos excesivos.

## Consideraciones de Implementación

### Equilibrio entre Seguridad y Experiencia de Usuario

La configuración actual de rate limiting (10 solicitudes por minuto) proporciona un equilibrio razonable entre:

- Protección contra abusos
- Experiencia de usuario fluida para usuarios legítimos

### Escalabilidad

En entornos de producción con múltiples instancias del servicio, se recomienda utilizar un almacén centralizado (como Redis) para el seguimiento de las tasas de solicitudes. Esto garantiza que los límites se apliquen correctamente incluso cuando las solicitudes se distribuyen entre diferentes instancias del servicio.

## Ejemplo de Comportamiento

### Escenario Normal

1. Un usuario realiza 5 solicitudes en un minuto al endpoint `/auth/login`.
2. Todas las solicitudes son procesadas normalmente, ya que están dentro del límite.

### Escenario de Límite Excedido

1. Un atacante intenta realizar 20 solicitudes en un minuto al endpoint `/auth/login`.
2. Las primeras 10 solicitudes son procesadas normalmente.
3. Las 10 solicitudes adicionales son rechazadas con un código de estado HTTP 429.
4. Después de que pase el período de limitación (60 segundos), el atacante puede realizar nuevas solicitudes.

## Conclusión

La implementación de rate limiting en este microservicio de autenticación proporciona una capa esencial de protección contra diversos tipos de abusos y ataques. La configuración actual está diseñada para permitir un uso normal de la API mientras se bloquean patrones de uso abusivos.

Esta protección es especialmente importante para los endpoints de autenticación, que son objetivos frecuentes de ataques de fuerza bruta y otros intentos maliciosos de acceso no autorizado.
