import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';

// Logs one row per partner-API request, success or failure. Deliberately
// hooks Express's `res.on('finish')` instead of an RxJS tap/catchError —
// that fires once the full response (including whatever the exception
// filter wrote) has actually been sent, so it always sees the true final
// status code regardless of which path (success or error) the request took.
@Injectable()
export class ApiUsageLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiUsageLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    response.on('finish', () => {
      const apiClient = request.apiClient;
      if (!apiClient) return; // guard rejected before setting it — nothing to attribute

      this.prisma.apiKeyRequestLog
        .create({
          data: {
            apiClientId: apiClient.id,
            method: request.method,
            path: request.originalUrl,
            statusCode: response.statusCode,
            ipAddress: request.ip,
          },
        })
        .catch((err: unknown) =>
          this.logger.warn(`Failed to write ApiKeyRequestLog: ${String(err)}`),
        );
    });

    return next.handle();
  }
}
