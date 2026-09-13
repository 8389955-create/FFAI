import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
const sqlFile = process.env.FFAI_RESTORE_SQL_FILE;

if (process.env.FFAI_CONFIRM_RESTORE !== 'ffai-cloud-bootstrap') {
  throw new Error('拒绝恢复：必须显式设置 FFAI_CONFIRM_RESTORE=ffai-cloud-bootstrap。');
}

if (!databaseUrl || !sqlFile) {
  throw new Error('拒绝恢复：缺少 DATABASE_URL 或 FFAI_RESTORE_SQL_FILE。');
}

const host = databaseUrl.match(/@([^/:?]+)(?::\d+)?\//)?.[1];
if (host !== 'db.prisma.io') {
  throw new Error(`拒绝恢复：目标主机 ${host || '未知'} 不是已确认的临时 Prisma PostgreSQL。`);
}

const sql = (await readFile(sqlFile, 'utf8'))
  .split(/\r?\n/)
  .filter((line) => !line.startsWith('\\'))
  .join('\n');
if (!sql.includes('CREATE TABLE public."Organization"') || !sql.includes('CREATE TABLE public."User"')) {
  throw new Error('拒绝恢复：SQL 快照缺少 FFAI 核心表。');
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query(sql);
  console.log(`PostgreSQL 快照恢复完成：${Buffer.byteLength(sql)} bytes。`);
} finally {
  await client.end();
}
