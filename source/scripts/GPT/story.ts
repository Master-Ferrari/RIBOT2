import { CommandInteraction, SlashCommandBuilder, Client, Message, GuildBasedChannel, TextChannel, EmbedBuilder } from 'discord.js';
import { print, printD, printL, format, dateToStr, printE } from '../../libs/consoleUtils';
import { fetchLastNMessages, GuildSetting, fetchChannel, sendWebhookMsg, getSettings } from '../../libs/discordUtils';
import { GptFactory, History, g4fModels, OpenaiModels, G4f } from '../../libs/gptHandler';
import { openaikey } from '../../botConfig.json';
import Database from '../../libs/sqlite';
import { ScriptBuilder } from '../../libs/scripts';

export const script = new ScriptBuilder({
    name: "story",
    group: "GPT",
}).addOnSlash({
    slashDeployData: new SlashCommandBuilder()
        .setName('story')
        .setDescription('casts gpt msg')
        .addStringOption(option =>
            option.setName('promt')
                .setDescription('про что диалог прикольный будет? краткое описание')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('model')
                .setDescription('model')
                .setRequired(false)
                .addChoices(
                    ...g4fModels.map(model => ({ name: model, value: model })),
                )),
    onSlash: async (interaction) => {



        const options: any = interaction.options;
        const model: string = options.getString("model") ?? 'gpt-4-1106-preview';
        const promt: string = options.getString("promt");


        const gpt = GptFactory.create('G4f', {
            model: 'gpt-3.5-turbo'
        }) as G4f;
        // const gpt = new GPT(openaikey, 4000, model as OpenaiModels);

        if (interaction.guildId === null) {
            printE('GuildId is null');
            return;
        };


        await send(
            `## 0/2\n<a:loading:1078462597982081096>`,
            JSON.stringify(promt, null, 2),
            interaction, script.client!);


        let history: History;
        let ans: any;
        history = [{
            role: "assistant",
            content: `У меня есть идея для рассказа: ${promt}\n
Обдумай эту идею. Распиши краткий план сюжета рассказа.
Не расписывай диалоги и мелкие события, только основные этапы развития истории.
Будь остроумен!`
        }];
        ans = await gpt.requestChat(history);
        // printD(ans);

        await send(`## 1/2\n<a:loading:1078462597982081096>`, JSON.stringify(ans, null, 2), interaction, script.client!);

        history = [{
            role: "assistant",
            content: `У меня есть сюжет рассказа: ${ans}\n
Расспиши длинный сценрай театральной постановки по этому рассказу.
Отвечай json файлом такого формата:
[{"name": "Автор","text": "блаблабла"},{"name": "Андрей","text": "блаблабла"},{"name": "Майкл","text": "блаблабла"},{"name": "Андрей","text": "блаблабла"},{"name": "Симон","text": "блаблабла"}]
Имена героев понятное дело подбери сам.\n\n\n!!!Каждый герой должен вступать не меньше трёх раз!!!`
        }];
        ans = await gpt.requestChat(history);
        // printD(ans);

        // await sendWebhookMsg({
        //     client: client,
        //     webhookUrl: guildSetting.mainWebhookLink,
        //     content: content,
        //     channelId: interaction.channelId,
        //     guildId: interaction.guildId,
        //     username: model,
        //     avatarURL: client.user?.displayAvatarURL()
        // });

        await send(`## 2/2`, JSON.stringify(ans, null, 2), interaction, script.client!);

    }
})
import fs from 'fs/promises';
async function send(content: string, txt: string, interaction: CommandInteraction, client: Client) {

    // const output = content;

    const embed = new EmbedBuilder()
        // .setColor(statusInfo.color)
        .setDescription(content)

    const filename = 'output.js';
    await fs.writeFile(filename, txt, 'utf8');
    await interaction.editReply({ embeds: [embed], files: [filename] });
    await fs.unlink(filename);

}