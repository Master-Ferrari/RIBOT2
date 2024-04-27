import { SlashCommandBuilder, CommandInteraction, TextChannel, ChannelType, PresenceStatusData } from 'discord.js';
import { print, printD, printL, format, dateToStr } from '../../libs/consoleUtils';


import { ScriptBuilder } from '../../libs/scripts';
export const script = new ScriptBuilder({
    name: "status",
    group: "private",
}).addOnSlash({
    slashDeployData: new SlashCommandBuilder()
        .setName('status')
        .setDescription('bot status')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('text')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('status')
                .setDescription('update commands?')
                .setRequired(false)
                .addChoices(
                    { name: 'online', value: 'online' },
                    { name: 'idle', value: 'idle' },
                    { name: 'dnd', value: 'dnd' },
                    { name: 'invisible', value: 'invisible' },
                    { name: 'streaming', value: 'streaming' },
                    { name: 'phone', value: 'phone' },
                )),
    onSlash: async (interaction) => {
        const options: any = interaction.options;
        const text = options.getString('text', true) as string;
        const status = options.getString('status', false) as PresenceStatusData | undefined;

        const client = script.client!;
        client.user!.setPresence({ activities: [{ name: text }], status });
        interaction.reply({ content: 'status set as ' + text + '', ephemeral: true });

    }
});
