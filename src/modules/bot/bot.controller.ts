import { Controller, Logger, Post, Req, Res } from '@nestjs/common';
import type { Request as BotRequest, Response as BotResponse } from 'botbuilder';
import type { Request, Response } from 'express';
import { TeamsBotAdapter } from './bot.adapter';
import { BotActivitiesService } from './bot.activities.service';

/**
 * Bot Framework messaging endpoint.
 * Teams sends every activity (messages, installs, uninstalls) to this route.
 */
@Controller('messages')
export class BotController {
  private readonly logger = new Logger(BotController.name);

  constructor(
    private readonly adapter: TeamsBotAdapter,
    private readonly activitiesService: BotActivitiesService,
  ) {}

  @Post()
  async messages(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      // Express request/response objects are structurally compatible with the
      // adapter's Request/Response boundary types.
      await this.adapter.process(
        req as unknown as BotRequest,
        res as unknown as BotResponse,
        (context) => this.activitiesService.onTurn(context),
      );
    } catch (error) {
      this.logger.error(
        `Failed to process incoming activity: ${this.errorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
