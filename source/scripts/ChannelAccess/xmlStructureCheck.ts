import { printE } from "../../libs/consoleUtils";

//#region types
type Attributes<T> = {
    $: T;
};

type MessageContentAttributes = {
    text: string;
};

type CommonActionAttributes = {
    actionType: 'roleToggle' | 'sendMsg';
    roleID?: string; // Optional, only for roleToggle
    type?: 'reply' | 'send'; // Optional, only for sendMsg
    channelLink?: string;
    text?: string; // Optional, only for sendMsg
    private?: 'true' | 'false'; // Optional, only for sendMsg
};

type MessageAttributes = {
    actionType: 'sendMsg';
    type: 'reply' | 'send'; // Optional, only for sendMsg
    channelLink?: string;
    text: string; // Optional, only for sendMsg
    private: 'true' | 'false'; // Optional, only for sendMsg
};

type RoleToggleAttributes = {
    actionType: 'roleToggle';
    roleID: string; // Optional, only for roleToggle
};

type ButtonAttributes = {
    emojiID: string;
    label: string;
    style: 'Success' | 'Secondary' | 'Primary' | 'Danger';
};

type EditMessageAttributes = {
    messageLink: string;
};

type MessageContent = Attributes<MessageContentAttributes>;

// Updated to support nested actions
export type Action = Attributes<CommonActionAttributes> & {
    action?: Action[]; // Optional nested actions
};

export type MessageAction = Attributes<MessageAttributes> & {
    action: Action[]; // Optional nested actions
};

export type RoleToggleAction = Attributes<RoleToggleAttributes> & {
};

export type Button = {
    $: ButtonAttributes;
    action?: Action[]; // Can contain nested actions
};

type ButtonRow = {
    button: Button[];
};

type EditMessage = {
    $: EditMessageAttributes;
    content: MessageContent[];
    buttonRow: ButtonRow[];
};

export type XML = {
    editMessage: EditMessage[];
};
//#endregion

function validateAction(action: Action): boolean {
    if (typeof action.$ !== 'object' || action.$.actionType !== 'roleToggle' && action.$.actionType !== 'sendMsg') {
        throw new Error('Invalid or missing action attributes');
    }
    if (action.$.actionType === 'roleToggle' && typeof action.$.roleID !== 'string') {
        throw new Error('Invalid or missing roleID in roleToggle action');
    }
    if (action.$.actionType === 'sendMsg' && (typeof action.$.text !== 'string' || typeof action.$.type !== 'string' || typeof action.$.private !== 'string')) {
        throw new Error('Invalid sendMsg action');
    }
    if (action.action) {
        if (!Array.isArray(action.action)) {
            throw new Error('Nested action is not an array');
        }
        action.action.forEach(validateAction); // Recursively validate nested actions
    }
    return true;
}

export function validateXML(xml: XML): boolean {
    try {
        if (!Array.isArray(xml.editMessage)) {
            throw new Error('editMessage is not an array');
        }

        xml.editMessage.forEach((editMessage) => {
            if (typeof editMessage.$ !== 'object' || !editMessage.$.messageLink) {
                throw new Error('Invalid or missing editMessage attributes');
            }
            if (!Array.isArray(editMessage.content) || editMessage.content.some(content => typeof content.$ !== 'object' || typeof content.$.text !== 'string')) {
                throw new Error('Invalid or missing content in editMessage');
            }
            if (!Array.isArray(editMessage.buttonRow)) {
                throw new Error('buttonRow is not an array in editMessage');
            }
            if (editMessage.buttonRow.length > 5) {
                throw new Error('There are more than 5 buttonRows in an editMessage');
            }
            editMessage.buttonRow.forEach((buttonRow) => {
                if (!Array.isArray(buttonRow.button)) {
                    throw new Error('button is not an array in buttonRow');
                }
                if (buttonRow.button.length > 5) {
                    throw new Error('There are more than 5 buttons in a buttonRow');
                }
                buttonRow.button.forEach((button) => {
                    if (typeof button.$ !== 'object' || typeof button.$.emojiID !== 'string' || typeof button.$.label !== 'string' || typeof button.$.style !== 'string') {
                        throw new Error('Invalid or missing button attributes');
                    }
                    if (button.action && !Array.isArray(button.action)) {
                        throw new Error('actions is not an array in button');
                    }
                    button.action?.forEach(validateAction);
                });
            });
        });
        return true;
    } catch (e) {
        printE("XML Structure Error: " + e);
        return false;
    }
}
