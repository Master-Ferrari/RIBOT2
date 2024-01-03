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
        .addChannelOption(option =>
            option.setName('botschannel')
                .setDescription('bots channel')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildText))
        .addStringOption(option =>
            option.setName('webhook')
                .setDescription('main webhook link')
                .setRequired(false)),

    async execute(interaction: CommandInteraction, client: Client): Promise<void> {

        const options: any = interaction.options;

        const botschannel = options.getChannel("botschannel");
        const webhook = options.getString("webhook");

        if (!interaction.guildId) return;

        if (botschannel) {
            const channel = await fetchChannel(client, interaction.guildId, botschannel.id);
            if (!channel) {
                await interaction.reply({
                    content: 'Channel not found',
                    ephemeral: true
                });
                return;
            }
        }



        Database.interact('database.db', async (db) => {
            const result = await db.getJSON('guildSettings', String(interaction.guildId));

            let guildSetting: GuildSetting | null = null;

            if (isGuildSetting(result)) {
                guildSetting = result;
            }

            // printD({ botschannel: botschannel.id });

            guildSetting = {
                guildName: interaction.guild?.name || guildSetting?.guildName || "",
                guildId: interaction.guild?.id || guildSetting?.guildId || "",
                botChannelId: botschannel?.id || guildSetting?.botChannelId || "",
                mainWebhookLink: webhook || guildSetting?.mainWebhookLink || ""
            };

            printD({ guildSetting });

            await db.setJSON('guildSettings', String(interaction.guildId), guildSetting);
        })


        await interaction.reply({
            content: '# thank you\n## i love you',
            ephemeral: true
        });

    },
};
