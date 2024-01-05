import { Collection, WebhookClient, EmbedBuilder, Client, GuildScheduledEvent, Message, APIMessage, Guild } from 'discord.js';
// import { fetchEventById, Database, fetchMessage, wait, color, TRY } from '../lib/stuff';
import { print, printD, printL, format, dateToStr, printE } from '../../lib/consoleUtils';
import { fetchMessage, fetchEventById } from '../../lib/discordUtils';
import Database from '../../lib/sqlite';

export const command = {

    info: {
        type: "startup",
        requiredServerSettings: [
            {
                type: "string",
                name: "event-webhook-url",
                description: "event webhook url"
            }
        ]
    },

    data: {
        name: 'guildEventHandler',
    },

    async execute(client: Client, guildIds: string[]): Promise<void> {
        const events: string[] = [
            "guildScheduledEventCreate",
            "guildScheduledEventDelete",
            "guildScheduledEventUpdate",
            "guildScheduledEventUserAdd",
            "guildScheduledEventUserRemove"
        ];

        events.forEach(event => {
            client.on(event, async (...args: any[]) => {
                let guildScheduledEvent: GuildScheduledEvent = args[0];
                if (event === "guildScheduledEventUpdate") {
                    guildScheduledEvent = args[1];
                }

                printD({args});

                if (!guildScheduledEvent.guild) {
                    printE('Guild not found');
                    return;
                }


            });
        });
    }
}