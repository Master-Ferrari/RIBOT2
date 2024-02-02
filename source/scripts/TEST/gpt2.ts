import { CommandInteraction, Client, Message, ActionRowBuilder, TextChannel, ButtonComponent, ComponentType, Events, User, PartialUser, PartialMessageReaction, MessageReaction } from 'discord.js';
import { ButtonBuilder, ButtonStyle, SlashCommandBuilder, MessageCreateOptions, MessageActionRowComponentBuilder, MessageEditOptions } from 'discord.js';

import { print, printD, printL, format, dateToStr, printE } from '../../libs/consoleUtils';
import { fetchLastNMessages, Fetcher, fetchMessage, GuildSetting, fetchChannel, sendWebhookMsg, editWebhookMsg, getSettings, updateReactions, ScriptScopes } from '../../libs/discordUtils';
import { GPT, History, ModelVersions, gptModels } from '../../libs/gptHandler';
import { openaikey } from '../../botConfig.json';
import Database from '../../libs/sqlite';
import { TTSFactory } from '../../libs/tts';
import { ScriptBuilder } from '../../libs/scripts';

const defaultVisionDistance = 15;
const defaultModel: ModelVersions = "gpt-4-1106-preview";
let guildSettingS: any;

const buttonNames = { cancel: "GptCancel", say: "GptSay", regenerate: "GptRegenerate", left: "GptLeft", right: "GptRight" };
const reactionNames = {
    regenerate: { full: "<:regenerate:1196122410626330624>", name: "regenerate" },
    cancel: { full: "<:cancel:1196070262567882802>", name: "cancel" },
    say: { full: "<:say:1196070264165912719>", name: "say" },
    left: { full: "<:previous:1196070253923405864>", name: "previous" },
    right: { full: "<:next:1196070255836012544>", name: "next" },
    wait: { full: "<a:discordloading2:1194652977256992930>", name: "discordloading2" },
    waitFlat: { full: "<a:discordloading:1192816519525183519>", name: "discordloading" },
}

export const script = new ScriptBuilder({
    name: "gpt2",
    group: "test",
})
    .addOnSlash({
        slashDeployData: new SlashCommandBuilder()
            .setName('gpt2')
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
        onSlash: async (interaction) => {

            interaction.deferReply({ ephemeral: true });
            interaction.deleteReply();
            const channel = interaction.channel as TextChannel;

            let message = await channel.send(Responder.buildLoadingMessage() as MessageCreateOptions);

            const lastMessages = await Fetcher.messages(channel, script.client!, defaultVisionDistance, "before");
            const content = String(await askGpt(script.client!, gptModels, lastMessages, defaultVisionDistance, defaultModel));
            await message.edit(Responder.buildDoneMessage(content) as MessageEditOptions);

            await GptDbHandler.firstPage(message.id, content);

        }
    })
    .addOnButton({
        isValidCustomId: async (customId: string) => {
            return Object.values(buttonNames).includes(customId);
        },

        onButton: async (interaction) => {

            const msgId = interaction.message.id;
            let data = await GptDbHandler.load(msgId);

            if (!data) {
                printE("No data");
                return;
            }

            print(interaction.message.id);
            printD({ data });

            if (interaction.customId === buttonNames.cancel) {
                interaction.message.delete();
                await GptDbHandler.delete(msgId);

            } else if (interaction.customId === buttonNames.say) {

            } else if (interaction.customId === buttonNames.regenerate) {

                await interaction.message.edit(Responder.buildLoadingButtonMessage(data, buttonNames.regenerate) as MessageEditOptions);

                if (data.deleted) return;
                const lastMessages = await Fetcher.messages(interaction.message, script.client!, defaultVisionDistance, "before");
                printD({ lastMessages });
                const content = String(await askGpt(script.client!, gptModels, lastMessages, defaultVisionDistance, defaultModel));
                data = await GptDbHandler.anotherPage(msgId, content);
                if (data.deleted) return;
                await interaction.message.edit(Responder.buildDoneMessage(data) as MessageEditOptions);


            } else if (interaction.customId === buttonNames.left) {
                await interaction.message.edit(Responder.buildLoadingButtonMessage(data, buttonNames.left) as MessageEditOptions);

            } else if (interaction.customId === buttonNames.right) {

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
    });



type ButtomParams = {
    customId: string,
    style: ButtonStyle,
    setdisabled: boolean,
    emoji: string | undefined,
    label: string | undefined
};

type Index = [string | number, string | number];

class Responder {

    // #region buttons
    private static btnInfo = {
        cancel: {
            customId: buttonNames.cancel,
            style: ButtonStyle.Secondary,
            setdisabled: false,
            emoji: reactionNames.cancel.full,
            label: undefined,
        },
        regenerate: {
            customId: buttonNames.regenerate,
            style: ButtonStyle.Secondary,
            setdisabled: false,
            emoji: reactionNames.regenerate.full,
            label: undefined,
        },
        say: {
            customId: buttonNames.say,
            style: ButtonStyle.Secondary,
            setdisabled: false,
            emoji: reactionNames.say.full,
            label: undefined,
        },
        left: {
            customId: buttonNames.left,
            style: ButtonStyle.Secondary,
            setdisabled: false,
            emoji: reactionNames.left.full,
            label: undefined,
        },
        right: {
            customId: buttonNames.right,
            style: ButtonStyle.Secondary,
            setdisabled: false,
            emoji: reactionNames.right.full,
            label: undefined,
        },
        indexBtn(index: Index): ButtomParams {
            return {
                customId: "GptIndex",
                style: ButtonStyle.Secondary,
                setdisabled: true,
                emoji: undefined,
                label: `${index[0]}/${index[1]}`,
            };
        },
        load: {
            customId: buttonNames.right,
            style: ButtonStyle.Secondary,
            setdisabled: false,
            emoji: reactionNames.waitFlat.full,
            label: undefined,
        }
    };

    private static buildBtns(data: ButtomParams[][]): ButtonBuilder[][] {
        return data.map(row => {
            return row.map(btnInfo => {
                const button = new ButtonBuilder()
                    .setCustomId(btnInfo.customId)
                    .setStyle(btnInfo.style);
                if (btnInfo.emoji) button.setEmoji(btnInfo.emoji);
                if (btnInfo.label) button.setLabel(btnInfo.label);
                return button;
            });
        });
    }

    private static buildDefaultBtns(index?: Index): ButtomParams[][] {
        const btnsInfo: ButtomParams[][] = [
            [this.btnInfo.cancel, this.btnInfo.say, this.btnInfo.regenerate]
        ];
        if (index) {
            const indexbutton = this.btnInfo.indexBtn(index);
            btnsInfo.push([this.btnInfo.left, indexbutton, this.btnInfo.right]);
        }
        return btnsInfo;
    }
    // #endregion


    private static buildMessage(options: MessageCreateOptions, components: ButtonBuilder[][]): MessageCreateOptions | MessageEditOptions {

        let rows: Array<ActionRowBuilder<MessageActionRowComponentBuilder>> = [];

        components.forEach(buttons => {
            const row = new ActionRowBuilder() as ActionRowBuilder<MessageActionRowComponentBuilder>;
            row.addComponents(buttons);
            rows.push(row);
        })

        return {
            ...options,
            components: rows,
        }
    }


    public static buildLoadingMessage(): MessageCreateOptions | MessageEditOptions {

        const btns = this.buildBtns([[this.btnInfo.cancel]]);

        return this.buildMessage({ content: reactionNames.wait.full }, btns);

    }


    public static buildLoadingButtonMessage(data: GptMessageData, loadButtonName: string): MessageCreateOptions | MessageEditOptions {

        let btnsInfo: ButtomParams[][] = this.buildDefaultBtns([(data.currentIndex + 1), (data.content.length + 1)]);
        btnsInfo = btnsInfo.map(row => {
            return row.map(button => {
                return button.customId === loadButtonName ? this.btnInfo.load : button;
            });
        })

        const btns = this.buildBtns(btnsInfo);
        return this.buildMessage({ content: data.content[data.currentIndex] }, btns);
    }

    public static buildDoneMessage(data: GptMessageData | string): MessageCreateOptions | MessageEditOptions {

        if (typeof data === "string") {
            const btnsInfo: ButtomParams[][] = this.buildDefaultBtns();
            const btns = this.buildBtns(btnsInfo);
            return this.buildMessage({ content: data }, btns);
        };

        const btnsInfo: ButtomParams[][] = this.buildDefaultBtns([(data.currentIndex + 1), (data.content.length + 1)]);
        const btns = this.buildBtns(btnsInfo);
        return this.buildMessage({ content: data.content[data.currentIndex] }, btns);
    }

}

async function askGpt(client: Client, gptModels: string[], lastMessages: Message[],
    visiondistance: number, model: ModelVersions): Promise<string> {

    const gpt = new GPT(openaikey, 2000, model);

    const history: History = [{
        role: "assistant",
        content: `Это запись чата. Ты дискорд бот. Твой ник - ${client.user?.username}.
Для кода ВСЕГДА используется форматирование: \`\`\`[язык][код]\`\`\` .
Отвечай на последние вопросы или сообщения.\n
Отвечай в формате JSON {"ans": "твой ответ"}!!!
Отвечай на русском языке. Общайся в житейской манере, но всегда ясно доноси мысль.
Не отвечай исключительно смайликами если тебя не просят.
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
    print('GPT: ' + content);
    return content || 'Нет ответа';
}

type GptMessageData = {
    messageId: string,
    content: Array<string>,
    currentIndex: number,
    deleted: boolean
};


class GptDbHandler {
    private static _gptMessagesTableName = 'gptMessages';
    private static _db: string = 'database.db';
    constructor() { }

    static async load(messageId: string): Promise<GptMessageData | null> {
        const data = await Database.interact(this._db, async (db) => {
            return await db.getJSON(this._gptMessagesTableName, messageId) as GptMessageData | null;
        }) as GptMessageData | null;
        if (!data) {
            // throw new Error(`GptDb: cannot load data for ${messageId}`);
            printE(`GptDb: cannot load data for ${messageId}`);
        }
        return data;
    }

    static async firstPage(messageId: string, content: string): Promise<GptMessageData> {
        const data = {
            messageId,
            content: [content],
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
            data: json.content.push(content) ?? content,
            currentIndex: json.content.length - 1
        }
        await Database.interact(this._db, async (db) => {
            await db.setJSON(this._gptMessagesTableName, messageId, data)
        })
        return data;
    }

    static async loadPage(messageId: string, index: number): Promise<GptMessageData> {
        const json = await this.load(messageId) as GptMessageData;
        const data = {
            ...json,
            currentIndex: index
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
