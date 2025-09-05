import { saveToHistory } from './history.js';

export function insertAtCursor(text) {
    const textarea = document.getElementById("editorTextarea");
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    saveToHistory();
    textarea.value =
        value.substring(0, start) + text + value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
}

export function insertChord(chord) {
    insertAtCursor(`[${chord}]`);
}

export function insertSection(sectionType) {
    insertAtCursor(`

[${sectionType}]`);
}

