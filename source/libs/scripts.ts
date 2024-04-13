import {
    Client, Interaction, AutocompleteInteraction, ContextMenuCommandBuilder, Partials,
    SlashCommandSubcommandsOnlyBuilder, MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction,
    SlashCommandBuilder, ChatInputCommandInteraction, ButtonInteraction, Message, BitFieldResolvable,
    GatewayIntentsString, GatewayIntentBits, ChannelSelectMenuInteraction, StringSelectMenuInteraction, AnySelectMenuInteraction, ModalSubmitInteraction
} from 'discord.js';

import { print, printD, printL, format, dateToStr, interactionLog, printE } from './consoleUtils';

export type ServerConfig = {
    serverName: string;
    serverId: string;
    scripts: Array<ScriptBuilder>;
};

export interface OnEventSettings {
    scopeGuilds?: boolean;
    scopeUsers?: boolean;
}

export interface OnMessageSettings extends OnEventSettings {
    ignoreDM?: boolean;
    ignoreBots?: boolean;
}

export class ScriptBuilder {

    private _enabled: boolean = true;
    public get enabled() { return this._enabled; }

    private _name: string;
    private _group: string;
    public get name() { return this._name; }
    public get group() { return this._group; }

    private _intents: Set<GatewayIntentsString | number> = new Set([]);
    private _partials: Set<Partials> = new Set([]);
    private _client?: Client;
    // public get intents() {
    //     return { intents: this._intents, partials: this._partials }
    // }
    public get intents() { return this._intents; }
    public get partials() { return this._partials; }
    public get client() { return this._client; }

    private _guilds?: ServerConfig[] | "global";
    private _isGlobal?: boolean;
    private _usersList: {
        whitelist: string[] | undefined;
        blacklist: string[] | undefined;
    } = {
            whitelist: undefined, blacklist: undefined
        };
    public get guilds() { return this._guilds; }
    public get isGlobal() { return this._isGlobal; }
    public get usersList() { return this._usersList; }

    //slash
    private _onSlash?: (interaction: ChatInputCommandInteraction) => Promise<void>;
    private _onSlashSettings: OnEventSettings = {
        scopeGuilds: true,
        scopeUsers: true
    };
    private _slashDeployData?: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
    public get onSlash() {
        if (!this._onSlash) return;
        return async (interaction: Interaction) => {
            if (!interaction.isChatInputCommand()) return;
            if (interaction.commandName !== this.name) return;

            const username = interaction.user.username;
            const commandName = interaction.commandName;
            const options = interaction.options.data.map(option => (` ${option.name}:${option.value}`)).join(" ");
            await interactionLog(username, commandName, options, interaction.user.id);

            if (!this.checkSetup()) return;

            if (!this.checkSettings(this._onSlashSettings, interaction.user.id, interaction.guildId ?? undefined)) return;

            await this._onSlash!(interaction);
        }
    }
    public get slashDeployData() { return this._slashDeployData; }
    public isSlash(): this is ScriptBuilder & {
        onSlash: (interaction: ChatInputCommandInteraction) => Promise<void>,
        slashDeployData: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">
    } {
        return this.onSlash !== undefined;
    }
    // context
    private _onContext?: (interaction: (MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction)) => Promise<void>;
    private _onContextSettings: OnEventSettings = {
        scopeGuilds: true,
        scopeUsers: true
    };
    private _contextDeployData?: ContextMenuCommandBuilder;
    public get onContext() {
        if (!this._onContext) return undefined;
        return async (interaction: Interaction) => {
            if (!interaction.isContextMenuCommand()) return;
            if (interaction.commandName !== this.name) return;

            const username = interaction.user.username;
            const commandName = interaction.commandName;
            const options = interaction.options.data.map(option => (` ${option.name}:${option.value}`)).join(" ");
            await interactionLog(username, commandName, options, interaction.user.id);

            if (!this.checkSetup()) return;

            if (!this.checkSettings(this._onContextSettings, interaction.user.id, interaction.guildId ?? undefined)) return;

            await this._onContext!(interaction);
        }
    }
    public get contextDeployData() { return this._contextDeployData; }
    public isContext(): this is ScriptBuilder & {
        onContext: (interaction: (MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction)) => Promise<void>,
        contextDeployData: ContextMenuCommandBuilder
    } {
        return this.onContext !== undefined;
    }
    ///start
    private _onStart?: () => Promise<void>;
    public get onStart() { return this._onStart; }
    public isStart(): this is ScriptBuilder & { onStart: () => Promise<void> } {
        return this.onStart !== undefined;
    }
    //message
    private _onMessage?: (message: Message) => Promise<void>;
    private _onMessageSettings: OnMessageSettings = {
        scopeGuilds: true,
        scopeUsers: true,
        ignoreDM: true,
        ignoreBots: true
    };
    public get onMessage() {
        if (!this._onMessage) return undefined;
        return async (message: Message) => {

            if (!this.checkSetup()) return;

            if (!this.checkSettings(this._onMessageSettings, message.author.id, message.guild?.id)) return;
            if (this._onMessageSettings.ignoreDM && message.channel.isDMBased()) return;
            if (this._onMessageSettings.ignoreBots && message.author.bot) return;

            await this._onMessage!(message);
        };
    }
    public isMessage(): this is ScriptBuilder & { onMessage: (message: Message) => Promise<void> } {
        return this.onMessage !== undefined;
    }
    //button
    private _onButton?: (interaction: ButtonInteraction) => Promise<void>;
    private _onButtonSettings: OnEventSettings = {
        scopeGuilds: true,
        scopeUsers: true
    };
    private _isValidButtonCustomId?: (customId: string) => Promise<boolean>;
    public get onButton() {
        if (!this._onButton) return undefined;
        return async (interaction: Interaction) => {
            if (!interaction.isButton()) return;
            if (!(await this.isValidButtonCustomId!(interaction.customId))) return;
            const username = interaction.user.username;
            const commandName = interaction.message.id + "/button/";
            const options = interaction.customId;
            await interactionLog(username, commandName, options, interaction.user.id);

            if (!this.checkSetup()) return;

            if (!this.checkSettings(this._onButtonSettings, interaction.user.id, interaction.guild?.id)) return;

            await this._onButton!(interaction);
        }
    }
    public get isValidButtonCustomId() { return this._isValidButtonCustomId; }
    public isButton(): this is ScriptBuilder & {
        onButton: (interaction: ButtonInteraction) => Promise<void>,
        isValidButtonCustomId: (customId: string) => Promise<boolean>
    } {
        return this.onButton !== undefined;
    }
    //selectMenu
    private _onSelectMenu?: (interaction: AnySelectMenuInteraction) => Promise<void>;
    private _onSelectMenuSettings: OnEventSettings = {
        scopeGuilds: true,
        scopeUsers: true
    };
    private _isValidSelectMenuCustomId?: (customId: string) => Promise<boolean>;
    public get onSelectMenu() {
        if (!this._onSelectMenu) return undefined;
        return async (interaction: Interaction) => {
            if (!interaction.isAnySelectMenu()) return;
            if (!(await this.isValidSelectMenuCustomId!(interaction.customId))) return;
            const username = interaction.user.username;
            const commandName = interaction.message.id + "/SelectMenu/";
            const options = interaction.customId;
            await interactionLog(username, commandName, options, interaction.user.id);

            if (!this.checkSetup()) return;

            if (!this.checkSettings(this._onButtonSettings, interaction.user.id, interaction.guild?.id)) return;

            await this._onSelectMenu!(interaction);
        }
    }
    public get isValidSelectMenuCustomId() { return this._isValidSelectMenuCustomId; }
    public isSelectMenu(): this is ScriptBuilder & {
        onSelectMenu: (interaction: AnySelectMenuInteraction) => Promise<void>,
        isValidSelectMenuCustomId: (customId: string) => Promise<boolean>
    } {
        return this.onSelectMenu !== undefined;
    }
    //Modal
    private _onModal?: (interaction: ModalSubmitInteraction) => Promise<void>;
    private _onModalSettings: OnEventSettings = {
        scopeGuilds: true,
        scopeUsers: true
    };
    private _isValidModalCustomId?: (customId: string) => Promise<boolean>;
    public get onModal() {
        return async (interaction: Interaction) => {
            if (!interaction.isModalSubmit()) return;
            if (!(await this.isValidModalCustomId!(interaction.customId))) return;
            const username = interaction.user.username;
            const commandName = interaction.id + "/Modal/";
            const options = interaction.customId;
            await interactionLog(username, commandName, options, interaction.user.id);

            if (!this.checkSetup()) return;

            if (!this.checkSettings(this._onModalSettings, interaction.user.id, interaction.guild?.id)) return;

            await this._onModal!(interaction);

        }
    }
    public get isValidModalCustomId() { return this._isValidModalCustomId; }
    public isModal(): this is ScriptBuilder & {
        onModal: (interaction: ModalSubmitInteraction) => Promise<void>,
        isValidModalCustomId: (customId: string) => Promise<boolean>
    } {
        return this.onModal !== undefined;
    }

    //autocomplite
    private _onAutocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
    private _isValidAutocompleteCommandName?: (customId: string) => Promise<boolean>;
    public get onAutocomplete() {
        return async (interaction: Interaction) => {
            if (!interaction.isAutocomplete()) return;

            // printD({ func: this._isValidAutocompleteCommandName });
            if (!this.isValidAutocompleteCommandName) return;///////////////////////////////////////wtf
            if (!(await this.isValidAutocompleteCommandName(interaction.commandName))) return;

            if (!this.checkSetup()) return;
            await this._onAutocomplete!(interaction);
        }
    }
    public get isValidAutocompleteCommandName() { return this._isValidAutocompleteCommandName; }
    public isAutocomplete(): this is ScriptBuilder & {
        onAutocomplete: (interaction: AutocompleteInteraction) => Promise<void>,
        isValidAutocompleteCommandName: (customId: string) => Promise<boolean>
    } {
        return this.onAutocomplete !== undefined;
    }

    //update
    private _onUpdate?: () => Promise<void>;
    public get onUpdate() { return this._onUpdate; }
    public isUpdate(): this is ScriptBuilder & { onUpdate: () => Promise<void> } {
        return this.onUpdate !== undefined;
    }

    //todo: events events
    //tatu: autocomlpite
    //todo: reactions
    //todo: multiple slash events
    //todo: userContext and messageContext definition
    //todo: remove interactionHandler

    private _isSetupScopes: boolean = false;
    private _isSetupClient: boolean = false;

    constructor(
        options: {
            name: string,
            group: string,
            intents?: Set<GatewayIntentsString | number>,
            partials?: Set<Partials>
        }
    ) {
        this._name = options.name;
        this._group = options.group;
        this._intents = options.intents ?? new Set();
        this._partials = options.partials ?? new Set();
    }

    public setupScopes(
        enabled: boolean,
        guilds: ServerConfig[] | "global",
        usersList?: {
            whitelist?: string[] | undefined;
            blacklist?: string[] | undefined;
        }
    ) {
        this._enabled = enabled;
        this._isGlobal = guilds === "global";
        this._guilds = guilds;
        this._usersList = { ...this._usersList, ...usersList };
        this._isSetupScopes = true;
        return this;
    }

    public setupClient(client: Client) {
        this._client = client;
        this._isSetupClient = true;
    }

    public isSetup(): this is ScriptBuilder & { client: Client, guilds: ServerConfig[] | "global" } {
        return this._isSetupScopes && this._isSetupClient;
    }
    private checkSetup(): boolean {
        if (!this.isSetup()) {
            printE('Client or guilds not set. ' + this._name);
            throw new Error();
        };
        if (!this._enabled) return false;
        return true;
    }
    private checkSettings(settings: OnEventSettings, authorId: string | undefined, guildId: string | undefined): boolean {

        if (settings.scopeGuilds && guildId
            && this.guilds !== "global"
            && !this.guilds!.map(guild => guild.serverId).includes(guildId)) {
            return false;
        }

        if (settings.scopeUsers && authorId
            && (
                (this._usersList.blacklist && this._usersList.blacklist.includes(authorId))
                || (this._usersList.whitelist && !this._usersList.whitelist.includes(authorId))
            )
        ) {
            return false;
        }

        return true;
    }

    public addOnSlash(
        options: {
            settings?: OnEventSettings,
            slashDeployData: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">,
            onSlash: (interaction: ChatInputCommandInteraction) => Promise<void>
        }
    ) {
        if (this._name !== options.slashDeployData.name) {
            printE('Slash command name does not match script name. ' + this._name + " != " + options.slashDeployData.name);
            throw new Error();
        }
        this._onSlashSettings = {
            ...this._onSlashSettings,
            ...options.settings
        };
        this._onSlash = options.onSlash;
        this._slashDeployData = options.slashDeployData;
        return this;
    }

    public addOnContext(
        options: {
            settings?: OnEventSettings,
            contextDeployData: ContextMenuCommandBuilder,
            onContext: (interaction: (MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction)) => Promise<void>
        }
    ) {
        if (this._name !== options.contextDeployData.name) {
            printE('Context command name does not match script name. ' + this._name + " != " + options.contextDeployData.name);
            return this;
        }
        this._onContextSettings = {
            ...this._onContextSettings,
            ...options.settings
        };
        this._onContext = options.onContext;
        this._contextDeployData = options.contextDeployData;
        return this;
    }

    public addOnStart(
        options: {
            onStart: () => Promise<void>
        }
    ) {
        this._onStart = async (): Promise<void> => {
            if (!this.checkSetup()) return;
            await options.onStart();
        };
        return this;
    }

    public addOnMessage(
        options: {
            settings?: OnMessageSettings,
            onMessage: (message: Message) => Promise<void>
        }
    ) {
        this._onMessageSettings = {
            ...this._onMessageSettings,
            ...options.settings
        };
        this._onMessage = options.onMessage;
        return this;
    }

    public addOnButton(
        options: {
            settings?: OnEventSettings,
            isValidButtonCustomId: (customId: string) => Promise<boolean>,
            onButton: (interaction: ButtonInteraction) => Promise<void>,
        }
    ) {
        this._onButtonSettings = {
            ...this._onButtonSettings,
            ...options.settings
        };
        this._onButton = options.onButton;
        this._isValidButtonCustomId = options.isValidButtonCustomId;
        return this;
    }

    public addOnSelectMenu(
        options: {
            settings?: OnEventSettings,
            isValidSelectMenuCustomId: (customId: string) => Promise<boolean>,
            onSelectMenu: (interaction: AnySelectMenuInteraction) => Promise<void>,
        }
    ) {
        this._onSelectMenuSettings = {
            ...this._onSelectMenuSettings,
            ...options.settings
        };
        this._onSelectMenu = options.onSelectMenu;
        this._isValidSelectMenuCustomId = options.isValidSelectMenuCustomId;
        return this;
    }

    public addOnModal(
        options: {
            settings?: OnEventSettings,
            isValidModalCustomId: (customId: string) => Promise<boolean>,
            onModal: (interaction: ModalSubmitInteraction) => Promise<void>,
        }
    ) {
        this._onModalSettings = {
            ...this._onModalSettings,
            ...options.settings
        };
        this._onModal = options.onModal;
        this._isValidModalCustomId = options.isValidModalCustomId;
        return this;
    }

    public addOnAutocomplete(
        options: {
            isValidAutocompleteCommandName: (commandName: string) => Promise<boolean>,
            onAutocomplete: (interaction: AutocompleteInteraction) => Promise<void>,
        }
    ) {
        this._onAutocomplete = options.onAutocomplete;
        this._isValidAutocompleteCommandName = options.isValidAutocompleteCommandName;
        return this;
    }

    public addOnUpdate(
        options: {
            onUpdate: () => Promise<void>
        }
    ) {
        this._onUpdate = async (): Promise<void> => {
            if (!this.checkSetup()) return;
            await options.onUpdate();
        };
        return this;
    }

    public async interactionHandler(
        interaction: Interaction
    ) {
        if (this.onButton)
            await this.onButton(interaction);
        if (this.onSlash)
            await this.onSlash(interaction);
        if (this.onContext)
            await this.onContext(interaction);
        if (this.onAutocomplete)
            await this.onAutocomplete(interaction);
        if (this.onSelectMenu)
            await this.onSelectMenu(interaction);
        if (this.onModal)
            await this.onModal(interaction);
    }



}
// TODO prevent reusing event declaration functions.
// so onSlash can be called only once.

// should check checkSetup only once in index? not in each function.
