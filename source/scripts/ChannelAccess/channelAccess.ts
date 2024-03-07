import * as fs from 'fs';
import * as xml2js from 'xml2js';


import { ScriptBuilder } from '../../libs/scripts';
import { print, printE, printD } from '../../libs/consoleUtils';
import { Fetcher, ButtonParams, ComponentsData, ComponentRow, ComponentBuilder, buildMessage, buildComponents, ComponentParams } from '../../libs/discordUtils';
import { APIInteractionGuildMember, ButtonInteraction, Client, GuildMember, MessageEditOptions, Role, SlashCommandBuilder, User } from 'discord.js';
import { Button, RoleToggle, RoleToggleMessage, XML, validateXML } from './xmlStructureCheck';

type ToggleRole = {
    actionType: 'toggleRole';
    roleID: string;
    actions?: Action[];
}

type SendMsg = {
    actionType: 'sendMsg';
    type: 'reply';
    text: string;
    private: boolean;
}

type Action = (ToggleRole | SendMsg);

// type CommandButton = 

type CommandMessage = {
    link: string;
    text: string;
    components: (ComponentParams & { actions?: Action[]; })[][];
}

// export type ComponentParams = (ButtonParams | SelectParams);
// export type ComponentRow = ComponentParams[];
// export type ComponentsData = ComponentRow[];


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

                                actions: getAction(xmlbutton.roleToggle)
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

        function getAction(xmlActions: RoleToggle[] | RoleToggleMessage[] | undefined): Action[] | undefined {
            if (!xmlActions) return;

            printD({ xmlActions })

            let actions: Action[] = [];
            xmlActions.forEach((xmlAction) => {

                if (xmlAction.$.actionType === 'roleToggle') {
                    xmlAction = xmlAction as RoleToggle;
                    actions.push({
                        actionType: 'toggleRole',
                        roleID: xmlAction.$.roleID,
                        actions: getAction(xmlAction.message)
                    });

                } if (xmlAction.$.actionType === 'sendMsg') {
                    xmlAction = xmlAction as any as RoleToggleMessage;
                    actions.push({
                        actionType: 'sendMsg',
                        type: 'reply',
                        text: xmlAction.$.text,
                        private: xmlAction.$.private === 'true'
                    });
                }

            })


            return actions;
        }

        printD({ commandMessages });
        return commandMessages;
    }

    async editMessages(client: Client) {

        this.xmlStruct.editMessage.forEach(async (messageInfo) => {
            const message = await Fetcher.message({ messageLink: messageInfo.$.messageLink }, client);
            print(message!.content);
        })

        this._commandMessages.forEach(async (commandMessage) => {
            const message = await Fetcher.message({ messageLink: commandMessage.link }, client);
            if (!message) {
                printE(`Message with link ${commandMessage.link} not found`);
                return;
            }
            print("Edit message: " + commandMessage.text);

            const btns = buildComponents(commandMessage.components);

            const params = buildMessage({ content: commandMessage.text }, btns);

            await message.edit(params as MessageEditOptions);
        })
    }

    async buttonInteract(interaction: ButtonInteraction) {
        // printD({ interaction: interaction.customId });

        const [group, msgNumber, rowNumber, btnNumber] = interaction.customId.split('-');

        const btnInfo = this.commandMessages[Number(msgNumber)].components[Number(rowNumber)][Number(btnNumber)];
        printD({ btnInfo });

        if (btnInfo.actions) {
            btnInfo.actions.forEach((action) => {
                performAction(action);
            })
        }

        function performAction(action: Action) {
            try {
                switch (action.actionType) {
                    case 'toggleRole': {
                        action = action as ToggleRole & { roleID: string; };
                        const role = interaction.guild!.roles.cache.get(action.roleID);
                        const hasRole = toggleRole(interaction.member as GuildMember, role!);
                        if (!role) {
                            printE(`Role ${action.roleID} not found`);
                            return;
                        }
                        action.actions?.forEach((action) => {
                            performAction(action);
                        })
                    }
                    case 'sendMsg': {
                        action = action as SendMsg & { roleID: string; };
                        if (action.type === 'reply')
                            interaction.reply({ content: action.text ?? '...', ephemeral: action.private });
                    }
                }
            } catch (e) {
                printE(e);
            }
        }

        async function toggleRole(member: GuildMember, role: Role): Promise<boolean> {
            const hasRole = member.roles.cache.has(role.id);
            if (!hasRole) {
                await member.roles.add(role);
            } else {
                await member.roles.remove(role);
            }
            return hasRole;
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
        await commander.buttonInteract(interaction);
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