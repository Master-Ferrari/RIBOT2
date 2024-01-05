import { Client, Message, TextChannel, Guild, GuildBasedChannel, WebhookClient, GuildScheduledEvent, GuildTextChannelResolvable, EmbedBuilder } from 'discord.js';
import { print, printD, printE, printL, format, dateToStr } from '../lib/consoleUtils';

export type GuildSetting = {
    guildName: string;
    guildId: string;
    botChannelId: string;
    mainWebhookLink: string;
    eventschannelId: string;
};

export function isGuildSetting(obj: any): obj is GuildSetting {
    return (
        obj &&
        typeof obj === 'object' &&
        typeof obj.guildName === 'string' &&
        typeof obj.guildId === 'string' &&
        typeof obj.botChannelId === 'string' &&
        typeof obj.mainWebhookLink === 'string' &&
        typeof obj.eventschannelId === 'string'
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


export type WebhookSend = {
    content: string | undefined;
    embeds?: Array<EmbedBuilder> | undefined;
    channelId: string;
    guildId: string;
    webhookUrl: string;
    username?: string;
    avatarURL?: string;
    client: Client;
};

export async function sendWebhookMsg(params: WebhookSend): Promise<Message> {
    const { client, webhookUrl, content, embeds, channelId, guildId, username, avatarURL } = params;

    const [id, token] = webhookUrl.replace('https://discord.com/api/webhooks/', '').split('/');

    const webhook = await client.fetchWebhook(id, token);

    if (channelId && webhook.channelId !== channelId) {
        await webhook.edit({ channel: channelId });
    }

    const guild = await client.guilds.fetch(guildId);
    if (!guild) throw new Error('Guild not found');

    const msg = await webhook.send({
        content: content,
        embeds: embeds,
        username: username || undefined,
        avatarURL: avatarURL || undefined,
    });

    return msg;
}

export async function editWebhookMsg(messageId: string, params: WebhookSend): Promise<Message> {
    const { client, webhookUrl, content, embeds, channelId, guildId, username, avatarURL } = params;

    const [id, token] = webhookUrl.replace('https://discord.com/api/webhooks/', '').split('/');

    const webhook = await client.fetchWebhook(id, token);

    if (channelId && webhook.channelId !== channelId) {
        await webhook.edit({ channel: channelId });
    }

    const guild = await client.guilds.fetch(guildId);
    if (!guild) throw new Error('Guild not found');

    const msg = await webhook.editMessage(messageId, ({
        content: content,
        embeds: embeds,
    }));

    return msg;
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
