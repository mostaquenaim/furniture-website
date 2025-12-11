/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { CreateSeoDto } from './dto/create-seo.dto';
import { UpdateSeoDto } from './dto/update-seo.dto';

@Injectable()
export class SeoService {
  private seoEntries = [];

  getAll() { return this.seoEntries; }

  create(dto: CreateSeoDto) {
    console.log('SEO entry creation requested with dto:', dto);
    // const entry = { id: Date.now(), ...dto };
    // this.seoEntries.push(entry);
    // return entry;
  }

  update(id: string, dto: UpdateSeoDto) {
    console.log(`SEO entry update requested for id ${id} with dto:`, dto);
    // const idx = this.seoEntries.findIndex(s => s.id == +id);
    // if (idx === -1) return null;
    // this.seoEntries[idx] = { ...this.seoEntries[idx], ...dto };
    // return this.seoEntries[idx];
  }

  getByUrl(url: string) {
    console.log(`SEO entry retrieval requested for url: ${url}`);
    // return this.seoEntries.find(s => s.url === url);
  }

  generateSchema(url: string) {
    console.log(`Schema generation requested for url: ${url}`);
    // const seo = this.getByUrl(url);
    // if (!seo) return null;

    // return {
    //   "@context": "https://schema.org",
    //   "@type": "WebPage",
    //   "url": seo.url,
    //   "name": seo.title,
    //   "description": seo.description,
    //   "keywords": seo.keywords?.split(',') || [],
    // };
  }
}
