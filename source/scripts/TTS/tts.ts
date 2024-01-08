import { CommandInteraction, SlashCommandBuilder, Client } from 'discord.js';
import { print, printD, printE, format, dateToStr } from '../../lib/consoleUtils';
import { PythonCommunicator } from '../../lib/pythonHandler';
import { wait } from '../../lib/discordUtils';
import path from 'path';
import fs from 'fs';

const scriptName = 'test.py';
const scriptsPath = path.join(__dirname, '../../../../TTS4/', scriptName);
const voicesPath = path.join(__dirname, '../../../../TTS4/misc/');
const outputPath = path.join(__dirname, '../../../output.wav');
const voices = fs.readdirSync(voicesPath).map(file => path.basename(file, '.wav'));
print ({voices});

export const command = {

    info: {
        type: "slash",
    },

    data: new SlashCommandBuilder()
        .setName('tts')
        .setDescription('its ttsing')
        .addStringOption(option =>
            option.setName('promt')
                .setDescription('promt')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('voice')
                .setDescription('voice')
                .setRequired(true)
                .addChoices(
                    ...voices.map(voice => ({ name: voice, value: voice })),
                ))
    ,

    async onIteraction(interaction: CommandInteraction, client: Client): Promise<void> {

        const options: any = interaction.options;
        const promt: string = options.getString("promt");
        const voice: string = options.getString("voice");

        interaction.deferReply({ ephemeral: false });

        const tts = new PythonCommunicator(scriptsPath, {
            onData: (data) => {
                print(format(data, { bold: true, foreground: 'white', background: 'green' }));
                if (data.includes('one')) {






                    interaction.editReply({ files: [outputPath] });
                }
            }
        });

        const args = JSON.stringify({ promt, voice });

        printD({ args });

        tts.send(args);
        tts.close();


    },
};
