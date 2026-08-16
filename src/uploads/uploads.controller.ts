import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { UploadsService } from './uploads.service';

function isPdfType(contentType: string, filename: string) {
  const lower = filename.toLowerCase();
  return contentType.includes('pdf') || lower.endsWith('.pdf');
}

function shouldServeInline(contentType: string, filename: string, forceDownload: boolean) {
  if (forceDownload) return false;
  if (contentType.startsWith('image/') || contentType.startsWith('video/')) return true;
  return isPdfType(contentType, filename);
}

@ApiTags('uploads')
@ApiBearerAuth('access-token')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @ApiOperation({ summary: 'Upload a post image (max 5 MB)' })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFile() image?: Express.Multer.File) {
    if (!image) throw new BadRequestException('image file is required');
    const file = await this.uploadsService.uploadImage(image);
    return {
      id: file.id,
      url: `/uploads/image/${file.id}`,
      filename: file.filename,
    };
  }

  @Post('chat-file')
  @ApiOperation({ summary: 'Upload a chat attachment (max 16 MB)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 16 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!UploadsService.isAllowedChatMime(file.mimetype)) {
          cb(new BadRequestException('File type is not supported'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadChatFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');
    const uploaded = await this.uploadsService.uploadChatFile(file);
    return {
      id: uploaded.id,
      url: `/uploads/file/${uploaded.id}`,
      filename: uploaded.filename,
      mimeType: uploaded.mimeType,
      size: uploaded.size,
    };
  }

  @Public()
  @Get('file/:id')
  @ApiOperation({
    summary: 'Stream a chat attachment (public — used by img/video tags)',
  })
  async getChatFile(
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Res() response: Response,
  ) {
    const metadata = await this.uploadsService.getChatFile(id);
    if (!metadata) {
      throw new BadRequestException('File not found');
    }
    const meta = metadata.metadata as
      | { contentType?: string; originalName?: string }
      | undefined;
    const filename = meta?.originalName || metadata.filename;
    let contentType = meta?.contentType || 'application/octet-stream';
    if (isPdfType(contentType, filename)) {
      contentType = 'application/pdf';
    }
    const forceDownload = download === '1' || download === 'true';
    response.setHeader('Content-Type', contentType);
    response.setHeader(
      'Content-Disposition',
      shouldServeInline(contentType, filename, forceDownload)
        ? 'inline'
        : `attachment; filename="${filename.replace(/"/g, '')}"`,
    );
    const stream = this.uploadsService.openChatFileStream(id);
    stream.pipe(response);
  }

  @Public()
  @Get('image/:id')
  @ApiOperation({
    summary: 'Stream an uploaded image (public — used by img tags)',
  })
  async getImage(@Param('id') id: string, @Res() response: Response) {
    const metadata = await this.uploadsService.getImage(id);
    if (!metadata) {
      throw new BadRequestException('Image not found');
    }
    const contentType = (metadata.metadata as { contentType?: string } | undefined)?.contentType;
    response.setHeader('Content-Type', contentType || 'application/octet-stream');
    const stream = this.uploadsService.openDownloadStream(id);
    stream.pipe(response);
  }
}
