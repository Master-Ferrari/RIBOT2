import { CommandInteraction, SlashCommandBuilder, Client } from 'discord.js';
import { spawnSync } from 'child_process';

import { print, printD, printL, format, dateToStr } from '../../lib/consoleUtils';
import { findMessage } from '../../lib/discordUtils';
import Database from '../../lib/sqlite';

import * as path from 'path';
const scriptPath = path.join(__dirname, './dist/motherscript.js');

const db = new Database('database.db');

export const command = {
    info: {
        type: "slash",
    },

    data: new SlashCommandBuilder()
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

    async execute(interaction: CommandInteraction, client: Client): Promise<void> {

        const options: any = interaction.options;
        const full = options.getString('full') === 'True';

        // printL(`its updating me..`);

        const msgText = 'Restarting...';
        await interaction.reply(msgText);

        const user: any = client.user;
        const reply: any = await findMessage(interaction.channelId, user.id, msgText, client);

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
    },
};
