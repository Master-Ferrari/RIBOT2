import { para } from "./types";

export class CustomTime {
    private minutes: number; // minutes from midnight

    constructor(minutes: number) {
        this.minutes = minutes;
    }

    static fromString(value: para | para[] | string): CustomTime {
        if (typeof value === 'number') {
            // para
            const timeStr = CustomTime.timeSlots[value];
            const minutes = CustomTime.parseTimeString(timeStr);
            return new CustomTime(minutes);
        } else if (Array.isArray(value)) {
            // para[]
            const times = value.map(v => {
                const timeStr = CustomTime.timeSlots[v];
                return CustomTime.parseTimeString(timeStr);
            });
            const earliestMinutes = Math.min(...times);
            return new CustomTime(earliestMinutes);
        } else if (typeof value === 'string') {
            // string
            const minutes = CustomTime.parseTimeString(value);
            return new CustomTime(minutes);
        } else {
            throw new Error("Invalid input");
        }
    }
    
    getMin(other: CustomTime): number {
        this.minutes = Math.min(this.minutes, other.minutes);
        return this.minutes;
    }

    toString(): string {
        return CustomTime.minutesToTimeString(this.minutes);
    }

    shift(delta: string): this {
        const deltaMinutes = CustomTime.parseDelta(delta);
        this.minutes = (this.minutes + deltaMinutes) % (24 * 60);
        if (this.minutes < 0) this.minutes += 24 * 60;
        return this; // Возвращаем текущий объект для поддержки чейнинга (если требуется)
    }    

    // Private helper methods
    private static parseTimeString(timeStr: string): number {
        // timeStr could be "8:00" or "8:00 - 9:30"
        // We need to extract the first time "8:00" and parse it into minutes
        const timePart = timeStr.split('-')[0].trim(); // get "8:00"
        const [hours, minutes] = timePart.split(':').map(Number);
        return hours * 60 + minutes;
    }

    private static minutesToTimeString(minutes: number): string {
        let hrs = Math.floor(minutes / 60) % 24;
        let mins = minutes % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    private static parseDelta(delta: string): number {
        // delta is string like "-10:00" or "1:30"
        // Need to handle negative numbers
        const negative = delta.startsWith('-');
        const deltaStr = negative ? delta.slice(1) : delta;
        const [hours, minutes] = deltaStr.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        return negative ? -totalMinutes : totalMinutes;
    }

    // Time slots mapping
    private static timeSlots: { [key in para]: string } = {
        1: "8:00 - 9:30",
        2: "9:40 - 11:10",
        3: "11:20 - 12:50",
        4: "13:10 - 14:40",
        5: "14:50 - 16:20",
        6: "16:25 - 17:55"
    };
}

