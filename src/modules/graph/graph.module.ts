import { Module } from '@nestjs/common';
import { MsalModule } from '../../shared/msal/msal.module';
import { GraphService } from './graph.service';

@Module({
  imports: [MsalModule],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
