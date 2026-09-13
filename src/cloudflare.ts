import { Container, getContainer } from '@cloudflare/containers';
import { env } from 'cloudflare:workers';

const optionalEnv = env as unknown as Record<string, string | undefined>;

export class FfaiApiContainer extends Container {
  defaultPort = 4000;
  sleepAfter = '30m';
  pingEndpoint = 'api/v1/health';
  enableInternet = true;

  envVars = {
    NODE_ENV: 'production',
    PORT: '4000',
    DATABASE_URL: env.DATABASE_URL,
    JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
    JWT_ACCESS_TTL: optionalEnv.JWT_ACCESS_TTL || '15m',
    JWT_REFRESH_TTL: optionalEnv.JWT_REFRESH_TTL || '7d',
    WEB_ORIGIN: env.WEB_ORIGIN || '',
    INTEGRATION_ENCRYPTION_KEY: env.INTEGRATION_ENCRYPTION_KEY,
    INTEGRATION_WEBHOOK_ALLOWED_HOSTS: optionalEnv.INTEGRATION_WEBHOOK_ALLOWED_HOSTS || '',
    REDIS_URL: optionalEnv.REDIS_URL || '',
    S3_ENDPOINT: optionalEnv.S3_ENDPOINT || '',
    S3_REGION: optionalEnv.S3_REGION || 'auto',
    S3_BUCKET: optionalEnv.S3_BUCKET || '',
    S3_ACCESS_KEY_ID: optionalEnv.S3_ACCESS_KEY_ID || '',
    S3_SECRET_ACCESS_KEY: optionalEnv.S3_SECRET_ACCESS_KEY || '',
  };
}

export default {
  async fetch(request: Request, workerEnv: Cloudflare.Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return getContainer(workerEnv.FFAI_API, 'primary').fetch(request);
    }

    return workerEnv.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Cloudflare.Env>;
