import { CommandInteraction, SlashCommandBuilder, Client } from 'discord.js';
import { print, printD, printE, format, dateToStr } from '../../lib/consoleUtils';

import path from 'path';
import fs from 'fs';

import { TTSFactory, voicesOpenAI } from '../../lib/tts';

const voicesPath = path.join(__dirname, '../../../../TTS4/misc/');
const voices = fs.readdirSync(voicesPath).map(file => path.basename(file, '.wav'));

export const command = {

    info: {
        type: "slash",
    },

    data: new SlashCommandBuilder()
        .setName('say')
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
                    ...voices.map(voice => ({ name: "[CoquiAI] " + voice, value: voice })),
                    ...voicesOpenAI.map(voice => ({ name: "[OpenAI] " + voice, value: voice })),
                )),

    async onIteraction(interaction: CommandInteraction, client: Client): Promise<void> {

        const options: any = interaction.options;
        const prompt: string = options.getString("promt");
        const voice: string = options.getString("voice");

        interaction.deferReply({ ephemeral: false });

        let tts = TTSFactory.createTTS(voice);

        tts.send({
            prompt, voice, onWav: (data) => {
                interaction.editReply({ files: [tts.outputPath] });
            }
        });

        const args = JSON.stringify({ promt: prompt, voice });
    },
};
