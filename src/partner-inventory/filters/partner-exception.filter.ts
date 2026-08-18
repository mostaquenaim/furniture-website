import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface NormalizedBody {
  code: string;
  message: string;
  fields?: string[];
}

const CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'INVALID_API_KEY',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
};

// Guarantees every response out of the partner namespace follows one
// stable, machine-parseable shape — a 3rd party integrates against this
// contract programmatically, not by reading a Nest stack trace, so the
// default per-exception body shapes (which vary across Nest's built-ins)
// all get normalized here.
@Catch()
export class PartnerExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PartnerExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = this.normalize(status, exception.getResponse());
      response.status(status).json({ error: body });
      return;
    }

    // Unknown/unexpected error — log the real thing, never leak it to the caller.
    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  }

  private normalize(status: number, body: unknown): NormalizedBody {
    const code = CODE_BY_STATUS[status] ?? 'REQUEST_FAILED';

    if (this.isPlainObject(body)) {
      const rawMessage = body.message;
      if (Array.isArray(rawMessage)) {
        return {
          code,
          message: rawMessage.map(String).join('; '),
          fields: rawMessage.map(String),
        };
      }
      if (typeof rawMessage === 'string') {
        return { code, message: rawMessage };
      }
    }

    return { code, message: typeof body === 'string' ? body : 'Request failed' };
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
