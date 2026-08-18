import { Body, Controller, Get, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import { ProactiveMessageDto } from '../../common/dto/proactive-message.dto';
import { SearchUsersDto } from '../../common/dto/search-users.dto';
import { MessagingService } from './messaging.service';

/**
 * REST API to search users and send proactive messages.
 * Protected by the x-api-key header (ApiKeyGuard).
 */
@ApiTags('Mensajería')
@ApiBearerAuth('x-api-key')
@UseGuards(ApiKeyGuard)
@UseInterceptors(ResponseInterceptor)
@Controller()
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('users/search')
  @ApiOperation({
    summary: 'Busca usuarios en Microsoft Entra ID',
    description:
      'Busca usuarios por correo, UPN o nombre e indica si el bot puede enviarles mensajes proactivos.',
  })
  searchUsers(@Query() query: SearchUsersDto) {
    return this.messagingService.searchUsers(query.q);
  }

  @Post('users/proactive-message')
  @ApiOperation({
    summary: 'Envía un mensaje proactivo a uno o varios correos',
    description:
      'Resuelve cada correo en Microsoft Entra ID, crea la conversación si es necesario y entrega el mensaje. Devuelve el estado de entrega por destinatario.',
  })
  sendProactiveMessage(@Body() dto: ProactiveMessageDto) {
    return this.messagingService.sendProactiveMessage(dto);
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'Lista las conversaciones almacenadas del bot',
    description:
      'Devuelve las referencias de conversación persistidas (usuarios con el bot instalado).',
  })
  listConversations() {
    return this.messagingService.listConversations();
  }
}
