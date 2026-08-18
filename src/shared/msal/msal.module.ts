import { Module } from '@nestjs/common';
import { MsalService } from './msal.service';

@Module({
  providers: [MsalService],
  exports: [MsalService],
})
export class MsalModule {}
