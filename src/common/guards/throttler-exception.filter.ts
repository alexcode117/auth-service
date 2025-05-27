import { Catch, ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

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
