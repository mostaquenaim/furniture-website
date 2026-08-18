import { Test, TestingModule } from '@nestjs/testing';
import { SeasonalCategoryController } from './seasonal-category.controller';

describe('SeasonalCategoryController', () => {
  let controller: SeasonalCategoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeasonalCategoryController],
    }).compile();

    controller = module.get<SeasonalCategoryController>(SeasonalCategoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
