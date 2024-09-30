export type para = 1 | 2 | 3 | 4 | 5 | 6;
export type ScheduleDayJson = {
    lesson: string,
    teacher: string,
    room: string,
    type: string,
    time: para | para[] | string,
    subgroup: subgroup
}

export type subgroup = 1 | 2 | "both";

export type AdditionalScheduleDayJson = {
    name: string,
    time: string,
    place: string
};

export type AdditionalScheduleJson = {
    [date: string]: AdditionalScheduleDayJson[]
};

export const timeSlots: { [key in para]: string } = {
    1: "8:00 - 9:30",
    2: "9:40 - 11:10",
    3: "11:20 - 12:50",
    4: "13:10 - 14:40",
    5: "14:50 - 16:20",
    6: "16:25 - 17:55"
};