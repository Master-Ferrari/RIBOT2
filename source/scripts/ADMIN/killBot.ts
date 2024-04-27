import { SlashCommandBuilder } from 'discord.js';
import { ScriptBuilder } from '../../libs/scripts';

export const script = new ScriptBuilder({
    name: "killbot",
    group: "private",
}).addOnSlash({
    slashDeployData: new SlashCommandBuilder()
        .setName('killbot')
        .setDescription('kill the bot'),

    onSlash: async (interaction) => {

        await interaction.reply(':anger:\nmy final message.');

        process.exit();
    }
});