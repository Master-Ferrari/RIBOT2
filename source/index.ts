import 'source-map-support/register';

import { Client, GatewayIntentBits, Partials, Events, BitFieldResolvable, GatewayIntentsString, ContextMenuCommandBuilder, SlashCommandBuilder, CommandInteraction, Guild } from 'discord.js';
import * as path from 'path';
import * as fs from 'fs';
import { Routes } from 'discord-api-types/v9';
import { getDirectories } from './libs/fsUtils';
import { REST } from '@discordjs/rest';

import { ScriptBuilder } from './libs/scripts';
import { print, printD, printE, printL, format, dateToStr, Color } from './libs/consoleUtils';
import { fetchMessage, fetchGuild, ScriptScopes } from './libs/discordUtils';
import { ServerConfig } from './libs/scripts';
import { ribotToken, clientId } from './botConfig.json';
import Database from './libs/sqlite';

type FeatureSwitches = { [key: string]: boolean };
const featureSwitches: FeatureSwitches = require('./botConfig.json').featureSwitches;

const deployPath = path.join(__dirname, './deploy');
const scriptsPath = path.join(__dirname, './scripts');



type GroupConfig = {
    guilds: Record<string, string>;
    global: boolean;
};

//#region ON READY
(async function start() {

    const { serverList, scriptsList, intents, partials } = await loadScriptsFromDirectories(scriptsPath);

    const client: Client = new Client({
        intents: [...new Set([
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildWebhooks,
            GatewayIntentBits.Guilds,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildScheduledEvents,
            GatewayIntentBits.GuildMessageReactions,
            ...intents])],
        partials: [...new Set([
            Partials.Channel,  // Required to receive DMs
            Partials.Reaction, // Required to receive old reactions
            Partials.Message,
            ...partials
        ])]
    });

    scriptsList.forEach(script => {
        script.setupClient(client);

    });

    client.once(Events.ClientReady, async () => {

        await printL(format(`Logged`, { foreground: 'white', background: 'red', formatting: ['italic', 'bold'] })
            + ` as ${client.user?.tag}`
            + dateToStr(new Date(), "timeStamp"));

        if (process.argv.includes('update')) {
            await deployCommands(serverList, client);
        }

        await printL("OnStart:   " + scriptsList.filter(script => script.isStart())
            .map(script => format(script.name, { foreground: script.enabled ? 'magenta' : 'red', formatting: 'italic' })).join(", "));
        await printL("OnMessgae: " + scriptsList.filter(script => script.isMessage())
            .map(script => format(script.name, { foreground: 'magenta', formatting: 'italic' })).join(", "));

        await printL(format(`Ready!`, { foreground: 'white', background: 'red', formatting: ['italic', 'bold'] })
            + " the final number of scripts: " + scriptsList.length);

        updateAnswer(client);
        const startPromises = scriptsList.map(script => {
            if (script.isStart()) {
                return script.onStart();
            }
            return Promise.resolve();
        });

        await Promise.all(startPromises); //wait for all onStart to be done

        client.on('interactionCreate', async interaction => {
            scriptsList.forEach(script => {
                script.interactionHandler(interaction);
            });
        });

        client.on('messageCreate', async message => {
            scriptsList.forEach(script => {
                if (script.isMessage())
                    script.onMessage(message);
            })
        });

    });

    await client.login(ribotToken);

})();

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

export async function loadScriptsFromDirectories(directoryPath: string = scriptsPath):
    Promise<{
        serverList: ServerConfig[],
        scriptsList: ScriptBuilder[],
        intents: Set<GatewayIntentsString | number>,
        partials: Set<Partials>
    }> {

    let intents: Set<GatewayIntentsString | number> = new Set();
    let partials: Set<Partials> = new Set();

    const serverList: ServerConfig[] = [];

    const scriptsList: ScriptBuilder[] = [];

    const groups = getDirectories(scriptsPath);

    intents.add(GatewayIntentBits.Guilds);

    // filling serverList
    for (const group of groups) {

        const groupConfigFile = path.join(directoryPath, group, 'scriptsConfig.json');
        if (!fs.existsSync(groupConfigFile)) {
            printE(`scriptsConfig.json not found in ${group}`);
            continue;
        }
        const groupConfig: GroupConfig = JSON.parse(fs.readFileSync(groupConfigFile, 'utf-8'));

        if (groupConfig.global) {
            if (!serverList.find(guild => guild.serverName === "global")) {
                serverList.push({
                    serverName: "global",
                    serverId: "",
                    scripts: []
                })
            }
        }

        for (const [serverId, configServerName] of Object.entries(groupConfig.guilds)) {

            const serverName = configServerName;

            if (!serverList.find(guild => guild.serverId === serverId)) {
                serverList.push({
                    serverName: serverName,
                    serverId: serverId,
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
            try {
                const relativePath = path.join(group, file);

                const fullPath = path.join(scriptsPath, relativePath);

                const scriptFile = require(fullPath);

                const guilds: ServerConfig[] = !groupConfig.global ? serverList.filter(server => groupConfig.guilds[server.serverId]) : [];

                const script = scriptFile.script;

                if (!(script instanceof ScriptBuilder)) return;

                const enabled = !(script.name in featureSwitches) || featureSwitches[script.name];
                script.setupScopes(enabled, groupConfig.global ? "global" : guilds);

                scriptsList.push(script);
                intents = new Set([...intents, ...script.intents]);
                partials = new Set([...partials, ...script.partials]);
            }
            catch (error) {
                printE(file + "/n");
                throw error;
            }
        });
    }


    // Linking scripts to guilds
    for (const server of serverList) {      
        for (const script of scriptsList) {
            if (script.guilds! !== "global" && script.guilds!.find(guild => guild.serverId === server.serverId) ||
                server.serverName === "global" && script.isGlobal) {

                if (server.scripts.find(SCRIPT => SCRIPT.name === script.name)) {
                    printE(`Script ${script.name} already exists in ${server.serverName}`);
                    continue;
                }

                server.scripts.push(script);
            }
        }
    }

    return { serverList, scriptsList, intents, partials };
}
export async function updateScripts() {
    const scriptsData = await loadScriptsFromDirectories();
    await printL(format(`Update!`, { foreground: 'white', background: 'yellow', formatting: ['italic', 'bold'] }));
    for (const script of scriptsData.scriptsList) {
        if (script.isUpdate()) {
            await script.onUpdate();
            await printL(script.name + ' updated');
        }
    }
}

async function deployCommands(serverList: ServerConfig[], client: Client) {

    await printL(format("Deploying commands", { foreground: 'white', background: 'blue', formatting: ['italic', 'bold'] }));

    for (const server of serverList) {

        const deployData: (SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> | ContextMenuCommandBuilder)[] = [];

        const guild = server.serverId ? await fetchGuild(client, server.serverId) : undefined;
        if (server.serverName === "global") {
            await printL("    Server: " + format("global", { foreground: 'yellow', background: 'magenta' }) +
                " " + format(client.guilds.cache.map(guild => guild.name).join(", "), { foreground: 'magenta', formatting: 'italic' }));
        } else if (guild) {
            await printL("    Server: " + format(guild.name, { foreground: 'yellow' }));
        } else {
            await printL("    Server: " + format(`not found (${server.serverName} ${server.serverId})`, { foreground: 'red', formatting: 'bold' }));
            continue;
        }



        let commandsNames: string[] = [];

        for (const script of server.scripts) {
            if (script.name in featureSwitches && !featureSwitches[script.name]) {
                commandsNames.push(format(((script.isSlash() ? "/" : "")) + script.name, { foreground: 'red', formatting: 'bold' }));
                continue;
            }

            let cmdStr = "";
            if (script.isSlash()) {
                deployData.push(script.slashDeployData);
                cmdStr = format("/" + script.name, { foreground: 'green', formatting: 'bold' });
            } else if (script.isContext()) {
                deployData.push(script.contextDeployData);
                cmdStr = format(script.name, { foreground: 'cyan', formatting: 'bold' });
            }
            else continue;

            commandsNames.push(cmdStr);
        }


        if (server.scripts.length === 0) {
            await printL('  Commands: ' + format(`no commands`, { foreground: 'red', formatting: 'bold' }));
        } else {
            await printL('  Commands: ' + commandsNames.join(", "));
        }

        try {
            // const rest = new REST({ version: '10' }).setToken(ribotToken);
            // await rest.put(
            //     server.serverName === "global" ?
            //         Routes.applicationCommands(clientId) :
            //         Routes.applicationGuildCommands(clientId, server.serverId),
            //     { body: deployData },
            // );
            if (server.serverName == "global") {
                client.application?.commands.set(deployData);
            } else {
                guild?.commands.set(deployData);
            }
        } catch (error) {
            printE(error);
        }
    }

    await printL(format("Commands deployed!", { foreground: 'white', background: 'blue', formatting: ['italic', 'bold'] }));
}
// #endregion