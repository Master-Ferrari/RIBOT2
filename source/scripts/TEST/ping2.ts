import { CommandInteraction, SlashCommandBuilder, Client, TextChannel } from 'discord.js';
import { print, printD, printL, format, dateToStr } from '../../libs/consoleUtils';
import { ScriptBuilder } from '../../libs/scripts';

export const script = new ScriptBuilder({
    name: "ping2",
    group: "test",
}).addOnSlash(
    new SlashCommandBuilder()
        .setName('ping2')
        .setDescription('its ponging'),
    async (options) => {

        (options.interaction.channel as TextChannel).send({
            content: "",
            files: ["C:/Users/Pecarnya-REREMASTER/YandexDisk/_active/_4/dis7/output.wav"],
            flags: 8192 as number,
        });


        await options.interaction.reply({
            content: "pong",
            ephemeral: true
        });

    }
);

// export const command = {

//     info: {
//         type: "slash",
//     },

//     data: new SlashCommandBuilder()
//         .setName('ping2')
//         .setDescription('its ponging'),

//     async onInteraction(interaction: CommandInteraction, client: Client): Promise<void> {

//         (interaction.channel as TextChannel).send({
//             content: "",
//             files: ["C:/Users/Pecarnya-REREMASTER/YandexDisk/_active/_4/dis7/output.wav"],
//             flags: 8192 as number,
//         });


//         await interaction.reply({
//             content: "pong",
//             ephemeral: true
//         });
//     },
// };
