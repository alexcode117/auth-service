// src/cache/cache.module.ts
import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { BaseCacheService } from './base-cache.service';

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
        password: configService.get('redis.password'),
        db: configService.get('redis.db'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [BaseCacheService],
  exports: [CacheModule, BaseCacheService],
})
export class RedisCacheModule {}