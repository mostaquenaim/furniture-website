import { CmsController } from './cms.controller';

describe('CmsController', () => {
  let controller: CmsController;
  let cmsService: { getHomepageBanners: jest.Mock };

  beforeEach(() => {
    cmsService = { getHomepageBanners: jest.fn().mockReturnValue([]) };
    controller = Object.create(CmsController.prototype) as CmsController;
    Object.defineProperty(controller, 'cmsService', { value: cmsService });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns active banners by default to anonymous visitors', () => {
    void controller.getHomepageBanners(undefined, undefined, undefined);

    expect(cmsService.getHomepageBanners).toHaveBeenCalledWith(true, undefined);
  });

  it('returns all banners by default to staff', () => {
    void controller.getHomepageBanners(
      { user: { role: 'ADMIN' } },
      undefined,
      undefined,
    );

    expect(cmsService.getHomepageBanners).toHaveBeenCalledWith(
      undefined,
      undefined,
    );
  });

  it('returns active banners by default to customers', () => {
    void controller.getHomepageBanners(
      { user: { role: 'CUSTOMER' } },
      undefined,
      undefined,
    );

    expect(cmsService.getHomepageBanners).toHaveBeenCalledWith(true, undefined);
  });

  it('respects an explicit activity filter for staff', () => {
    void controller.getHomepageBanners(
      { user: { role: 'ADMIN' } },
      'false',
      'MOBILE',
    );

    expect(cmsService.getHomepageBanners).toHaveBeenCalledWith(false, 'MOBILE');
  });

  it('does not expose inactive banners to customers requesting them', () => {
    void controller.getHomepageBanners(
      { user: { role: 'CUSTOMER' } },
      'false',
      undefined,
    );

    expect(cmsService.getHomepageBanners).toHaveBeenCalledWith(true, undefined);
  });
});
