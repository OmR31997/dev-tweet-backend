import { BadRequestException } from '@nestjs/common';
import { SendGroupMessageDto } from '../conversations/dto/send-group-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { Message } from './schemas/message.schema';

const DOC_MIME_PREFIXES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'text/plain',
];

export function isDocumentMime(mime: string) {
  return DOC_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

export function mediaPreviewLabel(message: Pick<Message, 'messageType' | 'content' | 'attachmentFilename'>) {
  if (message.messageType === 'image') {
    return message.content?.trim() || '📷 Photo';
  }
  if (message.messageType === 'document') {
    return message.attachmentFilename
      ? `📄 ${message.attachmentFilename}`
      : '📄 Document';
  }
  return message.content ?? '';
}

export function buildMessageFields(
  payload: SendMessageDto | SendGroupMessageDto,
) {
  const messageType = payload.messageType ?? 'text';

  if (messageType === 'text') {
    const content = payload.content ?? '';
    if (!content.trim()) {
      throw new BadRequestException('Message content is required');
    }
    return { messageType: 'text' as const, content };
  }

  const attachment = payload.attachment;
  if (!attachment?.fileId) {
    throw new BadRequestException('Attachment is required for media messages');
  }

  if (messageType === 'image' && !attachment.mimeType.startsWith('image/')) {
    throw new BadRequestException('Invalid image attachment');
  }

  if (messageType === 'document' && !isDocumentMime(attachment.mimeType)) {
    throw new BadRequestException('Invalid document attachment');
  }

  return {
    messageType: messageType as 'image' | 'document',
    content: payload.content?.trim() ?? '',
    attachmentId: attachment.fileId,
    attachmentMimeType: attachment.mimeType,
    attachmentFilename: attachment.filename,
    attachmentSize: attachment.size,
  };
}
