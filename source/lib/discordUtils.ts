import { Client, Message, TextChannel, Guild, GuildBasedChannel, WebhookClient } from 'discord.js';
import { print, printD, printE, printL, format, dateToStr } from '../lib/consoleUtils';

export type GuildSetting = {
    guildName: string;
    guildId: string;
    botChannelId: string;
    mainWebhookLink: string;
};
export function isGuildSetting(obj: any): obj is GuildSetting {
    return (
        obj &&
        typeof obj === 'object' &&
        typeof obj.guildName === 'string' &&
        typeof obj.guildId === 'string' &&
        typeof obj.botChannelId === 'string' &&
        typeof obj.mainWebhookLink === 'string'
    );
}

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
        if (!guild) return null;

        const channel = guild.channels.cache.get(channelId);
        // if (!channel || !channel.isText()) return null;

        const message = await (channel as any).messages.fetch(messageId);
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

export async function fetchLastNMessages(guildId: string, channelId: string, n: number, client: Client): Promise<Message[]> {
    try {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) throw new Error('Guild not found');

        const channel = guild.channels.cache.get(channelId);
        if (!channel || !(channel instanceof TextChannel)) throw new Error('Channel not found or is not a text channel');

        const messages = await channel.messages.fetch({ limit: n });
        return Array.from(messages.values());
    } catch (error) {
        printE('Failed to fetch messages:', error);
        return [];
    }
}



export type WebhookParams = {
    client: Client;
    webhookUrl: string;
    content: string;
    channelId: string;
    guildId: string;
    username: string;
    avatarURL: string;
};

export async function sendWebhookMsg(params: WebhookParams) {

    const { client, webhookUrl, content, channelId, guildId, username, avatarURL } = params;

    // try {

    // const webhook = webhookFromURL("https://discord.com/api/webhooks/1176534528441991322/ruFprC5MrWZAL_mqoJdSf85C617g1pPAGb4fzX8X_cuZlGp-roJGRw8zP76TDKGtP_LE");
    const webhook = await new WebhookClient({ url: webhookUrl });

    // printE(webhook.edit{});

    const guild = await client.guilds.fetch(guildId);
    if (!guild) throw new Error('Guild not found');

    const channel: GuildBasedChannel | null = await guild.channels.fetch(channelId);
    if (!channel || !channel.isTextBased) throw new Error('Channel not found or not a text channel');
    
    // const webhookId = webhookUrl.split('/').pop() || '';

    const textChannel = channel as TextChannel;

    await webhook.edit({
        name: username,
        avatar: avatarURL,
        channel: '968834331852300288',
        reason: 'a wot nado'
    });

    await webhook.send({
        content: content,
        username: username,
        avatarURL: avatarURL,
    });

    function webhookFromURL(webhookUrl: string): WebhookClient {
        const [id, token] = webhookUrl.replace('https://discord.com/api/webhooks/', '').split('/');

        const webhookClient = new WebhookClient({ id, token });

        return webhookClient;
    }

    // } catch (error) {
    //     printE('Failed to send message:', error);
    // }
}


