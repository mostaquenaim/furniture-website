/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { BadRequestException } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { resolveProductOrderBy } from '../common/utils/product-sort.utils';

// The series/subcategory listings used to pass sortBy straight to Prisma, so
// the storefront's "Featured" sort (sortBy=featured) was a 500.

describe('resolveProductOrderBy', () => {
  it('maps every sort the storefront sends', () => {
    expect(resolveProductOrderBy('price', 'asc')).toEqual({ price: 'asc' });
    expect(resolveProductOrderBy('price', 'desc')).toEqual({ price: 'desc' });
    expect(resolveProductOrderBy('createdAt', 'desc')).toEqual({
      createdAt: 'desc',
    });
    expect(resolveProductOrderBy('featured', 'desc')).toEqual({
      isFeatured: 'desc',
    });
    expect(resolveProductOrderBy('soldCount', 'desc')).toEqual({
      soldCount: 'desc',
    });
    expect(resolveProductOrderBy('rating', 'desc')).toEqual({
      rating: 'desc',
    });
    expect(resolveProductOrderBy('title', 'asc')).toEqual({ title: 'asc' });
    expect(resolveProductOrderBy('trendScore', 'desc')).toEqual({
      trendScore: 'desc',
    });
  });

  it('no sort requested → undefined (caller default), whatever order is', () => {
    expect(resolveProductOrderBy(undefined, 'asc')).toBeUndefined();
    expect(resolveProductOrderBy('', 'sideways')).toBeUndefined();
  });

  it('rejects unknown columns, prototype keys, arrays and bad orders', () => {
    for (const [sortBy, order] of [
      ['nope', 'asc'],
      ['toString', 'asc'],
      ['__proto__', 'asc'],
      [['price', 'title'], 'asc'],
      ['price', 'sideways'],
      ['price', undefined],
    ] as [unknown, unknown][]) {
      expect(() => resolveProductOrderBy(sortBy, order)).toThrow(
        BadRequestException,
      );
    }
  });
});

describe('CategoryController listings — sorting', () => {
  let service: {
    getSeriesWiseProducts: jest.Mock;
    getSubCategoryWiseProducts: jest.Mock;
  };
  let controller: CategoryController;

  beforeEach(() => {
    service = {
      getSeriesWiseProducts: jest.fn().mockResolvedValue({}),
      getSubCategoryWiseProducts: jest.fn().mockResolvedValue({}),
    };
    controller = new CategoryController(service as any);
  });

  const series = (sortBy?: string, order: 'asc' | 'desc' = 'asc') =>
    controller.getSeriesWiseProducts(
      'living',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      sortBy,
      order,
    );
  const subcategory = (sortBy?: string, order: 'asc' | 'desc' = 'asc') =>
    controller.getSubCategoryWiseProducts(
      'sofas',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      sortBy,
      order,
    );

  it('"Featured" sorts by isFeatured on both listings', async () => {
    await series('featured', 'desc');
    await subcategory('featured', 'desc');

    expect(service.getSeriesWiseProducts.mock.calls[0][0].orderBy).toEqual({
      isFeatured: 'desc',
    });
    expect(service.getSubCategoryWiseProducts.mock.calls[0][0].orderBy).toEqual(
      { isFeatured: 'desc' },
    );
  });

  it('no sort keeps the default order (undefined → service default)', async () => {
    await series();
    await subcategory();

    expect(
      service.getSeriesWiseProducts.mock.calls[0][0].orderBy,
    ).toBeUndefined();
    expect(
      service.getSubCategoryWiseProducts.mock.calls[0][0].orderBy,
    ).toBeUndefined();
  });

  it('an unknown sort is a 400 before any query', () => {
    expect(() => series('passwordHash')).toThrow(BadRequestException);
    expect(() => subcategory('passwordHash')).toThrow(BadRequestException);
    expect(service.getSeriesWiseProducts).not.toHaveBeenCalled();
    expect(service.getSubCategoryWiseProducts).not.toHaveBeenCalled();
  });

  it('still always lists active, in-stock products', async () => {
    await series('price');
    await subcategory('price');

    expect(service.getSeriesWiseProducts.mock.calls[0][0]).toMatchObject({
      isActive: true,
      admin: false,
    });
    expect(service.getSubCategoryWiseProducts.mock.calls[0][0]).toMatchObject({
      isActive: true,
      admin: false,
    });
  });
});
