import { Events, GatewayIntentBits, ChannelType, SlashCommandBuilder, Message, Guild } from 'discord.js';
// import { token2 } from '../config.json';
import * as fs from 'fs';
// import { dateToStr } from '../lib/stuff';
import { printL, printE, dateToStr, format } from '../../lib/consoleUtils';
import { fetchGuild } from '../../lib/discordUtils';

import { blacklist } from './gifLolList.json';

const imageDirectory = 'C:\\Users\\Pecarnya-REREMASTER\\YandexDisk\\_active\\_4\\dis5\\spaceCringe';

interface BlackList {
    [key: string]: string;
}

export const command = {

    info: {
        type: "startup",
    },
    data: {
        name: 'gif lol',
    },
    async onStart(client: any, guilds: Array<string>) {
        client.on('messageCreate', async (message: Message) => {

            if (!guilds.find(guild => guild === message.guildId)) return;

            const guild: Guild | undefined = await fetchGuild(client, message.guildId ?? "");
            if (!guild) return;


            let msgContent = "";
            if (message.attachments.size > 0) {
                message.attachments.forEach((attachment: any) => {
                    msgContent += attachment.name;
                });
            }
            msgContent += message.content;

            if (isGif(msgContent)) {
                if (isGifed(message.author.id + "-" + guild.id)) {
                    // printL("тут гифка! " + message.author.username + " в " + message.guild.name
                    //     + "\n\"" + message.content + "\"", "cyan");

                    printL(format("тут гифка! " + message.author.username + " в " + guild.name
                        + "\n\"" + message.content + "\""
                        , { foreground: 'cyan' }));

                    const count = isCalledMoreThanThreeTimesInTwoMinutes();

                    printL("Gif Counter: " + count);

                    if (count === 1) {
                        printL("💢" + dateToStr(new Date(), "timeStamp"));
                        message.react('💢');
                    } else {
                        if (count < 4) {
                            const files = fs.readdirSync(imageDirectory);

                            const randomIndex = Math.floor(Math.random() * files.length);
                            const randomImageFile = files[randomIndex];

                            const imagePath = `${imageDirectory}/${randomImageFile}`;

                            message.channel.send({
                                files: [imagePath],
                            });
                        } else {
                            message.channel.send('https://media.tenor.com/44fPZetiy5oAAAAd/skrillex-babushka.gif');
                            if (count > 10) {
                                message.channel.send('ух бля');
                                for (let i = 0; i < 4; i++) {
                                    message.channel.send('https://media.tenor.com/44fPZetiy5oAAAAd/skrillex-babushka.gif');
                                }
                            }
                        }
                    }
                } else {
                    printL("👍" + dateToStr(new Date(), "timeStamp"));
                    message.react('👍');
                }
            }
        });

        // client.login(token2);
    }
};

function isGifed(value: string): boolean {
    return Object.values(blacklist).includes(value);
}

function isGif(text: string): boolean {
    if (!text) return false;
    const lowerText = text.toLowerCase();

    return lowerText.includes('tenor') || lowerText.includes('gif');
}

let callTimestamps: number[] = [];

function isCalledMoreThanThreeTimesInTwoMinutes(): number {
    const now = Date.now();
    while (callTimestamps.length > 0 && now - callTimestamps[0] >= 6 * 60 * 60 * 1000) {
        callTimestamps.shift();
    }

    callTimestamps.push(now);

    return callTimestamps.length;
}
