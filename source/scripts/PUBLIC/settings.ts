import { CommandInteraction, SlashCommandBuilder, Client, ChannelType } from 'discord.js';
import { print, printD, printE, printL, format, dateToStr } from '../../lib/consoleUtils';
import { fetchLastNMessages, GuildSetting, fetchChannel, completeGuildSettings } from '../../lib/discordUtils';

import Database from '../../lib/sqlite';
import { loadScriptsFromDirectories } from '../../index';

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
                        .addChannelTypes(ChannelType.GuildText))
                .addChannelOption(option =>
                    option.setName('gptchannel')
                        .setDescription('gpt channel')
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('get')
                .setDescription('show server settings'))
    ,

    async onIteraction(interaction: CommandInteraction, client: Client): Promise<void> {

        const options: any = interaction.options;

        const botsChannel = options.getChannel("botschannel");
        const mainWebhook = options.getString("webhook");
        const eventsChannel = options.getChannel("eventschannel");
        const gptchannel = options.getChannel("gptchannel");

        const guildSetting = await Database.interact('database.db', async (db) => {
            const result = await db.getJSON('guildSettings', String(interaction.guildId));

            let guildSetting = completeGuildSettings(result as Partial<GuildSetting>);


            if (options._subcommand == "get") {
                return guildSetting;
            }

            guildSetting = {
                guildName: interaction.guild?.name || guildSetting.guildName || "",
                guildId: interaction.guild?.id || guildSetting.guildId || "",
                botChannelId: botsChannel?.id || guildSetting.botChannelId || "",
                mainWebhookLink: mainWebhook || guildSetting.mainWebhookLink || "",
                eventsChannelId: eventsChannel?.id || guildSetting.eventsChannelId || "",
                gptChannelId: gptchannel?.id || guildSetting.gptChannelId || "",
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

        const scriptsData = await loadScriptsFromDirectories(client);

        for (const script of scriptsData.scriptsList) {
            if (script.onUpdate) {
                await script.onUpdate(client, script.guilds.map(guild => guild.info.serverId));
                printL(script.info.comandName + ' updated');
            }
        }
    },
};
