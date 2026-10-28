import { Global, Module } from '@nestjs/common';
import { PublicReadCacheService } from './public-read-cache.service';

// Global so the services that change storefront data (products, stock) can
// clear the cache without each importing this module.
@Global()
@Module({
  providers: [PublicReadCacheService],
  exports: [PublicReadCacheService],
})
export class PublicReadCacheModule {}
