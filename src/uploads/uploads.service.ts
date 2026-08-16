import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';

const CHAT_FILE_LIMIT = 16 * 1024 * 1024;

const CHAT_MIME_ALLOWLIST = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
];

@Injectable()
export class UploadsService {
  private readonly bucket: GridFSBucket;
  private readonly chatBucket: GridFSBucket;

  constructor(@InjectConnection() connection: Connection) {
    if (!connection.db) {
      throw new Error('MongoDB connection is not ready');
    }
    this.bucket = new GridFSBucket(connection.db, { bucketName: 'images' });
    this.chatBucket = new GridFSBucket(connection.db, { bucketName: 'chat_files' });
  }

  static isAllowedChatMime(mime: string) {
    return CHAT_MIME_ALLOWLIST.some(
      (allowed) =>
        mime === allowed ||
        mime.startsWith('image/') ||
        mime.startsWith('video/'),
    );
  }

  uploadImage(file: Express.Multer.File) {
    return new Promise<{ id: string; filename: string }>((resolve, reject) => {
      const filename = `${Date.now()}-${file.originalname}`;
      const stream = this.bucket.openUploadStream(filename, {
        metadata: { contentType: file.mimetype },
      });
      stream.end(file.buffer);
      stream.on('error', reject);
      stream.on('finish', () => {
        resolve({ id: stream.id.toString(), filename });
      });
    });
  }

  async getImage(id: string) {
    const files = await this.bucket.find({ _id: new ObjectId(id) }).toArray();
    return files[0] ?? null;
  }

  openDownloadStream(id: string) {
    return this.bucket.openDownloadStream(new ObjectId(id));
  }

  async deleteImage(id: string) {
    try {
      await this.bucket.delete(new ObjectId(id));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  uploadChatFile(file: Express.Multer.File) {
    if (!UploadsService.isAllowedChatMime(file.mimetype)) {
      throw new BadRequestException('File type is not supported');
    }
    if (file.size > CHAT_FILE_LIMIT) {
      throw new BadRequestException('File is too large (max 16 MB)');
    }

    return new Promise<{
      id: string;
      filename: string;
      mimeType: string;
      size: number;
    }>((resolve, reject) => {
      const filename = `${Date.now()}-${file.originalname}`;
      const stream = this.chatBucket.openUploadStream(filename, {
        metadata: {
          contentType: file.mimetype,
          originalName: file.originalname,
          size: file.size,
        },
      });
      stream.end(file.buffer);
      stream.on('error', reject);
      stream.on('finish', () => {
        resolve({
          id: stream.id.toString(),
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        });
      });
    });
  }

  async getChatFile(id: string) {
    const files = await this.chatBucket.find({ _id: new ObjectId(id) }).toArray();
    return files[0] ?? null;
  }

  openChatFileStream(id: string) {
    return this.chatBucket.openDownloadStream(new ObjectId(id));
  }

  async deleteChatFile(id: string) {
    try {
      await this.chatBucket.delete(new ObjectId(id));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
}
