import { CommandInteraction, SlashCommandBuilder, Client, Message, GuildBasedChannel, TextChannel, Events, User, PartialUser, PartialMessageReaction, MessageReaction } from 'discord.js';
import { print, printD, printL, format, dateToStr, printE } from '../../lib/consoleUtils';
import { fetchLastNMessages, fetchMessage, GuildSetting, fetchChannel, sendWebhookMsg, editWebhookMsg, getSettings, updateReactions, ScriptScopes } from '../../lib/discordUtils';
import { GPT, History, ModelVersions, gptModels } from '../../lib/gptHandler';
import { openaikey } from '../../botConfig.json';
import Database from '../../lib/sqlite';
import { TTSFactory } from '../../lib/tts';

const defaultVisionDistance = 15;
const defaultModel: ModelVersions = "gpt-4-1106-preview";
let guildSettingS: any;

const reactions = ["♻️", "❎", "📣"];
const waitReaction = "<a:discordloading2:1194652977256992930>";
const waitReactionFlat = "<a:discordloading:1192816519525183519>";

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
                )),

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

        updateReactions({ client, msg: whMsg, reactions });

    },

    async onUpdate(client: Client, scriptScopes: ScriptScopes): Promise<void> {
        guildSettingS = await Database.interact('database.db', async (db) => {
            return await db.getTable('guildSettings');
        });
    },

    async onStart(client: Client, scriptScopes: ScriptScopes): Promise<void> {

        guildSettingS = await Database.interact('database.db', async (db) => {
            return await db.getTable('guildSettings');
        });

        client.on(Events.MessageCreate, async (userMessage) => {
            if (!userMessage.guild) return;
            if (!scriptScopes.guilds.includes(userMessage.guild.id) && !scriptScopes.global) return;
            if (!userMessage.guildId) return;
            if (userMessage.author.bot) return;
            if (!guildSettingS[userMessage.guild.id]?.gptChannelId) return;
            if (guildSettingS[userMessage.guild.id]?.gptChannelId !== userMessage.channelId) return;

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

            const whMsg = await sendWebhookMsg({
                client: client,
                webhookUrl: guildSetting.mainWebhookLink,
                content: waitReaction,
                channelId: userMessage.channelId,
                guildId: userMessage.guildId,
                username: defaultModel,
                avatarURL: client.user?.displayAvatarURL()
            });
            const content = await askGpt(client, gptModels, lastMessages, defaultVisionDistance, defaultModel);

            await editWebhookMsg(
                whMsg.id, {
                client: client,
                webhookUrl: guildSetting.mainWebhookLink,
                content: content,
                channelId: userMessage.channelId,
                guildId: userMessage.guildId,
                username: defaultModel,
                avatarURL: client.user?.displayAvatarURL()
            });

            updateReactions({ client, msg: whMsg, reactions });



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

            const users = await reaction.users.fetch()

            if (users.size > 1) {
                printL(user.tag + " " + (event == "add" ? "added" : "removed") + " " + reaction.emoji.name + " to " + msg.guildId + "/" + msg.channelId + "/" + msg.id);

                if (reaction.emoji.name === '♻️') {
                    msg.react(waitReactionFlat);
                    const lastMessages: Message[] = await fetchLastNMessages(reaction.message.guildId, reaction.message.channelId, defaultVisionDistance, client, "before", msg.id);

                    await editWebhookMsg(
                        msg.id,
                        {
                            client: client,
                            webhookUrl: guildSetting.mainWebhookLink,
                            content: waitReaction,
                            channelId: reaction.message.channelId,
                            guildId: reaction.message.guildId,
                            username: msg.author.username,
                            avatarURL: client.user?.displayAvatarURL(),
                            files: []
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

                    updateReactions({ client, msg, reactions });

                }

                else if (reaction.emoji.name === '❎') {
                    await reaction.message.delete();
                }

                else if (reaction.emoji.name === '📣') {

                    msg.react(waitReactionFlat);
                    let tts = TTSFactory.createTTS();
                    const content = msg.content.replace(/```.*?```/gs, ". код читать не буду. ");
                    tts.send({
                        prompt: content, onWav: async (data) => {
                            if (!msg.guildId) return;
                            print("редактируем " + msg.id);
                            await editWebhookMsg(
                                msg.id,
                                {
                                    client: client,
                                    webhookUrl: guildSetting.mainWebhookLink,
                                    content: msg.content,
                                    channelId: msg.channelId,
                                    guildId: msg.guildId,
                                    username: msg.author.username,
                                    avatarURL: client.user?.displayAvatarURL(),
                                    files: [tts.outputPath],
                                }
                            );
                            updateReactions({ client, msg, reactions });
                        }
                    });
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
Отвечай на русском языке.
Свой ник в ответе не пиши. Только текст ответа.
Последние ${visiondistance} сообщений:\n`
            + lastMessages.map(msg => {
                const name = gptModels.find(m => m === msg.author.username) ? client.user?.username : msg.author.username
                return `${name}:\n«${msg.content}»`;
            }).reverse().join("\n")
    }];

    history.reverse();

    const ans: any = await gpt.request(history, { format: 'json_object', formatting: 'simplify' });

    let content: string;

    if (typeof ans === 'string') {
        content = ans;
    }
    else {
        content = ans.ans;
    }

    return content || 'Нет ответа';
}
