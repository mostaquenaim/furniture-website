import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PartnerExceptionFilter } from './partner-exception.filter';

describe('PartnerExceptionFilter', () => {
  let filter: PartnerExceptionFilter;
  let json: jest.Mock;
  let status: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new PartnerExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
  });

  it('normalizes UnauthorizedException to 401 INVALID_API_KEY', () => {
    filter.catch(new UnauthorizedException('Invalid API key'), host);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'INVALID_API_KEY', message: 'Invalid API key' },
    });
  });

  it('normalizes ForbiddenException to 403 FORBIDDEN', () => {
    filter.catch(new ForbiddenException('nope'), host);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'nope' },
    });
  });

  it('normalizes NotFoundException to 404 NOT_FOUND', () => {
    filter.catch(new NotFoundException('Product size #1 not found'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Product size #1 not found' },
    });
  });

  it('collapses a class-validator array message into VALIDATION_ERROR with fields', () => {
    filter.catch(
      new BadRequestException(['limit must not be greater than 200']),
      host,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'limit must not be greater than 200',
        fields: ['limit must not be greater than 200'],
      },
    });
  });

  it('never leaks internals for an unexpected non-HTTP error', () => {
    filter.catch(new Error('db connection string leaked here'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  });
});
