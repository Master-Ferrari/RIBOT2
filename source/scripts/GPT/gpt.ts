import { CommandInteraction, SlashCommandBuilder, Client, Message, GuildBasedChannel, TextChannel, Events } from 'discord.js';
import { print, printD, printL, format, dateToStr, printE } from '../../lib/consoleUtils';
import { fetchLastNMessages, fetchMessage, GuildSetting, fetchChannel, sendWebhookMsg } from '../../lib/discordUtils';
import { GPT, History, gptModels } from '../../lib/openAI';
import { openaikey } from '../../botConfig.json';
import Database from '../../lib/sqlite';

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
        const model = options.getString("model") ?? 'gpt-4-1106-preview';
        const visiondistance = options.getInteger("visiondistance") ?? 10;

        const gpt = new GPT(openaikey, 2000, model);

        if (interaction.guildId === null) {
            printE('GuildId is null');
            return;
        };

        const lastMessages: Message[] = await fetchLastNMessages(interaction.guildId, interaction.channelId, visiondistance, client);

        await interaction.deferReply({ ephemeral: false });

        let guildSetting: GuildSetting = await Database.interact('database.db', async (db) => {
            return await db.getJSON('guildSettings', String(interaction.guildId));
        });

        if (!guildSetting || !guildSetting.mainWebhookLink) {
            printE('Guild setting not found or main webhook not set');
            await interaction.editReply({ content: "в /settings вебхук добавь" });
            return;
        };



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

        await sendWebhookMsg({
            client: client,
            webhookUrl: guildSetting.mainWebhookLink,
            content: content,
            channelId: interaction.channelId,
            guildId: interaction.guildId,
            username: model,
            avatarURL: client.user?.displayAvatarURL()
        });

        await interaction.deleteReply();

    },

    async onStart(client: Client, guildIds: string[]): Promise<void> {

        client.on(Events.MessageReactionAdd, async (reaction, user) => {


            if(reaction.message.guildId === null) {
                printE('GuildId is null');
                return;
            };

            const msg = await fetchMessage(reaction.message.id, reaction.message.channelId, reaction.message.guildId, client);

            print(reaction.partial);
            printD(msg);

        });

    }
};
