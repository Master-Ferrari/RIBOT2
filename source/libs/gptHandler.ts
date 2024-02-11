import axios from 'axios';
import { printD, printE } from './consoleUtils';

export const gptModels = ['gpt-3.5-turbo-1106', 'gpt-4-1106-preview'];
export type ModelVersions = 'gpt-3.5-turbo-1106' | 'gpt-4-1106-preview';


type ImageContent = { image: string };
type TextContent = string;
type MessageContent = TextContent | ImageContent | (TextContent | ImageContent)[];
type Message = { role: 'user' | 'assistant' | 'system', content: MessageContent };
type History = Message[];

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

type requestOptions = {
    format: 'json_object' | 'text';
    formatting: 'raw' | 'simplify';
}


class GPT {
    private apiKey: string;
    private tokens: number;
    private apiEndpoints: string = 'https://api.openai.com/v1/chat/completions';
    private model: string;
    private temperature: number;

    constructor(apiKey: string, tokens: number, model: ModelVersions, temperature: number = 0.7) {
        this.apiKey = apiKey;
        this.tokens = tokens;
        this.model = model;
        this.temperature = temperature;
    }

    async request(history: History, requestOptions: requestOptions = { format: 'text', formatting: 'simplify' }): Promise<ChatResponse | string> {

        let response: ChatResponse | string = '';

        try {
            const payload = {
                model: this.model,
                messages: history,
                max_tokens: this.tokens,
                temperature: this.temperature,
                response_format: { type: requestOptions.format },
            };

            const headers = { headers: { 'Authorization': `Bearer ${this.apiKey}` } };

            response = await axios.post(this.apiEndpoints, payload, headers) as ChatResponse;

            if (requestOptions.formatting === 'simplify') {
                if (requestOptions.format === 'json_object') {
                    response = JSON.parse(response.data.choices[0].message.content);
                }
                else {
                    response = response.data.choices[0].message.content;
                }
            }


        } catch (error) {
            printE(error);
            response = String(error);
            if (response.includes("403")) response += "\nвпн включить забыл наверно";
        }

        return response;
    }
}

export { GPT, History, Message, ChatResponse };
