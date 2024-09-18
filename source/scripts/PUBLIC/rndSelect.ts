import { CommandInteraction, SlashCommandBuilder, Client } from 'discord.js';
import { print, printD, printL, format, dateToStr } from '../../libs/consoleUtils';
import { ScriptBuilder } from '../../libs/scripts';

export const script = new ScriptBuilder({
    name: "rndselect",
    group: "basa",
}).addOnSlash(
    {
        slashDeployData: new SlashCommandBuilder()
            .setName('rndselect')
            .setDescription('selects a random message from the list')
            .addStringOption(option => option.setName('text1' ).setDescription('text1' ).setRequired(true ))
            .addStringOption(option => option.setName('text2' ).setDescription('text2' ).setRequired(false))
            .addStringOption(option => option.setName('text3' ).setDescription('text3' ).setRequired(false))
            .addStringOption(option => option.setName('text4' ).setDescription('text4' ).setRequired(false))
            .addStringOption(option => option.setName('text5' ).setDescription('text5' ).setRequired(false))
            .addStringOption(option => option.setName('text6' ).setDescription('text6' ).setRequired(false))
            .addStringOption(option => option.setName('text7' ).setDescription('text7' ).setRequired(false))
            .addStringOption(option => option.setName('text8' ).setDescription('text8' ).setRequired(false))
            .addStringOption(option => option.setName('text9' ).setDescription('text9' ).setRequired(false))
            .addStringOption(option => option.setName('text10').setDescription('text10').setRequired(false))
        ,
        onSlash: async (interaction) => {

            const options = interaction.options;
            const first = options.getString("text1", true);

            const list: string[] = [first];
            for (let i = 1; i < 10; i++) {
                const option = options.getString(`text${i}`);
                if (option) {
                    list.push(option);
                }
            }


            const random = Math.floor(Math.random() * list.length);

            // printD({number:number.getInteger("number")});


            await interaction.reply({
                content:
                    list.map((item, index) => {
                        if (index == random) return `${index + 1}. **\`>> ${item} <<\`**`
                        return `${index + 1}. \`   ${item}\``
                    }).join('\n'),
                ephemeral: false
            });


        }
    }
)