import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LinkPreviewQueryDto } from './dto/link-preview-query.dto';
import { LinkPreviewService } from './link-preview.service';

@ApiTags('link-preview')
@ApiBearerAuth('access-token')
@Controller('link-preview')
export class LinkPreviewController {
  constructor(private readonly linkPreviewService: LinkPreviewService) {}

  @Get()
  preview(@Query() query: LinkPreviewQueryDto) {
    return this.linkPreviewService.preview(query.url);
  }
}
