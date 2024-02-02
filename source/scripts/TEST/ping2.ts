import { CommandInteraction, SlashCommandBuilder, Client, TextChannel } from 'discord.js';
import { print, printD, printL, format, dateToStr } from '../../libs/consoleUtils';
import { ScriptBuilder } from '../../libs/scripts';

export const script = new ScriptBuilder({
    name: "ping3233",
    group: "test",
}).addOnSlash(
    {
        slashDeployData: new SlashCommandBuilder()
            .setName('ping3233')
            .setDescription('its ponging'),
        onSlash: async (interaction) => {
            await interaction.reply({
                content: "pong",
                ephemeral: true
            });
        }
    }
);
