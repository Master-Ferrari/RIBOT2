import {
    AttachmentBuilder, Client, Message, ActionRowBuilder,
    TextChannel, ButtonComponent, ComponentType, Events, User,
    PartialUser, PartialMessageReaction, MessageReaction, ChannelType,
    StringSelectMenuBuilder, ChannelSelectMenuBuilder, Emoji, ModalBuilder, TextInputBuilder, TextInputStyle,
    AnyThreadChannel,
    ThreadChannel
} from 'discord.js';
import {
    ButtonBuilder, ButtonStyle, SlashCommandBuilder,
    MessageCreateOptions, MessageActionRowComponentBuilder,
    MessageEditOptions
} from 'discord.js';

import {
    print, printD, printL, format, dateToStr, printE,
    prettySlice, interactionLog, replaceDictionary
} from '../../libs/consoleUtils';
import {
    fetchLastNMessages, Fetcher, fetchMessage, GuildSetting,
    fetchChannel, sendWebhookMsg, editWebhookMsg, getSettings,
    updateReactions, ScriptScopes, ComponentParams, ComponentBuilder,
    ChannelSelectParams, ButtonParams, buildMessage, buildComponents,
    SafeDiscord, StringSelectParams, GptSettings, UserSetting, GptSettingsTableType, commonStuff
} from '../../libs/discordUtils';

import { G4f, G4fModels, GptFactory, History, Method, Openai, allModels, g4fModels } from '../../libs/gptHandler';
import Database from '../../libs/sqlite';
import { TTSFactory } from '../../libs/tts';
import { ScriptBuilder } from '../../libs/scripts';
import axios from 'axios';
import { channel } from 'diagnostics_channel';

const defaultVisionDistance = 15;

const compNames = {
    cancel: "GptCancel", say: "GptSay", regenerate: "GptRegenerate",
    left: "GptLeft", right: "GptRight", load: "GptLoad",
    open: "GptOpen", close: "GptClose",
    gptChannel: "GptAutoChannel",
    method: "GptMethod",
    model: "GptModel",
    empty: "GptEmpty",
    prompt: "GptPrompt",
    promptGap: "GptPromptGap",
    promptModal: "GptPromptModal",
    reset: "GptReset",
    api: "GptApi",
    apiGap: "GptApiGap",
    apiModal: "GptApiModal",
    thread: "GptThread",
    webhook: "GptWebhook",
    webhookGap: "GptWebhookGap",
    webhookModal: "GptWebhookModal",
    info: "GptInfo",
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
    empty: { full: "<:empty:1228541126441435146>", name: "empty" },
    lips: { full: "<:lips:1228724931576205483>", name: "lips" },
    thread: { full: "<:thread:1234282204931293256>", name: "thread" },
    settings: { full: "<:settings:1234279706338005165>", name: "settings" },
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

type GptThreadData = {
    name: string,
    rootMessageId: string,
    startMessageId?: string,
    contextLenght?: number
}


type Index = [string | number, string | number];

export const script = new ScriptBuilder({
    name: "gpt",
    group: "test",
})
    .addOnSlash({
        slashDeployData: new SlashCommandBuilder()
            .setName('gpt')
            .setDescription('бесплатный безлимитный gpt 4 не упусти свой шанс'),
        onSlash: async (interaction) => {

            interaction.deferReply({ ephemeral: true });
            interaction.deleteReply();
            const channel = interaction.channel as TextChannel;

            let message = await channel.send(Responder.buildLoadingMessage() as MessageCreateOptions);

            let data = await GptMessagesDbHandler.firstPage(message.id, "nothing here");

            const lastMessages = await Fetcher.messages(message, script.client!, defaultVisionDistance, "before");

            const gptSettings = GptSettingsDbHandler.get(interaction.guildId ?? interaction.user.id);

            const content = await AskGpt.ask(gptSettings, script.client!, lastMessages, defaultVisionDistance, g4fModels);

            data = await GptMessagesDbHandler.editPage(message.id, content);

            await SafeDiscord.messageEdit(message, Responder.buildDoneMessage(data!, gptSettings) as MessageEditOptions);
        }
    })
    .addOnButton({
        isValidButtonCustomId: async (customId: string) => {
            return Object.values(compNames).includes(customId);
        },

        onButton: async (interaction) => {

            const msgId = interaction.message.id;
            let data = await GptMessagesDbHandler.load(msgId);

            const id = interaction.guildId ?? interaction.user.id;
            const tableType = interaction.guildId ? "guildSettings" : "userSettings";
            let gptSettings = GptSettingsDbHandler.get(id, tableType);

            if (!data) {
                printE("No data");
                return;
            }

            if (interaction.customId === compNames.cancel) {
                interaction.message.delete();
                await GptMessagesDbHandler.delete(msgId);

            } else if (interaction.customId === compNames.say) {

                let tts = TTSFactory.createTTS();
                const content = interaction.message.content.replace(/```.*?```/gs, ". код читать не буду. ");

                await SafeDiscord.interactionUpdate(interaction, Responder.buildLoadingButtonMessage(data, [compNames.say], gptSettings, [compNames.regenerate, compNames.left, compNames.right]) as MessageEditOptions);

                tts.send({
                    text: content,
                    onWav: async (ttsData) => {

                        if (!data) { printE("No data"); return; }

                        const voiceFile = new AttachmentBuilder(tts.outputPath, { name: "tts.wav" });

                        //не забыть не убить картинки там которые были
                        if (data.deleted) return;
                        await SafeDiscord.messageEdit(interaction.message, { ...Responder.buildDoneMessage(data, gptSettings), files: [voiceFile] } as MessageEditOptions);

                        const files: msgFiles = interaction.message.attachments.map(attachment => { return { url: attachment.url, name: attachment.name } });

                        data = await GptMessagesDbHandler.addFiles(msgId, files, "combine");

                    },

                    errorCallback: async (error) => {
                        if (!data) { printE("No data"); return; }
                        if (data.deleted) return;
                        interaction.followUp({ content: String(error) ?? "error", ephemeral: false });
                        await SafeDiscord.messageEdit(interaction.message, { ...Responder.buildDoneMessage(data, gptSettings) } as MessageEditOptions);
                    }
                });


            } else if (interaction.customId === compNames.regenerate) {

                await SafeDiscord.interactionUpdate(interaction, Responder.buildLoadingButtonMessage(data, [compNames.regenerate], gptSettings, [compNames.say, compNames.left, compNames.right]) as MessageEditOptions);
                data = await GptMessagesDbHandler.anotherPage(msgId, reactionNames.wait.full);

                const lastMessages = await Fetcher.messages(interaction.message, script.client!, defaultVisionDistance, "before");

                const content = await AskGpt.ask(gptSettings, script.client!, lastMessages, defaultVisionDistance, g4fModels);

                data = await GptMessagesDbHandler.editPage(msgId, content);

                await SafeDiscord.messageEdit(interaction.message, Responder.buildDoneMessage(data!, gptSettings) as MessageEditOptions);

            } else if (interaction.customId === compNames.left) {

                data = await GptMessagesDbHandler.loadPage(data.messageId, "left");
                if (data.deleted) return;
                await SafeDiscord.interactionUpdate(interaction, Responder.buildDoneMessage(data, gptSettings) as MessageEditOptions);

            } else if (interaction.customId === compNames.right) {

                data = await GptMessagesDbHandler.loadPage(data.messageId, "right");
                if (data.deleted) return;
                await SafeDiscord.interactionUpdate(interaction, Responder.buildDoneMessage(data, gptSettings) as MessageEditOptions);

            } else if (interaction.customId === compNames.open) {

                data = await GptMessagesDbHandler.load(data.messageId);
                if (data!.deleted) return;

                await SafeDiscord.interactionUpdate(interaction, Responder.buildOptionsMessage(data!, gptSettings) as MessageEditOptions);

            } else if (interaction.customId === compNames.close) {

                data = await GptMessagesDbHandler.load(data.messageId);
                if (data!.deleted) return;
                await SafeDiscord.interactionUpdate(interaction, Responder.buildDoneMessage(data!, gptSettings) as MessageEditOptions);

            } else if (interaction.customId === compNames.prompt) {

                data = await GptMessagesDbHandler.load(data.messageId);
                if (data!.deleted) return;

                const modal = new ModalBuilder()
                    .setCustomId(compNames.promptModal)
                    .setTitle('This is your GPT request');

                const promptInput = new TextInputBuilder()
                    .setCustomId(compNames.promptGap)
                    .setLabel("Use %pseudonyms%")
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(gptSettings.prompt)
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(promptInput) as ActionRowBuilder<TextInputBuilder>;
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);

            } else if (interaction.customId === compNames.reset) {

                gptSettings = await GptSettingsDbHandler.set(id, tableType, interaction.client, GptSettingsDbHandler.defaultSettings);
                data = await GptMessagesDbHandler.load(data.messageId);
                if (data!.deleted) return;
                await SafeDiscord.interactionUpdate(interaction, Responder.buildDoneMessage(data!, gptSettings) as MessageEditOptions);

            } else if (interaction.customId === compNames.api) {

                data = await GptMessagesDbHandler.load(data.messageId);
                if (data!.deleted) return;

                const modal = new ModalBuilder()
                    .setCustomId(compNames.apiModal)
                    .setTitle('Enter your api key');

                const Input = new TextInputBuilder()
                    .setCustomId(compNames.apiGap)
                    .setLabel("visit https://platform.openai.com/api-keys")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const firstActionRow = new ActionRowBuilder().addComponents(Input) as ActionRowBuilder<TextInputBuilder>;
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);


            } else if (interaction.customId === compNames.webhook) {

                data = await GptMessagesDbHandler.load(data.messageId);
                if (data!.deleted) return;

                const modal = new ModalBuilder()
                    .setCustomId(compNames.webhookModal)
                    .setTitle('Enter webhook url');

                const Input = new TextInputBuilder()
                    .setCustomId(compNames.webhookGap)
                    .setLabel("server settings / integrations / webhooks")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const firstActionRow = new ActionRowBuilder().addComponents(Input) as ActionRowBuilder<TextInputBuilder>;
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);


            } else if (interaction.customId === compNames.thread) {
                const defaultName = "GPT";

                // check webhook or ask for it

                // check for db record или нет

                // delete all messages in thread before creation completed

                // create db record
                const record: GptThreadData = {
                    name: defaultName,
                    rootMessageId: data.messageId,
                    startMessageId: data.messageId,
                    contextLenght: 0
                }

                Database.interact('database.db', async (db) => {
                    db.setJSON('global', 'gptThreads', record);
                })  

                //create new thread by channel
                const thread = await (interaction.message.channel as TextChannel).threads.create({ name: defaultName });

                //hide thread
                await thread.setArchived(true);

                // interaction update
                const threadLink = "https://discord.com/channels/" + interaction.guildId + "/" + thread.id;
                await SafeDiscord.messageEdit(interaction.message,
                    {
                        ...Responder.buildDoneMessage(data, gptSettings),
                        embeds: [{ description: "Continuation of the dialogue: " + threadLink }]
                    } as MessageEditOptions);

                //send start message asking count of last context messages
                // thread.send({ content: "Please provide the number of recent messages that should be in the context of the bot.", components: buildComponents() });

                //get last messages

                //ask gpt thread name

                //fill thread by webhook

                //ans as usial 

                /////////maybe create class about crating gpt threads becouse i want to make slash gptthread command


                // interaction.message.startThread({ name: "GPT" });

                await SafeDiscord.messageEdit(interaction.message, { ...Responder.buildDoneMessage(data, gptSettings) } as MessageEditOptions);

                //clear system message about thread creation
                const sysMessages = (await interaction.message.channel.messages.fetch({ limit: 5 })).find(m => m.system && m.content.includes(defaultName));
                sysMessages?.delete();



            }
        }
    })
    .addOnSelectMenu({
        isValidSelectMenuCustomId: async (customId: string) => {
            return true;
        },
        onSelectMenu: async (interaction) => {

            if (interaction.customId == compNames.gptChannel) {
                if (!interaction.guildId) {
                    return;
                }

                const tableType = "guildSettings";

                const gptSettings = await GptSettingsDbHandler.set(interaction.guildId, tableType, interaction.client, { gptChannels: interaction.values });
                const data = await GptMessagesDbHandler.load(interaction.message.id);
                if (data!.deleted) return;
                await SafeDiscord.interactionUpdate(interaction, Responder.buildOptionsMessage(data!, gptSettings) as MessageEditOptions);
            }

            if (interaction.customId == compNames.method) {
                const tableType = interaction.guildId ? "guildSettings" : "userSettings";
                const id = interaction.guildId ?? interaction.user.id;

                let gptSettings = GptSettingsDbHandler.get(interaction.guildId ?? interaction.user.id, tableType);

                if (interaction.values[0] != gptSettings.method) {
                    gptSettings = await GptSettingsDbHandler.set(id, tableType, interaction.client, { model: allModels[interaction.values[0]][0] });
                }

                gptSettings = await GptSettingsDbHandler.set(id, tableType, interaction.client, { method: interaction.values[0] });
                const data = await GptMessagesDbHandler.load(interaction.message.id);
                if (data!.deleted) return;
                await SafeDiscord.interactionUpdate(interaction, Responder.buildOptionsMessage(data!, gptSettings) as MessageEditOptions);
            }

            if (interaction.customId == compNames.model) {
                const tableType = interaction.guildId ? "guildSettings" : "userSettings";
                const id = interaction.guildId ?? interaction.user.id;

                const gptSettings = await GptSettingsDbHandler.set(id, tableType, interaction.client, { model: interaction.values[0] });

                const data = await GptMessagesDbHandler.load(interaction.message.id);
                if (data!.deleted) return;
                await SafeDiscord.interactionUpdate(interaction, Responder.buildOptionsMessage(data!, gptSettings) as MessageEditOptions);
            }
        }
    })
    .addOnStart({
        onStart: async () => {
            GptSettingsDbHandler.updateLocalTable();
        }
    })
    .addOnUpdate({
        onUpdate: async () => {
            GptSettingsDbHandler.updateLocalTable();
        }
    }).addOnModal({
        isValidModalCustomId: async (customId: string): Promise<boolean> => {
            return true
        },
        onModal: async (interaction) => {

            if (!interaction.isFromMessage()) return;
            const tableType = interaction.guildId ? "guildSettings" : "userSettings";
            const id = interaction.guildId ?? interaction.user.id;
            let gptSettings: GptSettings;

            if (interaction.customId == compNames.promptModal) {

                gptSettings = await GptSettingsDbHandler.set(id, tableType, interaction.client, { prompt: interaction.components[0].components[0].value });

            } else if (interaction.customId == compNames.apiModal) {

                gptSettings = await GptSettingsDbHandler.set(id, tableType, interaction.client, { apikey: interaction.components[0].components[0].value });

            } else if (interaction.customId == compNames.webhookModal) {

                gptSettings = await GptSettingsDbHandler.set(id, tableType, interaction.client, { webhook: interaction.components[0].components[0].value });

            } else { gptSettings = GptSettingsDbHandler.defaultSettings }

            const data = await GptMessagesDbHandler.load(interaction.message.id);
            if (data!.deleted) return;
            await SafeDiscord.interactionUpdate(interaction, Responder.buildOptionsMessage(data!, gptSettings) as MessageEditOptions);
        }
    }).addOnMessage({
        settings: {
            ignoreDM: false
        },
        onMessage: async (userMessage) => {

            if (!userMessage.channel.isDMBased() && userMessage.guildId) { // do not filter if is not dm

                const channelId = (userMessage.channel.isThread() ? userMessage.channel.parent!.id : userMessage.channel.id); // replace thread to its parent

                const allowedChannel = GptSettingsDbHandler.get(userMessage.guildId)?.gptChannels.find((channel) => {
                    if (channelId === channel) return true // not undefined if is in allowed channels from guild settings
                });

                if (!allowedChannel) return // reject if is not in allowed channels
            }


            interactionLog(userMessage.author.tag, "gpt", userMessage.content, userMessage.author.id);

            const channel = userMessage.channel as TextChannel;

            let message = await channel.send(Responder.buildLoadingMessage() as MessageCreateOptions);

            let data = await GptMessagesDbHandler.firstPage(message.id, "nothing here");

            const lastMessages = await Fetcher.messages(message, script.client!, defaultVisionDistance, "before");

            const gptSettings = GptSettingsDbHandler.get(message.guildId ?? message.author.id);

            const content = await AskGpt.ask(gptSettings, script.client!, lastMessages, defaultVisionDistance, g4fModels);

            data = await GptMessagesDbHandler.editPage(message.id, content);

            await SafeDiscord.messageEdit(message, Responder.buildDoneMessage(data!, gptSettings) as MessageEditOptions);

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
        say(gptSettings: GptSettings) {
            return {
                type: 2,
                customId: compNames.say,
                style: ButtonStyle.Secondary,
                disabled: gptSettings.method != 'OpenAI',
                emoji: reactionNames.say.full,
                label: undefined,
            } as ButtonParams
        },
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
            emoji: reactionNames.settings.full,
            label: undefined,
        } as ButtonParams,
        close: {
            type: 2,
            customId: compNames.close,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: reactionNames.close.full,
            label: "back",
        } as ButtonParams,
        gptChannel(guildSetting?: GptSettings): ChannelSelectParams {
            return {
                type: 8,
                customId: compNames.gptChannel,
                disabled: false,
                placeholder: "Select GPT channel.",
                channelTypes: [ChannelType.GuildText],
                min_values: 0,
                max_values: 25,
                default_values: guildSetting?.gptChannels ?? [],
            } as ChannelSelectParams
        },
        method(selectedMethod: string): StringSelectParams {
            return {
                type: 3,
                customId: compNames.method,
                disabled: false,
                placeholder: "Select API method. (" + selectedMethod + " is selected)",
                options: [
                    { label: "OpenAI   НЕ СТОИТ! ДОРОГО!", value: "OpenAI" },
                    { label: "Gpt4Free", value: "Gpt4Free" },
                ]
            } as StringSelectParams
        },
        model(selectedModel: string, Models: string[]): StringSelectParams {
            return {
                type: 3,
                customId: compNames.model,
                disabled: false,
                placeholder: "Select model. (" + selectedModel + " is selected)",
                options: Models.map(x => ({ label: x, value: x }))
            } as StringSelectParams
        },
        empty(customId: string = compNames.load): ButtonParams {
            return {
                type: 2,
                customId: customId,
                style: ButtonStyle.Secondary,
                disabled: true,
                emoji: reactionNames.empty.full,
                label: undefined,
            };
        },
        thread: {
            type: 2,
            customId: compNames.thread,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: reactionNames.thread.full,
            label: undefined,
        } as ButtonParams,
        prompt: {
            type: 2,
            customId: compNames.prompt,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: undefined,
            label: "edit base prompt",
        } as ButtonParams,
        reset: {
            type: 2,
            customId: compNames.reset,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: reactionNames.cancel.full,
            label: "reset all",
        } as ButtonParams,
        api: {
            type: 2,
            customId: compNames.api,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: undefined,
            label: "enter api key",
        } as ButtonParams,
        webhook: {
            type: 2,
            customId: compNames.webhook,
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: reactionNames.thread.full,
            label: "enter webhook",
        } as ButtonParams,
        info: {
            type: 2,
            customId: compNames.info,
            style: ButtonStyle.Secondary,
            disabled: true,
            emoji: reactionNames.lips.full,
            label: "info",
        } as ButtonParams,
    };

    private static buildDefaultBtns(index: Index, gptSettings: GptSettings): ButtonParams[][] {
        const btnsInfo: ButtonParams[][] = [];

        btnsInfo.push([
            this.compInfo.cancel,
            this.compInfo.regenerate,
            gptSettings.type == "guildSettings" ? this.compInfo.thread : null,
            gptSettings.type == "userSettings" ? this.compInfo.say(gptSettings) : null,
            this.compInfo.open,
            gptSettings.type == "guildSettings" && index[1] == 1 ? this.compInfo.say(gptSettings) : null,
        ].filter((e) => e != null) as ButtonParams[]);

        if (Number(index[1]) > 1)
            btnsInfo.push([
                this.compInfo.left,
                this.compInfo.index(index),
                this.compInfo.right,
                gptSettings.type == "guildSettings" ? this.compInfo.say(gptSettings) : null,
            ].filter((e) => e != null) as ButtonParams[]);

        return btnsInfo;
    }

    private static buildAdditionalBtns(gptSettings: GptSettings): ComponentParams[][] {
        const compsInfo: ComponentParams[][] = [];

        compsInfo.push([
            this.compInfo.close,
            this.compInfo.reset,
            this.compInfo.info,
        ]);
        compsInfo.push([
            this.compInfo.prompt,
            this.compInfo.api,
            gptSettings.type == "guildSettings" ? this.compInfo.webhook : null,
        ].filter((e) => e != null) as ComponentParams[]);

        if (gptSettings.type == "guildSettings") {
            compsInfo.push([this.compInfo.gptChannel(gptSettings)]);
        }
        compsInfo.push([this.compInfo.method(gptSettings.method)]);
        compsInfo.push([this.compInfo.model(gptSettings.model, allModels[gptSettings.method])]);
        return compsInfo;
    }
    // #endregion

    // #region message builders
    public static buildLoadingMessage(): MessageCreateOptions | MessageEditOptions {

        const btns = buildComponents([[this.compInfo.cancel]]);

        return buildMessage({ content: reactionNames.wait.full }, btns);

    }

    public static buildLoadingButtonMessage(data: GptMessageData, loadButtonIds: string[], gptSettings: GptSettings, disabledButtonIds?: string[]): MessageCreateOptions | MessageEditOptions {

        let compsInfo: ButtonParams[][] = this.buildDefaultBtns([(data.currentIndex + 1), (data.answers.length)], gptSettings);
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

    public static buildDoneMessage(data: GptMessageData | string, gptSettings: GptSettings): MessageCreateOptions | MessageEditOptions {

        if (typeof data === "string") {
            const btnsInfo: ButtonParams[][] = this.buildDefaultBtns([1, 1], gptSettings);
            const btns = buildComponents(btnsInfo);
            return buildMessage({ content: data }, btns);
        };

        const files = data.answers[data.currentIndex].files.map(file => {
            return new AttachmentBuilder(file.url, { name: file.name });
        });

        const btnsInfo: ButtonParams[][] = this.buildDefaultBtns([(data.currentIndex + 1), (data.answers.length)], gptSettings);
        const btns = buildComponents(btnsInfo);
        return buildMessage({ content: data.answers[data.currentIndex].content, files }, btns);
    }

    public static buildOptionsMessage(data: GptMessageData, gptSettings: GptSettings): MessageCreateOptions | MessageEditOptions {

        const files = data.answers[data.currentIndex].files.map(file => {
            return new AttachmentBuilder(file.url, { name: file.name });
        });

        const btnsInfo: ComponentParams[][] = this.buildAdditionalBtns(gptSettings);
        const btns = buildComponents(btnsInfo);
        return buildMessage({ content: data.answers[data.currentIndex].content, files }, btns);
    }

    // public static buildNewThreadMessage(gptSettings: GptSettings): MessageCreateOptions | MessageEditOptions {
    //     const btnsInfo: ComponentParams[][] = this.buildAdditionalBtns(gptSettings);
    //     const btns = buildComponents(btnsInfo);
    //     return buildMessage({ content: data.answers[data.currentIndex].content, files }, btns);
    // }

    // #endregion

}

class AskGpt {


    static async ask(
        gptSettings: GptSettings,

        // method: Method,

        client: Client,
        lastMessages: Message[],
        visiondistance: number,
        // model: G4fModels,

        allModels: string[],

        // stream: boolean,
        callback?: (content: string) => Promise<void>,
        streamCallback?: (iteration: number, content: string) => Promise<void>,
    ): Promise<string> {
        const dictionary = {
            "botusername": client.user?.username,
            "visiondistance": visiondistance,
            "lastmessages": (await Promise.all(lastMessages.map(async function (msg: Message) {
                const name = allModels.find(m => m === msg.author.username) ? client.user?.username : msg.author.username;
                if (msg.attachments && msg.attachments.size > 0) {
                    const attachment = msg.attachments.find(attachment => attachment.name === "message.txt");
                    if (attachment) {
                        return `${name}:\n«${msg.content}\n${await urlToText(attachment.url)}»`;
                    }
                }
                return `${name}:\n«${msg.content}»`;
                async function urlToText(url: string): Promise<string> {
                    try {
                        const response = await axios.get(url);
                        return response.data;
                    } catch (error) {
                        printE('Error getting text from url:', error);
                        return '';
                    }
                }
            }))).reverse().join("\n")
        };

        const prompt = replaceDictionary(gptSettings.prompt, dictionary, "\\%", "\\%");


        const history: History = [{
            role: "system",
            content: prompt
        }];
        history.reverse();

        let ans: string = "No answer";
        if (gptSettings.method === "OpenAI") {
            ans = await this.openai(history, gptSettings.apikey, gptSettings.model, streamCallback);
        }

        if (gptSettings.method === "Gpt4Free") {
            ans = await this.g4f(history, gptSettings.model, callback);
        }

        ans = ans.replace(/^[«»""]*|[«»""]*$/g, '');

        return String(ans);
    }

    private static async openai(history: History, openaikey: string | undefined, model: G4fModels, callback?: (iteration: number, content: string) => Promise<void>): Promise<string> {

        if (!openaikey) return 'Enter Api Key!';

        const gpt = GptFactory.create("OpenAI", {
            apiKey: openaikey,
            tokens: 2000,
            model: model,
            temperature: 0.7
        }) as Openai;

        let content = "";

        let iteration = 0;
        await gpt.requestStream(history, 10, 400, async (part: string) => {
            content += part;
            callback?.(iteration, content)
            iteration++;
            return;
        });

        return (content != "") ? content : 'No answer';
    }

    private static async g4f(history: History, model: G4fModels, callback?: (content: string) => Promise<void>): Promise<string> {

        const gpt = GptFactory.create("Gpt4Free", {
            apiKey: "",
            tokens: 2000,
            model: model,
            temperature: 0.7
        }) as G4f;


        let content: string = await gpt.requestChat(history, 3);
        if (!content || content == "") content = 'No answer';

        callback?.(content);

        return (content != "") ? content : 'No answer';
    }

}



class GptMessagesDbHandler {
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

    static async firstPage(messageId: string, content: string, files: msgFiles = []): Promise<GptMessageData> {
        const data = {
            messageId,
            answers: [{ content, files }],
            currentIndex: 0,
            deleted: false
        };
        await Database.interact(this._db, async (db) => {
            await db.setJSON(this._gptMessagesTableName, messageId, data)
        })
        return data;
    }

    static async editPage(messageId: string, content: string): Promise<GptMessageData> {
        const json = await this.load(messageId) as GptMessageData;

        const answers = json.answers;
        answers[json.currentIndex].content = content;

        const data = {
            ...json,
            answers: answers,
        }
        await Database.interact(this._db, async (db) => {
            await db.setJSON(this._gptMessagesTableName, messageId, data)
        })
        return data;
    }

    static async anotherPage(messageId: string, content: string, files: msgFiles = []): Promise<GptMessageData> {
        const json = await this.load(messageId) as GptMessageData;
        json.answers.push({ content, files }) ?? content

        const data = {
            ...json,
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

type GptSettingsTable = { [key: string]: GptSettings };

class GptSettingsDbHandler {

    private static loaclTable: GptSettingsTable;

    static defaultSettings: GptSettings = {
        type: "userSettings",
        model: "gpt-4-32k",
        method: "Gpt4Free",
        gptChannels: [],
        prompt: `error!!!!! panic!!!!!`
    }

    static async updateLocalTable() {
        this.loaclTable = await Database.interact('database.db', async (db) => {

            try {
                this.defaultSettings.prompt = String((await db.getJSON('global', 'commonStuff') as commonStuff).prompt);
            } catch {
                this.defaultSettings.prompt = `error!!!!! panic!!!!!`;
            }

            let combinedSettings: GptSettingsTable = {};
            const guilds = Object.values(await db.getTable('guildSettings') as GuildSetting[]);
            if (guilds) {
                combinedSettings = guilds.reduce((acc: { [key: string]: GptSettings }, guild: GuildSetting) => {
                    if (!guild) return acc;
                    try { acc[guild.guildId] = guild.gptSettings; } catch { }
                    return acc;
                }, {});
            };
            const users = Object.values(await db.getTable('userSettings') as UserSetting[]);
            if (users) {
                combinedSettings = users.reduce((acc: { [key: string]: GptSettings }, user: UserSetting) => {
                    if (!user) return acc;
                    try { acc[user.userId] = user.gptSettings; } catch { }
                    return acc;
                }, combinedSettings ?? {});
            }
            return combinedSettings;
        });
    }

    static get(id: string, table: GptSettingsTableType = "userSettings"): GptSettings {
        return this.loaclTable[id] ?? { ...this.defaultSettings, type: table };
    }

    static async set(id: string, table: GptSettingsTableType, client: Client, gptSettings: Partial<GptSettings>): Promise<GptSettings> {
        const commonInformation = table === "userSettings" ?
            { userId: id, userName: (await Fetcher.user({ userId: id }, client))?.username } :
            { guildId: id, guildName: (await Fetcher.guild({ guildId: id }, client))?.name };

        this.loaclTable[id] = { ...this.defaultSettings, ...this.loaclTable[id], ...gptSettings, type: table };
        return await Database.interact('database.db', async (db) => {
            let json = await db.getJSON(table, id);
            json = await db.setJSON(table, id, { ...json, ...commonInformation, gptSettings: this.loaclTable[id] });
            return json.gptSettings;
        });
    }

}