import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StockEventsGateway } from './stock-events.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretkey',
    }),
  ],
  providers: [StockEventsGateway],
  exports: [StockEventsGateway],
})
export class StockEventsModule {}
