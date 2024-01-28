import { CommandInteraction, Client, Message, ActionRowBuilder, TextChannel, Events, User, PartialUser, PartialMessageReaction, MessageReaction } from 'discord.js';
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

const regenerateReaction = { full: "<:regenerate:1196122410626330624>", name: "regenerate" };
const cancelReaction = { full: "<:cancel:1196070262567882802>", name: "cancel" };
const sayReaction = { full: "<:say:1196070264165912719>", name: "say" };
const waitReaction = { full: "<a:discordloading2:1194652977256992930>", name: "discordloading2" };
const waitReactionFlat = { full: "<a:discordloading:1192816519525183519>", name: "discordloading" };
const leftReaction = { full: "<:previous:1196070253923405864>", name: "previous" };
const rightReaction = { full: "<:next:1196070255836012544>", name: "next" };




export const script = new ScriptBuilder({
    name: "gpt2",
    group: "test",
})
    .addOnSlash(
        new SlashCommandBuilder()
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
        async (options) => {
            const interaction = options.interaction;


            interaction.deferReply({ ephemeral: true });
            interaction.deleteReply();
            const channel = interaction.channel as TextChannel;
    
            let message = await channel.send(Responder.buildLoadingMessage() as MessageCreateOptions);
    
            const lastMessages = await Fetcher.messages(channel, script.client!, defaultVisionDistance, "before");
            const content = String(await askGpt(script.client!, gptModels, lastMessages, defaultVisionDistance, defaultModel));
            await message.edit(Responder.buildDoneMessage(content) as MessageEditOptions);
    
            await saveMsgData(message.id, content);

        }
    )
    .addOnButton(
        async (options) => {
            print(options.interaction.customId);
        }
    )
    .addOnStart(
        async (options) => {
            guildSettingS = await Database.interact('database.db', async (db) => {
                return await db.getTable('guildSettings');
            });
        }
    )
    .addOnUpdate(
        async (options) => {
            guildSettingS = await Database.interact('database.db', async (db) => {
                return await db.getTable('guildSettings');
            });
        }
    )



// export const command = {

//     info: {
//         type: "slash",
//     },

//     data: new SlashCommandBuilder()
//         .setName('gpt2')
//         .setDescription('casts gpt msg')
//         .addIntegerOption(option =>
//             option.setName('visiondistance')
//                 .setDescription('how many messages to look back')
//                 .setRequired(false)
//                 .addChoices(
//                     { name: '1', value: 1 },
//                     { name: '5', value: 5 },
//                     { name: '10', value: 10 },
//                     { name: '20', value: 20 },
//                     { name: '40', value: 40 },
//                 ))
//         .addStringOption(option =>
//             option.setName('model')
//                 .setDescription('model')
//                 .setRequired(false)
//                 .addChoices(
//                     ...gptModels.map(model => ({ name: model, value: model })),
//                 )),

//     // #region slash handler
//     async onInteraction(interaction: CommandInteraction, client: Client): Promise<void> {

//         interaction.deferReply({ ephemeral: true });
//         interaction.deleteReply();

//         const channel = interaction.channel as TextChannel;

//         let message = await channel.send(Responder.buildLoadingMessage() as MessageCreateOptions);

//         const lastMessages = await Fetcher.messages(channel, client, defaultVisionDistance, "before");
//         const content = String(await askGpt(client, gptModels, lastMessages, defaultVisionDistance, defaultModel));
//         await message.edit(Responder.buildDoneMessage(content) as MessageEditOptions);

//         await saveMsgData(message.id, content);

//     },
//     // #endregion


//     // #region buttons
//     async checkCustomID(interaction: CommandInteraction): Promise<boolean> {

//         return true;

//     },

//     async onButton(interaction: CommandInteraction, client: Client): Promise<void> {

//         printD({ interaction });

//     },
//     // #endregion

//     async onUpdate(client: Client, scriptScopes: ScriptScopes): Promise<void> {
//         guildSettingS = await Database.interact('database.db', async (db) => {
//             return await db.getTable('guildSettings');
//         });
//     },

//     async onStart(client: Client, scriptScopes: ScriptScopes): Promise<void> {

//         guildSettingS = await Database.interact('database.db', async (db) => {
//             return await db.getTable('guildSettings');
//         });

//     }
// };




class Responder {

    // #region buttons
    private static cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(cancelReaction.full)
    // .setLabel('cancel');

    private static regenerate = new ButtonBuilder()
        .setCustomId('regenerate')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(regenerateReaction.full)
    // .setLabel('regenerate');

    private static say = new ButtonBuilder()
        .setCustomId('say')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(sayReaction.full)
    // .setLabel('say');

    private static left = new ButtonBuilder()
        .setCustomId('left')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(leftReaction.full)

    private static right = new ButtonBuilder()
        .setCustomId('right')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(rightReaction.full)

    private static infoButton(text: string, customId: string): ButtonBuilder {
        return new ButtonBuilder()
            .setCustomId(customId)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
            .setLabel(text);
    }
    // #endregion

    private static buildMessage(options: MessageCreateOptions, components: Array<Array<ButtonBuilder>>): MessageCreateOptions | MessageEditOptions {

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


    public static buildLoadingMessage(oldMsg?: Message): MessageCreateOptions | MessageEditOptions {

        if (!oldMsg) {
            return this.buildMessage({ content: waitReaction.full }, [[this.cancel]]);
        }

        return this.buildMessage({
            content: oldMsg.content + "\n" + waitReactionFlat.full,
            components: oldMsg.components
        }, [[this.cancel]]);

    }

    public static buildDoneMessage(content: string, oldMsgId?: string): MessageCreateOptions | MessageEditOptions {

        return this.buildMessage({
            content
        }, [[this.cancel, this.say, this.regenerate], [this.left, this.infoButton('15/15', 'index'), this.right]]);

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

type GptMessageData = {
    messageId: string,
    content: Array<string>,
    currentIndex: number,
};
const gptMessagesTableName = 'gptMessages';

async function saveMsgData(messageId: string, content?: string, index?: number) {
    await Database.interact('database.db', async (db) => {
        let data = await db.getJSON(gptMessagesTableName, messageId) as GptMessageData | null;
        if (content) {
            if (data) {
                data.content.push(content);
                data.currentIndex = index ?? data.content.length - 1;
            }
            else {
                data = {
                    messageId,
                    content: [content],
                    currentIndex: 0,
                }
            }
        }
        else if (index) {
            if (data && data.content) {
                data.currentIndex = index;
            }
        }

        if (!data || !data.content) {
            printE('saveMsgData: content or currentIndex must be set');
            return;
        }

        db.setJSON(gptMessagesTableName, messageId, data);

    });
}



async function loadMsgData(messageId: string, content?: string, currentIndex?: number): Promise<GptMessageData | null> {
    return await Database.interact('database.db', async (db) => {
        return await db.getJSON(gptMessagesTableName, messageId) as GptMessageData | null;
    });
}

