import { IsString } from 'class-validator';

export class UpdatePrivacyPolicyDto {
  @IsString()
  privacyPolicy!: string;
}
