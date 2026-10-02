import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';

const COLOR_RED = 0xed4245;

export const commandData = [
  new SlashCommandBuilder()
    .setName('검열횟수')
    .setDescription('유저의 누적 검열 횟수를 확인합니다.')
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) => option
      .setName('유저')
      .setDescription('확인할 유저 (비워두면 본인)')),
  new SlashCommandBuilder()
    .setName('검열순위')
    .setDescription('이 서버에서 검열 횟수가 많은 유저 10명을 보여줍니다.')
    .setContexts(InteractionContextType.Guild),
].map((command) => command.toJSON());

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('./storage.js').CensorStore} store
 */
export async function handleCommand(interaction, store) {
  switch (interaction.commandName) {
    case '검열횟수': {
      const user = interaction.options.getUser('유저') ?? interaction.user;
      const count = store.getCount(interaction.guildId, user.id);
      const embed = new EmbedBuilder()
        .setColor(COLOR_RED)
        .setAuthor({ name: user.displayName, iconURL: user.displayAvatarURL() })
        .setDescription(
          count > 0
            ? `누적 검열 **${count}회** · 서버 내 **${store.getRank(interaction.guildId, user.id)}위**`
            : '아직 검열된 기록이 없습니다. 🎉',
        );
      return interaction.reply({ embeds: [embed] });
    }

    case '검열순위': {
      const rows = store.top(interaction.guildId, 10);
      const embed = new EmbedBuilder()
        .setColor(COLOR_RED)
        .setTitle('🚫 검열 순위')
        .setDescription(
          rows.length > 0
            ? rows.map((row, i) => `**${i + 1}.** <@${row.userId}> — ${row.count}회`).join('\n')
            : '아직 검열된 기록이 없습니다.',
        );
      return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    }

    default:
      return undefined;
  }
}
