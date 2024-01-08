import { CommandInteraction, SlashCommandBuilder, Client } from 'discord.js';
import { print, printD, printL, format, dateToStr } from '../../lib/consoleUtils';

export const command = {

    info: {
        type: "slash",
    },

    data: new SlashCommandBuilder()
        .setName('ping2')
        .setDescription('its ponging'),

    async onIteraction(interaction: CommandInteraction, client: Client): Promise<void> {

        await interaction.reply({
            content: "pong",
            ephemeral: true
        });

    },
};
