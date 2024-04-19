import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';

const logPath = path.join(__dirname, '../../log');

//#region ansi format()
export type Color = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' |
    'brightBlack' | 'brightRed' | 'brightGreen' | 'brightYellow' |
    'brightBlue' | 'brightMagenta' | 'brightCyan' | 'brightWhite';

export type formatting = 'bold' | 'italic' | 'underline' | 'dim';

type Style = {
    foreground?: Color | number | string;
    background?: Color | number | string;
    formatting?: formatting[] | formatting;
};

const colorMap = {
    black: '0', red: '1', green: '2', yellow: '3',
    blue: '4', magenta: '5', cyan: '6', white: '7',
    brightBlack: '8', brightRed: '9', brightGreen: '10', brightYellow: '11',
    brightBlue: '12', brightMagenta: '13', brightCyan: '14', brightWhite: '15'
};

function ansiColor(input: Color | number | string): string {
    // 'r*,g*,b*'
    // 'R***,G***,B***'
    // '**%'
    // ***
    // 'colorName'

    let color = '';

    const reg_0to255 = '([1-9]?[0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])';
    const reg_0to5 = '([0-5])';

    const Reg_rgb = new RegExp(`^r${reg_0to5},g${reg_0to5},b${reg_0to5}$`);
    const Reg_RGB = new RegExp(`^R${reg_0to255},G${reg_0to255},B${reg_0to255}$`);
    const Reg_prc = new RegExp(`^(100|[1-9][0-9]|[0-9])%$`);


    if (typeof input === 'number') { // ***
        if (input < 0 || input > 255) {
            printE(new Error('Incorrect format() parameters. Expected a number from 0 to 255.'));
            color = '5;15m';
        }
        else {
            color = '5;' + input + 'm';
        }
    } else if (input in colorMap) { // 'colorName'
        color = '5;' + colorMap[input as Color] + 'm';
    } else { // 'r*,g*,b*'
        const rgb = input.match(Reg_rgb);
        if (rgb) {
            const r = parseInt(rgb[1], 10);
            const g = parseInt(rgb[2], 10);
            const b = parseInt(rgb[3], 10);
            color = '5;' + String(16 + (r * 36) + (g * 6) + b) + 'm';
        } else { // 'R***,G***,B***'
            const RGB = input.match(Reg_RGB);
            if (RGB) {
                const R = parseInt(RGB[1], 10);
                const G = parseInt(RGB[2], 10);
                const B = parseInt(RGB[3], 10);
                color = '2;' + R + ';' + G + ';' + B + 'm';
            } else { // '**%' 
                const prc = input.match(Reg_prc);
                if (prc) {
                    color = '2;'
                    const p = parseInt(prc[1], 10);
                    if (p === 100) color += 231;
                    if (p === 0) color += 16;
                    color += Math.round((p - 3) / 4) + 232 + 'm';
                } else { // error
                    printE(`Incorrect format() parameters. 
Expected RGB format \`r*,g*,b*\`, \`**%\`, \`R***,G***,B***\`, *** or \`colorName\`
(* is a digit from 0 to 5)
(** is a digit from 0 to 100)
(*** is a digit from 0 to 255)
(colorName is a color name like 'red')`);
                    color = '5;15m';
                }
            }
        }
    }
    return color;
}

const formattingMap = {
    bold: '1', italic: '3', underline: '4', dim: '2'
};

export function format(text: string, options: Style): string {
    let result = '';

    if (options.foreground) {
        const colorCode = ansiColor(options.foreground);
        result += '\x1b[38;' + colorCode;
    }

    if (options.background) {
        const colorCode = ansiColor(options.background);
        result += '\x1b[48;' + colorCode;
    }

    if (options.formatting) {
        const formatCodes = Array.isArray(options.formatting) ? options.formatting : [options.formatting];
        for (const format of formatCodes) {
            result += '\x1b[' + formattingMap[format] + 'm';
        }
    }

    result += text + '\x1b[0m';
    return result;
}
//#endregion

//#region print*()
export function print(text: any = "", newLine: boolean = true): string {
    text = "[0m" + String(text) + (newLine ? '\n' : "");
    process.stdout.write(text);
    return text;
}

interface PrintDOptions {
    head?: boolean;
    depth?: number;
}
export function printD(obj: any, options: PrintDOptions = { head: true, depth: 0 }): string {

    function decorateLines(inputString: string) {
        const lines = inputString.split('\n');
        const decoratedLines = lines.map(line => "\x1b[48;5;235m" + line + "\x1b[0m");
        return decoratedLines.join('\n');
    }

    if (options.head && obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length === 1) {
        const firstKey = Object.keys(obj)[0]; ``
        print(format(String(typeof obj[firstKey]) + ' ' + firstKey,
            { foreground: 'black', background: 'blue', formatting: ['bold'] }));

        let text = util.inspect(obj[firstKey], { depth: options.depth === 0 ? null : options.depth, colors: true });
        return print(decorateLines(text));
    }

    print(format('ololo',
        { foreground: 'blue', background: 'blue', formatting: ['bold'] }));

    let text = util.inspect(obj, { depth: options.depth === 0 ? null : options.depth, colors: true });
    return print(decorateLines(text));
}

export async function printL(text: any = "", newLine: boolean = true): Promise<string> {
    const logString = print(text, newLine);

    if (!fs.existsSync(logPath)) {
        fs.mkdirSync(logPath, { recursive: true });
    }
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const filePath = path.join(logPath, `${formattedDate}.ans`);

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '', 'utf8');
    }

    try {
        await fs.promises.appendFile(filePath, `${logString}`);
    } catch (err) {
        throw err;
    }

    return logString;
}

export function printE(msg: any = "", error: any = null): string {
    return print(format(String(msg) + (error ? '\n' + String(error) : ' '), { foreground: 'red', formatting: ['bold'] }));
}
//#endregion

//#region *()
export function dateToStr(date: Date, style: string = "ddmmyyyy"): string {
    const dd = date.toLocaleDateString("ru-RU", { day: '2-digit' });
    const mm = date.toLocaleDateString("ru-RU", { month: '2-digit' });
    const ww = date.toLocaleDateString("ru-RU", { weekday: 'short' });
    const yyyy = date.toLocaleDateString("ru-RU", { year: 'numeric' });
    const hh = date.getHours().toString().padStart(2, '0');
    const mn = date.getMinutes().toString().padStart(2, '0');
    const ss = date.getSeconds().toString().padStart(2, '0');

    if (style === "ddmmyyyy")
        return `${dd}-${mm}-${yyyy}`;
    if (style === "dd")
        return dd;
    if (style === "ww")
        return ww;
    if (style === "ddww")
        return `${dd} ${ww}`;
    if (style === "words")
        return date.toLocaleDateString("ru-RU", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (style === "timeStamp")
        return ` | ${dd}-${mm}-${yyyy} (${hh}:${mn}_${ss})`;

    return '';
}

export function prettySlice(input: string, minLength: number, maxLength: number, breakers: string[] = ['\n', '.', ',', ' ']): { start: string, end: string, full: string } {
    let result = input.slice(0, maxLength);

    if (result.length > minLength) {
        for (let breaker of breakers) {
            const lastBreakIndex = result.lastIndexOf(breaker);
            if (lastBreakIndex > minLength) {
                result = breaker === '\n' ? result.slice(0, lastBreakIndex) : result.slice(0, lastBreakIndex + 1);
                break;
            }
        }
        result = result.length > maxLength ? result.slice(0, maxLength) : result;
    }

    return {
        start: result,
        end: input.slice(result.length),
        full: input
    };
}

import { myId } from './../botConfig.json';

export async function interactionLog(username: string, commandName: string, options: string, userId: string) {
    await printL(
        username + format(
            " /" + commandName + (userId == myId ? " " + limiter(options.trim(), 20) : "")
            , { foreground: 'yellow' }
        ) + dateToStr(new Date(), "timeStamp"));

    function limiter(input: string, limit: number): string {
        if (input.length > limit) {
            return input.slice(0, limit - 3) + '...';
        }
        return input;
    }
}

export function shieldRegEx(str: string): string {
    return str.replace(/[-[\]{}()*+?.,\\^$|#\s%]/g, "\$&");
}

export function replaceDictionary(content: string, dictionary: Record<string, any>, prefix: string = '[', postfix: string = ']'): string {
    const regex = new RegExp(shieldRegEx(prefix) + "(\\w+)" + shieldRegEx(postfix), "g");
    const groups = [...content.matchAll(regex)];
    for (const group of groups) {
        const key = group[0];
        content = content.replace(key, String(dictionary[group[1]]));
    }
    return content;
}
//#endregion