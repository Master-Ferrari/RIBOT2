import { CommandInteraction, SlashCommandBuilder, Client, TextChannel, ActionRowData, MessageActionRowComponentBuilder, ButtonStyle, MessageEditOptions, InteractionResponse, InteractionUpdateOptions } from 'discord.js';
import { print, printD, printL, format, dateToStr, printE } from '../../libs/consoleUtils';
import { ScriptBuilder } from '../../libs/scripts';
import { buildComponents, buildMessage, ButtonParams, ComponentParams, Fetcher, SafeDiscord, StringSelectParams } from '../../libs/discordUtils';
import Database from '../../libs/sqlite';
import { PasteBin } from '../../libs/pastebin';

import { myId } from './../../botConfig.json';
import { CustomDate } from './customDate';
import { AdditionalScheduleDayJson, AdditionalScheduleJson, para, ScheduleDayJson, subgroup, timeSlots } from './types';
import { CustomTime } from './customTime';

export const script = new ScriptBuilder({
    name: "schedule",
    group: "school",
}).addOnSlash(
    {
        slashDeployData: new SlashCommandBuilder()
            .setName('schedule')
            .setDescription('its scheduling'),
        onSlash: async (interaction) => {

            const itIsMe = interaction.user.id == myId;
            const creator = new ScheduleResponder();

            const today = CustomDate.today();
            const monday = today.getWeek()[0];

            const buttonsInfo = await creator.makeBtns(today, "both");
            const buttons = buildComponents(buttonsInfo);

            const textPromise = creator.makeText(today, itIsMe, "both");

            const reply = await SafeDiscord.do(async () => {
                return await interaction.deferReply({ ephemeral: false });
            }) as InteractionResponse;

            const msgInfo = buildMessage({ content: await textPromise }, buttons);

            SafeDiscord.do(async () => {
                await reply.edit(msgInfo);
            });

            const msg = await reply.fetch();

            ScheduleMessagesDbHandler.set(msg.id, { messageId: reply.id, monday: monday.toString(), selectedDay: today.toString(), selectedGroup: "both" });
        }
    }
).addOnButton({
    isValidButtonCustomId: async (customId: string) => {
        return customId.startsWith("schedule_");
    },

    onButton: async (interaction) => {

        const creator = new ScheduleResponder();
        const itIsMe = interaction.user.id == myId;

        const data = await ScheduleMessagesDbHandler.load(interaction.message.id);
        if (!data) {
            printE("SCHEDULE: No data " + interaction.message.id);
            return;
        }

        const selected: CustomDate = CustomDate.fromString(data.selectedDay);
        const monday: CustomDate = CustomDate.fromString(data.monday);

        if (interaction.customId == "schedule_left") {
            selected.shift(-7);
            monday.shift(-7);
        }
        else if (interaction.customId == "schedule_right") {
            selected.shift(7);
            monday.shift(7);
        }
        else if (interaction.customId.startsWith("schedule_")) {
            selected.setDayOfWeek(Number(interaction.customId.replace("schedule_", "")));
        }

        const newData: ScheduleMessageData = {
            messageId: data.messageId,
            monday: monday.toString(),
            selectedDay: selected.toString(),
            selectedGroup: data.selectedGroup
        };

        await ScheduleMessagesDbHandler.edit(interaction.message.id, newData as ScheduleMessageData);

        const buttonsInfo = await creator.makeBtns(CustomDate.fromString(newData.selectedDay), newData.selectedGroup);
        const buttons = buildComponents(buttonsInfo);
        const msgInfo = buildMessage(
            {
                content: await creator.makeText(CustomDate.fromString(newData.selectedDay), itIsMe, newData.selectedGroup),
            }, buttons
        );
        interaction.update(msgInfo as InteractionUpdateOptions);
    }
}).addOnSelectMenu({
    isValidSelectMenuCustomId: async (customId: string) => {
        return customId.startsWith("schedule_");
    },

    onSelectMenu: async (interaction) => {
        if (interaction.customId == "schedule_group") {

            const creator = new ScheduleResponder();
            const itIsMe = interaction.user.id == myId;

            const data = await ScheduleMessagesDbHandler.load(interaction.message.id);
            if (!data) {
                printE("SCHEDULE: No data " + interaction.message.id);
                return;
            }

            function toGroup(value: string): subgroup {
                switch (value) {
                    case "1":
                        return 1;
                    case "2":
                        return 2;
                    default:
                        return "both";
                }
            }

            const newData: ScheduleMessageData = {
                ...data,
                selectedGroup: toGroup(interaction.values[0])
            };

            await ScheduleMessagesDbHandler.edit(interaction.message.id, newData as ScheduleMessageData);

            const buttonsInfo = await creator.makeBtns(CustomDate.fromString(newData.selectedDay), newData.selectedGroup);
            const buttons = buildComponents(buttonsInfo);
            const msgInfo = buildMessage(
                {
                    content: await creator.makeText(CustomDate.fromString(newData.selectedDay), itIsMe, newData.selectedGroup),
                }, buttons
            );
            interaction.update(msgInfo as InteractionUpdateOptions);

        }
    }
})

type ScheduleJson = {
    [date: string]: ScheduleDayJson[]
}
function formatTime(time: para | para[] | string): string {
    if (typeof time === "string") {
        return time;
    }

    if (typeof time === "number") {
        return timeSlots[time];
    }

    const mergedTimes: string[] = [];
    let start = time[0];
    let end = start;

    for (let i = 1; i < time.length; i++) {
        if (time[i] === end + 1) {
            end = time[i];
        } else {
            mergedTimes.push(`${timeSlots[start].split(" - ")[0]} - ${timeSlots[end].split(" - ")[1]}`);
            start = time[i];
            end = start;
        }
    }

    mergedTimes.push(`${timeSlots[start].split(" - ")[0]} - ${timeSlots[end].split(" - ")[1]}`);

    return mergedTimes.join(", ");
}

const pasteBinMain = new PasteBin('https://pastebin.com/raw/CWG1sn1i');
const pasteBinAdditional = new PasteBin('https://pastebin.com/raw/u1aP9P2R');

class ScheduleResponder {

    filterGroups(dayData: ScheduleDayJson[], group: subgroup): ScheduleDayJson[] | null {
        if (!dayData || dayData.length == 0) {
            return null;
        }
        const out = dayData.filter(x => x.subgroup == group || x.subgroup == "both" || group == "both");
        if (out.length == 0) {
            return null;
        }
        return out;
    }

    getFirstTime(dayData?: ScheduleDayJson[] | null, additionalData?: AdditionalScheduleDayJson[] | null): CustomTime | null {

        let outTime: CustomTime | null = null;

        if (dayData && dayData.length > 0) {
            outTime = CustomTime.fromString(dayData[0].time);
        }

        if (additionalData && additionalData.length > 0) {
            const additionalTime = CustomTime.fromString(additionalData[0].time);
            if (outTime) {
                outTime.getMin(additionalTime);
            } else {
                outTime = additionalTime;
            }
        }

        return outTime;
    }


    async makeText(date: CustomDate, itIsMe: boolean, subgroup: subgroup): Promise<string> {

        const scheduleData = await pasteBinMain.fetch<ScheduleJson>();
        let dayData = this.filterGroups(scheduleData[date.toString()], subgroup);
        // if (dayData.length == 0) {
        //     dayData = null;
        // }
        // if (!dayData) {
        //     return "No data";
        // }
        const AdditionalScheduleData = itIsMe ? await pasteBinAdditional.fetch<AdditionalScheduleJson>() : undefined;
        const additionalData = AdditionalScheduleData ? AdditionalScheduleData[date.toString()] : undefined;

        let out = "";

        if (itIsMe) {
            // const dayData = (await pasteBinAdditional.fetch<AdditionalScheduleJson>())[date.toString()];
            // if (!dayData) {
            //     return out;
            // }
            // printD({ dayData })
            if (dayData) {
                const time = this.getFirstTime(dayData, additionalData);

                if (time) {
                    out += "# ПРИВЕТ)\n"
                    out += "> `" + time.shift("-1:30").toString() + "` просыпаемся (Волжский)\n";
                    out += "> `" + time.shift("0:30").toString() + "` заканчиваем чо делали\n";
                    out += "> `" + time.shift("0:15").toString() + "` собираемсяяя\n";
                    out += "> `" + time.shift("0:15").toString() + "` выходим\n";
                    out += "> `" + time.shift("0:30").toString() + "` начало занятий\n";
                }
            }
        }

        if (itIsMe) out += "# ЗАНЯТИЯ\n";
        if (dayData) {
            out += dayData.map(event => {
                return "- **" + event.lesson + "**" + (event.subgroup === "both" ? " `обе подгруппы`" : " `подгруппа " + event.subgroup + "`") + "\n"
                    + "> `" + formatTime(event.time) + "` " + event.teacher.toUpperCase() + " __*" + event.type + "*__ **" + event.room + "**\n";
            }).join("");
        } else {
            out += "Нет данных\n";
        }



        if (itIsMe) {
            // const dayData = (await pasteBinAdditional.fetch<AdditionalScheduleJson>())[date.toString()];
            // if (!dayData) {
            //     return out;
            // }
            if (additionalData) {
                out += "# ДОПЫ\n" 
                // printD({ dayData })
                out += additionalData.map(event => {
                    return "- **" + event.name + "**\n"
                        + "> `" + event.time + "` **" + event.place + "**\n";
                }).join("");
            }
            const tomorrowDate = CustomDate.fromString(date.toString());
            tomorrowDate.shift(1);
            const tomorrowData = scheduleData[tomorrowDate.toString()];
            if (tomorrowData) {

                const tomorrowData = this.filterGroups(scheduleData[tomorrowDate.toString()], subgroup);
                const tomorrowAdditionalData = AdditionalScheduleData ? AdditionalScheduleData[tomorrowDate.toString()] : undefined;

                const time = this.getFirstTime(tomorrowData, tomorrowAdditionalData);
                // printD({ tomorrowData, tomorrowAdditionalData });

                // printD({ "первое занятие завтра: ": time.toString() });

                // printD({ time: time.toString() });
                if (time) {
                    out += "# БАИ\n"
                    out += "> `" + time.shift("-10:00").toString() + "` готовимся\n";
                    out += "> `" + time.shift("1:00").toString() + "` засыпаем\n";
                }
            }
        }

        out += "### (" + date.toLongString() + ")\n";

        return out;
    }

    async makeBtns(date: CustomDate, selectedGroup: subgroup): Promise<ComponentParams[][]> {

        const leftBtn: ButtonParams = {
            type: 2,
            customId: "schedule_left",
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: "<:previous:1196070253923405864>",
            label: undefined,
        };

        const rightBtn: ButtonParams = {
            type: 2,
            customId: "schedule_right",
            style: ButtonStyle.Secondary,
            disabled: false,
            emoji: "<:next:1196070255836012544>",
            label: undefined,
        };

        function group(): StringSelectParams {

            const groupString = selectedGroup === 1 ? "первая подгруппа" : selectedGroup === 2 ? "вторая подгруппа" : "все подгруппы";

            return {
                type: 3,
                customId: "schedule_group",
                disabled: false,
                placeholder: groupString,
                options: [
                    { label: "первая подгруппа", value: "1" },
                    { label: "вторая подгруппа", value: "2" },
                    { label: "все подгруппы", value: "both" },
                ]
            } as StringSelectParams
        };

        const week = date.getWeek();
        // let dayIterator: CustomDate = week[0];
        // printD({ "AAA": date.toString() })

        const daysButtons = week.map(day => {

            // dayIterator.shift(1); // Смещаем день

            const button: ButtonParams = {
                type: 2,
                customId: "schedule_" + day.getDay(),
                style: day.toString() === date.toString() ? ButtonStyle.Primary : (day.toString() === CustomDate.today().toString() ? ButtonStyle.Success : ButtonStyle.Secondary),
                disabled: false,
                emoji: undefined,
                label: String(day.getDate() + " " + day.getWeekDayName()),
            };
            return button;
        });

        return [
            [daysButtons[0], daysButtons[1], daysButtons[2]],
            [daysButtons[3], daysButtons[4], daysButtons[5]],
            [leftBtn, daysButtons[6], rightBtn],
            [group()]
        ];
    }
}

type ScheduleMessageData = {
    monday: string;
    selectedDay: string;
    messageId: string;
    selectedGroup: subgroup;
}

class ScheduleMessagesDbHandler {
    private static ScheduleMessagesTableName = 'scheduleMessages';
    private static _db: string = 'database.db';

    static async load(messageId: string): Promise<ScheduleMessageData | null> {
        const data = await Database.interact(this._db, async (db) => {
            return await db.getJSON(this.ScheduleMessagesTableName, messageId) as ScheduleMessageData | null;
        }) as ScheduleMessageData | null;
        if (!data) {
            printE(`GptDb: cannot load data for ${messageId}`);
            return null;
        }

        data.selectedGroup = data.selectedGroup || "both";

        return data;
    }

    static async set(messageId: string, data: ScheduleMessageData): Promise<ScheduleMessageData> {
        await Database.interact(this._db, async (db) => {
            await db.setJSON(this.ScheduleMessagesTableName, messageId, data);
        });
        return data;
    }

    static async edit(messageId: string, data: Partial<ScheduleMessageData>): Promise<ScheduleMessageData> {
        const json = await this.load(messageId) as ScheduleMessageData;
        const newData = {
            ...json,
            ...data
        };

        await Database.interact(this._db, async (db) => {
            await db.setJSON(this.ScheduleMessagesTableName, messageId, newData);
        });
        return newData;
    }
}



