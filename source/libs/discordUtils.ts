import {
    Client, Message, TextChannel, Guild, GuildBasedChannel,
    WebhookClient, GuildScheduledEvent, GuildTextChannelResolvable,
    EmbedBuilder, FetchMessagesOptions, ButtonStyle, ChannelType, ButtonBuilder,
    ChannelSelectMenuBuilder, MessageCreateOptions, MessageEditOptions,
    MessageActionRowComponentBuilder, ActionRowBuilder, StringSelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuDefaultValueType, APISelectMenuDefaultValue, User, AttachmentBuilder, Interaction, ButtonInteraction, MessageComponentInteraction, ModalMessageModalSubmitInteraction, Channel, ChatInputCommandInteraction
} from 'discord.js';

import { print, printD, printE, printL, format, dateToStr } from './consoleUtils';
import Database from "./sqlite"
import { AllModels, G4fModels, Method } from './gptHandler';

//#region TYPES
export type ScriptScopes = {
    global: boolean;
    guilds: Array<string>;
    usersWhitelist?: Array<string>;
}

export type GptSettingsTableType = "userSettings" | "guildSettings";
export type GptSettings = {
    type: GptSettingsTableType;
    method: Method;
    model: AllModels;
    gptChannels: string[];
    prompt: string;
    apikey?: string;
    webhook?: string;
}

export type GuildSetting = {
    guildName: string;
    guildId: string;
    botChannelId: string;
    mainWebhookLink: string;
    eventsChannelId: string;
    gptSettings: GptSettings;
};

export type UserSetting = {
    userName: string;
    userId: string;
    gptSettings: GptSettings;
}

export function completeGuildSettings(partial: Partial<GuildSetting>): GuildSetting {
    const defaultValues: GuildSetting = {
        guildName: '',
        guildId: '',
        botChannelId: '',
        mainWebhookLink: '',
        eventsChannelId: '',
        gptSettings: { type: 'guildSettings', method: 'Gpt4Free', model: 'gpt-4-32k', gptChannels: [], prompt: '' }
    };

    return { ...defaultValues, ...partial };
};

export type ButtonParams = {
    type: 2,
    customId: string,
    style: ButtonStyle,
    disabled: boolean,
    emoji: string | undefined,
    label: string | undefined
};

export type ChannelSelectParams = {
    type: 8,
    customId: string,
    channelTypes: ChannelType[],
    placeholder: string | undefined,
    disabled: boolean,
    default_values?: string[],
    min_values?: number,
    max_values?: number
};

export type StringSelectParams = {
    type: 3,
    customId: string,
    options: SelectMenuComponentOptionData[],
    placeholder: string | undefined,
    disabled: boolean,
    min_values?: number,
    max_values?: number
};

export type ComponentParams = (ButtonParams | ChannelSelectParams | StringSelectParams);
export type ComponentRow = ComponentParams[];
export type ComponentsData = ComponentRow[];

export type ComponentBuilder = (ButtonBuilder | ChannelSelectMenuBuilder | StringSelectMenuBuilder);

export type commonStuff = {
    prompt: string
}
//#endregion

//#region database
export async function getSettings(settings: Array<keyof GuildSetting>, db: Database, guildId: string): Promise<GuildSetting | string> {

    const dbData = await db.getJSON('guildSettings', String(guildId));
    if (!dbData) return `добавь в /settings эти штуки: ${settings.join(', ')}`;

    const completedData: GuildSetting = completeGuildSettings(dbData as Partial<GuildSetting>);

    const missingSettings = settings.filter(setting => !completedData[setting as keyof GuildSetting]);

    if (missingSettings.length > 0) {
        return `Добавь в /settings эти штуки: ${missingSettings.join(', ')}`;
    }

    return completedData;
}
//#endregion

//#region webhooks

export type WebhookSend = {
    content?: string | undefined;
    embeds?: Array<EmbedBuilder> | undefined;
    channelId: string;
    guildId: string;
    webhookUrl: string;
    username?: string;
    avatarURL?: string;
    client: Client;
    files?: Array<string>;
};

export async function sendWebhookMsg(params: WebhookSend): Promise<Message> {
    const { client, webhookUrl, content, embeds, channelId, guildId, username, avatarURL, files } = params;

    const [id, token] = webhookUrl.replace('https://discord.com/api/webhooks/', '').split('/');

    const webhook = await client.fetchWebhook(id, token);

    if (channelId && webhook.channelId !== channelId) {
        await webhook.edit({ channel: channelId });
    }

    const guild = await client.guilds.fetch(guildId);
    if (!guild) throw new Error('Guild not found');

    const msg = await webhook.send({
        content: content || undefined,
        embeds: embeds || undefined,
        username: username || undefined,
        avatarURL: avatarURL || undefined,
        files: files || undefined
    });

    return msg;
}

export async function editWebhookMsg(messageId: string, params: WebhookSend): Promise<Message> {
    const { client, webhookUrl, content, embeds, channelId, guildId, username, avatarURL, files } = params;

    const [id, token] = webhookUrl.replace('https://discord.com/api/webhooks/', '').split('/');

    const webhook = await client.fetchWebhook(id, token);

    if (channelId && webhook.channelId !== channelId) {
        await webhook.edit({ channel: channelId });
    }

    const guild = await client.guilds.fetch(guildId);
    if (!guild) throw new Error('Guild not found');

    const msg = await webhook.editMessage(messageId, ({
        content: content || undefined,
        embeds: embeds || undefined,
        files: files || undefined
    }));

    return msg;
}

//#endregion

//#region old fetch functions

export async function findMessage(channelId: string, userId: string, content: string, client: Client): Promise<Message | null> {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
        printE('Channel not found or is not a text channel.');
        return null;
    }

    let foundMessage: Message | null = null;
    let lastId: string | undefined = undefined;

    while (true) {
        const options: { limit: number; before?: string } = { limit: 100 };
        if (lastId) options.before = lastId;

        const messages = await channel.messages.fetch(options);
        const message = messages.find(msg => msg.author.id === userId && msg.content.includes(content));

        if (message) {
            foundMessage = message;
            break;
        } else if (messages.size !== 100) {
            break; // No more messages left to check
        }

        lastId = messages.last()?.id;
    }

    return foundMessage;
}

export async function fetchMessage(messageId: string, channelId: string, guildId: string, client: Client): Promise<Message | null> {
    try {
        const guild = await client.guilds.fetch(guildId);
        const channel = await guild.channels.cache.get(channelId) as TextChannel;
        const message = await channel.messages.fetch(messageId);
        if (!(message instanceof Message)) return null;
        return message;
    } catch (error) {
        printE('Failed to fetch message:', error);
        return null;
    }
}

export async function fetchGuild(client: Client, guildId: string): Promise<Guild | undefined> {

    const guild = await client.guilds.cache.get(guildId);

    return guild;

}

export async function fetchChannel(client: Client, guildId: string, channelId: string): Promise<GuildBasedChannel | undefined> {

    const guild = await client.guilds.cache.get(guildId);

    const channel = await guild?.channels.cache.get(channelId);

    return channel as GuildBasedChannel | undefined;
}

export async function fetchLastNMessages(guildId: string, channelId: string, n: number, client: Client, relative?: "before" | "after", messageId?: string): Promise<Message[]> {
    try {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) throw new Error('Guild not found');

        const channel = guild.channels.cache.get(channelId);
        if (!channel || !(channel instanceof TextChannel)) throw new Error('Channel not found or is not a text channel');
        const options: FetchMessagesOptions = { limit: n };
        if (relative && messageId) {
            options[relative] = messageId;
        }
        const messages = await channel.messages.fetch(options);
        return Array.from(messages.values());
    } catch (error) {
        console.error('Failed to fetch messages:', error);
        return [];
    }
}

export async function fetchEventById(client: Client, guildId: string, eventId: string): Promise<GuildScheduledEvent | null> {
    try {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) throw new Error('Guild not found');

        const events = await guild.scheduledEvents.fetch();

        const event = events.get(eventId);
        if (!event) throw new Error('Event not found');

        return event;
    } catch (error) {
        console.error('Error finding event by ID:', error);
        return null;
    }
}

export function wait(mils: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, mils));
}


export type updateReactionsOptions = {
    reactions: Array<string>,
    client: Client
    msg: Message
}

export async function updateReactions({ reactions, client, msg }: updateReactionsOptions): Promise<void> {
    try {

        const reactionNames = reactions.map(reaction => {
            const match = reaction.match(/^<a?:([a-zA-Z0-9_]+):[0-9]+>$/);
            return match ? match[1] : reaction;
        });

        const userReactions = msg.reactions.cache;
        for (const reaction of userReactions.values()) {
            const reactionName = reaction.emoji.name;
            if (reactionName && !reactionNames.includes(reactionName)) {
                await reaction.remove();//await
            } else if (reactionName) {
                const users = await reaction.users.fetch();
                for (const [userId] of users) {
                    if (client.user && userId !== client.user.id) {
                        await reaction.users.remove(userId);//await
                    }
                }
            }
        }

        for (let reaction of reactions) {
            if (!msg.reactions.cache.some(r => r.emoji.name === reaction)) {
                await msg.react(reaction);
            }
        }

    } catch (error) {
        console.error('Failed to update reactions:', error);
    }
}

//#endregion

//#region fetcher

type MessageInfo = Message
    | {
        messageLink?: string;
        messageId?: string;
        channel?: ChannelInfo;
    };

type ChannelInfo = TextChannel
    | {
        channelLink?: string;
        channelId?: string;
        guild?: GuildInfo;
    };

type GuildInfo = Guild
    | {
        guildId: string;
    };

type UserInfo =
    {
        userId: string;
    };

export class Fetcher {

    public static async guild(guild: GuildInfo, client: Client): Promise<Guild | undefined> {
        try {
            if (guild instanceof Guild) {
                return guild;
            }
            if (guild.guildId) {
                return await client.guilds.cache.get(guild.guildId);
            }
            return undefined;
        }
        catch (error) {
            printE('Error fetching guild:', error);
            return undefined;
        }
    }

    public static async channel(channel: ChannelInfo, client: Client): Promise<TextChannel | undefined> {
        try {
            if (channel instanceof TextChannel) {
                return channel;
            }
            if (channel.channelLink) {
                const regex = /channels\/(\d+|@me)\/(\d+)/;
                const match = channel.channelLink.match(regex);

                if (match) {
                    const guildId = match[1];
                    const channelId = match[2];

                    if (guildId === '@me') { // DM channels are not TextChannels, so this might need special handling
                        return undefined; // Direct messages do not have TextChannels
                    } else {
                        const guild = await client.guilds.fetch(guildId);
                        if (!guild) throw new Error(`Guild with ID ${guildId} not found`);
                        return guild.channels.cache.get(channelId) as TextChannel;
                    }
                } else {
                    throw new Error(`Invalid channel link: ${channel.channelLink}`);
                }
            } else if (channel.channelId) {
                if (channel.guild) {
                    const guild = await Fetcher.guild(channel.guild, client);
                    if (guild) {
                        return guild.channels.cache.get(channel.channelId) as TextChannel;
                    }
                } else {
                    return client.channels.cache.get(channel.channelId) as TextChannel;
                }
            }
            return undefined;
        } catch (error) {
            printE('Error fetching channel:', error);
            return undefined;
        }
    }

    public static async message(message: MessageInfo, client: Client): Promise<Message | undefined> {
        try {
            if (message instanceof Message) {
                return message;
            }
            if (message.messageLink) {
                const regex = /channels\/(\d+|@me)\/(\d+)\/(\d+)/;
                const match = message.messageLink.match(regex);

                if (match) {
                    const guildId = match[1];
                    const channelId = match[2];
                    const messageId = match[3];

                    if (guildId == '@me') { // DM
                        const channel = await client.users.createDM(channelId);
                        if (!channel) throw new Error(`DM channel with ID ${channelId} not found`);
                        return channel.messages.fetch(messageId);
                    } else {
                        const guild = await client.guilds.fetch(guildId);
                        if (!guild) throw new Error(`Guild with ID ${guildId} not found`);
                        const channel = guild.channels.cache.get(channelId) as TextChannel;
                        if (!channel) throw new Error(`Channel with ID ${channelId} not found in guild with ID ${guildId}`);
                        return channel.messages.fetch(messageId);
                    }

                } else {
                    throw new Error(`Invalid message link: ${message.messageLink}`);
                }

            } else if (message.messageId && message.channel) {
                if ('channel' in message) {
                    const channel = await Fetcher.channel(message.channel, client);
                    if (channel) {
                        return channel.messages.fetch(message.messageId);
                    }
                }
            }

            throw new Error(`Invalid message info: ${JSON.stringify(message)}`);

        } catch (error) {
            printE('Error fetching message:', error);
            return undefined;
        }
    }

    public static async messages(channel: TextChannel, client: Client, n: number, relative?: "before"): Promise<Array<Message>>;
    public static async messages(message: MessageInfo, client: Client, n: number, relative?: "before" | "after"): Promise<Array<Message>>;
    public static async messages(messageOrChannel: MessageInfo | TextChannel, client: Client, n: number, relative?: "before" | "after"): Promise<Array<Message>> {
        try {

            let channel: TextChannel | undefined;
            let msg: Message | undefined;
            messageOrChannel
            if (messageOrChannel instanceof Message || 'messageLink' in messageOrChannel || 'messageId' in messageOrChannel || 'channel' in messageOrChannel) {
                msg = await Fetcher.message(messageOrChannel, client);
                if (!msg) return [];
                channel = msg.channel as TextChannel;

                if (!relative) relative = "before";
                const messages = await channel.messages.fetch({
                    limit: n,
                    before: msg.id
                    // after: relative === "before" ? msg.id : undefined,
                    // before: relative === "after" ? msg.id : undefined
                });
                const lastMessages = messages.map(m => m);
                return lastMessages;
            }
            else {
                channel = await Fetcher.channel(messageOrChannel as ChannelInfo, client);
                if (!channel) return [];
                return (await channel.messages.fetch({ limit: n })).map(m => m);
            }
        }
        catch (error) {
            printE('Error fetching messages:', error);
            return [];
        }
    }

    public static async user(userInfo: UserInfo, client: Client): Promise<User | undefined> {
        try {
            return await client.users.fetch(userInfo.userId);
        }
        catch (error) {
            printE('Error fetching user:', error);
            return;
        }
    }

}

//#endregion

//#region message builder
export function buildMessage(options: MessageCreateOptions, components: ComponentBuilder[][]): MessageCreateOptions | MessageEditOptions {

    let rows: Array<ActionRowBuilder<MessageActionRowComponentBuilder>> = [];

    components.forEach(buttons => {
        const row = new ActionRowBuilder() as ActionRowBuilder<MessageActionRowComponentBuilder>;
        row.addComponents(buttons);
        rows.push(row);
    })

    return {
        ...options,
        components: rows
    }
}

export function buildComponents(data: ComponentParams[][]): ComponentBuilder[][] {
    return data.map(row => {
        return row.map(cmpInfo => {

            if (cmpInfo.type === 2) {
                const button = new ButtonBuilder()
                    .setCustomId(cmpInfo.customId)
                    .setStyle(cmpInfo.style)
                    .setDisabled(cmpInfo.disabled);
                if (cmpInfo.emoji) button.setEmoji(cmpInfo.emoji);
                if (cmpInfo.label) button.setLabel(cmpInfo.label);
                return button;

            } else if (cmpInfo.type === 8) {
                const select = new ChannelSelectMenuBuilder()
                    .addChannelTypes(cmpInfo.channelTypes)
                    .setMinValues(cmpInfo.min_values || 1)
                    .setMaxValues(cmpInfo.max_values || 1)
                    .setCustomId(cmpInfo.customId)
                    .setDisabled(cmpInfo.disabled);
                if (cmpInfo.default_values)
                    select.setDefaultChannels(cmpInfo.default_values);
                if (cmpInfo.placeholder) select.setPlaceholder(cmpInfo.placeholder);
                return select;

            } else if (cmpInfo.type === 3) {
                const select = new StringSelectMenuBuilder()
                    .addOptions(cmpInfo.options)
                    .setMinValues(cmpInfo.min_values || 1)
                    .setMaxValues(cmpInfo.max_values || 1)
                    .setCustomId(cmpInfo.customId)
                    .setDisabled(cmpInfo.disabled);
                if (cmpInfo.placeholder) select.setPlaceholder(cmpInfo.placeholder);
                return select;

            }

        }).filter(x => x !== undefined) as ComponentBuilder[];
    });
}

//#endregion

//#region safeRequest //cringe
export class SafeDiscord {

    private static async trycatch(callback: () => Promise<any>): Promise<any> {
        try {
            return await callback();
        } catch (error) {
            printE('SafeDiscord Error:', error);
        }
    }

    private static limitCheck(options: MessageEditOptions): MessageEditOptions {
        if (options.content && options.content.length > 2000) {
            options.files = [new AttachmentBuilder(Buffer.from(options.content, 'utf-8'), { name: 'message.txt' })];
            options.content = '...';
        }
        return options;
    }

    static async interactionUpdate(interaction: Partial<MessageComponentInteraction | ModalMessageModalSubmitInteraction>, options: MessageEditOptions) {
        return this.trycatch(
            async () => {
                return await interaction.update?.(this.limitCheck(options))
            }
        );

    }

    static async messageEdit(message: Message, options: MessageEditOptions): Promise<Message | undefined> {
        return this.trycatch(
            async () => {
                return await message.edit(this.limitCheck(options))
            }
        );
    }


    static async do(stuff: () => Promise<any>): Promise<any> {
        return this.trycatch(
            async () => {
                return await stuff();
            }
        )
    }

}
//#endregion