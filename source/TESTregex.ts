
import { printD } from "./libs/consoleUtils";

function shieldRegEx(str: string): string {
    return str.replace(/[-[\]{}()*+?.,\\^$|#\s%]/g, '\\$&');
}

function replaceDictionary(content: string, dictionary: Record<string, string>, prefix: string = 'жопа', postfix: string = 'попа'): string {
    const regex = new RegExp(shieldRegEx(prefix) + "(\\w+)" + shieldRegEx(postfix), "g");
    const groups = [...content.matchAll(regex)];
    for (const group of groups) {
        const key = group[0];
        content = content.replace(key, dictionary[group[1]]);
    }
    return content;
}

const dict = { "ololo": "OLOLO", "alala": "ALALA" };
const str = "какая-то строчка !ololo? [ololo] что-то в ней написано %ololo% %alala%   жопаololoпопа";
console.log(replaceDictionary(str, dict));