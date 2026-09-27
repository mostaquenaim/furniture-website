import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerOrderEventsGateway } from './customer-order-events.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretkey',
    }),
  ],
  providers: [CustomerOrderEventsGateway],
  exports: [CustomerOrderEventsGateway],
})
export class CustomerOrderEventsModule {}
