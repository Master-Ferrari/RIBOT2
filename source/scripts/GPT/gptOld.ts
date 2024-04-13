import { CommandInteraction, SlashCommandBuilder, Client, Message, GuildBasedChannel, TextChannel, Events, User, PartialUser, PartialMessageReaction, MessageReaction } from 'discord.js';
import { print, printD, printL, format, dateToStr, printE, prettySlice } from '../../libs/consoleUtils';
import { fetchLastNMessages, WebhookSend, fetchMessage, GuildSetting, fetchChannel, sendWebhookMsg, editWebhookMsg, getSettings, updateReactions, ScriptScopes } from '../../libs/discordUtils';
import { GptFactory, History, OpenaiModels, openaiModels } from '../../libs/gptHandler';
import { openaikey } from '../../botConfig.json';
import Database from '../../libs/sqlite';
import { TTSFactory } from '../../libs/tts';
import { ScriptBuilder } from '../../libs/scripts';

const defaultVisionDistance = 15;
const defaultModel: OpenaiModels = "gpt-4-1106-preview";
let guildSettingS: any;

const regenerateReaction = { full: "<:regenerate:1196122410626330624>", name: "regenerate" };
const cancelReaction = { full: "<:cancel:1196070262567882802>", name: "cancel" };
const sayReaction = { full: "<:say:1196070264165912719>", name: "say" };
const waitReaction = { full: "<a:discordloading2:1194652977256992930>", name: "discordloading2" };
const waitReactionFlat = { full: "<a:discordloading:1192816519525183519>", name: "discordloading" };

// const reactions = ["♻️", "❎", "📣"];
// const reactions = [regenerateReaction.full, cancelReaction.full, sayReaction.full];


export const script = new ScriptBuilder({
    name: "gptOld",
    group: "GPT",
}).addOnSlash({
    slashDeployData: new SlashCommandBuilder()
        .setName('gptOld')
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
                    ...openaiModels.map(model => ({ name: model, value: model })),
                )),
    onSlash: async (interaction) => {

        try {
            if (interaction.guildId === null) {
                interaction.reply({
                    content: 'GPT command is not available in Direct Messages. На сервере юзай крч.\n'
                });
                return;
            }

            const options: any = interaction.options;
            const model = (options.getString("model") ?? defaultModel) as OpenaiModels;
            const visiondistance = options.getInteger("visiondistance") ?? 10;


            if (interaction.guildId === null) {
                printE('GuildId is null');
                return;
            };

            const lastMessages: Message[] = await fetchLastNMessages(interaction.guildId, interaction.channelId, visiondistance, script.client!);

            await interaction.deferReply({ ephemeral: false });

            let guildSetting: string | GuildSetting = await Database.interact('database.db', async (db) => {
                return await getSettings(["mainWebhookLink"], db, String(interaction.guildId));
            });
            if (typeof guildSetting === "string") {
                await interaction.editReply({ content: guildSetting });
                return;
            };

            interaction.deleteReply(); //await

            await gptWhResponse(
                {
                    mode: {
                        name: "command",
                        sendParams: {
                            channelId: interaction.channelId,
                            guildId: interaction.guildId,
                            webhookUrl: guildSetting.mainWebhookLink,
                            username: defaultModel,
                            client: script.client!,
                            avatarURL: script.client!.user?.displayAvatarURL()
                        }
                    },
                    visiondistance,
                    model
                },
            );

            // let whMsg = await sendWebhookMsg({
            //     client: client,
            //     webhookUrl: guildSetting.mainWebhookLink,
            //     content: waitReaction,
            //     channelId: interaction.channelId,
            //     guildId: interaction.guildId,
            //     username: defaultModel,
            //     avatarURL: client.user?.displayAvatarURL()
            // });
            // updateReactions({ client, msg: whMsg, reactions: [cancelReaction.full] });
            // try {
            //     const content = await askGpt(client, gptModels, lastMessages, visiondistance, model);
            //     whMsg = await editWebhookMsg(whMsg.id, {
            //         client: client,
            //         webhookUrl: guildSetting.mainWebhookLink,
            //         content: content,
            //         channelId: interaction.channelId,
            //         guildId: interaction.guildId,
            //         username: model,
            //         avatarURL: client.user?.displayAvatarURL()
            //     });
            //     updateReactions({ client, msg: whMsg, reactions });
            // } catch (e) {
            //     printE(e);
            //     whMsg = await editWebhookMsg(whMsg.id, {
            //         client: client,
            //         webhookUrl: guildSetting.mainWebhookLink,
            //         content: "OpenAI API Error: " + String(e),
            //         channelId: interaction.channelId,
            //         guildId: interaction.guildId,
            //         username: model,
            //         avatarURL: client.user?.displayAvatarURL()
            //     });
            //     updateReactions({ client, msg: whMsg, reactions: [cancelReaction.full, regenerateReaction.full] });
            // }

        }
        catch (e) { printE(e); }
    }
}).addOnUpdate({
    onUpdate: async () => {
        guildSettingS = await Database.interact('database.db', async (db) => {
            return await db.getTable('guildSettings');
        });
    }
}).addOnStart({
    onStart: async () => {

        guildSettingS = await Database.interact('database.db', async (db) => {
            return await db.getTable('guildSettings');
        });

        script.client!.on(Events.MessageCreate, async (userMessage) => {
            try {
                if (!userMessage.guild) return;
                // if (!scriptScopes.guilds.includes(userMessage.guild.id) && !scriptScopes.global) return;\
                if (script.guilds !== "global" && !script.guilds!.map(guild => guild.serverId).includes(userMessage.guild.id)) return;
                if (!userMessage.guildId) return;
                if (userMessage.author.bot) return;
                if (!guildSettingS[userMessage.guild.id]?.gptChannelId) return;
                if (guildSettingS[userMessage.guild.id]?.gptChannelId !== userMessage.channelId) return;

                const channel = await fetchChannel(script.client!, userMessage.guild.id, guildSettingS[userMessage.guild.id]?.gptChannelId) as TextChannel;
                if (!channel) return;

                let guildSetting: string | GuildSetting = await Database.interact('database.db', async (db) => {
                    return await getSettings(["mainWebhookLink"], db, String(userMessage.guildId));
                });
                if (typeof guildSetting === "string") {
                    await userMessage.reply({ content: guildSetting });
                    return;
                };


                // const lastMessages: Message[] = await fetchLastNMessages(userMessage.guildId, userMessage.channelId, defaultVisionDistance, client);

                await gptWhResponse(
                    {
                        mode: {
                            name: "auto",
                            sendParams: {
                                channelId: userMessage.channelId,
                                guildId: userMessage.guildId,
                                webhookUrl: guildSetting.mainWebhookLink,
                                username: defaultModel,
                                client: script.client!,
                                avatarURL: script.client!.user?.displayAvatarURL()
                            }
                        },
                        visiondistance: defaultVisionDistance,
                        model: defaultModel
                    },
                );

                // const whMsg = await sendWebhookMsg({
                //     client: client,
                //     webhookUrl: guildSetting.mainWebhookLink,
                //     content: waitReaction,
                //     channelId: userMessage.channelId,
                //     guildId: userMessage.guildId,
                //     username: defaultModel,
                //     avatarURL: client.user?.displayAvatarURL()
                // });

                // updateReactions({ client, msg: whMsg, reactions: [cancelReaction.full] });
                // const content = await askGpt(client, gptModels, lastMessages, defaultVisionDistance, defaultModel);
                // printL(userMessage.author + format(" /gpt " + userMessage.content, { foreground: 'yellow' }) + "\n" + format("gpt: " + content, { foreground: 'blue' }));

                // await editWebhookMsg(
                //     whMsg.id, {
                //     client: client,
                //     webhookUrl: guildSetting.mainWebhookLink,
                //     content: content,
                //     channelId: userMessage.channelId,
                //     guildId: userMessage.guildId,
                //     username: defaultModel,
                //     avatarURL: client.user?.displayAvatarURL()
                // });

                // updateReactions({ client, msg: whMsg, reactions });
            } catch (e) { printE(e); }


        })

        script.client!.on(Events.MessageReactionAdd, async (reaction, user) => {
            await onEmoji(reaction, user, 'add');
        });

        script.client!.on(Events.MessageReactionRemove, async (reaction, user) => {
            await onEmoji(reaction, user, 'remove');
        });

        async function onEmoji(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, event: 'add' | 'remove') {

            try {

                if (reaction.message.guildId === null) {
                    printE('GuildId is null');
                    return;
                };

                const msg = await fetchMessage(reaction.message.id, reaction.message.channelId, reaction.message.guildId, script.client!);

                const guildSetting: GuildSetting = await Database.interact('database.db', async (db) => {
                    return await db.getJSON('guildSettings', String(reaction.message.guildId));
                });
                const webhookId = guildSetting?.mainWebhookLink.split("/").slice(-2, -1)[0];
                if (!msg || msg?.author.id !== webhookId) {
                    return;
                }

                const users = await reaction.users.fetch()

                if (users.size <= 1) return;

                printL(user.tag + " " + (event == "add" ? "added" : "removed") + " " + reaction.emoji.name + " to " + msg.guildId + "/" + msg.channelId + "/" + msg.id);

                if (reaction.emoji.name === regenerateReaction.name) {



                    await gptWhResponse(
                        {
                            mode: {
                                name: "regenerate",
                                sendParams: {
                                    channelId: reaction.message.channelId,
                                    guildId: reaction.message.guildId,
                                    webhookUrl: guildSetting.mainWebhookLink,
                                    client: script.client!,
                                },
                                oldMsg: msg
                            },
                            visiondistance: defaultVisionDistance,
                            model: msg.author.username as OpenaiModels
                        },
                    );

                    // updateReactions({ client, msg, reactions: reactions.concat([waitReactionFlat]) });

                    // const lastMessages: Message[] = await fetchLastNMessages(reaction.message.guildId, reaction.message.channelId, defaultVisionDistance, client, "before", msg.id);

                    // const content = await askGpt(client, gptModels, lastMessages, defaultVisionDistance, msg.author.username as ModelVersions);

                    // await editWebhookMsg(
                    //     msg.id,
                    //     {
                    //         client: client,
                    //         webhookUrl: guildSetting.mainWebhookLink,
                    //         content: content,
                    //         channelId: reaction.message.channelId,
                    //         guildId: reaction.message.guildId,
                    //         username: msg.author.username,
                    //         avatarURL: client.user?.displayAvatarURL()
                    //     });

                    // updateReactions({ client, msg, reactions });

                }

                else if (reaction.emoji.name === cancelReaction.name) {
                    await reaction.message.delete();
                }

                else if (reaction.emoji.name === sayReaction.name) {

                    // updateReactions({ client, msg, reactions: [cancelReaction.full, regenerateReaction.full, sayReaction.full, waitReactionFlat.full] });

                    let tts = TTSFactory.createTTS();
                    const content = msg.content.replace(/```.*?```/gs, ". код читать не буду. ");
                    tts.send({
                        text: content, onWav: async (data) => {
                            if (!msg.guildId) return;
                            print("редактируем " + msg.id);


                            await gptWhResponse(
                                {
                                    mode: {
                                        name: "say",
                                        sendParams: {
                                            channelId: reaction.message.channelId,
                                            guildId: msg.guildId,
                                            webhookUrl: guildSetting.mainWebhookLink,
                                            client: script.client!,
                                        },
                                        oldMsg: msg,
                                        file: tts.outputPath
                                    },
                                    visiondistance: defaultVisionDistance,
                                    model: msg.author.username as OpenaiModels
                                },
                            );

                            // await editWebhookMsg(
                            //     msg.id,
                            //     {
                            //         client: client,
                            //         webhookUrl: guildSetting.mainWebhookLink,
                            //         content: msg.content,
                            //         channelId: msg.channelId,
                            //         guildId: msg.guildId,
                            //         username: msg.author.username,
                            //         avatarURL: client.user?.displayAvatarURL(),
                            //         files: [tts.outputPath],
                            //     }
                            // );
                            // updateReactions({ client, msg, reactions: [cancelReaction.full, regenerateReaction.full, sayReaction.full] });
                        }
                    });

                }
            }
            catch (e) {
                printE(e);
            }
        }

    }
})


type gptResponseParams = {
    mode: (
        {
            name: "command",
            sendParams: WebhookSend
        } |
        {
            name: "auto",
            sendParams: WebhookSend
        } |
        {
            name: "regenerate",
            oldMsg: Message,
            sendParams: WebhookSend
        } |
        {
            name: "say",
            oldMsg: Message,
            sendParams: WebhookSend,
            file: string
        }
    ),
    visiondistance: number,
    model: OpenaiModels
}

async function gptWhResponse(params: gptResponseParams) {
    let msg: Message;
    let lastMessages2: Message[];
    //loading state
    if (params.mode.name === "regenerate" || params.mode.name === "say") {
        msg = params.mode.oldMsg;
        lastMessages2 = await fetchLastNMessages(msg.guildId!, msg.channelId, defaultVisionDistance, params.mode.sendParams.client, "before", msg.id);
        await updateReactions({
            client: params.mode.sendParams.client, msg,
            reactions: [cancelReaction.full, waitReactionFlat.full]
        });
    }
    else {
        msg = await sendWebhookMsg({ ...params.mode.sendParams, content: waitReaction.full });
        lastMessages2 = await fetchLastNMessages(msg.guildId!, msg.channelId, defaultVisionDistance, params.mode.sendParams.client);
        await updateReactions({
            client: params.mode.sendParams.client, msg,
            reactions: [cancelReaction.full, waitReactionFlat.full]
        });
    }
    //end state
    if (params.mode.name === "say") {
        await editWebhookMsg(msg.id, {
            ...params.mode.sendParams,
            content: msg.content,
            files: [params.mode.file]
        });
        updateReactions({
            client: params.mode.sendParams.client, msg,
            reactions: [cancelReaction.full, regenerateReaction.full, sayReaction.full]
        });
    }
    else {
        try {
            const content = await askGpt(params.mode.sendParams.client, openaiModels, lastMessages2, params.visiondistance, params.model);

            await editWebhookMsg(msg.id, {
                ...params.mode.sendParams,
                content: content,

            });

            updateReactions({
                client: params.mode.sendParams.client, msg,
                reactions: [cancelReaction.full, regenerateReaction.full, sayReaction.full]
            });
        }
        catch (e) {
            printE(e);

            await editWebhookMsg(msg.id, {
                ...params.mode.sendParams,
                content: "Error: " + String(e),
            });

            updateReactions({
                client: params.mode.sendParams.client, msg: msg,
                reactions: [cancelReaction.full, regenerateReaction.full]
            });
        }
    }
};


async function askGpt(client: Client, gptModels: string[], lastMessages: Message[],
    visiondistance: number, model: OpenaiModels): Promise<string> {

    const gpt = GptFactory.create('Openai', {
        apiKey: openaikey,
        tokens: 2000,
        model: model,
    })

    const history: History = [{
        role: "assistant",
        content: `Это запись чата. Ты дискорд бот. Твой ник - ${client.user?.username}.
Для кода ВСЕГДА используется форматирование: \`\`\`[язык][код]\`\`\` .
Для перечисления используется форматирование: - [элемент перечисления][перенос строки] .
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

    const ans: any = await gpt.requestChat(history);

    let content: string;

    content = ans;

    return content || 'Нет ответа';
}


//todo DM support
//unify anses
//dalle support
//threads support
//antispam
//user prompt preset
//error if no answer for long time
//common path to database.db

// IS_VOICE_MESSAGE
