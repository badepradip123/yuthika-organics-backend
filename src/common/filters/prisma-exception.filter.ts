import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    switch (exception.code) {
      case 'P2002':
        throw new ConflictException('A record with the same unique value already exists');
      case 'P2025':
        throw new NotFoundException('Requested record was not found');
      default: {
        const response = host.switchToHttp().getResponse();
        response.status(500).json({ statusCode: 500, message: 'Database request failed' });
        return;
      }
    }
  }
}
