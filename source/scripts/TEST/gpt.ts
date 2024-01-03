import { CommandInteraction, SlashCommandBuilder, Client, Message, GuildBasedChannel, TextChannel } from 'discord.js';
import { print, printD, printL, format, dateToStr, printE } from '../../lib/consoleUtils';
import { fetchLastNMessages, GuildSetting, fetchChannel } from '../../lib/discordUtils';
import { GPT, History } from '../../lib/openAI';
import { openaikey } from '../../botConfig.json';

const gpt = new GPT(openaikey, 2000, 'gpt-3.5-turbo-1106');

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
    ,

    async execute(interaction: CommandInteraction, client: Client): Promise<void> {

        const options: any = interaction.options;
        const visiondistance = options.getInteger("visiondistance") ?? 10;

        if (interaction.guildId === null) {
            printE('GuildId is null');
            return;
        };

        interaction.deferReply({ ephemeral: false });


        const lastMessages: Message[] = await fetchLastNMessages(interaction.guildId, interaction.channelId, visiondistance, client);

        // const history: History = lastMessages.map(msg => {
        //     return {
        //         role: msg.author.bot ? "assistant" : "user",
        //         content: msg.content
        //     };
        // });
        // history.reverse();

        const history: History = [{
            role: "assistant",

            content: `Это запись чата. Твой ник - ${client.user?.username}.
            Отвечай в формате JSON {"ans": "твой ответ"}.
            Ник в ответе не пиши. Только текст ответа.
            Отвечай на последние вопросы или сообщения.\n` 
            + lastMessages.map(msg => {
                return `${msg.author.displayName}: ${msg.content}`;
            }).reverse().join("\n")

        }];

        history.reverse();

        const ans = await gpt.request(history, 'json');

        await interaction.editReply({
            content: JSON.parse(ans.choices[0].message.content).ans
        });

        const channel = await fetchChannel(client, interaction.guildId, interaction.channelId) as TextChannel;

        await interaction.editReply(ans);

    },
};
