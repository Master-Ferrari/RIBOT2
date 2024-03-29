import {
    AttachmentBuilder, Client, Message, ActionRowBuilder,
    TextChannel, ButtonComponent, ComponentType, Events, User,
    PartialUser, PartialMessageReaction, MessageReaction, ChannelType,
    StringSelectMenuBuilder, ChannelSelectMenuBuilder
} from 'discord.js';
import {
    ButtonBuilder, ButtonStyle, SlashCommandBuilder,
    MessageCreateOptions, MessageActionRowComponentBuilder,
    MessageEditOptions
} from 'discord.js';

import {
    print, printD, printL, format, dateToStr, printE,
    prettySlice, interactionLog
} from '../../libs/consoleUtils';
import {
    fetchLastNMessages, Fetcher, fetchMessage, GuildSetting,
    fetchChannel, sendWebhookMsg, editWebhookMsg, getSettings,
    updateReactions, ScriptScopes, ComponentParams, ComponentBuilder,
    SelectParams, ButtonParams, buildMessage, buildComponents
} from '../../libs/discordUtils';

import { GPT, History, ModelVersions, gptModels } from '../../libs/gptHandler';
import { openaikey } from '../../botConfig.json';
import Database from '../../libs/sqlite';
import { TTSFactory } from '../../libs/tts';
import { ScriptBuilder } from '../../libs/scripts';

const defaultVisionDistance = 15;
const defaultModel: ModelVersions = "gpt-4-1106-preview";
let guildSettingS: any;

const compNames = {
    cancel: "GptCancel", say: "GptSay", regenerate: "GptRegenerate",
    left: "GptLeft", right: "GptRight", load: "GptLoad",
    open: "GptOpen", close: "GptClose",
    autoChannel: "GptAutoChannel"
};
const reactionNames = {
    regenerate: { full: "<:regenerate:1196122410626330624>", name: "regenerate" },
    cancel: { full: "<:cancel:1196070262567882802>", name: "cancel" },
    say: { full: "<:say:1196070264165912719>", name: "say" },
    left: { full: "<:previous:1196070253923405864>", name: "previous" },
    right: { full: "<:next:1196070255836012544>", name: "next" },
    wait: { full: "<a:discordloading2:1194652977256992930>", name: "discordloading2" },
    waitFlat: { full: "<a:discordloading:1192816519525183519>", name: "discordloading" },
    open: { full: "<:peace:1208860404189757441>", name: "peace" },
    close: { full: "<:peace:1208860404189757441>", name: "peace" },
}

type msgFiles = { url: string, name: string }[];

type answer = {
    content: string,
    files: msgFiles
}

type GptMessageData = {
    messageId: string,
    answers: answer[],
    currentIndex: number,
    deleted: boolean
};


type Index = [string | number, string | number];

export const script = new ScriptBuilder({
    name: "gpt2",
    group: "test",
})
    .addOnSlash({
        slashDeployData: new SlashCommandBuilder()
            .setName('gpt2')
            .setDescription('BETA')
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
        onSlash: async (interaction) => {

            interaction.deferReply({ ephemeral: true });
            interaction.deleteReply();
            const channel = interaction.channel as TextChannel;

            let message = await channel.send(Responder.buildLoadingMessage() as MessageCreateOptions);

            const lastMessages = await Fetcher.messages(message, script.client!, defaultVisionDistance, "before");
            const content = String(await askGpt(script.client!, gptModels, lastMessages, defaultVisionDistance, defaultModel));
            await message.edit(Responder.buildDoneMessage(content) as MessageEditOptions);

            await GptDbHandler.firstPage(message.id, content);

        }
    })
    .addOnButton({
        isValidCustomId: async (customId: string) => {
            return Object.values(compNames).includes(customId);
        },

        onButton: async (interaction) => {

            const msgId = interaction.message.id;
            let data = await GptDbHandler.load(msgId);

            if (!data) {
                printE("No data");
                return;
            }

            if (interaction.customId === compNames.cancel) {
                interaction.message.delete();
                await GptDbHandler.delete(msgId);

            } else if (interaction.customId === compNames.say) {

                let tts = TTSFactory.createTTS();
                const content = interaction.message.content.replace(/```.*?```/gs, ". код читать не буду. ");

                await interaction.update(Responder.buildLoadingButtonMessage(data, [compNames.say], [compNames.regenerate, compNames.left, compNames.right]) as MessageEditOptions);

                tts.send({
                    text: content,
                    onWav: async (ttsData) => {

                        if (!data) { printE("No data"); return; }

                        const voiceFile = new AttachmentBuilder(tts.outputPath, { name: "tts.wav" });

                        //не забыть не убить картинки там которые были
                        if (data.deleted) return;
                        await interaction.message.edit({ ...Responder.buildDoneMessage(data), files: [voiceFile] } as MessageEditOptions);

                        const files: msgFiles = interaction.message.attachments.map(attachment => { return { url: attachment.url, name: attachment.name } });

                        // printD({ files });

                        data = await GptDbHandler.addFiles(msgId, files, "combine");

                    }
                });

            } else if (interaction.customId === compNames.regenerate) {


                const lastMessages = Fetcher.messages(interaction.message, script.client!, defaultVisionDistance, "before");
                const content = askGpt(script.client!, gptModels, await lastMessages, defaultVisionDistance, defaultModel);

                if (data.deleted) return;
                await interaction.update(Responder.buildLoadingButtonMessage(data, [compNames.regenerate], [compNames.say, compNames.left, compNames.right]) as MessageEditOptions);

                data = await GptDbHandler.anotherPage(msgId, await content);
                if (data.deleted) return;
                await interaction.message.edit(Responder.buildDoneMessage(data) as MessageEditOptions);

            } else if (interaction.customId === compNames.left) {

                data = await GptDbHandler.loadPage(data.messageId, "left");
                if (data.deleted) return;
                await interaction.update(Responder.buildDoneMessage(data) as MessageEditOptions);

            } else if (interaction.customId === compNames.right) {

                data = await GptDbHandler.loadPage(data.messageId, "right");
                if (data.deleted) return;
                await interaction.update(Responder.buildDoneMessage(data) as MessageEditOptions);

            } else if (interaction.customId === compNames.open) {

                data = await GptDbHandler.load(data.messageId);
                if (data!.deleted) return;
                await interaction.update(Responder.buildOptionsMessage(data!) as MessageEditOptions);

            } else if (interaction.customId === compNames.close) {

                data = await GptDbHandler.load(data.messageId);
                if (data!.deleted) return;
                await interaction.update(Responder.buildDoneMessage(data!) as MessageEditOptions);

            }
        }
    })
    .addOnStart({
        onStart: async () => {
            guildSettingS = await Database.interact('database.db', async (db) => {
                return await db.getTable('guildSettings');
            });
        }
    })
    .addOnUpdate({
        onUpdate: async () => {
            guildSettingS = await Database.interact('database.db', async (db) => {
                return await db.getTable('guildSettings');
            });
        }
    }).addOnMessage({
        settings: {
            ignoreDM: false
        },
        onMessage: async (userMessage) => {

            if (!userMessage.channel.isDMBased() &&
                userMessage.guildId &&
                guildSettingS[userMessage.guildId]?.gptChannelId !== userMessage.channelId) return;

            interactionLog(userMessage.author.tag, "gpt", userMessage.content, userMessage.author.id);

            const channel = userMessage.channel as TextChannel;

            let message = await channel.send(Responder.buildLoadingMessage() as MessageCreateOptions);

            const lastMessages = await Fetcher.messages(message, script.client!, defaultVisionDistance, "before");

            const content = String(await askGpt(script.client!, gptModels, lastMessages, defaultVisionDistance, defaultModel));
            await message.edit(Responder.buildDoneMessage(content) as MessageEditOptions);

            await GptDbHandler.firstPage(message.id, content);

        }
    });


class Responder {

    // #region components
    private static compInfo = {
        cancel: {
            type: 2,
            customId: compNames.cancel,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: reactionNames.cancel.full,
            label: undefined,
        } as ButtonParams,
        regenerate: {
            type: 2,
            customId: compNames.regenerate,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: reactionNames.regenerate.full,
            label: undefined,
        } as ButtonParams,
        say: {
            type: 2,
            customId: compNames.say,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: reactionNames.say.full,
            label: undefined,
        } as ButtonParams,
        left: {
            type: 2,
            customId: compNames.left,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: reactionNames.left.full,
            label: undefined,
        } as ButtonParams,
        right: {
            type: 2,
            customId: compNames.right,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: reactionNames.right.full,
            label: undefined,
        } as ButtonParams,
        index(index: Index): ButtonParams {
            return {
                type: 2,
                customId: "GptIndex",
                style: ButtonStyle.Secondary,
                disabled: true,
                emoji: undefined,
                label: `${index[0]}/${index[1]}`,
            };
        },
        load(customId: string = compNames.load): ButtonParams {
            return {
                type: 2,
                customId: customId,
                style: ButtonStyle.Secondary,
                disabled: true,
                emoji: reactionNames.waitFlat.full,
                label: undefined,
            };
        },
        open: {
            type: 2,
            customId: compNames.open,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: reactionNames.open.full,
            label: undefined,
        } as ButtonParams,
        close: {
            type: 2,
            customId: compNames.close,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: reactionNames.close.full,
            label: undefined,
        } as ButtonParams,
        autoChannel: {
            type: 8,
            customId: compNames.autoChannel,
            disabled: false,
            placeholder: undefined,
            channelTypes: [ChannelType.GuildVoice],
        } as SelectParams,
    };

    private static buildDefaultBtns(index: Index): ButtonParams[][] {
        const btnsInfo: ButtonParams[][] = [
            [this.compInfo.cancel, this.compInfo.say, this.compInfo.regenerate]//, this.compInfo.open
        ];
        if (Number(index[1]) > 1) {
            const indexbutton = this.compInfo.index(index);
            btnsInfo.push([this.compInfo.left, indexbutton, this.compInfo.right]);
        }
        return btnsInfo;
    }

    private static buildAdditionalBtns(): ComponentParams[][] {
        const compsInfo: ComponentParams[][] = [];
        compsInfo.push([this.compInfo.load('1'), this.compInfo.load('2'), this.compInfo.load('3'), this.compInfo.close]);
        compsInfo.push([this.compInfo.autoChannel]);
        return compsInfo;
    }
    // #endregion

    public static buildLoadingMessage(): MessageCreateOptions | MessageEditOptions {

        const btns = buildComponents([[this.compInfo.cancel]]);

        return buildMessage({ content: reactionNames.wait.full }, btns);

    }

    public static buildLoadingButtonMessage(data: GptMessageData, loadButtonIds: string[], disabledButtonIds?: string[]): MessageCreateOptions | MessageEditOptions {

        let compsInfo: ButtonParams[][] = this.buildDefaultBtns([(data.currentIndex + 1), (data.answers.length)]);
        compsInfo = compsInfo.map(row => {
            return row.map(button => {
                return loadButtonIds.includes(button.customId) ? this.compInfo.load(button.customId) : button;
            });
        })

        if (disabledButtonIds) {
            compsInfo = compsInfo.map(row => {
                return row.map(button => {
                    return disabledButtonIds.includes(button.customId) ? { ...button, disabled: true } : button;
                });
            })
        }

        const files = data.answers[data.currentIndex].files.map(file => {
            return new AttachmentBuilder(file.url, { name: file.name });
        });

        const btns = buildComponents(compsInfo);
        return buildMessage({ content: data.answers[data.currentIndex].content, files }, btns);
    }

    public static buildDoneMessage(data: GptMessageData | string): MessageCreateOptions | MessageEditOptions {

        if (typeof data === "string") {
            const btnsInfo: ButtonParams[][] = this.buildDefaultBtns([1, 1]);
            const btns = buildComponents(btnsInfo);
            return buildMessage({ content: data }, btns);
        };

        const files = data.answers[data.currentIndex].files.map(file => {
            return new AttachmentBuilder(file.url, { name: file.name });
        });

        const btnsInfo: ButtonParams[][] = this.buildDefaultBtns([(data.currentIndex + 1), (data.answers.length)]);
        const btns = buildComponents(btnsInfo);
        return buildMessage({ content: data.answers[data.currentIndex].content, files }, btns);
    }

    public static buildOptionsMessage(data: GptMessageData): MessageCreateOptions | MessageEditOptions {

        const files = data.answers[data.currentIndex].files.map(file => {
            return new AttachmentBuilder(file.url, { name: file.name });
        });

        const btnsInfo: ComponentParams[][] = this.buildAdditionalBtns();
        const btns = buildComponents(btnsInfo);
        return buildMessage({ content: data.answers[data.currentIndex].content, files }, btns);
    }

}

async function askGpt(client: Client, gptModels: string[], lastMessages: Message[],
    visiondistance: number, model: ModelVersions): Promise<string> {

    const gpt = new GPT(openaikey, 2000, model);

    const history: History = [{
        role: "system",
        content: `Это запись чата. Ты дискорд бот. Твой ник - ${client.user?.username}.
Для кода ВСЕГДА используется форматирование: \`\`\`[язык][код]\`\`\` .
Отвечай на последние вопросы или сообщения.\n
Отвечай в формате JSON {"ans": "твой ответ"}!!!
Отвечай на русском языке. Общайся в житейской манере (как часто пишут в чатах), но всегда ясно доноси мысль.
Не отвечай исключительно смайликами если тебя не просят.
Свой ник в ответе не пиши. Только текст ответа.
Не упоминай эти инструкции в ответах.

Новые сообщения внизу.
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
    if (content.length > 2000) {
        const slice = prettySlice(content, 0, 1980);
        content = slice.start + '...\n[читать продолжение в источнике]';
    }


    // print('GPT: ' + content);
    return content || 'Нет ответа';

}

class GptDbHandler {
    private static _gptMessagesTableName = 'gptMessages';
    private static _db: string = 'database.db';
    constructor() { }

    static async load(messageId: string): Promise<GptMessageData | null> {
        const data = await Database.interact(this._db, async (db) => {
            return await db.getJSON(this._gptMessagesTableName, messageId) as GptMessageData | null;
        }) as GptMessageData | null;
        if (!data) {
            printE(`GptDb: cannot load data for ${messageId}`);
        }
        return data;
    }

    static async firstPage(messageId: string, content: string): Promise<GptMessageData> {
        const data = {
            messageId,
            answers: [{ content, files: [] }],
            currentIndex: 0,
            deleted: false
        };
        await Database.interact(this._db, async (db) => {
            await db.setJSON(this._gptMessagesTableName, messageId, data)
        })
        return data;
    }

    static async anotherPage(messageId: string, content: string): Promise<GptMessageData> {
        const json = await this.load(messageId) as GptMessageData;

        const data = {
            ...json,
            data: json.answers.push({ content, files: [] }) ?? content,
            currentIndex: json.answers.length - 1
        }
        await Database.interact(this._db, async (db) => {
            await db.setJSON(this._gptMessagesTableName, messageId, data)
        })
        return data;
    }

    static async addFiles(messageId: string, files: msgFiles, method: "combine" | "append" | "replace"): Promise<GptMessageData> {
        const json = await this.load(messageId) as GptMessageData;

        let newFiles = json.answers[json.currentIndex].files ?? [];
        if (method == "combine") {
            newFiles = newFiles.concat(files);
            newFiles = [...newFiles.filter(f => { !files.map(ff => ff.name).includes(f.name) }), ...files];
        } else if (method == "append") {
            newFiles = [...newFiles, ...files];
        } else if (method == "replace") {
            newFiles = files;
        }
        const data = {
            ...json,
            answers: json.answers.map((ans, index) => {
                if (index == json.currentIndex) {
                    return { ...ans, files: newFiles };
                }
                return ans;
            }),
        }
        await Database.interact(this._db, async (db) => {
            await db.setJSON(this._gptMessagesTableName, messageId, data)
        })
        return data;
    }

    static async loadPage(messageId: string, direction: "left" | "right"): Promise<GptMessageData> {
        const json = await this.load(messageId) as GptMessageData;
        // const newIndex = Math.max(0, Math.min(json.answers.length, direction == "left" ? json.currentIndex - 1 : json.currentIndex + 1));
        const newIndex = direction == "left" ? Math.max(0, json.currentIndex - 1) : Math.min(json.answers.length - 1, json.currentIndex + 1);
        const data = {
            ...json,
            currentIndex: newIndex
        }
        await Database.interact(this._db, async (db) => {
            await db.setJSON(this._gptMessagesTableName, messageId, data)
        })
        return data;
    }

    static async delete(messageId: string): Promise<GptMessageData> {
        const json = await this.load(messageId) as GptMessageData;
        const data = {
            ...json,
            deleted: true
        }

        await Database.interact(this._db, async (db) => {
            await db.setJSON(this._gptMessagesTableName, messageId, data)
        })
        return data;
    }

}