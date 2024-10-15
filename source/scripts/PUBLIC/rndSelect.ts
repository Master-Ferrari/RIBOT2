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
            .addStringOption(option => option.setName('text1').setDescription('text1').setRequired(true))
            .addStringOption(option => option.setName('text2').setDescription('text2').setRequired(false))
            .addStringOption(option => option.setName('text3').setDescription('text3').setRequired(false))
            .addStringOption(option => option.setName('text4').setDescription('text4').setRequired(false))
            .addStringOption(option => option.setName('text5').setDescription('text5').setRequired(false))
            .addStringOption(option => option.setName('text6').setDescription('text6').setRequired(false))
            .addStringOption(option => option.setName('text7').setDescription('text7').setRequired(false))
            .addStringOption(option => option.setName('text8').setDescription('text8').setRequired(false))
            .addStringOption(option => option.setName('text9').setDescription('text9').setRequired(false)) 
        ,
        onSlash: async (interaction) => {

            const options = interaction.options;
            const first = options.getString("text1", true);

            let maxLenght = 0;

            const list: string[] = [];
            for (let i = 1; i < 10; i++) {
                const option = options.getString(`text${i}`);
                if (option) {
                    list.push(option);
                    maxLenght = maxLenght > option.length ? maxLenght : option.length;
                }
            }
            // maxLenght += 6;

            maxLenght = maxLenght > 20 ? 20 : maxLenght;

            const random = Math.floor(Math.random() * list.length);

            // printD({number:number.getInteger("number")});


            await interaction.reply({
                content:
                    list.map((item, index) => {

                        const itIsSelected = index == random;

                        item = item.trim();
                        const spacesL = Math.floor((maxLenght - item.length) / 2);
                        const spacesR = maxLenght - item.length - spacesL;

                        if (!itIsSelected) item = `\`${makeSpaces(spacesL)}   ${item}   ${makeSpaces(spacesR)}\``;
                        else item =             `**\`${makeSpaces(spacesL)}>> ${item} <<${makeSpaces(spacesR)}\`**`;


                        return String(index + 1) + ". " + item;
                        // item = `${spaces}${item}${spaces}`



                        // if (index == random) return `${index + 1}. **\`>>${item}<<\`**`
                        // return `${index + 1}. \`${item}\``


                        function makeSpaces(number: number): string {
                            number = number < 0 ? 0 : number;
                            return " ".repeat(number)
                        }
                    }).join('\n'),
                ephemeral: false
            });


        }
    }
)
