import { print, printD, printE, format, dateToStr } from './consoleUtils';
import path from 'path';
import fs from 'fs';

type SendOptions = {
    voice?: string,
    onWav: (data: string) => any,
    text: string
}


export interface ITTS {
    send({ voice, onWav, text }: SendOptions): void;
    close(): void;
    outputPath: string;
    readonly voices: readonly string[];
}


import { PythonCommunicator } from './pythonHandler';

export class CoquiTTS implements ITTS {

    public voices: Array<string>;
    public outputPath: string = path.join(__dirname, '../../output.wav');

    private static instance: CoquiTTS;
    private script: any;
    private voicesPath: string = path.join(__dirname, '../../../TTS4/misc/');
    private scriptsPath: string = path.join(__dirname, '../../../TTS4/test.py');
    private callQueue: Array<{ prompt: string, voice: string, onWav: (data: string) => any }> = [];
    private isProcessing: boolean = false;

    public static getInstance(): CoquiTTS {
        if (!CoquiTTS.instance) {
            CoquiTTS.instance = new CoquiTTS();
        }
        return CoquiTTS.instance;
    }

    close() {
        this.script.close();
    }

    private constructor() {
        this.voices = fs.readdirSync(this.voicesPath).map(file => path.basename(file, '.wav'));
        this.script = new PythonCommunicator(this.scriptsPath, {
            onData: async (data) => {
                if (data.includes('one')) {
                    const currentCall = this.callQueue.shift();
                    if (currentCall) {
                        currentCall.onWav(data);
                        this.processNextCall();
                    }
                }
            },
            onError: (error) => {
                printE(error);
                this.close();
            }
        });
        print(format('TTS initialized', { foreground: 'white', background: 'green', formatting: 'bold' }));
    }

    send({ voice, onWav, text: prompt }: SendOptions) {
        if (!voice) voice = 'дамочка'; //this.voices[Math.floor(Math.random() * this.voices.length)]
        this.callQueue.push({ prompt, voice, onWav });
        if (!this.isProcessing) {
            this.processNextCall();
        }
    }

    private processNextCall() {
        if (this.callQueue.length > 0) {
            const { prompt, voice } = this.callQueue[0];
            this.isProcessing = true;
            const args = JSON.stringify({ prompt, voice });
            // printD({ args });
            this.script.send(args);
        } else {
            this.isProcessing = false;
        }
    }

}




import { OpenAI } from 'openai';
import { openaikey } from '../botConfig.json';

type ReadonlyArray<T> = readonly T[];
export const voicesOpenAI = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
type VoicesOpenAI = typeof voicesOpenAI[number];


export class OpenaiTTS implements ITTS {

    public voices = voicesOpenAI;
    public outputPath: string = path.join(__dirname, '../../speech.mp3');

    private static instance: OpenaiTTS | null = null;
    private fileName = "./speech.mp3";
    private openai: OpenAI;

    private constructor() {
        this.openai = new OpenAI({
            apiKey: openaikey
        });
    }

    public static getInstance(): OpenaiTTS {
        if (!OpenaiTTS.instance) {
            OpenaiTTS.instance = new OpenaiTTS();
        }
        return OpenaiTTS.instance;
    }

    public async send({ voice = 'nova', onWav, text: prompt }: SendOptions): Promise<void> {
        try {
            const mp3 = await this.openai.audio.speech.create({
                model: "tts-1",
                voice: voice as VoicesOpenAI,
                speed: Number('0.9'),
                input: prompt,
            });
            const buffer = Buffer.from(await mp3.arrayBuffer());
            await fs.promises.writeFile(this.outputPath, buffer);

            onWav(this.fileName);
        }
        catch (error) {
            console.error('Error in send function:', error);
        }
    }

    public close(): void {
        OpenaiTTS.instance = null;
    }
}

export class TTSFactory {
    static createTTS(voice: string = 'nova'): ITTS {
        if (voicesOpenAI.includes(voice as VoicesOpenAI)) {
            return OpenaiTTS.getInstance();
        } else {
            return CoquiTTS.getInstance();
        }
    }
}