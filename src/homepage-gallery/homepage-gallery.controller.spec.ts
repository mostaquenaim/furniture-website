import { Test, TestingModule } from '@nestjs/testing';
import { HomepageGalleryController } from './homepage-gallery.controller';

describe('HomepageGalleryController', () => {
  let controller: HomepageGalleryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HomepageGalleryController],
    }).compile();

    controller = module.get<HomepageGalleryController>(HomepageGalleryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
