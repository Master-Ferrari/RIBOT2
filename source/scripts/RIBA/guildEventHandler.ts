import { Collection, WebhookClient, EmbedBuilder, Client, GuildScheduledEvent, Message, APIMessage, Guild, TextChannel } from 'discord.js';
import { print, printD, printL, format, dateToStr, printE } from '../../lib/consoleUtils';
import { fetchMessage, WebhookSend, GuildSetting, fetchChannel, sendWebhookMsg, editWebhookMsg, wait, getSettings } from '../../lib/discordUtils';
import Database from '../../lib/sqlite';


type EventSettings = {
    eventName: string,
    guildId: string,
    channelId: string,
    eventMessageId: string,
}

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

    async onStart(client: Client, guildIds: string[]): Promise<void> {
        const events: string[] = [
            "guildScheduledEventCreate",
            "guildScheduledEventDelete",
            "guildScheduledEventUpdate",
            "guildScheduledEventUserAdd",
            "guildScheduledEventUserRemove"
        ];

        events.forEach(event => {
            client.on(event, async (...args: any[]) => await new Promise(async () => {

                let guildScheduledEvent: GuildScheduledEvent = args[0];

                if (event === "guildScheduledEventUpdate") {
                    guildScheduledEvent = args[1];
                }
                if (event === "guildScheduledEventCreate") {
                    await wait(1500);
                }

                const guild: Guild = guildScheduledEvent.guild as Guild;
                await printL(guild.name + " " + format(guildScheduledEvent.name + "/" + event, { foreground: 'yellow' }) + dateToStr(new Date(), "timeStamp"));

                const subs: Collection<string, any> = event === "guildScheduledEventDelete" ? new Collection() : await guildScheduledEvent.fetchSubscribers();

                const data = await Database.interact('database.db', async (db: Database) => { // читаем бд

                    const guildSetting = await getSettings(["eventsChannelId", "mainWebhookLink"], db, guild.id);

                    const eventSetting = await db.getJSON('events', guildScheduledEvent.id) as EventSettings || null;
                    return { guild: guildSetting, event: eventSetting };
                });

                if (typeof data.guild === "string") {
                    printE(data.guild);
                    return;
                }


                const username = guildScheduledEvent.creator?.username ?? client.user?.username ?? 'Unknown';
                const avatarUrl = guildScheduledEvent.creator?.displayAvatarURL() ?? client.user?.displayAvatarURL() ?? 'https://cdn.discordapp.com/embed/avatars/2.png';



                let webhookSend: WebhookSend = {
                    webhookUrl: data.guild.mainWebhookLink,
                    content: undefined,
                    embeds: [
                        (function () {
                            return new EmbedBuilder()
                                .setColor(0x00a8fc)
                                .setDescription("<a:loading:1078462597982081096>");
                        })()
                    ],
                    channelId: data.guild.eventsChannelId,
                    guildId: guild.id,
                    username: username,
                    avatarURL: avatarUrl,
                    client: client
                };

                let eventMsg: Message; // хотим
                if (data.event === null || data.event.channelId === null) { // если нет записи
                    const channel = await fetchChannel(client, guild.id, data.guild.eventsChannelId);
                    if (!channel) { throw new Error('Channel not found'); }

                    eventMsg = await webhook(webhookSend); // нет записи. шлём.
                    await addEventToDB(guildScheduledEvent.id, guild.id, channel.id, eventMsg.id, guildScheduledEvent);
                }
                else { // если есть запись
                    const message = await fetchMessage(data.event.eventMessageId, data.event.channelId, guild.id, client);
                    if (message) { eventMsg = message; } // нашли
                    else {
                        eventMsg = await webhook(webhookSend); // в записи ошибка. шлём.
                        await addEventToDB(guildScheduledEvent.id, guild.id, data.guild.eventsChannelId, eventMsg.id, guildScheduledEvent);
                    }
                }


                const status = event === "guildScheduledEventDelete" ? 3 : guildScheduledEvent.status;
                const statusInfo = status === 1 ?
                    {
                        text: "🟡запланировано",
                        color: 0xfff100
                    } : status === 2 ? {
                        text: "🟢идёт",
                        color: 0x16c60c
                    } : status === 3 ? {
                        text: "🔴завершено",
                        color: 0xe81224
                    } : {
                        text: "",
                        color: 0x000000
                    };

                const inviteLink = `https://discord.com/events/${guild.id}/${guildScheduledEvent.id}`;
                const eventImageUrl = guildScheduledEvent.image ? guildScheduledEvent.coverImageURL() + "?size=1280" : "";
                const location = (() => {
                    if (guildScheduledEvent.channelId)
                        return "<#" + guildScheduledEvent.channelId + ">";
                    else {
                        return guildScheduledEvent.entityMetadata?.location ?? "";
                    }
                })();

                const embedDescription = (
                    `# [*${guildScheduledEvent.name}* <:external_link3:1175294082059354112>](${inviteLink})
${location} <t:${String(guildScheduledEvent.scheduledStartTimestamp).slice(0, 10)}:R>
${guildScheduledEvent.description !== "" ? "\`\`\`" + guildScheduledEvent.description + "\`\`\`" : ""}`
                );

                const embed = new EmbedBuilder()
                    .setColor(statusInfo.color)
                    .setDescription(embedDescription)

                if (eventImageUrl !== "")
                    embed.setImage(eventImageUrl);



                const embed2 = new EmbedBuilder()
                    .setColor(statusInfo.color)
                    .setDescription(`### Собрались поучавствовать:`);

                for (const [userId, userData] of subs) {
                    embed2.addFields({ name: ' ', value: `<@${userId}>`, inline: true });
                }


                webhookSend.embeds = [embed, embed2];

                eventMsg = await webhook(eventMsg.id, webhookSend); // редачим

            }));
        });
    }
}

async function webhook(params: WebhookSend): Promise<Message>;
async function webhook(messageId: string, params: WebhookSend): Promise<Message>;

async function webhook(...args: [WebhookSend] | [string, WebhookSend]): Promise<Message> {
    if (args.length === 1) {
        return await sendWebhookMsg(args[0]);
    } else if (args.length === 2 && typeof args[0] === 'string') {
        return await editWebhookMsg(args[0], args[1]);
    } else {
        throw new Error('Invalid arguments');
    }
}

async function addEventToDB(eventID: string, guildID: string, channelId: string, eventMessageID: string, guildScheduledEvent: GuildScheduledEvent): Promise<void> {
    await Database.interact('database.db', async (db: Database) => {
        await db.setJSON('events', eventID, {
            eventName: guildScheduledEvent.name,
            guildId: guildID,
            channelId: channelId,
            eventMessageId: eventMessageID
        });
    })
}