import 'source-map-support/register';

import { Client, GatewayIntentBits, Partials, Events, Collection, ContextMenuCommandBuilder, SlashCommandBuilder, CommandInteraction, Guild } from 'discord.js';
import * as path from 'path';
import * as fs from 'fs';
import { Routes } from 'discord-api-types/v9';
import { getDirectories } from './libs/fsUtils';
import { REST } from '@discordjs/rest';

import { ScriptBuilder } from './libs/scripts';
import { print, printD, printE, printL, format, dateToStr } from './libs/consoleUtils';
import { fetchMessage, fetchGuild, ScriptScopes } from './libs/discordUtils';
import { GroupConfig, ScriptConfig, ServerConfig } from './libs/scripts';
import { ribotToken, clientId } from './botConfig.json';
import Database from './libs/sqlite';

const deployPath = path.join(__dirname, './deploy');
const scriptsPath = path.join(__dirname, './scripts');

const client: Client = new Client({
    intents: [
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildScheduledEvents,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [
        Partials.Channel, // Required to receive DMs

        Partials.Reaction, // Required to receive old reactions
        Partials.Message
    ]
});

//#region ON READY

client.once(Events.ClientReady, async () => {
    await printL(format(`Logged`, { foreground: 'white', background: 'red', bold: true, italic: true })
        + ` as ${client.user?.tag}`
        + dateToStr(new Date(), "timeStamp"));


    const scriptsData = await loadScriptsFromDirectories(client, scriptsPath);

    if (process.argv.includes('update')) {
        await deployCommands(scriptsData.serverList, client);
    }

    await subscribeToInteractions(client, scriptsData.scriptsList);

    await launchStartupScripts(client, scriptsData.scriptsList);

    await printL(format(`Ready!`, { foreground: 'white', background: 'red', bold: true, italic: true })
        + " the final number of scripts: " + scriptsData.scriptsList.length);

    updateAnswer(client);

});

async function updateAnswer(client: Client): Promise<void> {

    Database.interact('database.db', async (db) => {
        const rec = await db.getJSON('global', 'lastUpdateCommand');
        if (!rec) return;
        await db.deleteRecord('global', 'lastUpdateCommand');
        const message = await fetchMessage(rec.messageID, rec.channelID, rec.guildID, client);
        if (!message) return;
        await message.edit("Restarted!");
    });

}

// #endregion

//#region DEPLOY COMMANDS

const rest = new REST({ version: '9' }).setToken(ribotToken);

export async function loadScriptsFromDirectories(client: Client, directoryPath: string = scriptsPath):
    Promise<{ serverList: ServerConfig[], scriptsList: ScriptConfig[] }> {

    const serverList: ServerConfig[] = [];

    const scriptsList: ScriptConfig[] = [];

    const groups = getDirectories(scriptsPath);

    // filling serverList
    for (const group of groups) {

        const groupConfigFile = path.join(directoryPath, group, 'scriptsConfig.json');
        if (!fs.existsSync(groupConfigFile)) {
            printE(`scriptsConfig.json not found in ${group}`);
            continue;
        }
        const groupConfig: GroupConfig = JSON.parse(fs.readFileSync(groupConfigFile, 'utf-8'));

        if (groupConfig.global) {
            if (!serverList.find(guild => guild.info.serverName === "global")) {
                serverList.push({
                    info: {
                        serverName: "global",
                        serverId: ""
                    },
                    scripts: []
                })
            }
        }

        for (const [serverId, configServerName] of Object.entries(groupConfig.guilds)) {

            const server = await fetchGuild(client, serverId);
            if (!server) {
                printE(`Server ${serverId} not found`);
                continue;
            }
            const serverName = server.name;

            if (!serverList.find(guild => guild.info.serverId === serverId)) {
                serverList.push({
                    info: {
                        serverName: serverName,
                        serverId: serverId
                    },
                    scripts: []
                })
            }
        }
    }

    // filling scriptsList
    for (const group of groups) {

        const groupConfigFile = path.join(directoryPath, group, 'scriptsConfig.json');
        const groupConfig: GroupConfig = JSON.parse(fs.readFileSync(groupConfigFile, 'utf-8'));


        const groupScripts = fs.readdirSync(path.join(directoryPath, group))
            .filter(file => file.endsWith('.js'))

        groupScripts.forEach(async file => {

            const relativePath = path.join(group, file);

            const fullPath = path.join(scriptsPath, relativePath);

            const scriptFile = require(fullPath);

            const guilds: ServerConfig[] = !groupConfig.global ? serverList.filter(server => groupConfig.guilds[server.info.serverId]) : [];

            const scriptData: ScriptConfig = {
                info: {
                    comandName: scriptFile.command.data.name,
                    type: scriptFile.command.info.type,
                    group: group,
                },
                global: groupConfig.global,
                guilds: guilds,
                data: scriptFile.command.data
            };

            printD({ scriptData });

            if (scriptFile.command.onInteraction) {
                scriptData.onInteraction = scriptFile.command.onInteraction;
            }
            if (scriptFile.command.onStart) {
                scriptData.onStart = scriptFile.command.onStart;
            }
            if (scriptFile.command.onUpdate) {
                scriptData.onUpdate = scriptFile.command.onUpdate;
            }


            scriptsList.push(scriptData);
        });
    }

    // Linking scripts to guilds
    for (const server of serverList) {
        for (const script of scriptsList) {
            if (script.guilds.find(guild => guild.info.serverId === server.info.serverId) ||
                server.info.serverName === "global" && script.global) {

                if (server.scripts.find(SCRIPT => SCRIPT.info.comandName === script.info.comandName)) {
                    printE(`Script ${script.info.comandName} already exists in ${server.info.serverName}`);
                    continue;
                }

                server.scripts.push(script);
            }
        }
    }

    return { serverList: serverList, scriptsList: scriptsList };
}


async function deployCommands(serverList: ServerConfig[], client: Client) {

    await printL(format("Deploying commands", { foreground: 'white', background: 'blue', bold: true, italic: true }));

    for (const server of serverList) {

        const commands: (SlashCommandBuilder | ContextMenuCommandBuilder)[] = [];

        const guildName = server.info.serverId ? await fetchGuild(client, server.info.serverId).then(guild => guild?.name) : server.info.serverName;


        if (!guildName) {
            await printL("    Server: " + format(`not found (id ${server.info.serverId})`, { foreground: 'red', bold: true }));
            continue;
        }

        if (server.info.serverName === "global")
            await printL("    Server: " + format(guildName, { foreground: 'yellow', background: 'magenta' }) +
                " " + format(client.guilds.cache.map(guild => guild.name).join(", "), { foreground: 'magenta', italic: true }));
        else
            await printL("    Server: " + format(guildName, { foreground: 'yellow' }));


        if (server.scripts.length === 0) {
            await printL('  Commands: ' + format(`no commands`, { foreground: 'red', bold: true }));
            continue;
        }


        let commandsNames: string[] = [];

        for (const scriptConfig of server.scripts) {

            let cmdStr = "";
            if (scriptConfig.info.type === "slash") {
                cmdStr = format("/" + scriptConfig.info.comandName, { foreground: 'green', bold: true });
            } else if (scriptConfig.info.type === "context") {
                cmdStr = format(scriptConfig.info.comandName, { foreground: 'cyan', bold: true });
            }
            else continue;

            commandsNames.push(cmdStr);
            commands.push(scriptConfig.data);
        }

        const commandsString = commandsNames.join(", ");
        await printL('  Commands: ' + commandsString);


        try {

            await rest.put(
                server.info.serverName === "global" ?
                    Routes.applicationCommands(clientId) :
                    Routes.applicationGuildCommands(clientId, server.info.serverId),
                { body: commands },
            );

        } catch (error) {
            printE(error);
        }
    }

    await printL(format("Commands deployed!", { foreground: 'white', background: 'blue', bold: true, italic: true }));
}

// #endregion

//#region SLASH

async function subscribeToInteractions(client: Client, scripts: ScriptConfig[]): Promise<void> {

    client.on('interactionCreate', async interaction => {

        printD({ interaction });

        for (const script of scripts) {

            if (!interaction.isCommand() && !interaction.isContextMenuCommand()) continue;
            if (interaction.commandName !== script.data.name) continue;

            if (script.info.type !== "slash" && script.info.type !== "context") continue;
            if (!script.guilds.find(guild => guild.info.serverId === interaction.guildId) && !script.global) continue;

            await printL(interaction.user.username +
                format(" /" + interaction.commandName
                    + interaction.options.data.map(option => (` ${option.name}:${option.value}`)),
                    { foreground: 'yellow' })
                + dateToStr(new Date(), "timeStamp"));

            if (script.onInteraction) {
                const scriptScopes: ScriptScopes = { global: script.global, guilds: script.guilds.map(guild => guild.info.serverId) };
                await script.onInteraction(interaction, client, scriptScopes);
            }
            return;
        }

    });
}

//#endregion


//#region STARTUP

async function launchStartupScripts(client: Client, scripts: ScriptConfig[]): Promise<void> {
    // const strtpScripts = scripts.filter(script => script.info.type === "startup");
    const strtpScripts = scripts.filter(script => script.onStart);
    if (strtpScripts.length === 0) return;
    await printL(format("Launching startup scripts", { foreground: 'white', background: 'magenta', bold: true, italic: true }));
    for (const script of strtpScripts) {
        await printL(format(script.info.comandName, { foreground: 'magenta', bold: true, italic: true }));
        if (script.onStart) {
            const scriptScopes: ScriptScopes = { global: script.global, guilds: script.guilds.map(guild => guild.info.serverId) };
            await script.onStart(client, scriptScopes);
        }
    }
}

// #endregion


client.login(ribotToken);
