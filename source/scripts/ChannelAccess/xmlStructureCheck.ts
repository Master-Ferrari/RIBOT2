import { printE } from "../../libs/consoleUtils";

//#region types
type Attributes<T> = {
    $: T;
};

type MessageContentAttributes = {
    text: string;
};

type RoleToggleMessageAttributes = {
    actionType: 'sendMsg';
    type: 'reply' | 'sendMsg';
    text: string;
    private: 'true' | 'false';
};

type RoleToggleAttributes = {
    actionType: 'roleToggle';
    roleID: string;
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
export type RoleToggleMessage = Attributes<RoleToggleMessageAttributes>;
export type RoleToggle = {
    $: RoleToggleAttributes;
    message?: RoleToggleMessage[]; // Now optional
};

export type Button = {
    $: ButtonAttributes;
    roleToggle?: RoleToggle[];
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
                    if (button.roleToggle && !Array.isArray(button.roleToggle)) {
                        throw new Error('roleToggle is not an array in button');
                    }
                    button.roleToggle?.forEach((roleToggle) => {
                        if (typeof roleToggle.$ !== 'object' || typeof roleToggle.$.roleID !== 'string' || roleToggle.$.actionType !== 'roleToggle') {
                            throw new Error('Invalid or missing roleToggle attributes');
                        }
                        // Adjusted validation for optional message
                        if (roleToggle.message && !Array.isArray(roleToggle.message)) {
                            throw new Error('roleToggle message exists but is not an array');
                        }
                        roleToggle.message?.forEach((message) => {
                            if (typeof message.$ !== 'object' || typeof message.$.text !== 'string' || message.$.actionType !== 'sendMsg') {
                                throw new Error('Invalid message in roleToggle');
                            }
                        });
                    });
                });
            });
        });
        return true;
    } catch (e) {
        printE("XML Structure Error: " + e);
        return false;
    }
}
