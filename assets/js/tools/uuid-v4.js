'use strict';

/**
 * Returns the UUID v4 tool's localized strings.
 * @returns {Object} The translation map for this tool, or an empty object.
 */
const i18n = () => globalThis.toolsI18n?.uuidV4 || {};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX32_REGEX = /^[0-9a-f]{32}$/i;
const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Converts a hyphenated UUID string to its lowercase 32-character hex form.
 * @param {string} uuid - The UUID to convert.
 * @returns {string} The hyphen-free lowercase hex string.
 */
const uuidToHex = (uuid) => uuid.replaceAll('-', '').toLowerCase();

/**
 * Formats a 32-character hex string into a hyphenated UUID.
 * @param {string} hex - The 32-character hex string.
 * @returns {string} The hyphenated UUID string.
 */
const hexToUuid = (hex) => [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
].join('-');

/**
 * Removes surrounding braces and quotes from a string and trims whitespace.
 * @param {string} s - The string to unwrap.
 * @returns {string} The unwrapped, trimmed string.
 */
const stripWrappers = (s) => s.trim().replace(/^\{|\}$/g, '').replace(/^"|"$/g, '').trim();

/**
 * Encodes a hex string as a Base64 string.
 * @param {string} hex - The hex string to encode.
 * @returns {string} The Base64-encoded representation.
 */
const hexToBase64 = (hex) => {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) bytes.push(Number.parseInt(hex.substring(i, i + 2), 16));
    return btoa(String.fromCodePoint(...bytes));
};

/**
 * Decodes a Base64 string into a hex string.
 * @param {string} str - The Base64 string to decode.
 * @returns {string} The hex representation of the decoded bytes.
 */
const base64ToHex = (str) => {
    const bytes = Array.from(atob(str), (c) => c.codePointAt(0));
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Checks whether a hex string represents a valid version 4 UUID.
 * @param {string} hex - The 32-character hex string to test.
 * @returns {boolean} True if the hex encodes a v4 UUID.
 */
const isV4Hex = (hex) => hex.length === 32 && hex[12] === '4' && '89ab'.includes(hex[16]);

/**
 * Parses raw input in UUID, hex or Base64 form into a v4 UUID hex string.
 * @param {string} raw - The raw user input to parse.
 * @returns {string|null} The 32-character v4 hex string, or null if invalid.
 */
const parseToHex = (raw) => {
    const s = stripWrappers(raw);
    let hex = null;
    if (UUID_REGEX.test(s)) hex = uuidToHex(s);
    else if (HEX32_REGEX.test(s)) hex = s.toLowerCase();
    else if (BASE64_REGEX.test(s) && s.length === 24) {
        const decoded = base64ToHex(s);
        if (decoded.length === 32) hex = decoded;
    }
    return hex && isV4Hex(hex) ? hex : null;
};

/**
 * Generates a random version 4 UUID, preferring the Web Crypto API.
 * @returns {string} A newly generated v4 UUID string.
 */
const randomUuidV4 = () => {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
        return hexToUuid(hex);
    }
    /**
     * Computes the hex digit substituted for a UUID template placeholder.
     * @param {string} placeholder - The matched template character ('x' or 'y').
     * @returns {string} The hex digit to substitute.
     */
    const replacer = (placeholder) => {
        const r = Math.trunc(Math.random() * 16);
        return (placeholder === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    };
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(/[xy]/g, replacer);
};

/**
 * Initializes the UUID v4 tool: resets controls, wires events and renders output.
 * @returns {void}
 */
const initUuidV4 = () => {
    const scope = document.querySelector('[data-tool-scope="uuid-v4"]');
    if (!scope) return;

    const input = document.getElementById('uuid-input');
    const output = document.getElementById('uuid-output');
    const validity = document.getElementById('uuid-validity');
    if (!input || !output) return;

    input.value = '';
    output.value = '';

    const uppercaseEl = document.getElementById('uuid-uppercase');
    const hyphensEl = document.getElementById('uuid-hyphens');
    const bracesEl = document.getElementById('uuid-braces');
    const quotesEl = document.getElementById('uuid-quotes');
    if (uppercaseEl) uppercaseEl.checked = false;
    if (hyphensEl) hyphensEl.checked = true;
    if (bracesEl) bracesEl.checked = false;
    if (quotesEl) quotesEl.checked = false;

    let view = 'uuid';

    /**
     * Updates the validity indicator element with a state and message.
     * @param {string} state - The validity state ('empty', 'ok' or 'err').
     * @param {string} text - The message to display.
     * @returns {void}
     */
    const setValidity = (state, text) => globalThis.ToolUI.setValidity(validity, state, text);

    const viewBtns = scope.querySelectorAll('[data-view]');
    /**
     * Marks the matching view tab button as active.
     * @param {string|null} active - The view name to activate, or null for none.
     * @returns {void}
     */
    const updateTabs = (active) => globalThis.ToolUI.activateTabs(viewBtns, active);

    /**
     * Wraps a string in braces and/or quotes based on the active options.
     * @param {string} s - The string to wrap.
     * @returns {string} The optionally wrapped string.
     */
    const wrap = (s) => {
        if (bracesEl?.checked) s = `{${s}}`;
        if (quotesEl?.checked) s = `"${s}"`;
        return s;
    };

    /**
     * Formats a v4 hex string for the active view, applying display options.
     * @param {string} hex - The 32-character v4 hex string.
     * @returns {string} The formatted output string.
     */
    const compute = (hex) => {
        switch (view) {
            case 'base64': return wrap(hexToBase64(hex));
            case 'hex': return wrap(uppercaseEl?.checked ? hex.toUpperCase() : hex);
            default: {
                let uuid = hexToUuid(hex);
                if (!hyphensEl?.checked) uuid = uuid.replaceAll('-', '');
                if (uppercaseEl?.checked) uuid = uuid.toUpperCase();
                return wrap(uuid);
            }
        }
    };

    let cache = { raw: null, hex: null };
    /**
     * Parses raw input to a v4 hex string, caching the last result.
     * @param {string} raw - The raw input to parse.
     * @returns {string|null} The cached or freshly parsed v4 hex string, or null.
     */
    const parseOnce = (raw) => {
        if (cache.raw !== raw) cache = { raw, hex: parseToHex(raw) };
        return cache.hex;
    };

    /**
     * Reads the current input, validates it and renders the formatted output.
     * @returns {void}
     */
    const update = () => {
        const raw = input.value.trim();
        if (!raw) {
            setValidity('empty', '');
            output.value = '';
            updateTabs(view);
            return;
        }
        const hex = parseOnce(raw);
        if (!hex) {
            setValidity('err', i18n().errorInvalid || 'Invalid');
            output.value = `${i18n().error || 'Error'}: ${i18n().errorInvalidUuid || 'Invalid UUID format'}`;
            updateTabs(null);
            return;
        }
        setValidity('ok', i18n().validOk || 'Valid');
        updateTabs(view);
        output.value = compute(hex);
    };

    const schedule = globalThis.ToolUI.debounce(update);

    viewBtns.forEach((btn) => btn.addEventListener('click', () => { view = btn.dataset.view; update(); }));

    [uppercaseEl, hyphensEl, bracesEl, quotesEl].forEach((el) => el?.addEventListener('change', schedule));
    input.addEventListener('input', schedule);

    document.getElementById('uuid-generate-btn')?.addEventListener('click', () => {
        input.value = randomUuidV4();
        schedule.cancel();
        update();
    });

    document.getElementById('uuid-clear-btn')?.addEventListener('click', () => {
        input.value = '';
        schedule.cancel();
        update();
        input.focus();
    });

    update();
};

globalThis.initUuidV4 = initUuidV4;
