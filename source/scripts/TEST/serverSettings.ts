import { CommandInteraction, SlashCommandBuilder, Client, ChannelType } from 'discord.js';
import { print, printD, printE, format, dateToStr } from '../../lib/consoleUtils';
import { fetchLastNMessages, GuildSetting, isGuildSetting, fetchChannel } from '../../lib/discordUtils';

import Database from '../../lib/sqlite';

export const command = {

    info: {
        type: "slash",
    },

    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('server settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('set server settings')
                .addChannelOption(option =>
                    option.setName('botschannel')
                        .setDescription('bots channel')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText))
                .addStringOption(option =>
                    option.setName('webhook')
                        .setDescription('ribot webhook url')
                        .setRequired(false))
                .addChannelOption(option =>
                    option.setName('eventschannel')
                        .setDescription('events channel')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('get')
                .setDescription('show server settings'))
    ,

    async execute(interaction: CommandInteraction, client: Client): Promise<void> {

        const options: any = interaction.options;

        const botsChannel = options.getChannel("botschannel");
        const mainWebhook = options.getString("webhook");
        const eventsChannel = options.getChannel("eventschannel");

        const guildSetting = await Database.interact('database.db', async (db) => {
            const result = await db.getJSON('guildSettings', String(interaction.guildId));

            let guildSetting: GuildSetting | null = null;

            if (isGuildSetting(result)) {
                guildSetting = result as GuildSetting;
            }

            if (options._subcommand == "get") {
                return guildSetting;
            }

            guildSetting = {
                guildName: interaction.guild?.name || guildSetting?.guildName || "",
                guildId: interaction.guild?.id || guildSetting?.guildId || "",
                botChannelId: botsChannel?.id || guildSetting?.botChannelId || "",
                mainWebhookLink: mainWebhook || guildSetting?.mainWebhookLink || "",
                eventschannelId: eventsChannel?.id || guildSetting?.eventschannelId || "",
            };

            await db.setJSON('guildSettings', String(interaction.guildId), guildSetting);

            return guildSetting;
        })

        if (options._subcommand == "get") {
            await interaction.reply({
                content: `\`\`\`json\n ${JSON.stringify(guildSetting, null, 2)} \`\`\``,
                ephemeral: true
            });
            return;
        }

        await interaction.reply({
            content: '# thank you\n## i love you',
            ephemeral: true
        });

    },
};
