import { CommandInteraction, SlashCommandBuilder, Client, ChannelType } from 'discord.js';
import { print, printD, printE, printL, format, dateToStr } from '../../libs/consoleUtils';
import { fetchLastNMessages, GuildSetting, fetchChannel, completeGuildSettings, ScriptScopes } from '../../libs/discordUtils';

import Database from '../../libs/sqlite';
import { loadScriptsFromDirectories } from '../../index';

import { ScriptBuilder } from '../../libs/scripts';

export const script = new ScriptBuilder({
    name: "settings",
    group: "basa",
}).addOnSlash({
    slashDeployData: new SlashCommandBuilder()
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
        .setName('settings')
        .setDescription('server settings'),
    onSlash: async (interaction) => {

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

        const scriptsData = await loadScriptsFromDirectories();


        await printL(format(`Update!`, { foreground: 'white', background: 'yellow', bold: true, italic: true }));

        for (const script of scriptsData.scriptsList) {
            if (script.isUpdate()) {
                // const scriptScopes = { global: script.isGlobal, guilds: script.guilds.map(guild => guild.info.serverId) };
                await script.onUpdate();
                await printL(script.name + ' updated');
            }
        }
    }
});