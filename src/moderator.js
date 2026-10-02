import { RESTJSONErrorCodes } from 'discord.js';
import { buildRepost } from './formatter.js';
import { logger } from './logger.js';

const WEBHOOK_NAME = 'CensorBot Relay';
/** 이 크기를 넘는 첨부파일은 재업로드하지 않는다. (봇 기본 업로드 한도 10MB) */
const MAX_REUPLOAD_BYTES = 10 * 1024 * 1024;

export class Moderator {
  /**
   * @param {object} deps
   * @param {import('discord.js').Client} deps.client
   * @param {import('./filter.js').WordFilter} deps.filter
   * @param {import('./storage.js').CensorStore} deps.store
   */
  constructor({ client, filter, store }) {
    this.client = client;
    this.filter = filter;
    this.store = store;
    /** @type {Map<string, import('discord.js').Webhook>} 채널 ID → 재전송용 웹훅 */
    this.webhooks = new Map();
  }

  /** @param {import('discord.js').Message} message */
  async handle(message) {
    if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;

    const matches = this.filter.find(message.content);
    if (matches.length === 0) return;

    // 삭제하면 첨부파일 URL 이 무효화되므로 먼저 받아둔다.
    const files = await this.#downloadAttachments(message);

    try {
      await message.delete();
    } catch (err) {
      if (err.code !== RESTJSONErrorCodes.UnknownMessage) {
        logger.warn(`#${message.channel.name} 메시지 삭제 실패 (메시지 관리 권한 확인 필요):`, err.message);
      }
      return;
    }

    // 한 메시지에서 여러 번 걸렸다면 그 횟수만큼 카운트한다.
    const total = this.store.add(message.guildId, message.author.id, matches.length);
    logger.info(
      `검열: ${message.author.tag} @ ${message.guild.name}#${message.channel.name}`
        + ` (${matches.map((m) => m.word).join(', ')}) → 누적 ${total}회`,
    );

    await this.#repost(message, { text: message.content, matches, total }, files);
  }

  /**
   * 원래 작성자의 이름과 프로필 사진으로 보이도록 웹훅을 통해 재전송한다.
   * 웹훅을 쓸 수 없으면 봇 계정으로 작성자 이름을 붙여 보낸다.
   */
  async #repost(message, repost, files) {
    const name = message.member?.displayName ?? message.author.displayName;
    const base = { allowedMentions: { parse: [] } }; // 원문에 있던 @everyone 등이 다시 울리지 않게

    const { webhook, threadId, targetId } = await this.#getWebhook(message.channel);
    if (webhook) {
      const sent = await sendWithFileFallback(
        (extra) => webhook.send({
          ...base,
          ...extra,
          content: buildRepost(repost),
          username: name.slice(0, 80),
          avatarURL: (message.member ?? message.author).displayAvatarURL(),
          threadId: threadId ?? undefined,
        }),
        files,
      ).catch((err) => {
        if (err.code === RESTJSONErrorCodes.UnknownWebhook) this.webhooks.delete(targetId);
        logger.warn('웹훅 재전송 실패, 봇 메시지로 대체합니다:', err.message);
        return null;
      });
      if (sent) return;
    }

    await sendWithFileFallback(
      (extra) => message.channel.send({
        ...base,
        ...extra,
        content: buildRepost({ ...repost, header: `**${name}** 님의 메시지` }),
      }),
      files,
    ).catch((err) => logger.error('메시지 재전송 실패:', err.message));
  }

  /** 채널(스레드라면 상위 채널)의 웹훅을 찾거나 만든다. */
  async #getWebhook(channel) {
    const threadId = channel.isThread() ? channel.id : null;
    const target = channel.isThread() ? channel.parent : channel;
    if (!target || typeof target.fetchWebhooks !== 'function') return { webhook: null, threadId };

    let webhook = this.webhooks.get(target.id);
    if (!webhook) {
      try {
        const hooks = await target.fetchWebhooks();
        webhook = hooks.find((h) => h.owner?.id === this.client.user.id && h.token)
          ?? await target.createWebhook({ name: WEBHOOK_NAME, reason: '검열된 메시지 재전송용' });
        this.webhooks.set(target.id, webhook);
      } catch (err) {
        logger.warn(`#${target.name} 웹훅을 준비하지 못했습니다 (웹훅 관리 권한 확인 필요):`, err.message);
        return { webhook: null, threadId };
      }
    }
    return { webhook, threadId, targetId: target.id };
  }

  async #downloadAttachments(message) {
    const files = [];
    for (const attachment of message.attachments.values()) {
      if (attachment.size > MAX_REUPLOAD_BYTES) continue;
      try {
        const res = await fetch(attachment.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        files.push({ attachment: Buffer.from(await res.arrayBuffer()), name: attachment.name });
      } catch (err) {
        logger.warn(`첨부파일 ${attachment.name} 다운로드 실패:`, err.message);
      }
    }
    return files;
  }
}

/** 첨부파일과 함께 보내되, 용량 초과 등으로 실패하면 첨부파일 없이 다시 보낸다. */
async function sendWithFileFallback(send, files) {
  if (files.length === 0) return send({});
  try {
    return await send({ files });
  } catch (err) {
    if (err.code !== RESTJSONErrorCodes.RequestEntityTooLarge) throw err;
    logger.warn('첨부파일이 너무 커서 텍스트만 재전송합니다.');
    return send({});
  }
}
