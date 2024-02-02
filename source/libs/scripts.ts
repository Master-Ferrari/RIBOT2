import { Client, Interaction, ContextMenuCommandBuilder, Partials, MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction, SlashCommandBuilder, CommandInteraction, ButtonInteraction, Message, BitFieldResolvable, GatewayIntentsString, GatewayIntentBits } from 'discord.js';
import { print, printD, printL, format, dateToStr, printE } from './consoleUtils';

export type ServerConfig = {
    serverName: string;
    serverId: string;
    scripts: Array<ScriptBuilder>;
};

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
    private _usersList?: {
        whitelist: string[] | null;
        blacklist: string[] | null;
    };
    public get guilds() { return this._guilds; }
    public get isGlobal() { return this._isGlobal; }
    public get usersList() { return this._usersList; }

    //slash
    private _onSlash?: (interaction: CommandInteraction) => Promise<void>;
    private _slashDeployData?: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
    public get onSlash() {
        if (!this._onSlash) return;
        return async (interaction: Interaction) => {
            if (!interaction.isCommand()) return;
            if (interaction.commandName !== this.name) return;

            const username = interaction.user.username;
            const commandName = interaction.commandName;
            const options = interaction.options.data.map(option => (` ${option.name}:${option.value}`)).join(" ");
            await this.interactionLog(username, commandName, options);

            if (!this.checkSetup()) return;
            if (this.guilds !== "global" && !this.guilds!.map(guild => guild.serverId).includes(interaction.guildId!)) return;
            const script = this as ScriptBuilder & { client: Client, guilds: ServerConfig[] | "global" };
            await this._onSlash!(interaction);
        }
    }
    public get slashDeployData() { return this._slashDeployData; }
    public isSlash(): this is ScriptBuilder & {
        onSlash: (interaction: CommandInteraction) => Promise<void>,
        slashDeployData: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">
    } {
        return this.onSlash !== undefined;
    }
    // context
    private _onContext?: (interaction: (MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction)) => Promise<void>;
    private _contextDeployData?: ContextMenuCommandBuilder;
    public get onContext() {
        if (!this._onContext) return undefined;
        return async (interaction: Interaction) => {
            if (!interaction.isContextMenuCommand()) return;
            if (interaction.commandName !== this.name) return;

            const username = interaction.user.username;
            const commandName = interaction.commandName;
            const options = interaction.options.data.map(option => (` ${option.name}:${option.value}`)).join(" ");
            await this.interactionLog(username, commandName, options);

            if (!this.checkSetup()) return;
            if (this.guilds !== "global" && !this.guilds!.map(guild => guild.serverId).includes(interaction.guildId!)) return;
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
    public get onMessage() {
        if (!this._onMessage) return undefined;
        return async (message: Message) => {
            if (!this.checkSetup()) return;
            if (this.guilds !== "global" && !this.guilds!.map(guild => guild.serverId).includes(message.guildId!)) return;
            await this._onMessage!(message);
        };
    }
    public isMessage(): this is ScriptBuilder & { onMessage: (message: Message) => Promise<void> } {
        return this.onMessage !== undefined;
    }
    //button
    private _onButton?: (interaction: ButtonInteraction) => Promise<void>;
    private _isValidCustomId?: (customId: string) => Promise<boolean>;
    public get onButton() {
        if (!this._onButton) return undefined;
        return async (interaction: Interaction) => {
            if (!interaction.isButton()) return;
            if (!this.isValidCustomId!(interaction.customId)) return;

            const username = interaction.user.username;
            const commandName = "button/";
            const options = interaction.customId;
            await this.interactionLog(username, commandName, options);

            if (!this.checkSetup()) return;
            await this._onButton!(interaction);
        }
    }
    public get isValidCustomId() { return this._isValidCustomId; }
    public isButton(): this is ScriptBuilder & {
        onButton: (interaction: ButtonInteraction) => Promise<void>,
        isValidCustomId: (customId: string) => Promise<boolean>
    } {
        return this.onButton !== undefined;
    }
    //update
    private _onUpdate?: () => Promise<void>;
    public get onUpdate() { return this._onUpdate; }
    public isUpdate(): this is ScriptBuilder & { onUpdate: () => Promise<void> } {
        return this.onUpdate !== undefined;
    }
    //todo: events events
    //todo: autocomlpite
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
            whitelist: string[] | null;
            blacklist: string[] | null;
        }
    ) {
        this._enabled = enabled;
        this._isGlobal = guilds === "global";
        this._guilds = guilds;
        this._usersList = usersList ?? { whitelist: null, blacklist: null };
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
        return true;
    }

    public addOnSlash(
        options: {
            slashDeployData: SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">,
            onSlash: (interaction: CommandInteraction) => Promise<void>
        }
    ) {
        if (this._name !== options.slashDeployData.name) {
            printE('Slash command name does not match script name. ' + this._name + " != " + options.slashDeployData.name);
            throw new Error();
        }
        this._onSlash = options.onSlash;
        this._slashDeployData = options.slashDeployData;
        return this;
    }

    public addOnContext(
        options: {
            contextDeployData: ContextMenuCommandBuilder,
            onContext: (interaction: (MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction)) => Promise<void>
        }
    ) {
        if (this._name !== options.contextDeployData.name) {
            printE('Context command name does not match script name. ' + this._name + " != " + options.contextDeployData.name);
            return this;
        }
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
            onMessage: (message: Message) => Promise<void>
        }
    ) {
        this._onMessage = options.onMessage;
        return this;
    }

    public addOnButton(
        options: {
            isValidCustomId: (customId: string) => Promise<boolean>,
            onButton: (interaction: ButtonInteraction) => Promise<void>,
        }
    ) {
        this._onButton = options.onButton;
        this._isValidCustomId = options.isValidCustomId;
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

    private async interactionLog(username: string, commandName: string, options: string) {
        await printL(
            username + format(
                " /" + commandName + options
                , { foreground: 'yellow' }
            ) + dateToStr(new Date(), "timeStamp"));
    }

    public interactionHandler(
        interaction: Interaction
    ) {
        if (this.onButton)
            this.onButton(interaction);
        if (this.onSlash)
            this.onSlash(interaction);
        if (this.onContext)
            this.onContext(interaction);
    }



}