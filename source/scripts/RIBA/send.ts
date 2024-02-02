import { SlashCommandBuilder, CommandInteraction, TextChannel, ChannelType } from 'discord.js';
import { print, printD, printL, format, dateToStr } from '../../libs/consoleUtils';


import { ScriptBuilder } from '../../libs/scripts';
export const script = new ScriptBuilder({
    name: "send",
    group: "private",
}).addOnSlash({
    slashDeployData: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Sends a specified message to a specified channel')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text you want to send')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel you want to send the message to')
                .setRequired(true)),
    onSlash: async (interaction) => {
        const options: any = interaction.options;
        const text = options.getString('text', true);
        const channel = options.getChannel('channel', true) as TextChannel;

        if (channel?.type === ChannelType.GuildText) {
            const message = await channel.send(text);
            await interaction.reply({
                content: `Message sent to ${channel.name}!`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: `Cannot send a message to ${channel.name}`,
                ephemeral: true
            });
        }
    }
});
