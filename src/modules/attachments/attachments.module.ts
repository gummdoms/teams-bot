import { Module } from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { AttachmentsController } from './attachments.controller';
import { FileStorageService } from './file-storage.service';

@Module({
  controllers: [AttachmentsController],
  providers: [FileStorageService, AttachmentService],
  exports: [AttachmentService],
})
export class AttachmentsModule {}
