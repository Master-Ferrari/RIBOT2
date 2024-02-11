import { CommandInteraction, SlashCommandBuilder, Client, TextChannel, ChannelType } from 'discord.js';
import { print, printD, printL, format, dateToStr } from '../../libs/consoleUtils';
import { ScriptBuilder } from '../../libs/scripts';
import { Fetcher, updateReactions, wait } from '../../libs/discordUtils';

export const script = new ScriptBuilder({
    name: "threader",
    group: "custom",
}).addOnMessage({
    onMessage: async (message) => {
        const channelConfig = channels.find(c => c.channelId === message.channelId);

        if (channelConfig && channelConfig.threadUsers.includes(message.author.id)) {
            if (!message.hasThread) await message.startThread({ name: message.author.username, autoArchiveDuration: 60 });
            if (message.hasThread) await message.thread?.setArchived(true);
            return;
        }

        if (channelConfig && !channelConfig.freeUsers.includes(message.author.id) && !message.system) {

            const reply = await message.reply({ content: "## удаляем\n||используй треды||" });
            const countdownEmojis = ['🔟', '9️⃣', '8️⃣', '7️⃣', '6️⃣', '5️⃣', '4️⃣', '3️⃣', '2️⃣', '1️⃣', '☮️'];
            for (const emoji of countdownEmojis) {
                await updateReactions({ reactions: ['☠️', emoji], msg: reply, client: script.client! });
                await wait(300);
            }
            print(format("удалил)\n" + message.author + ": " + message.content + " " + message.attachments.map(a => a.url).join(" "), { bold: true, foreground: 'green' }));
            reply.delete();
            message.delete();
            return;
        }
    }
});


const channels: restrictedChannel[] = [
    {
        channelId: "1175235566044987583",//эвенты
        freeUsers: ["902679422618963988", "1118701384771043389"],//вебхук
        threadUsers: []
    },
    {
        channelId: "1188583408339792012",//саша
        freeUsers: ["1118701384771043389"],//рибот
        threadUsers: ["286231752723267585"]//гофа
    }
]

interface restrictedChannel {
    channelId: string,
    freeUsers: string[],
    threadUsers: string[]
}