import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';

const logPath = path.join(__dirname, '../../log');

type StyleOptions = {
    foreground?: 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';
    background?: 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'
    | 'brightBlack' | 'brightRed' | 'brightGreen' | 'brightYellow' | 'brightBlue'
    | 'brightMagenta' | 'brightCyan' | 'brightWhite' | 'brightGray';
    bold?: boolean;
    italic?: boolean;
};

const ansiStyles = {
    foreground: {
        black: '30',
        red: '31',
        green: '32',
        yellow: '33',
        blue: '34',
        magenta: '35',
        cyan: '36',
        white: '37',
    },
    background: {
        black: '40',
        red: '41',
        green: '42',
        yellow: '43',
        blue: '44',
        magenta: '45',
        cyan: '46',
        white: '47',
        brightBlack: '90',
        brightRed: '91',
        brightGreen: '92',
        brightYellow: '93',
        brightBlue: '94',
        brightMagenta: '95',
        brightCyan: '96',
        brightWhite: '97',
        brightGray: '37',
    },
    bold: '1',
    italic: '3',
    reset: '0',
};

function format(text: string, options: StyleOptions): string {
    let styleCodes: string[] = [];

    if (options.foreground) {
        styleCodes.push(ansiStyles.foreground[options.foreground]);
    }

    if (options.background) {
        styleCodes.push(ansiStyles.background[options.background]);
    }

    if (options.bold) {
        styleCodes.push(ansiStyles.bold);
    }

    if (options.italic) {
        styleCodes.push(ansiStyles.italic);
    }

    const styleStart = styleCodes.length > 0 ? `\x1b[${styleCodes.join(';')}m` : '';
    const styleEnd = styleCodes.length > 0 ? `\x1b[${ansiStyles.reset}m` : '';

    // return text;
    return styleStart + text + styleEnd;
}

function print(text: any = "", newLine: boolean = true): string {
    // console.log(newLine);
    text = "[0m" + String(text) + (newLine ? '\n' : "");
    // process.stdout.write(text);
    process.stdout.write(text);
    // if(newLine) {
    //     process.stdout.write('\n');
    // }
    return text;
}

interface PrintDOptions {
    head?: boolean;
    depth?: number;
}
function printD(obj: any, options: PrintDOptions = { head: true, depth: 0 }): string {

    function decorateLines(inputString: string) {
        const lines = inputString.split('\n');
        const decoratedLines = lines.map(line => "\x1b[48;5;235m" + line + "\x1b[0m");
        return decoratedLines.join('\n');
    }

    if (options.head && obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length === 1) {
        const firstKey = Object.keys(obj)[0];
        print(format(String(typeof obj[firstKey]) + ' ' + firstKey,
            { foreground: 'black', background: 'blue', bold: true, italic: false }));

        let text = util.inspect(obj[firstKey], { depth: options.depth === 0 ? null : options.depth, colors: true });
        return print(decorateLines(text));
    }

    // print(format(String(typeof obj), { foreground: 'black', background: 'white', bold: true, italic: true }));
    let text = util.inspect(obj, { depth: options.depth === 0 ? null : options.depth, colors: true });
    return print(decorateLines(text));
}

async function printL(text: any = "", newLine: boolean = true): Promise<string> {
    // const logPath = path.resolve(__dirname, '../log');
    // printD({ text });
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

function dateToStr(date: Date, style: string = "ddmmyyyy"): string {
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

    return ''; // Добавьте возвращаемое значение по умолчанию на случай, если ни одно из условий не выполнено
}

function printE(msg: any = "", error: any = null): string {
    return print(format(String(msg) + (error ? '\n' + String(error) : ' '), { foreground: 'red', bold: true }));
}

export { print, printD, printL, printE, format, dateToStr };