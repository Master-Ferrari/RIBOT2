import { Client, GatewayIntentBits, Partials, Events, Collection, SlashCommandBuilder, CommandInteraction } from 'discord.js';
import * as path from 'path';
import * as fs from 'fs';
import { Routes } from 'discord-api-types/v9';
import { getDirectories } from './lib/fsUtils';
import { REST } from '@discordjs/rest';

import { print, printD, printL, format, dateToStr } from './lib/consoleUtils';
import { fetchMessage } from './lib/discordUtils';
import { ribotToken, clientId } from './botConfig.json';
import Database from './lib/sqlite';

const deployPath = path.join(__dirname, './deploy');
const scriptsPath = path.join(__dirname, './scripts');

const client: Client = new Client({
    intents: [
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildScheduledEvents,
    ],
    partials: [
        Partials.Channel, // Required to receive DMs
    ]
});

//#region ON READY
client.once(Events.ClientReady, async () => {
    await printL(format(`Logged`, { foreground: 'white', background: 'red', bold: true, italic: true })
        + ` as ${client.user?.tag}`
        + dateToStr(new Date(), "timeStamp"));


    const scriptsData = await loadScriptsFromDirectories(scriptsPath, client);
    // printD(scriptsData.scriptsList); 

    if (process.argv.includes('update')) {
        await deployCommands(scriptsData.serverScripts, client);
    }

    await subscribeToInteractions(client, scriptsData.scriptsList);

    await printL(format(`Ready!`, { foreground: 'white', background: 'red', bold: true, italic: true }));

    updateAnswer(client);

});
// #endregion

//#region DEPLOY COMMANDS

const rest = new REST({ version: '9' }).setToken(ribotToken);

type ScriptsConfig = {
    guilds: Record<string, string>;
};

type ScriptConfig = {
    info: {
        comandName: string;
        type: string;
        serverName: string;
        serverId: string;
        folder: string;
    };
    data: SlashCommandBuilder;
    execute(interaction: CommandInteraction, client: Client): Promise<void>;
};

// type ServerScripts = Record<string, string[]>;
type ServerScripts = Record<string, Array<ScriptConfig>>;

async function loadScriptsFromDirectories(directoryPath: string, client: Client):
    Promise<{ serverScripts: ServerScripts, scriptsList: ScriptConfig[] }> {

    const serverScripts: ServerScripts = {};

    const scriptsList: ScriptConfig[] = [];

    const subdirectories = getDirectories(scriptsPath);


    for (const subdir of subdirectories) {
        const configPath = path.join(directoryPath, subdir, 'scriptsConfig.json');

        if (fs.existsSync(configPath)) {

            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config: ScriptsConfig = JSON.parse(configContent);

            for (const [serverName, serverId] of Object.entries(config.guilds)) {
                const scriptFiles = fs.readdirSync(path.join(directoryPath, subdir))
                    .filter(file => file !== 'scriptsConfig.json')
                    .filter(file => file !== 'scriptsConfig--.json');

                if (!serverScripts[serverId]) {
                    serverScripts[serverId] = [];
                }

                const guild = await fetchGuild(client, serverId);

                scriptFiles.forEach(async file => {
                    const relativePath = path.join(subdir, file);

                    const fullPath = path.join(scriptsPath, relativePath);

                    const commandScript = require(fullPath);

                    const scriptData: ScriptConfig = {
                        info: {
                            comandName: commandScript.command.data.name,
                            ...commandScript.command.info,
                            serverName: guild.name,
                            serverId: serverId,
                            folder: subdir
                        },
                        data: commandScript.command.data,
                        execute: commandScript.command.execute
                    };


                    if (!serverScripts[serverId].includes(scriptData)) {
                        serverScripts[serverId].push(scriptData);
                    }
                    else {
                        print(format(`${relativePath} already exists in ${serverId}`, { foreground: 'red', bold: true }));
                    }

                    scriptsList.push(scriptData);


                });
            }
        }
        else {
            print(format(`scriptsConfig.json not found in ${subdir}`, { foreground: 'red', bold: true }));
        }
    }

    return { serverScripts: serverScripts, scriptsList: scriptsList };
}

async function fetchGuild(client: Client, guildId: string): Promise<any> {

    const guild = await client.guilds.cache.get(guildId);
    return guild;

}

async function deployCommands(ServerScripts: ServerScripts, client: Client) {

    await printL(format("Deploying commands", { foreground: 'white', background: 'blue', bold: true, italic: true }));

    // printD({ServerScripts});

    for (const [guildId, commandsData] of Object.entries(ServerScripts)) {

        const commands: SlashCommandBuilder[] = [];

        const guild = await fetchGuild(client, guildId);


        if (!guild) {
            await printL("    Server: " + format(`not found (id ${guildId})`, { foreground: 'red', bold: true }));
            continue;
        }

        await printL("    Server: " + format(guild.name, { foreground: 'yellow' }));

        if (commandsData.length === 0) {
            await printL('  Commands: ' + format(`no commands`, { foreground: 'red', bold: true }));
            continue;
        }


        let commandsNames: string[] = [];
        // await printL("  Commands: ", false);
        // let frst = true;
        for (const commandData of commandsData) {
            // const commandScript = require(path.join(directoryPath, file));

            let cmdStr = "";
            if (commandData.info.type === "slash") {
                cmdStr = format("/" + commandData.info.comandName, { foreground: 'green', bold: true });
            }
            if (commandData.info.type === "context") {
                cmdStr = format(commandData.info.comandName, { foreground: 'cyan', bold: true });
            }
            commandsNames.push(cmdStr);
            // await printL(format((frst ? "" : ", ") + "/" + commandScript.command.data.name, { foreground: 'green' }), false);
            commands.push(commandData.data);
            // frst = false;
        }
        // await printL("");
        const commandsString = commandsNames.join(", ");
        await printL('  Commands: ' + commandsNames);


        try {

            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands },
            );

        } catch (error) {
            print(format(String(error), { foreground: 'red', bold: true }));
        }
    }

    await printL(format("Commands deployed!", { foreground: 'white', background: 'blue', bold: true, italic: true }));
}

// #endregion

//#region SLASH

interface slashCommand {
    info: String;
    data: SlashCommandBuilder;
    execute(interaction: CommandInteraction, client: Client): Promise<void>;
}

async function subscribeToInteractions(client: Client, slashCommands: ScriptConfig[]): Promise<void> {

    for (const command of slashCommands) {
        client.on('interactionCreate', async interaction => {

            if (!interaction.isCommand()) return;
            if (interaction.guildId !== command.info.serverId) return;

            if (interaction.commandName === command.data.name) {

                printL(interaction.user.username +
                    format(" /" + interaction.commandName
                        + interaction.options.data.map(option => (` ${option.name}:${option.value}`)),
                        { foreground: 'yellow' })
                    + dateToStr(new Date(), "timeStamp"));

                await command.execute(interaction, client);
            }
        });
    }
}

//#endregion


async function updateAnswer(client: Client): Promise<void> {

    Database.interact('database.db', async (db) => {
        const rec = await db.getJSON('global', 'lastUpdateCommand');
        if (!rec) return;
        await db.deleteRecord('global', 'lastUpdateAnswer');
        const message = await fetchMessage(rec.messageID, rec.channelID, rec.guildID, client);
        if (!message) return;
		await message.edit("Restarted!");
    });

}


client.login(ribotToken);
