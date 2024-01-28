import { Client, ContextMenuCommandBuilder, MessageContextMenuCommandInteraction, SlashCommandBuilder, CommandInteraction, ButtonInteraction, Message, BitFieldResolvable, GatewayIntentsString } from 'discord.js';
import { ScriptScopes } from './discordUtils';
import { print, printD, printL, format, dateToStr, printE } from './consoleUtils';


export type GroupConfig = {
    guilds: Record<string, string>;
    global: boolean;
};

export type ScriptConfig = {
    info: {
        comandName: string;
        type: string;
        group: string;
    };
    global: boolean;
    guilds: Array<ServerConfig>;
    data: SlashCommandBuilder | ContextMenuCommandBuilder;
    onInteraction?(interaction: CommandInteraction, client: Client, scriptScopes?: ScriptScopes): Promise<void>;
    onStart?(client: Client, scriptScopes: ScriptScopes): Promise<void>;
    onUpdate?(client: Client, scriptScopes: ScriptScopes): Promise<void>;
};


export type ServerConfig = {
    info: {
        serverName: string;
        serverId: string;
    }
    scripts: Array<ScriptConfig>;
};


///////////////////////////

type OnSlashOptions = {
    interaction: CommandInteraction,
}

type OnContextOptions = {
    interaction: MessageContextMenuCommandInteraction,
}

type onMessageOptions = {
    message: Message,
}

type onStartOptions = {
}

type onButtonOptions = {
    interaction: ButtonInteraction,
}

type onUpdateOptions = {
}

export class ScriptBuilder {

    private _name: string;
    private _group: string;

    private _scriptScopes?: ScriptScopes;
    private _intents?: BitFieldResolvable<GatewayIntentsString, number>;
    private _client?: Client;

    private _onSlash?: (options: OnSlashOptions) => Promise<void>;
    private _slashDeployData?: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
    private _isSlash: boolean = false;

    private _onContext?: (options: OnContextOptions) => Promise<void>;
    private _contextDeployData?: ContextMenuCommandBuilder;
    private _isContext: boolean = false;

    private _onStart?: (options: onStartOptions) => Promise<void>;
    private _isStart: boolean = false;

    private _onMessage?: (options: onMessageOptions) => Promise<void>;
    private _isChat: boolean = false;

    private _onButton?: (options: onButtonOptions) => Promise<void>;
    private _isButton: boolean = false;

    private _onUpdate?: (options: onUpdateOptions) => Promise<void>;
    private _isUpdate: boolean = false;


    public get name() { return this._name; }
    public get group() { return this._group; }
    public get scriptScopes() { return this._scriptScopes; }
    public get intents() { return this._intents; }
    public get client() { return this._client; }
    public get onSlash() { return this._onSlash; }
    public get slashDeployData() { return this._slashDeployData; }
    public get isSlash() { return this._isSlash; }
    public get onContext() { return this._onContext; }
    public get contextDeployData() { return this._contextDeployData; }
    public get isContext() { return this._isContext; }
    public get onStart() { return this._onStart; }
    public get isStart() { return this._isStart; }
    public get onMessage() { return this._onMessage; }
    public get isChat() { return this._isChat; }
    public get onButton() { return this._onButton; }
    public get isButton() { return this._isButton; }
    public get onUpdate() { return this._onUpdate; }
    public get isUpdate() { return this._isUpdate; }


    constructor(
        options: {
            name: string,
            group: string,
            intents?: BitFieldResolvable<GatewayIntentsString, number>
        }
    ) {
        this._name = options.name;
        this._group = options.group;
        this._intents = options.intents;
    }

    public setup(
        client: Client,
        scopes: ScriptScopes
    ) {
        if (scopes.global && scopes.guilds.length > 0) {
            printE('Global script cannot be used in guilds');
        }
        this._client = client;
        this._scriptScopes = scopes;
        return this;
    }

    private checkScopes(): boolean {
        if (!this._client || !this._scriptScopes) {
            printE('Client or script scopes are not set');
            return false;
        };
        return true;
    }

    public addOnSlash(
        slashDeployData: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">,
        onSlash: (options: OnSlashOptions) => Promise<void>
    ) {
        this._onSlash = async (options: OnSlashOptions): Promise<void> => {
            if (!this.checkScopes()) return;
            if (!this._scriptScopes!.global && !this._scriptScopes!.guilds.includes(options.interaction.guildId!)) return;
            if (this._name !== options.interaction.commandName) {
                printE('Slash command name does not match script name');
                return;
            }
            await onSlash(options);
        };
        this._slashDeployData = slashDeployData;
        this._isSlash = true;
        return this;
    }

    public addOnContext(
        contextDeployData: ContextMenuCommandBuilder,
        onContext: (options: OnContextOptions) => Promise<void>
    ) {
        this._onContext = async (options: OnContextOptions): Promise<void> => {
            if (!this.checkScopes()) return;
            if (!this._scriptScopes!.global && !this._scriptScopes!.guilds.includes(options.interaction.guildId!)) return;
            if (this._name !== options.interaction.commandName) {
                printE('Context command name does not match script name');
                return;
            }
            await onContext(options);
        };
        this._contextDeployData = contextDeployData;
        this._isContext = true;
        return this;
    }

    public addOnStart(
        onStart: (options: onStartOptions) => Promise<void>
    ) {
        this._onStart = async (options: onStartOptions): Promise<void> => {
            if (!this.checkScopes()) return;
            await onStart(options);
        };
        this._isStart = true;
        return this;
    }

    public addOnMessage(
        onMessage: (options: onMessageOptions) => Promise<void>
    ) {
        this._onMessage = async (options: onMessageOptions): Promise<void> => {
            if (!this.checkScopes()) return;
            if (!this._scriptScopes!.global && !this._scriptScopes!.guilds.includes(options.message.guildId!)) return;
            await onMessage(options);
        };
        this._isChat = true;
        return this;
    }

    public addOnButton(
        onButton: (options: onButtonOptions) => Promise<void>
    ) {
        this._onButton = async (options: onButtonOptions): Promise<void> => {
            if (!this.checkScopes()) return;
            await onButton(options);
        };
        this._isButton = true;
        return this;
    }

    public addOnUpdate(
        onUpdate: (options: onUpdateOptions) => Promise<void>
    ) {
        this._onUpdate = async (options: onUpdateOptions): Promise<void> => {
            if (!this.checkScopes()) return;
            await onUpdate(options);
        };
        this._isUpdate = true;
        return this;
    }
}



export const script = new ScriptBuilder({
    name: "testScript",
    group: "testGroup"
}).addOnButton(
    async (options: onButtonOptions) => {

    }
).addOnStart(
    async () => {
        // script.client
    }
);

if (script.onStart)
    script.onStart({});

if (script.isSlash)
    script.onStart!({});
