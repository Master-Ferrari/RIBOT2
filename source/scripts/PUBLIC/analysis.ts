import { ContextMenuCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandType } from 'discord-api-types/v9';
import util from 'util';
import fs from 'fs/promises';
import { MessageContextMenuCommandInteraction, Client } from 'discord.js';
// import { printD } from '../../lib/consoleUtils';

import { ScriptBuilder } from '../../libs/scripts';

export const script = new ScriptBuilder({
    name: "analysis",
    group: "basa",
}).addOnContext(
    {
        contextDeployData: new ContextMenuCommandBuilder()
            .setName('analysis')
            .setType(ApplicationCommandType.Message),
        onContext: async (interaction) => {
            if (!interaction.isMessageContextMenuCommand()) return;

            const targetMessage = interaction.targetMessage;

            const output = util.inspect(targetMessage, { depth: null });

            const filename = 'output.js';
            await fs.writeFile(filename, output, 'utf8');
            await interaction.reply({ files: [filename] });
            await fs.unlink(filename);

        }
    }
)