import { CommandInteraction, SlashCommandBuilder, Client } from 'discord.js';
import { spawnSync } from 'child_process';

import { print, printD, printL, format, dateToStr } from '../../libs/consoleUtils';
import { findMessage } from '../../libs/discordUtils';
import Database from '../../libs/sqlite';

import * as path from 'path';
const scriptPath = path.join(__dirname, './dist/motherscript.js');

const db = new Database('database.db');

import { ScriptBuilder } from '../../libs/scripts';
export const script = new ScriptBuilder({
    name: "update",
    group: "private",
}).addOnSlash({
    slashDeployData: new SlashCommandBuilder()
        .setName('update')
        .setDescription('restarting the bot and deploying commands')
        .addStringOption(option =>
            option
                .setName('full')
                .setDescription('update commands?')
                .setRequired(false)
                .addChoices(
                    { name: 'True', value: 'True' }
                )),
    onSlash: async (interaction) => {

        const options: any = interaction.options;
        const full = options.getString('full') === 'True';

        // printL(`its updating me..`);

        const msgText = 'Restarting...';
        await interaction.reply(msgText);

        const user: any = script.client!.user;
        const reply: any = await findMessage(interaction.channelId, user.id, msgText, script.client!);

        await db.init();
        await db.setJSON('global', 'lastUpdateCommand',
            {
                'messageID': reply.id,
                'channelID': interaction.channelId,
                'guildID': interaction.guildId
            });
        await db.close();


        const command = 'npm run ribot' + (full ? ' update' : '');

        const child = spawnSync(command, { stdio: 'inherit', shell: true });


        process.exit();
    }
});