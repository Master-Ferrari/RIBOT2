import { CommandInteraction, SlashCommandBuilder, Client, TextChannel } from 'discord.js';
import { print, printD, printL, format, dateToStr } from '../../libs/consoleUtils';
import { ScriptBuilder } from '../../libs/scripts';

import { GptFactory, G4f } from '../../libs/gptHandler';
const gpt = GptFactory.create("Gpt4Free", {
    model: 'gpt-3.5-turbo'
}) as G4f;

export const script = new ScriptBuilder({
    name: "translate",
    group: "test",
}).addOnSlash(
    {
        slashDeployData: new SlashCommandBuilder()
            .setName('translate')
            .setDescription('its translating')
            .addStringOption(option =>
                option.setName('text')
                    .setDescription('text to translate')
                    .setRequired(true)),
        onSlash: async (interaction) => {
            
            const reply = await interaction.deferReply();

            const ans = await gpt.requestTranslation("ru", "en", interaction.options.getString('text', true));
            
            await reply.edit({
                content: ans
            });
        }
    }
);
