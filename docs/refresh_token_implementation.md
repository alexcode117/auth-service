# Implementación de Refresh Tokens en el Microservicio de Autenticación

## Introducción

Este documento explica la implementación y funcionamiento del sistema de refresh tokens en el microservicio de autenticación. Los refresh tokens son una parte fundamental de la seguridad de la aplicación, ya que permiten mantener la sesión del usuario activa sin comprometer la seguridad.

## Arquitectura General

El sistema de autenticación utiliza dos tipos de tokens:

1. **Access Token**: Token de corta duración (15 minutos) utilizado para autorizar las peticiones a los endpoints protegidos.
2. **Refresh Token**: Token de larga duración (7 días) utilizado para obtener nuevos access tokens sin necesidad de que el usuario vuelva a introducir sus credenciales.

## Almacenamiento de Tokens

### Base de Datos

Los refresh tokens se almacenan en la base de datos a través de dos modelos de Prisma:

1. **Modelo User**:
   ```prisma
   model User {
     id           Int      @id @default(autoincrement())
     email        String   @unique
     password     String
     name         String
     createdAt    DateTime @default(now())
     refreshToken String?
     sessions     Session[]
   }
   ```

2. **Modelo Session**:
   ```prisma
   model Session {
     id           Int      @id @default(autoincrement())
     user         User     @relation(fields: [userId], references: [id])
     userId       Int
     jti          String   @unique
     userAgent    String
     ip           String
     refreshToken String
     createdAt    DateTime @default(now())
     updatedAt    DateTime @updatedAt
   }
   ```

### Cookies Seguras

Los refresh tokens se almacenan en cookies HTTP-only con las siguientes características de seguridad:

```typescript
res.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
});
```

Estas configuraciones garantizan que:
- El token no es accesible mediante JavaScript (`httpOnly`)
- Solo se envía a través de conexiones HTTPS (`secure`)
- No se envía en solicitudes cross-site (`sameSite: 'strict'`)
- Solo se envía a la ruta específica de refresh (`path: '/auth/refresh'`)

## Flujo de Autenticación

### 1. Registro de Usuario

Cuando un usuario se registra:

1. Se crea un nuevo usuario con contraseña hasheada
2. Se generan tokens de acceso y refresh
3. Se almacena el refresh token hasheado en la base de datos
4. Se devuelven ambos tokens al cliente

```typescript
async register(data: { email: string; password: string; name: string }) {
  const hashedPassword = await bcrypt.hash(data.password, 10);
  const newUser = await this.usersService.create({
    ...data,
    password: hashedPassword,
  });

  const tokens = await this.generateTokens(newUser.id, newUser.email);
  const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
  await this.usersService.updateRefreshToken(newUser.id, hashedRefreshToken);

  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
    },
  };
}
```

### 2. Inicio de Sesión

Cuando un usuario inicia sesión:

1. Se validan las credenciales del usuario
2. Se genera un identificador único (JTI) para el token
3. Se crean tokens de acceso y refresh
4. Se almacena la información de la sesión en la base de datos
5. Se devuelve el access token en la respuesta y se establece el refresh token en una cookie segura

```typescript
async login(user: User, req: Request) {
  const jti = randomUUID();

  const refreshToken = this.jwtService.sign(
    {
      sub: user.id,
      jti,
    },
    {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    },
  );

  const accessToken = this.jwtService.sign(
    {
      sub: user.id,
    },
    {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: '15m',
    },
  );

  const userAgent = req.headers['user-agent'] || 'unknown';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  await this.prisma.session.create({
    data: {
      userId: user.id,
      jti,
      refreshToken,
      userAgent,
      ip,
    },
  });

  return { accessToken, refreshToken };
}
```

### 3. Renovación de Tokens (Refresh)

Cuando un access token expira, el cliente puede solicitar uno nuevo utilizando el refresh token:

1. El cliente envía el refresh token almacenado en la cookie
2. El servidor verifica la validez del token
3. Se busca la sesión asociada al JTI del token
4. Se generan nuevos tokens de acceso y refresh
5. Se devuelve el nuevo access token y se actualiza la cookie con el nuevo refresh token

```typescript
async refreshToken(token: string) {
  try {
    const payload = this.jwtService.verify(token, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
    });

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const session = await this.prisma.session.findFirst({
      where: { jti: payload.jti },
    });
    if (!session) throw new UnauthorizedException('Sesión inválida');

    const accessToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '15m',
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti: session.jti },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    return { accessToken, refreshToken };
  } catch (error) {
    throw new UnauthorizedException('Token inválido');
  }
}
```

## Gestión de Sesiones

El sistema permite a los usuarios gestionar sus sesiones activas:

### Listar Sesiones Activas

Los usuarios pueden ver todas sus sesiones activas, incluyendo información sobre el dispositivo y la ubicación:

```typescript
async getSessions(@Req() req) {
  const userId = req.user.sub;
  return this.prisma.session.findMany({
    where: { userId },
    select: {
      id: true,
      userAgent: true,
      ip: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
```

### Revocar una Sesión Específica

Los usuarios pueden revocar una sesión específica, lo que invalida el refresh token asociado:

```typescript
async revokeSession(@Param('id') sessionId: number, @Req() req) {
  const userId = req.user.sub;

  const session = await this.prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.userId !== userId) {
    throw new ForbiddenException('No autorizado para eliminar esta sesión');
  }

  await this.prisma.session.delete({ where: { id: sessionId } });

  return { message: 'Sesión revocada correctamente' };
}
```

### Cerrar Todas las Sesiones

Los usuarios pueden cerrar todas sus sesiones activas:

```typescript
async logoutAll(@Req() req) {
  const userId = req.user.sub;
  await this.prisma.session.deleteMany({
    where: { userId },
  });
  return { message: 'Todas las sesiones cerradas' };
}
```

## Medidas de Seguridad

El sistema implementa varias medidas de seguridad:

1. **Tokens JWT firmados**: Los tokens están firmados con secretos diferentes para access y refresh tokens.
2. **Cookies HTTP-only**: Los refresh tokens se almacenan en cookies HTTP-only, inaccesibles desde JavaScript.
3. **Identificadores únicos (JTI)**: Cada refresh token tiene un identificador único que se almacena en la base de datos.
4. **Limitación de tasa**: Se implementa throttling para prevenir ataques de fuerza bruta.
5. **Revocación de tokens**: Los usuarios pueden revocar tokens específicos o todos los tokens.

## Conclusión

La implementación de refresh tokens en este microservicio de autenticación proporciona un equilibrio entre seguridad y experiencia de usuario. Los access tokens de corta duración minimizan el riesgo de accesos no autorizados, mientras que los refresh tokens de larga duración permiten a los usuarios mantener su sesión sin tener que iniciar sesión constantemente.

La gestión de sesiones múltiples permite a los usuarios controlar sus accesos desde diferentes dispositivos, mejorando la seguridad general del sistema.
