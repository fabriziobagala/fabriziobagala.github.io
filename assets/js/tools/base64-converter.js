'use strict';

/**
 * Returns the localized strings for the Base64 converter tool.
 * @returns {Object} The i18n string map, or an empty object when unavailable.
 */
const i18n = () => globalThis.toolsI18n?.base64Converter || {};

/**
 * Builds a localized error message from an Error.
 * @param {Error} e - The error whose message is appended.
 * @returns {string} The formatted error message.
 */
const errMsg = (e) => `${i18n().error || 'Error'}: ${e.message}`;

/**
 * Encodes a byte array to a standard Base64 string.
 * @param {Uint8Array} bytes - The bytes to encode.
 * @returns {string} The Base64-encoded string.
 */
const bytesToBase64 = (bytes) => {
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCodePoint(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
};

/**
 * Converts a standard Base64 string to the URL-safe variant.
 * @param {string} b64 - The standard Base64 string.
 * @returns {string} The URL-safe Base64 string without padding.
 */
const toUrlSafe = (b64) => b64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

/**
 * Converts a URL-safe Base64 string back to the standard padded variant.
 * @param {string} b64 - The URL-safe Base64 string.
 * @returns {string} The standard Base64 string with restored padding.
 */
const fromUrlSafe = (b64) => {
    const s = b64.replaceAll('-', '+').replaceAll('_', '/');
    const remainder = s.length % 4;
    return remainder ? s + '='.repeat(4 - remainder) : s;
};

/**
 * Encodes UTF-8 text to Base64, optionally using the URL-safe variant.
 * @param {string} text - The text to encode.
 * @param {boolean} urlSafe - Whether to produce URL-safe output.
 * @returns {string} The Base64-encoded string.
 */
const encode = (text, urlSafe) => {
    const b64 = bytesToBase64(new TextEncoder().encode(text));
    return urlSafe ? toUrlSafe(b64) : b64;
};

/**
 * Decodes a Base64 string to UTF-8 text.
 * @param {string} b64 - The Base64 string to decode (standard or URL-safe).
 * @returns {string} The decoded UTF-8 text.
 * @throws {Error} When the input is not valid Base64 or not valid UTF-8.
 */
const decode = (b64) => {
    const normalised = fromUrlSafe(b64.trim());
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalised)) {
        throw new Error('Invalid Base64');
    }
    const binary = atob(normalised);
    const bytes = Uint8Array.from(binary, (char) => char.codePointAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

/**
 * Initializes the Base64 converter tool: wires up inputs, mode tabs and events.
 * @returns {void}
 */
const initBase64Converter = () => {
    const scope = document.querySelector('[data-tool-scope="base64-converter"]');
    if (!scope) return;

    const input = document.getElementById('b64-input');
    const output = document.getElementById('b64-output');
    const validity = document.getElementById('b64-validity');
    if (!input || !output) return;

    input.value = '';
    output.value = '';

    const urlSafeEl = document.getElementById('b64-urlsafe');
    if (urlSafeEl) urlSafeEl.checked = false;

    const inTitle = scope.querySelector('[data-b64-in-title]');
    const outTitle = scope.querySelector('[data-b64-out-title]');
    const modeBtns = scope.querySelectorAll('[data-mode]');

    /**
     * Returns the localized label for plain text.
     * @returns {string} The localized "Text" label.
     */
    const labelText = () => i18n().labelText || 'Text';
    /**
     * Returns the localized label for Base64.
     * @returns {string} The localized "Base64" label.
     */
    const labelBase64 = () => i18n().labelBase64 || 'Base64';

    let mode = 'encode';

    /**
     * Updates the validity indicator for the current operation.
     * @param {string} state - The validity state ('empty', 'ok', or 'err').
     * @param {string} text - The message to display.
     * @returns {void}
     */
    const setValidity = (state, text) => globalThis.ToolUI.setValidity(validity, state, text);

    /**
     * Applies the active mode to the UI: tabs, titles and input placeholder.
     * @returns {void}
     */
    const applyMode = () => {
        scope.dataset.b64Mode = mode;
        globalThis.ToolUI.activateTabs(modeBtns, mode, 'mode');
        const encoding = mode === 'encode';
        if (inTitle) inTitle.textContent = encoding ? labelText() : labelBase64();
        if (outTitle) outTitle.textContent = encoding ? labelBase64() : labelText();
        input.placeholder = encoding ? 'Hello, world' : 'SGVsbG8sIHdvcmxk';
    };

    /**
     * Reads the input, runs the active encode/decode operation and renders the result.
     * @returns {void}
     */
    const update = () => {
        const raw = input.value;
        if (!raw.trim()) {
            setValidity('empty', '');
            output.value = '';
            return;
        }
        if (mode === 'encode') {
            setValidity('empty', '');
            try {
                output.value = encode(raw, urlSafeEl?.checked ?? false);
            } catch (e) {
                output.value = errMsg(e);
            }
            return;
        }
        try {
            output.value = decode(raw);
            setValidity('ok', i18n().validOk || 'Valid');
        } catch (e) {
            output.value = errMsg(e);
            setValidity('err', i18n().errorInvalid || 'Invalid');
        }
    };

    const schedule = globalThis.ToolUI.debounce(update);

    modeBtns.forEach((btn) => btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        applyMode();
        update();
    }));

    urlSafeEl?.addEventListener('change', schedule);
    input.addEventListener('input', schedule);

    document.getElementById('b64-clear-btn')?.addEventListener('click', () => {
        input.value = '';
        schedule.cancel();
        update();
        input.focus();
    });

    applyMode();
    update();
};

globalThis.initBase64Converter = initBase64Converter;
