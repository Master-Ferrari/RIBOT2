import { CommandInteraction, SlashCommandBuilder, Client, TextChannel, ActionRowData, MessageActionRowComponentBuilder, ButtonStyle, MessageEditOptions, InteractionResponse, InteractionUpdateOptions } from 'discord.js';
import { print, printD, printL, format, dateToStr, printE } from '../../libs/consoleUtils';
import { ScriptBuilder } from '../../libs/scripts';
import { buildComponents, buildMessage, ButtonParams, ComponentParams, Fetcher, SafeDiscord } from '../../libs/discordUtils';
import Database from '../../libs/sqlite';
import axios from 'axios';

export const script = new ScriptBuilder({
    name: "schedule",
    group: "school",
}).addOnSlash(
    {
        slashDeployData: new SlashCommandBuilder()
            .setName('schedule')
            .setDescription('its scheduling'),
        onSlash: async (interaction) => {

            const creator = new ScheduleResponder();

            const today = CustomDate.today();
            const monday = today.getWeek()[0];

            const buttonsInfo = await creator.makeBtns(today);
            const buttons = buildComponents(buttonsInfo);
            const msgInfo = buildMessage({ content: await creator.makeText(today) }, buttons);

            const reply = await SafeDiscord.do(async () => {
                return await interaction.deferReply({ ephemeral: false });
            }) as InteractionResponse;

            SafeDiscord.do(async () => {
                await reply.edit(msgInfo);
            });

            const msg = await reply.fetch();

            ScheduleMessagesDbHandler.set(msg.id, { messageId: reply.id, monday: monday.toString(), selectedDay: today.toString() });
        }
    }
)
    .addOnButton({
        isValidButtonCustomId: async (customId: string) => {
            return customId.startsWith("schedule_");
        },

        onButton: async (interaction) => {

            const creator = new ScheduleResponder();

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
            };

            await ScheduleMessagesDbHandler.edit(interaction.message.id, newData as ScheduleMessageData);

            const buttonsInfo = await creator.makeBtns(CustomDate.fromString(newData.selectedDay));
            const buttons = buildComponents(buttonsInfo);
            const msgInfo = buildMessage(
                {
                    content: await creator.makeText(CustomDate.fromString(newData.selectedDay)),
                }, buttons
            );
            interaction.update(msgInfo as InteractionUpdateOptions);
        }
    })

type para = 1 | 2 | 3 | 4 | 5 | 6;
type ScheduleDayJson = {
    lesson: string,
    teacher: string,
    room: string,
    type: string,
    time: para | para[] | string,
    subgroup: 1 | 2 | "both"
}
const timeSlots: { [key in para]: string } = {
    1: "8:00 - 9:30",
    2: "9:40 - 11:10",
    3: "11:20 - 12:50",
    4: "13:10 - 14:40",
    5: "14:50 - 16:20",
    6: "16:25 - 17:55"
};

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


class PasteBin {
    private url: string;

    constructor(url: string) {
        this.url = url;
    }

    async fetchSchedule(): Promise<ScheduleJson> {
        try {
            const response = await axios.get(this.url, { timeout: 15000 });
            const schedule: ScheduleJson = response.data;
            return schedule;
        } catch (error) {
            console.error('Ошибка при получении или десериализации расписания:', error);
            throw error;
        }
    }
}
const pasteBin = new PasteBin('https://pastebin.com/raw/CWG1sn1i');

class ScheduleResponder {

    async makeText(date: CustomDate): Promise<string> {

        const scheduleData = await pasteBin.fetchSchedule()
        const dayData = scheduleData[date.toString()];
        if (!dayData) {
            return "No data";
        }
        const out = "### " + date.toString() + "\n" +
            dayData.map(event => {
                return "- **" + event.lesson + "**" + (event.subgroup === "both" ? " `обе подгруппы`" : " `подгруппа " + event.subgroup + "`") + "\n" +
                    "> `" + formatTime(event.time) + "` " + event.teacher.toUpperCase() + " __*" + event.type + "*__ **" + event.room + "**\n";
            }).join("");

        return out;
    }

    async makeBtns(date: CustomDate): Promise<ComponentParams[][]> {

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

        const week = date.getWeek();
        // let dayIterator: CustomDate = week[0];
        printD({ "AAA": date.toString() })

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
        ];
    }
}

type ScheduleMessageData = {
    monday: string;
    selectedDay: string;
    messageId: string;
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

class CustomDate {
    private date: Date;

    constructor(date: Date) {
        this.date = date;
    }

    shift(delta: number): void {
        const currentDate = this.date.getDate();
        this.date.setDate(currentDate + delta);
    }

    getDate(): number {
        return this.date.getDate();
    }

    getDay(): number {
        const day = this.date.getDay();
        return day === 0 ? 7 : day;
    }

    getFullYear(): number {
        return this.date.getFullYear();
    }

    getMonth(): number {
        return this.date.getMonth() + 1;
    }

    toString(): string {
        const day = this.date.getUTCDate().toString().padStart(2, '0');
        const month = (this.date.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = this.date.getUTCFullYear().toString();
        return `${day}-${month}-${year}`;
    }


    static today(): CustomDate {
        const now = new Date();
        now.setUTCHours(0, 0, 0, 0);
        return new CustomDate(now);
    }


    static fromString(dateString: string): CustomDate {
        const [day, month, year] = dateString.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return new CustomDate(date);
    }


    private getMonday(): CustomDate {
        const dayOfWeek = this.date.getDay();
        const diff = this.date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(this.date);
        monday.setDate(diff);
        return new CustomDate(monday);
    }

    getWeek(): CustomDate[] {
        const week: CustomDate[] = [];
        let currentDay = this.getMonday();

        for (let i = 0; i < 7; i++) {
            week.push(new CustomDate(new Date(currentDay.date)));
            currentDay.shift(1);
        }

        return week;
    }

    getWeekDayName(full: boolean = false): string {
        const daysOfWeek = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
        const daysOfWeekFull = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

        if (full) {
            return daysOfWeekFull[this.date.getDay()];
        } else {
            return daysOfWeek[this.date.getDay()];
        }
    }

    setDayOfWeek(targetDay: number): void {
        const currentDay = this.getDay(); // текущий день недели (1-7)
        const delta = targetDay - currentDay; // разница между текущим и целевым днём
        this.shift(delta); // сдвигаем дату на эту разницу
    }
}

