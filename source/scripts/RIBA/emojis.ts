import { SlashCommandBuilder, CommandInteraction, CacheType, GuildEmoji } from 'discord.js';
import * as util from 'util';
import * as fs from 'fs/promises';
import { print, printD, printL, format, dateToStr } from '../../libs/consoleUtils';

import { ScriptBuilder } from '../../libs/scripts';
export const script = new ScriptBuilder({
    name: "emojis",
    group: "private",
}).addOnSlash({
    slashDeployData: new SlashCommandBuilder()
        .setName('emojis')
        .setDescription('list of server emojis'),
    onSlash: async (interaction) => {
        if (!interaction.guild) return;

        const emojis = interaction.guild.emojis.cache.map((emoji: GuildEmoji) => `${emoji.name}: ${emoji.toString()}`);
        printD(emojis);

        const output = util.inspect(emojis, { depth: null });

        const filename = 'output.js';
        await fs.writeFile(filename, output, 'utf8');
        await interaction.reply({ files: [filename] });
        await fs.unlink(filename);
    }
});