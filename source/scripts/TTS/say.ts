import { CommandInteraction, SlashCommandBuilder, Client } from 'discord.js';
import { print, printD, printE, format, dateToStr } from '../../libs/consoleUtils';

import path from 'path';
import fs from 'fs';
import { ScriptBuilder } from '../../libs/scripts';
// import { featureSwitches } from '../../botConfig.json';
import { TTSFactory, voicesOpenAI } from '../../libs/tts';


type FeatureSwitches = { [key: string]: boolean };
const featureSwitches: FeatureSwitches = require('../../botConfig.json').featureSwitches;
const enableCoquiAI = !("CoquiAI" in featureSwitches) || featureSwitches["CoquiAI"];
const voicesPath = enableCoquiAI ? path.join(__dirname, '../../../../TTS4/misc/') : undefined;
const voices = enableCoquiAI ? fs.readdirSync(voicesPath!).map(file => path.basename(file, '.wav')) : [];

export const script = new ScriptBuilder({
    name: "say",
    group: "TTS",
}).addOnSlash(
    {
        slashDeployData:
            new SlashCommandBuilder()
                .setName('say')
                .setDescription('its ttsing')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('promt')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('voice')
                        .setDescription('voice')
                        .setRequired(true)
                        .addChoices(
                            ...(enableCoquiAI ? voices.map(voice => ({ name: "[CoquiAI] " + voice, value: voice })) : []),
                            ...voicesOpenAI.map(voice => ({ name: "[OpenAI] " + voice, value: voice })),
                        )),
        onSlash: async (interaction) => {

            const options: any = interaction.options;
            const prompt: string = options.getString("text");
            const voice: string = options.getString("voice");

            interaction.deferReply({ ephemeral: false });

            let tts = TTSFactory.createTTS(voice);

            tts.send({
                prompt, voice, onWav: (data) => {
                    interaction.editReply({ files: [tts.outputPath] });
                }
            });

            const args = JSON.stringify({ promt: prompt, voice });

        }
    }
)

