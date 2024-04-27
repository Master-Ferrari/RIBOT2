import axios from 'axios';
import { printD, printE, print } from './consoleUtils';
import { wait } from './discordUtils';

import { G4F as G4F_, chunkProcessor } from "g4f";
const g4f = new G4F_();

const methods = ["Gpt4Free", "OpenAI"];
export type Method = typeof methods[number];

export const openaiModels = ['gpt-3.5-turbo-1106', 'gpt-4-1106-preview'];
export type OpenaiModels = typeof openaiModels[number];

export const g4fModels = ['gpt-4-32k', 'gpt-3.5-turbo-16k'];
export type G4fModels = typeof openaiModels[number];

export const allModels: Record<Method, string[]> = {"OpenAI": openaiModels, "Gpt4Free": g4fModels};
export type AllModels = OpenaiModels | G4fModels;

export type Message = { role: 'user' | 'assistant' | 'system', content: MessageContent };
export type History = Message[];

interface IGpt {
    requestChat: (
        history: History,
        retry?: number,
        check?: (arg: any) => boolean
    ) => Promise<any | string>;
    requestJson: (
        history: History,
        structure: any,
        retry?: number,
        check?: (arg: any) => boolean
    ) => Promise<any>;
    requestStream: (
        history: History,
        chunkSize: number,
        period: number,
        callback: (response: string) => Promise<void>
    ) => Promise<void>;
    models: string[];
}

class Gpt {

    async retry(count: number, fn: () => Promise<any>, check: (arg: any) => boolean): Promise<any> {
        for (let i = 0; i < count; i++) {
            try {
                const ans = await fn();
                if (check(ans)) return ans;
            } catch (e) {
                printE(e)
                if (i === count - 1) {
                    return { ans: '```' + String(e) + '```' };
                }
            }
        }

    }

    checkJson(obj: any, structure: any): any | undefined {
        if (typeof obj !== typeof structure) {
            return false;
        }
        if (typeof structure === 'object' && !Array.isArray(structure) && structure !== null) {
            for (const key in structure) {
                if (!this.checkJson(obj[key], structure[key])) {
                    return false;
                }
            }
        }
        return true;
    }
}

type ImageContent = { image: string };
type TextContent = string;
export type MessageContent = TextContent | ImageContent | (TextContent | ImageContent)[];

type ChatResponse = {
    status: Number;
    statusText: string,
    data: {
        choices: Array<{
            index: number;
            message: {
                role: string;
                content: string;
            };
            logprobs: null | any;
            finish_reason: string;
        }>;
    }
};

type OpenAICreateParams = {
    apiKey: string, tokens: number, model: OpenaiModels, temperature: number
}

type G4FCreateParams = {
    model: G4fModels
}

type CreateParams = OpenAICreateParams | G4FCreateParams

type TranslatedText = {
    source: {
        code: string;
        lang: string;
    };
    target: {
        code: string;
        lang: string;
    };
    translation: {
        parts?: {
            result: string;
        }[];
        result: string;
    };
};


export class Openai extends Gpt implements IGpt {
    private apiKey: string;
    private tokens: number;
    private apiEndpoint: string = 'https://api.openai.com/v1/chat/completions';
    private model: string;
    private temperature: number;
    get models() { return openaiModels }

    constructor(apiKey: string, tokens: number, model: OpenaiModels, temperature: number = 0.7) {
        super();
        this.apiKey = apiKey;
        this.tokens = tokens;
        this.model = model;
        this.temperature = temperature;
    }

    private async request(
        history: History,
        format: "json_object" | "text",
        stream: boolean = false,
        callback?: (response: string) => Promise<void>
    ): Promise<any | string> {

        const payload = {
            model: this.model,
            messages: history,
            max_tokens: this.tokens,
            temperature: this.temperature,
            response_format: { type: format },
        };

        try {
            const headers = { headers: { 'Authorization': `Bearer ${this.apiKey}` } };

            if (!stream) {
                const response = await axios.post(this.apiEndpoint, payload, headers) as ChatResponse;

                if (format === 'json_object') {
                    return JSON.parse(response.data.choices[0].message.content);
                } else {
                    return response.data.choices[0].message.content;
                }
            } else {
                const response = await axios.post(this.apiEndpoint, payload, headers);
                for (const chunk of response.data) {
                    callback?.(chunk.choices[0].delta.content);
                }
            }

        } catch (error) {
            printE(error);
            let response = String(error);
            if (response.includes("403")) response += "\nError: bot owner forgot his VPN";
            if (response.includes("429")) response += "\nError: tokens have run out";
            return response;
        }
    }

    async requestChat(history: History, retry: number = 1, check: (arg: any) => boolean = () => true): Promise<any | string> {
        return await this.retry(retry, async () => await this.request(history, 'text'), (a) => check(a));
    }

    async requestJson(history: History, structure: any, retry: number = 3, check: (arg: any) => boolean = () => true): Promise<any> {
        return await this.retry(retry, async () => JSON.parse(await this.request(history, 'json_object')), (a) => {
            return (this.checkJson(a, structure) == true) && check(a);
        });
    }

    async requestStream(history: History, chunkSize: number, period: number, callback: (response: string) => Promise<void>) {
        return await this.request(history, 'text', true, callback);
    }

}


export class G4f extends Gpt implements IGpt {
    get models() { return g4fModels }
    private model: string;
    constructor(model: G4fModels) {
        super();
        this.model = model;
    }

    async requestChat(history: History, retry: number = 1, check: (arg: any) => boolean = () => true): Promise<any | string> {
        return await this.retry(retry, async () => await g4f.chatCompletion(history as any, { model: this.model }), (a) => check(a))
    }

    async requestJson(history: History, structure: any, retry: number = 3, check: (arg: any) => boolean = () => true): Promise<any | string> {
        return await this.retry(
            retry,
            async () => JSON.parse(await g4f.chatCompletion(history as any, { model: this.model })),
            (a) => { return (this.checkJson(a, structure) == true) && check(a); }
        )
    }

    async requestStream(history: History, chunkSize: number, period: number, callback: (response: string) => Promise<void>) {
        const response = await g4f.chatCompletion(history as any, {
            model: this.model,
            stream: true,
            chunkSize: chunkSize
        });

        for await (const chunk of chunkProcessor(response)) {
            const startTime = Date.now();
            await callback((chunk as string));
            const endTime = Date.now();
            const elapsed = endTime - startTime;
            if (elapsed < period) {
                await wait(period - elapsed);
            }
        }
    }

    async requestTranslation(source: string, target: string, inputString: string, retry: number = 3, check: (arg: any) => boolean = () => true): Promise<any | string> {
        return await this.retry(
            retry,
            (async () => (await g4f.translation({ source: source, target: target, text: inputString }) as any as TranslatedText).translation.result),
            (a) => { return check(a); }
        )
    }
}

export class GptFactory {
    static create(api: Method, params_: CreateParams): IGpt {
        if (api === "OpenAI") {
            if (!this.OpenAICreateParamsGuard(params_)) {
                throw new Error("type error. OpenAICreateParams");
            }
            const params = (params_ as OpenAICreateParams);
            return new Openai(params.apiKey, params.tokens, params.model, params.temperature);
        } else if (api === "Gpt4Free") {
            if (!this.G4FCreateParamsGuard(params_)) {
                throw new Error("type error. G4FCreateParams");
            }
            const params = (params_ as G4FCreateParams);
            return new G4f(params.model);
        } else {
            throw new Error("unknown api type");
        }
    }

    private static OpenAICreateParamsGuard(arg: CreateParams): boolean {
        const param = arg as OpenAICreateParams;
        if ((param.apiKey == undefined) || (param.tokens == undefined) || (param.model == undefined) || (param.temperature == undefined)) {
            return false;
        }
        return true;
    }
    private static G4FCreateParamsGuard(arg: CreateParams): boolean {
        const param = arg as G4FCreateParams;
        if ((param.model == undefined)) {
            return false;
        }
        return true;
    }
}