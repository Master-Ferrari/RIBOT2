import * as fs from 'fs';
import * as xml2js from 'xml2js';


import { ScriptBuilder } from '../../libs/scripts';
import { print, printE, printD } from '../../libs/consoleUtils';
import { Fetcher, ButtonParams, ComponentsData, ComponentRow, ComponentBuilder, buildMessage, buildComponents, ComponentParams } from '../../libs/discordUtils';
import { APIInteractionGuildMember, ButtonInteraction, Client, GuildMember, MessageEditOptions, Role, SlashCommandBuilder, User } from 'discord.js';
import { Button, Action as ActionXml, XML, validateXML, RoleToggleAction, MessageAction } from './xmlStructureCheck';

type ToggleRole = {
    actionType: 'toggleRole';
    roleId: string;
    actions?: Action[];
}

type SendMsg = {
    actionType: 'sendMsg';
    type: 'reply' | 'send';
    channelLink?: string;
    text: string;
    private: boolean;
}

type Action = (ToggleRole | SendMsg);

type CommandMessage = {
    link: string;
    text: string;
    components: (ComponentParams & { actions?: Action[]; })[][];
}


class XMLCommander {
    private xmlPath: string;
    private xmlStruct: XML;
    private _commandMessages: CommandMessage[];

    public get commandMessages() { return this._commandMessages; }

    private constructor(_xmplPath: string, _xmlStruct: XML, _commandMessages: CommandMessage[]) {
        this.xmlPath = _xmplPath;
        this.xmlStruct = _xmlStruct;
        this._commandMessages = _commandMessages;
    }

    static async initialize(xmlFilePath: string,): Promise<XMLCommander> {
        const xmlStruct = await this.deserializeXML(xmlFilePath);
        const commandMessages = this.getCommandMessages(xmlStruct);
        return new XMLCommander(xmlFilePath, xmlStruct, commandMessages);
    }

    async update() {
        this.xmlStruct = await XMLCommander.deserializeXML(this.xmlPath);
        this._commandMessages = XMLCommander.getCommandMessages(this.xmlStruct);
    }

    private static async deserializeXML(filePath: string): Promise<XML> {
        const parser = new xml2js.Parser({ mergeAttrs: false, explicitRoot: false });
        const xmlString = await fs.promises.readFile(filePath, 'utf8');

        return new Promise((resolve, reject) => {
            parser.parseString(xmlString, (e, result) => {
                if (e) printE(e);
                else {
                    try {
                        if (validateXML(result)) resolve(result as XML)
                    } catch (e) {
                        printE(e);
                    }
                };
            });
        });
    }

    private static getCommandMessages(XMLstruct: XML): CommandMessage[] {
        const commandMessages: CommandMessage[] = [];
        let messageIndex = 0;
        XMLstruct.editMessage.forEach((messageInfo) => {
            const commandMessage: CommandMessage = {
                link: messageInfo.$.messageLink,
                text: messageInfo.content[0].$.text,
                components: (() => {
                    const rows: ComponentRow[] = [];
                    let rowIndex = 0;
                    messageInfo.buttonRow.forEach((xmlrow) => {
                        let buttonIndex = 0;
                        const row: ComponentRow = [];
                        xmlrow.button.forEach((xmlbutton) => {
                            const button: ButtonParams & { actions?: Action[]; } = {
                                type: 2,
                                customId: 'cmd-' + messageIndex + '-' + rowIndex + '-' + buttonIndex,
                                emoji: xmlbutton.$.emojiID,
                                label: xmlbutton.$.label,
                                style: xmlbutton.$.style as any,
                                disabled: false,

                                actions: getAction(xmlbutton.action)
                            };
                            row.push(button);
                            buttonIndex++;
                        })
                        rows.push(row);
                        rowIndex++;
                    })
                    return rows as (ComponentParams & { actions?: Action[]; })[][];
                })()
            };
            commandMessages.push(commandMessage);
            messageIndex++;
        });

        function getAction(xmlActions: ActionXml[] | undefined): Action[] | undefined {
            if (!xmlActions) return;


            let actions: Action[] = [];
            xmlActions.forEach((xmlAction) => {

                if (xmlAction.$.actionType === 'roleToggle') {
                    xmlAction = xmlAction as RoleToggleAction;
                    actions.push({
                        actionType: 'toggleRole',
                        roleId: xmlAction.$.roleID!,
                        actions: getAction(xmlAction.action)
                    });

                } if (xmlAction.$.actionType === 'sendMsg') {
                    xmlAction = xmlAction as MessageAction;
                    actions.push({
                        actionType: 'sendMsg',
                        type: xmlAction.$.type!,
                        channelLink: xmlAction.$.channelLink,
                        text: xmlAction.$.text!,
                        private: xmlAction.$.private === 'true'
                    });
                }

            })


            return actions;
        }

        return commandMessages;
    }

    async editMessages(client: Client) {

        this._commandMessages.forEach(async (commandMessage) => {
            const message = await Fetcher.message({ messageLink: commandMessage.link }, client);
            if (!message) {
                printE(`Message with link ${commandMessage.link} not found`);
                return;
            }

            const btns = buildComponents(commandMessage.components);

            const params = buildMessage({ content: commandMessage.text }, btns);

            await message.edit(params as MessageEditOptions);
        })
    }

    async buttonInteract(interaction: ButtonInteraction, client: Client) {

        const [group, msgNumber, rowNumber, btnNumber] = interaction.customId.split('-');
        const btnInfo = this.commandMessages[Number(msgNumber)].components[Number(rowNumber)][Number(btnNumber)];
        let member = interaction.member as GuildMember;
        btnInfo.actions?.forEach(performAction);


        async function performAction(action: Action) {

            //#region common variables

            const roleId = 'roleID' in action ? (action as ToggleRole & { roleID: string; }).roleId : undefined;
            const role: Role | undefined = roleId ? interaction.guild!.roles.cache.get(roleId) : undefined;

            //#endregion

            //#region synonym handler

            async function synonymHandler(text: string): Promise<string> {
                let result = text;

                const regexDict: { regex: RegExp, replace: (matches: string[]) => string }[] = [
                    { regex: /%userName%/g, replace: () => `${member.user.globalName}` },
                    { regex: /%userPing%/g, replace: () => `<@${member.id}>` },
                    { regex: /%userNick%/g, replace: () => `${member.nickname || member.user.globalName}` },
                    {
                        regex: /%rolePing:(\d*)%/g,
                        replace: (matches: string[]): string => `<@&${matches[0]}>`
                    },
                    {
                        regex: /%roleName:(\d*)%/g,
                        replace: (matches: string[]): string => {
                            const name = interaction.guild?.roles.cache.get(matches[0])?.name;
                            return `${name}`;
                        }
                    },
                    {
                        regex: /\[(?!\[)([^\]\[]+)\|([^\]\[]+)\]\(hasRole:(\d*)\)/g,
                        replace: (matches: string[]): string => {
                            const roleId = matches[2];
                            const hasRole = member.roles.cache.has(roleId);
                            return hasRole ? matches[0] : matches[1];
                        }
                    },
                    {
                        regex: /%buttonLabel%/g,
                        replace: (): string => {
                            return `${(btnInfo as ButtonParams).label}`
                        }
                    },
                ];

                regexDict.forEach(({ regex, replace }) => {
                    result = result.replace(regex, (...matches) => {
                        const result = replace(matches.slice(1, -2));
                        return result;
                    });
                });

                return result;

            }


            //#endregion

            switch (action.actionType) {
                case 'toggleRole': {
                    action = action as ToggleRole;
                    const role = interaction.guild!.roles.cache.get(action.roleId);
                    if (role) member = await toggleRole(member, role);
                    if (!role) {
                        return;
                    }
                    action.actions?.forEach(async (action) => {
                        await performAction(action);
                    })
                    break;
                }
                case 'sendMsg': {
                    action = action as SendMsg;
                    if (action.type === 'reply') {
                        await interaction.reply({ content: await synonymHandler(action.text) ?? '...', ephemeral: action.private });
                    }
                    if (action.type === 'send') {
                        const channel = await Fetcher.channel({ channelLink: action.channelLink! }, client);
                        await channel?.send({ content: await synonymHandler(action.text) ?? '...' });
                    }
                    break;
                }
            }
        }

        async function toggleRole(member: GuildMember, role: Role): Promise<GuildMember> {
            const hasRole = member.roles.cache.has(role.id);
            if (!hasRole) {
                member = await member.roles.add(role);
            } else {
                member = await member.roles.remove(role);
            }
            return member;
        }

    }

}














const xmlFilePath = './source/scripts/ChannelAccess/channels_access.xml';
let commander: XMLCommander;


export const script = new ScriptBuilder({
    name: "channelaccess",
    group: "private",
}).addOnStart({
    onStart: async () => {
        commander = await XMLCommander.initialize(xmlFilePath);
        // await commander.editMessages(script.client!); //
    }
}).addOnUpdate({
    onUpdate: async () => {
        await commander.update();
        await commander.editMessages(script.client!);
    },
}).addOnButton({
    isValidCustomId: async (customId) => {
        commander.commandMessages.forEach((commandMessage) => {
            commandMessage.components.forEach((row) => {
                row.forEach((btn) => {
                    if (btn.customId === customId) return true;
                })
            })
        })
        return false;
    },
    onButton: async (interaction) => {
        await commander.buttonInteract(interaction, script.client!);
    }
}).addOnSlash({
    slashDeployData: new SlashCommandBuilder()
        .setName('channelaccess')
        .setDescription('olololo')
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('update channel access messages via control XML')),

    onSlash: async (interaction) => {
        commander.update();
        await commander.editMessages(script.client!);
        await interaction.reply({ content: 'done', ephemeral: true });
    }
})