import { CommandInteraction, SlashCommandBuilder, Client } from 'discord.js';
import { print, printD, printL, format, dateToStr } from '../../libs/consoleUtils';


export const command = {

    info: {
        type: "slash",
    },

    data: new SlashCommandBuilder()
        .setName('rnd')
        .setDescription('its randomit')
        .addIntegerOption(option =>
            option.setName('number')
                .setDescription('from 1 to input number')
                .setRequired(true)),

    async onInteraction(interaction: CommandInteraction, client: Client): Promise<void> {

        const options: any = interaction.options;
        const number = options.getInteger("number");
        // printD({number:number.getInteger("number")});

        const random = Math.floor(Math.random() * number)+1;

        await interaction.reply({
            content:  '# ' + random,
            ephemeral: false
        });

    },
};
