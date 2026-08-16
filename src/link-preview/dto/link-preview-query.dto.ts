import { IsUrl } from 'class-validator';

export class LinkPreviewQueryDto {
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url!: string;
}
