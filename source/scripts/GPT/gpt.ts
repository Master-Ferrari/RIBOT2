import { CommandInteraction, SlashCommandBuilder, Client, Message, GuildBasedChannel, TextChannel, Events, User, PartialUser, PartialMessageReaction, MessageReaction } from 'discord.js';
import { print, printD, printL, format, dateToStr, printE } from '../../lib/consoleUtils';
import { fetchLastNMessages, fetchMessage, GuildSetting, fetchChannel, sendWebhookMsg, editWebhookMsg, getSettings } from '../../lib/discordUtils';
import { GPT, History, ModelVersions, gptModels } from '../../lib/openAI';
import { openaikey } from '../../botConfig.json';
import Database from '../../lib/sqlite';
import { before } from 'node:test';

const defaultVisionDistance = 15;
const defaultModel: ModelVersions = "gpt-4-1106-preview";
let guildSettingS: any;

export const command = {

    info: {
        type: "slash",
    },

    data: new SlashCommandBuilder()
        .setName('gpt')
        .setDescription('casts gpt msg')
        .addIntegerOption(option =>
            option.setName('visiondistance')
                .setDescription('how many messages to look back')
                .setRequired(false)
                .addChoices(
                    { name: '1', value: 1 },
                    { name: '5', value: 5 },
                    { name: '10', value: 10 },
                    { name: '20', value: 20 },
                    { name: '40', value: 40 },
                ))
        .addStringOption(option =>
            option.setName('model')
                .setDescription('model')
                .setRequired(false)
                .addChoices(
                    ...gptModels.map(model => ({ name: model, value: model })),
                ))
    ,

    async onIteraction(interaction: CommandInteraction, client: Client): Promise<void> {

        const options: any = interaction.options;
        const model = (options.getString("model") ?? defaultModel) as ModelVersions;
        const visiondistance = options.getInteger("visiondistance") ?? 10;


        if (interaction.guildId === null) {
            printE('GuildId is null');
            return;
        };

        const lastMessages: Message[] = await fetchLastNMessages(interaction.guildId, interaction.channelId, visiondistance, client);

        await interaction.deferReply({ ephemeral: false });

        let guildSetting: string | GuildSetting = await Database.interact('database.db', async (db) => {
            return await getSettings(["mainWebhookLink"], db, String(interaction.guildId));
        });
        if (typeof guildSetting === "string") {
            await interaction.editReply({ content: guildSetting });
            return;
        };

        printD({ guildSetting });
        // if (!guildSetting || !guildSetting.mainWebhookLink) {
        //     printE('Guild setting not found or main webhook not set');
        //     await interaction.editReply({ content: "в /settings вебхук добавь" });
        //     return;
        // };


        const content = await askGpt(client, gptModels, lastMessages, visiondistance, model);

        await interaction.deleteReply();

        const whMsg = await sendWebhookMsg({
            client: client,
            webhookUrl: guildSetting.mainWebhookLink,
            content: content,
            channelId: interaction.channelId,
            guildId: interaction.guildId,
            username: model,
            avatarURL: client.user?.displayAvatarURL()
        });

        // if (whMsg.guildId)
        // const whMsgF = await fetchMessage(whMsg.id, whMsg.channelId, interaction.guildId, client)
        whMsg.react('♻️')
            .then(() => whMsg.react('❎'))
            .catch(error => printE('One of the emojis failed to react:', error));

    },

    async onUpdate(client: Client, guildIds: string[]): Promise<void> {
        guildSettingS = await Database.interact('database.db', async (db) => {
            return await db.getTable('guildSettings');
        });
    },

    async onStart(client: Client, guildIds: string[]): Promise<void> {

        guildSettingS = await Database.interact('database.db', async (db) => {
            return await db.getTable('guildSettings');
        });

        // printD({guildSetting});


        client.on(Events.MessageCreate, async (userMessage) => {
            if (!userMessage.guild) return;
            if (!guildIds.includes(userMessage.guild.id)) return;
            if (!userMessage.guildId) return;
            if (userMessage.author.bot) return;
            if (guildSettingS[userMessage.guild.id]?.gptChannelId !== null) {
                if (guildSettingS[userMessage.guild.id]?.gptChannelId === userMessage.channelId) {

                    const channel = await fetchChannel(client, userMessage.guild.id, guildSettingS[userMessage.guild.id]?.gptChannelId) as TextChannel;
                    if (!channel) return;

                    let guildSetting: string | GuildSetting = await Database.interact('database.db', async (db) => {
                        return await getSettings(["mainWebhookLink"], db, String(userMessage.guildId));
                    });
                    if (typeof guildSetting === "string") {
                        await userMessage.reply({ content: guildSetting });
                        return;
                    };

                    const lastMessages: Message[] = await fetchLastNMessages(userMessage.guildId, userMessage.channelId, defaultVisionDistance, client);
                    const message = await userMessage.reply("<a:loading:1078462597982081096>");
                    const content = await askGpt(client, gptModels, lastMessages, defaultVisionDistance, defaultModel);

                    await message.delete();

                    const whMsg = await sendWebhookMsg({
                        client: client,
                        webhookUrl: guildSetting.mainWebhookLink,
                        content: content,
                        channelId: userMessage.channelId,
                        guildId: userMessage.guildId,
                        username: defaultModel,
                        avatarURL: client.user?.displayAvatarURL()
                    });

                    whMsg.react('♻️')
                        .then(() => whMsg.react('❎'))
                        .catch(error => printE('One of the emojis failed to react:', error));

                }
            };
        })

        client.on(Events.MessageReactionAdd, async (reaction, user) => {
            await onEmoji(reaction, user, 'add');
        });

        client.on(Events.MessageReactionRemove, async (reaction, user) => {
            await onEmoji(reaction, user, 'remove');
        });

        async function onEmoji(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, event: 'add' | 'remove') {

            if (reaction.message.guildId === null) {
                printE('GuildId is null');
                return;
            };

            const msg = await fetchMessage(reaction.message.id, reaction.message.channelId, reaction.message.guildId, client);

            const guildSetting: GuildSetting = await Database.interact('database.db', async (db) => {
                return await db.getJSON('guildSettings', String(reaction.message.guildId));
            });
            const webhookId = guildSetting?.mainWebhookLink.split("/").slice(-2, -1)[0];
            if (!msg || msg?.author.id !== webhookId) {
                return;
            }




            printL(
                format(String(reaction.emoji.name) + " " + String(msg.author.username),
                    { foreground: 'blue', background: 'white', bold: true, italic: true }) +

                format(" " + event,
                    { foreground: 'blue', background: 'red', bold: true, italic: true })
            );

            const users = await reaction.users.fetch()

            if (users.size > 1) {
                if (reaction.emoji.name === '♻️') {
                    printL('♻️');

                    const lastMessages: Message[] = await fetchLastNMessages(reaction.message.guildId, reaction.message.channelId, defaultVisionDistance, client, "before", msg.id);
                    printD({ lastMessages: lastMessages[0].content });

                    await editWebhookMsg(
                        msg.id,
                        {
                            client: client,
                            webhookUrl: guildSetting.mainWebhookLink,
                            content: "<a:loading:1078462597982081096>",
                            channelId: reaction.message.channelId,
                            guildId: reaction.message.guildId,
                            username: msg.author.username,
                            avatarURL: client.user?.displayAvatarURL()
                        });

                    const content = await askGpt(client, gptModels, lastMessages, defaultVisionDistance, msg.author.username as ModelVersions);

                    await editWebhookMsg(
                        msg.id,
                        {
                            client: client,
                            webhookUrl: guildSetting.mainWebhookLink,
                            content: content,
                            channelId: reaction.message.channelId,
                            guildId: reaction.message.guildId,
                            username: msg.author.username,
                            avatarURL: client.user?.displayAvatarURL()
                        });

                    if (reaction) {
                        reaction.users.cache.forEach(user => {
                            if (user.id !== client.user?.id) {
                                reaction.users.remove(user);
                            }
                        });
                    }

                }

                else if (reaction.emoji.name === '❎') {
                    printL('❎');
                    await reaction.message.delete();
                }
            }

        }

    }
};



async function askGpt(client: Client, gptModels: string[], lastMessages: Message[],
    visiondistance: number, model: ModelVersions): Promise<string> {

    const gpt = new GPT(openaikey, 2000, model);

    const history: History = [{
        role: "assistant",
        content: `Это запись чата. Ты дискорд бот. Твой ник - ${client.user?.username}.
Для кода ВСЕГДА используется форматирование: \`\`\`[язык][код]\`\`\` .
Отвечай на последние вопросы или сообщения.\n
Отвечай в формате JSON {"ans": "твой ответ"}!!!
Свой ник в ответе не пиши. Только текст ответа.
Последние ${visiondistance} сообщений:\n`
            + lastMessages.map(msg => {
                const name = gptModels.find(m => m === msg.author.username) ? client.user?.username : msg.author.username
                return `${name}:\n«${msg.content}»`;
            }).reverse().join("\n")
    }];

    // printD({ history });

    history.reverse();

    const ans: any = await gpt.request(history, { format: 'json_object', formatting: 'simplify' });

    let content: string;

    if (typeof ans === 'string') {
        content = ans;
    }
    else {
        content = ans.ans;
    }

    return content;
}
