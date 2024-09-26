import axios from "axios";

export class PasteBin {
    private url: string;

    constructor(url: string) {
        this.url = url;
    }

    async fetch<T>(): Promise<T> {
        try {
            const response = await axios.get(this.url, { timeout: 15000 });
            const schedule: T = response.data;
            return schedule;
        } catch (error) {
            console.error('PasteBin Error:', error);
            throw error;
        }
    }
}