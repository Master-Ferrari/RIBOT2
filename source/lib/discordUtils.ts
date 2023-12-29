import { Client, Message, TextChannel, Guild } from 'discord.js';

/**
 * Finds a message in a specified channel.
 * 
 * @param channelId - The ID of the channel to search in.
 * @param userId - The ID of the user who sent the message.
 * @param content - The content of the message to find.
 * @param client - The Discord client instance.
 * @returns The found message, or null if not found.
 */
async function findMessage(channelId: string, userId: string, content: string, client: Client): Promise<Message | null> {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
        console.error('Channel not found or is not a text channel.');
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

/**
 * Fetches a message by its ID from a specified channel and guild.
 * 
 * @param messageId - The ID of the message to fetch.
 * @param channelId - The ID of the channel where the message is located.
 * @param guildId - The ID of the guild where the channel is located.
 * @param client - The Discord client instance.
 * @returns The message if found, otherwise null.
 */
async function fetchMessage(messageId: string, channelId: string, guildId: string, client: Client): Promise<Message | null> {
    try {
        const guild = await client.guilds.fetch(guildId);
        if (!guild) return null;

        const channel = guild.channels.cache.get(channelId);
        // if (!channel || !channel.isText()) return null;

        const message = await (channel as any).messages.fetch(messageId);
        return message;
    } catch (error) {
        console.error('Failed to fetch message:', error);
        return null;
    }
}

async function fetchGuild(client: Client, guildId: string): Promise<Guild | undefined> {

    const guild = await client.guilds.cache.get(guildId);

    return guild;

}

export { findMessage, fetchMessage, fetchGuild };