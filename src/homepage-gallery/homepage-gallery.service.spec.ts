import { Test, TestingModule } from '@nestjs/testing';
import { HomepageGalleryService } from './homepage-gallery.service';

describe('HomepageGalleryService', () => {
  let service: HomepageGalleryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HomepageGalleryService],
    }).compile();

    service = module.get<HomepageGalleryService>(HomepageGalleryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
