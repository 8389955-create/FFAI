import { readFileSync } from 'node:fs';

const errors = [];
const wranglerConfig = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const configuredAccountId = wranglerConfig.match(/"account_id"\s*:\s*"([a-f0-9]{32})"/i)?.[1];
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || configuredAccountId;
const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api/v1';

if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) {
  errors.push('CLOUDFLARE_ACCOUNT_ID 必须设置为已确认账号的 32 位账号 ID。');
}

if (apiUrl !== '/api/v1') {
  try {
    const url = new URL(apiUrl);
    const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
    if (url.protocol !== 'https:' || localHosts.has(url.hostname)) {
      errors.push('NEXT_PUBLIC_API_URL 必须是公网 HTTPS 地址，不能指向本机。');
    }
  } catch {
    errors.push('NEXT_PUBLIC_API_URL 不是有效 URL。');
  }
}

if (errors.length > 0) {
  console.error(`Cloudflare 生产部署已阻止：\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`Cloudflare 部署前置检查通过：账号 ${accountId}，API ${apiUrl === '/api/v1' ? '同源 Container /api/v1' : apiUrl}`);
