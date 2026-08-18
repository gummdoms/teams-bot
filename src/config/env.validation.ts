import * as Joi from 'joi';

/** Environment validation schema. Fails fast at startup when required values are missing. */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().positive().default(3000),

  MICROSOFT_APP_ID: Joi.string().required(),
  MICROSOFT_APP_PASSWORD: Joi.string().required(),
  MICROSOFT_APP_TENANT_ID: Joi.string().allow('').optional(),
  MICROSOFT_APP_NAME: Joi.string().default('Oberon360 Bot'),
  BOT_FRAMEWORK_OAUTH_SCOPE: Joi.string().default('https://api.botframework.com'),
  TEAMS_SERVICE_URL: Joi.string().uri().default('https://smba.trafficmanager.net/teams/'),

  GRAPH_TENANT_ID: Joi.string().allow('').optional(),
  GRAPH_CLIENT_ID: Joi.string().allow('').optional(),
  GRAPH_CLIENT_SECRET: Joi.string().allow('').optional(),
  GRAPH_AUTHORITY: Joi.string().uri().default('https://login.microsoftonline.com'),
  GRAPH_BASE_URL: Joi.string().uri().default('https://graph.microsoft.com/v1.0'),
  GRAPH_SCOPE: Joi.string().default('https://graph.microsoft.com/.default'),

  MANIFEST_APP_ID: Joi.string().required(),
  TEAMS_APP_CATALOG_ID: Joi.string().allow('').optional(),

  API_KEY: Joi.string().allow('').optional(),

  PUBLIC_BASE_URL: Joi.string().uri().allow('').optional(),
  FILE_STORAGE_DIR: Joi.string().allow('').optional(),
  ATTACHMENT_MAX_SIZE_MB: Joi.number().positive().default(20),
  ATTACHMENT_TTL_HOURS: Joi.number().positive().default(24),
  ATTACHMENT_ALLOWED_HOSTS: Joi.string().allow('').optional(),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().integer().positive().default(5432),
  DB_USER: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().default('postgres'),
  DB_NAME: Joi.string().default('teams_bot'),
  DB_SYNCHRONIZE: Joi.boolean().truthy('true').falsy('false').default(true),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
});
