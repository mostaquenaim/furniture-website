export class UpdatePromoBannerDto {
  text?: string;
  bgColor?: string;
  order?: number;
  isActive?: boolean;

  links?: {
    text: string;
    url: string;
  }[];
}
