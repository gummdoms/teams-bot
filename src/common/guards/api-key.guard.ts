import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ENV } from '../constants/config-globals';

/**
 * Protects the REST API with an API key sent in the "x-api-key" header.
 * When API_KEY is not configured (local development) the guard is disabled.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configuredKey = this.configService.get<string>(ENV.API_KEY);

    if (!configuredKey) {
      this.logger.warn('API_KEY is not set; REST API endpoints are not protected.');
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers['x-api-key'];

    if (!providedKey || providedKey !== configuredKey) {
      throw new UnauthorizedException('API key inválida o ausente.');
    }

    return true;
  }
}
