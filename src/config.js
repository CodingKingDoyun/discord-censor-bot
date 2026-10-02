import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROOT_DIR = resolve(import.meta.dirname, '..');

/**
 * .env 파일과 환경 변수에서 설정을 읽어온다.
 * Node 21.7+ 의 process.loadEnvFile 을 사용하므로 dotenv 의존성이 필요 없다.
 */
export function loadConfig() {
  const envPath = resolve(ROOT_DIR, '.env');
  if (existsSync(envPath)) process.loadEnvFile(envPath);

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error('DISCORD_TOKEN 이 설정되지 않았습니다. .env.example 을 참고해 .env 파일을 만들어 주세요.');
  }

  return {
    token,
    // 지정하면 해당 서버에만 슬래시 명령어를 즉시 등록한다. (비우면 전역 등록, 반영까지 최대 1시간)
    guildId: process.env.GUILD_ID || null,
    dbPath: resolve(ROOT_DIR, process.env.DB_PATH || 'data/censor.db'),
    bannedWordsPath: resolve(ROOT_DIR, 'data/banned-words.txt'),
    allowedWordsPath: resolve(ROOT_DIR, 'data/allowed-words.txt'),
  };
}
