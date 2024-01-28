import { ContextMenuCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandType } from 'discord-api-types/v9';
import util from 'util';
import fs from 'fs/promises';
import { MessageContextMenuCommandInteraction, Client } from 'discord.js';
// import { printD } from '../../lib/consoleUtils';

export const command = {

    info: {
        type: "context",
    },

    data: new ContextMenuCommandBuilder()
        .setName('analysis')
        .setType(ApplicationCommandType.Message),

    async onInteraction(interaction: MessageContextMenuCommandInteraction, client: Client): Promise<void> {

        const targetMessage = interaction.targetMessage;

        const output = util.inspect(targetMessage, { depth: null });

        const filename = 'output.js';
        await fs.writeFile(filename, output, 'utf8');
        await interaction.reply({ files: [filename] });
        await fs.unlink(filename);

    },
};