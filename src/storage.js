import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * 서버(guild)별 유저 검열 횟수를 SQLite 에 저장한다.
 * Node 내장 node:sqlite 를 사용해 Termux 에서도 네이티브 모듈 빌드가 필요 없다.
 * 디스코드 ID(snowflake)는 JS Number 범위를 넘으므로 TEXT 로 저장한다.
 */
export class CensorStore {
  /** @param {string} path DB 파일 경로 (테스트에서는 ':memory:') */
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS censor_counts (
        guild_id   TEXT    NOT NULL,
        user_id    TEXT    NOT NULL,
        count      INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id)
      );
    `);

    this.addStmt = this.db.prepare(`
      INSERT INTO censor_counts (guild_id, user_id, count) VALUES (?, ?, ?)
      ON CONFLICT (guild_id, user_id)
      DO UPDATE SET count = count + excluded.count, updated_at = CURRENT_TIMESTAMP
      RETURNING count
    `);
    this.getStmt = this.db.prepare(
      'SELECT count FROM censor_counts WHERE guild_id = ? AND user_id = ?',
    );
    this.rankStmt = this.db.prepare(
      'SELECT COUNT(*) + 1 AS rank FROM censor_counts WHERE guild_id = ? AND count > ?',
    );
    this.topStmt = this.db.prepare(`
      SELECT user_id AS userId, count FROM censor_counts
      WHERE guild_id = ? ORDER BY count DESC, updated_at ASC LIMIT ?
    `);
  }

  /** 검열 횟수를 amount 만큼 늘리고, 늘어난 누적 횟수를 반환한다. */
  add(guildId, userId, amount) {
    return this.addStmt.get(guildId, userId, amount).count;
  }

  getCount(guildId, userId) {
    return this.getStmt.get(guildId, userId)?.count ?? 0;
  }

  /** 서버 내 순위 (검열 횟수가 많을수록 높은 순위) */
  getRank(guildId, userId) {
    return this.rankStmt.get(guildId, this.getCount(guildId, userId)).rank;
  }

  /** @returns {{ userId: string, count: number }[]} */
  top(guildId, limit = 10) {
    return this.topStmt.all(guildId, limit);
  }

  close() {
    this.db.close();
  }
}
