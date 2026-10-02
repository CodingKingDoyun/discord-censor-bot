import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { commandData, handleCommand } from './commands.js';
import { loadConfig } from './config.js';
import { WordFilter } from './filter.js';
import { logger } from './logger.js';
import { Moderator } from './moderator.js';
import { CensorStore } from './storage.js';

const config = loadConfig();
const filter = WordFilter.fromFiles(config.bannedWordsPath, config.allowedWordsPath);
const store = new CensorStore(config.dbPath);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // 메시지 내용 읽기 (Privileged)
  ],
});
const moderator = new Moderator({ client, filter, store });

client.once(Events.ClientReady, async (readyClient) => {
  logger.info(`${readyClient.user.tag} 로그인 완료 · 금지어 ${filter.bannedWords.length}개 / 허용어 ${filter.allowedWords.length}개 로드`);
  try {
    if (config.guildId) {
      await readyClient.application.commands.set(commandData, config.guildId);
      logger.info(`슬래시 명령어를 서버(${config.guildId})에 등록했습니다.`);
    } else {
      await readyClient.application.commands.set(commandData);
      logger.info('슬래시 명령어를 전역 등록했습니다. (반영까지 최대 1시간)');
    }
  } catch (err) {
    logger.error('슬래시 명령어 등록 실패:', err);
  }
});

client.on(Events.MessageCreate, (message) => {
  moderator.handle(message).catch((err) => logger.error('메시지 처리 중 오류:', err));
});

// 수정으로 금지어를 넣는 경우도 검열한다.
client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
  if (oldMessage.content === newMessage.content) return; // 링크 미리보기 등 내용 외 변경
  moderator.handle(newMessage).catch((err) => logger.error('수정 메시지 처리 중 오류:', err));
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleCommand(interaction, store);
  } catch (err) {
    logger.error(`/${interaction.commandName} 처리 중 오류:`, err);
    const reply = { content: '명령어 처리 중 오류가 발생했습니다.', flags: MessageFlags.Ephemeral };
    await (interaction.replied || interaction.deferred ? interaction.followUp(reply) : interaction.reply(reply))
      .catch(() => {});
  }
});

process.on('unhandledRejection', (err) => logger.error('처리되지 않은 Promise 거부:', err));

const shutdown = async (signal) => {
  logger.info(`${signal} 수신, 종료합니다.`);
  await client.destroy();
  store.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

client.login(config.token);
