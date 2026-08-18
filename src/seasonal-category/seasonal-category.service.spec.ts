import { Test, TestingModule } from '@nestjs/testing';
import { SeasonalCategoryService } from './seasonal-category.service';

describe('SeasonalCategoryService', () => {
  let service: SeasonalCategoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeasonalCategoryService],
    }).compile();

    service = module.get<SeasonalCategoryService>(SeasonalCategoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
