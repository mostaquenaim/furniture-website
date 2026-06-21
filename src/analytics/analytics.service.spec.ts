import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { DashboardService } from 'src/dashboard/dashboard.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: DashboardService,
          useValue: {
            getTopSearchKeywordsForRange: jest.fn().mockResolvedValue([]),
            getUserRetentionForRange: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
