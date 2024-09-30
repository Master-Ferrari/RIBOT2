export class CustomDate {
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

    toLongString(): string {
        const months = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];

        const day = this.getDate();
        const month = months[this.date.getMonth()]; // getMonth возвращает индекс месяца 0-11
        const year = this.getFullYear();

        return `${day} ${month}, ${year}`;
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

