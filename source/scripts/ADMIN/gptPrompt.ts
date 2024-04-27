import { SlashCommandBuilder, CommandInteraction, TextChannel, ChannelType, PresenceStatusData, MessageEditOptions, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { print, printD, printL, format, dateToStr } from '../../libs/consoleUtils';


import { ScriptBuilder } from '../../libs/scripts';
import Database from '../../libs/sqlite';
import { loadScriptsFromDirectories, updateScripts } from '../../index';
import { SafeDiscord, commonStuff } from '../../libs/discordUtils';
export const script = new ScriptBuilder({
    name: "gptprompt",
    group: "private",
}).addOnSlash({
    slashDeployData: new SlashCommandBuilder()
        .setName('gptprompt')
        .setDescription('global default gpt prompt')
        // .addStringOption(option =>
        //     option.setName('newprompt')
        //         .setDescription('text')
        //         .setRequired(true))
                ,
    onSlash: async (interaction) => {
        const options: any = interaction.options;


        const table = await Database.interact('database.db', async (db) => {
            return await db.getJSON('global', 'commonStuff') as commonStuff;
        });

        const modal = new ModalBuilder()
            .setCustomId("gptPromptModal")
            .setTitle('This is your GPT request');

        const hobbiesInput = new TextInputBuilder()
            .setCustomId("gptPromptModalGap")
            .setLabel("Use %pseudonyms%")
            .setStyle(TextInputStyle.Paragraph)
            .setValue(table.prompt??"")
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(hobbiesInput) as ActionRowBuilder<TextInputBuilder>;
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
        // await interaction.reply({ content: 'input', ephemeral: true });


    }
}).addOnModal({
    isValidModalCustomId: async (customId: string): Promise<boolean> => {
        return "gptPromptModal" == customId;
    },
    onModal: async (interaction) => {

        const newprompt = interaction.components[0].components[0].value;

        const table = await Database.interact('database.db', async (db) => {
            const json = await db.getJSON('global', 'commonStuff') as commonStuff;
            json.prompt = newprompt;
            await db.setJSON('global', 'commonStuff', json);
        });

        await updateScripts();

        await interaction.reply({ content: 'done!', ephemeral: true });

    }
});
