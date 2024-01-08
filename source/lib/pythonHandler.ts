import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { TextEncoder } from 'util';
import { print, printE } from './../lib/consoleUtils';

interface PythonCommunicatorOptions {
    onData?: (data: string) => any;
    onError?: (error: string) => any;
    onClose?: (code: number | null) => any;
}

export class PythonCommunicator {
    private pythonProcess: ChildProcessWithoutNullStreams;

    constructor(pyFilePath: string, options?: PythonCommunicatorOptions) {
        const { onData, onError, onClose } = options || {};

        const _onData = onData ?? ((data: string) => print(data));
        const _onError = onError ?? ((error: string) => printE(pyFilePath + ": ", error));
        const _onClose = onClose ?? ((code: number | null) => print(pyFilePath + " closed with code " + code));

        this.pythonProcess = spawn('python3', [pyFilePath]);

        this.pythonProcess.stdout.on('data', (data) => {
            data = this.decodeFromNumbers(data.toString());
            _onData(String(data));
        });

        this.pythonProcess.stderr.on('data', (data) => {
            _onError(String(data));
        });

        this.pythonProcess.on('close', (code) => {
            _onClose(code);
        });
    }

    private stringToUint8Array(inputString: string): Uint8Array {
        const encoder = new TextEncoder();
        return encoder.encode(inputString);
    }

    private encodeToNumbers(text: string): string {
        return text.split('').map(char => char.charCodeAt(0)).join(',');
    }

    private decodeFromNumbers(text: string): string {
        const numbers = text.split(',').map(Number);
        return String.fromCharCode(...numbers);
    }

    send(msg: string): void {
        try {
            this.pythonProcess.stdin.write(this.stringToUint8Array(this.encodeToNumbers(msg) + '\n'));
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    close(): void {
        this.pythonProcess.stdin.end();
    }
}
