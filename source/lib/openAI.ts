import axios from 'axios';
import { printE } from './../lib/consoleUtils';

type ModelVersions = 'gpt-3.5-turbo-1106' | 'gpt-4-1106-preview';

type ImageContent = { image: string };
type TextContent = string;
type MessageContent = TextContent | ImageContent | (TextContent | ImageContent)[];
type Message = { role: 'user' | 'assistant', content: MessageContent };
type History = Message[];

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

    async request(history: History, response_format: 'json' | 'text' = 'text'): Promise<any> {
        try {
            const payload = {
                model: this.model,
                messages: history,
                max_tokens: this.tokens,
                temperature: this.temperature
            };

            const headers = { headers: { 'Authorization': `Bearer ${this.apiKey}` } };

            const response = await axios.post(this.apiEndpoints, payload, headers);

            return response_format === 'json' ? response.data : response.data.choices[0].message.content;
        } catch (error) {
            printE(error);
            return String(error);
        }
    }
}

export { GPT, History, Message };
