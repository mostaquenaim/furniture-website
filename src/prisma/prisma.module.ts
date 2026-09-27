import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global so the whole app shares a single PrismaClient (and connection pool).
// Do not add PrismaService to feature modules' `providers` — each listing
// creates another PrismaClient with its own pool and exhausts Postgres
// max_connections.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
