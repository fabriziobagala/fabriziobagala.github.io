'use strict';

/**
 * Returns the JSON tool's i18n string table.
 * @returns {Object} The i18n strings, or an empty object when unavailable.
 */
const i18n = () => globalThis.toolsI18n?.json || {};

/**
 * Formats an error into a localized, displayable message.
 * @param {Error} e - The error to format.
 * @returns {string} The localized error message.
 */
const errMsg = (e) => `${i18n().error || 'Error'}: ${e.message}`;

/**
 * Recursively returns a copy of a value with all object keys sorted alphabetically.
 * @param {*} obj - The value to sort.
 * @returns {*} The value with sorted keys, or the value unchanged when not an object.
 */
const sortObjectKeys = (obj) => {
    if (Array.isArray(obj)) return obj.map(sortObjectKeys);
    if (obj !== null && typeof obj === 'object') {
        const sorted = Object.create(null);
        Object.keys(obj).sort((a, b) => a.localeCompare(b)).forEach((key) => {
            sorted[key] = sortObjectKeys(obj[key]);
        });
        return sorted;
    }
    return obj;
};

/**
 * Recursively returns a copy of a value with all null-valued keys removed.
 * @param {*} obj - The value to filter.
 * @returns {*} The value without null-valued keys, or the value unchanged when not an object.
 */
const stripNullKeys = (obj) => {
    if (Array.isArray(obj)) return obj.map(stripNullKeys);
    if (obj !== null && typeof obj === 'object') {
        const out = Object.create(null);
        for (const key of Object.keys(obj)) {
            if (obj[key] === null) continue;
            out[key] = stripNullKeys(obj[key]);
        }
        return out;
    }
    return obj;
};

const MAX_DEPTH = 2000;

/**
 * Determines whether a value's nesting exceeds the maximum allowed depth.
 * @param {*} root - The value to inspect.
 * @returns {boolean} True when nesting exceeds MAX_DEPTH, otherwise false.
 */
const tooDeep = (root) => {
    const stack = [[root, 1]];
    while (stack.length) {
        const [v, d] = stack.pop();
        if (v === null || typeof v !== 'object') continue;
        if (d > MAX_DEPTH) return true;
        const children = Array.isArray(v) ? v : Object.values(v);
        for (const c of children) stack.push([c, d + 1]);
    }
    return false;
};

/**
 * Escapes non-ASCII characters in a string as \uXXXX sequences.
 * @param {string} str - The string to escape.
 * @returns {string} The string with non-ASCII characters escaped.
 */
const escapeNonAscii = (str) => str.replaceAll(
    /[-￿]/g,
    (c) => String.raw`\u` + c.codePointAt(0).toString(16).padStart(4, '0')
);

/**
 * Escapes XML special characters in a value's string form.
 * @param {*} s - The value to escape.
 * @returns {string} The XML-escaped string.
 */
const xmlEscape = (s) => String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

/**
 * Converts a key into a valid XML tag name.
 * @param {*} key - The key to convert.
 * @returns {string} A sanitized XML tag name.
 */
const xmlSafeTag = (key) => {
    let tag = String(key).replaceAll(/[^A-Za-z0-9_.-]/g, '_');
    if (!/^[A-Za-z_]/.test(tag)) tag = `_${tag}`;
    return tag;
};

/**
 * Recursively serializes a value into XML markup.
 * @param {*} value - The value to serialize.
 * @param {string} rootTag - The tag name to wrap the value in.
 * @param {string} indent - The indentation unit per depth level.
 * @param {number} depth - The current nesting depth.
 * @param {string} nl - The newline string ('' when minified).
 * @returns {string} The XML representation of the value.
 */
const toXml = (value, rootTag, indent, depth, nl) => {
    const pad = indent.repeat(depth);
    const tag = xmlSafeTag(rootTag);

    if (value === null || value === undefined) return `${pad}<${tag}/>`;
    if (Array.isArray(value)) {
        if (!value.length) return `${pad}<${tag}/>`;
        const inner = value.map((v) => toXml(v, 'item', indent, depth + 1, nl)).join(nl);
        return `${pad}<${tag}>${nl}${inner}${nl}${pad}</${tag}>`;
    }
    if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (!keys.length) return `${pad}<${tag}/>`;
        const inner = keys.map((k) => toXml(value[k], k, indent, depth + 1, nl)).join(nl);
        return `${pad}<${tag}>${nl}${inner}${nl}${pad}</${tag}>`;
    }
    return `${pad}<${tag}>${xmlEscape(value)}</${tag}>`;
};

/**
 * Converts parsed JSON data into an XML document string.
 * @param {*} data - The data to convert.
 * @param {Object} options - Serialization options.
 * @param {string} options.indent - The indentation unit per depth level.
 * @param {boolean} options.minify - Whether to omit newlines and indentation.
 * @returns {string} The XML document.
 */
const jsonToXml = (data, { indent, minify }) => {
    const nl = minify ? '' : '\n';
    return `<?xml version="1.0" encoding="UTF-8"?>${nl}${toXml(data, 'root', minify ? '' : indent, 0, nl)}`;
};

/**
 * Escapes a value for inclusion in a CSV field.
 * @param {*} v - The value to escape.
 * @returns {string} The CSV-escaped field.
 */
const csvEscape = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/**
 * Converts an array of objects into CSV text.
 * @param {Array<Object>} data - A non-empty array of objects.
 * @returns {string} The CSV representation of the data.
 * @throws {Error} When the data is not a non-empty array of objects.
 */
const jsonToCsv = (data) => {
    const shapeMsg = i18n().errorCsvShape || 'CSV requires a non-empty array of objects';
    if (!Array.isArray(data) || !data.length) throw new Error(shapeMsg);
    const allRows = data.every((r) => r && typeof r === 'object' && !Array.isArray(r));
    if (!allRows) throw new Error(shapeMsg);
    const headers = [...new Set(data.flatMap((r) => Object.keys(r)))];
    const body = data.map((r) => headers.map((h) => csvEscape(r[h])).join(','));
    return [headers.map(csvEscape).join(','), ...body].join('\n');
};

/**
 * Converts parsed JSON data into YAML text.
 * @param {*} data - The data to convert.
 * @param {number} indent - The number of spaces per indentation level.
 * @returns {string} The YAML representation of the data.
 * @throws {TypeError} When the YAML library is not loaded.
 */
const jsonToYaml = (data, indent) => {
    if (typeof globalThis.jsyaml?.dump !== 'function') {
        throw new TypeError(i18n().errorYamlMissing || 'YAML library not loaded');
    }
    return globalThis.jsyaml.dump(data, { indent, lineWidth: 120, noRefs: true });
};

/**
 * Initializes the JSON tool: wires inputs, controls and view tabs, and binds conversion handlers.
 * @returns {void}
 */
const initJson = () => {
    const scope = document.querySelector('[data-tool-scope="json"]');
    if (!scope) return;

    const input = document.getElementById('json-input');
    const output = document.getElementById('json-output');
    const validity = document.getElementById('json-validity');
    if (!input || !output) return;

    input.value = '';
    output.value = '';

    const indentEl = document.getElementById('json-indent');
    const minifyEl = document.getElementById('json-minify');
    const sortKeysEl = document.getElementById('json-sort-keys');
    const escapeUnicodeEl = document.getElementById('json-escape-unicode');
    const removeNullEl = document.getElementById('json-remove-null');
    if (indentEl) indentEl.value = '2';
    if (minifyEl) minifyEl.checked = false;
    if (sortKeysEl) sortKeysEl.checked = false;
    if (escapeUnicodeEl) escapeUnicodeEl.checked = false;
    if (removeNullEl) removeNullEl.checked = false;

    let view = 'json';

    /**
     * Reads the indentation control and clamps it to a usable range.
     * @returns {number} The indentation width, between 1 and 10 (default 2).
     */
    const indent = () => {
        const n = indentEl ? Number.parseInt(indentEl.value, 10) : 2;
        return Number.isNaN(n) || n < 1 ? 2 : Math.min(n, 10);
    };

    /**
     * Updates the validity indicator element.
     * @param {string} state - The validity state.
     * @param {string} text - The text to display.
     * @returns {void}
     */
    const setValidity = (state, text) => globalThis.ToolUI.setValidity(validity, state, text);

    const viewBtns = scope.querySelectorAll('[data-view]');
    /**
     * Activates the view tab matching the given value.
     * @param {string|null} active - The view to mark active, or null for none.
     * @returns {void}
     */
    const updateTabs = (active) => globalThis.ToolUI.activateTabs(viewBtns, active);

    /**
     * Applies the enabled transform options to parsed data.
     * @param {*} parsed - The parsed JSON value.
     * @returns {*} The transformed value.
     */
    const transform = (parsed) => {
        if (removeNullEl?.checked) parsed = stripNullKeys(parsed);
        if (sortKeysEl?.checked) parsed = sortObjectKeys(parsed);
        return parsed;
    };

    /**
     * Transforms and serializes parsed data into the currently selected output format.
     * @param {*} parsed - The parsed JSON value.
     * @returns {string} The serialized output.
     * @throws {Error} When nesting is too deep or the target format rejects the data.
     */
    const compute = (parsed) => {
        if (tooDeep(parsed)) throw new Error(i18n().errorTooDeep || 'Nesting too deep');
        const data = transform(parsed);
        const minify = minifyEl?.checked ?? false;
        switch (view) {
            case 'yaml': return jsonToYaml(data, indent());
            case 'xml': return jsonToXml(data, { indent: ' '.repeat(indent()), minify });
            case 'csv': return jsonToCsv(data);
            default: {
                const text = JSON.stringify(data, null, minify ? 0 : indent());
                return escapeUnicodeEl?.checked ? escapeNonAscii(text) : text;
            }
        }
    };

    let cache = { raw: null, value: undefined, error: null };
    /**
     * Parses raw input once and caches the result for repeated lookups.
     * @param {string} raw - The raw JSON text.
     * @returns {Object} The cache entry with raw, value and error fields.
     */
    const parseOnce = (raw) => {
        if (cache.raw !== raw) {
            try {
                cache = { raw, value: JSON.parse(raw), error: null };
            } catch (e) {
                cache = { raw, value: undefined, error: e };
            }
        }
        return cache;
    };

    /**
     * Reads the input, parses it, and refreshes the output, validity state and tabs.
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
        const { value, error } = parseOnce(raw);
        if (error) {
            setValidity('err', i18n().errorInvalid || 'Invalid');
            output.value = errMsg(error);
            updateTabs(null);
            return;
        }
        setValidity('ok', i18n().validOk || 'Valid');
        updateTabs(view);
        try {
            output.value = compute(value);
        } catch (e) {
            output.value = errMsg(e);
            updateTabs(null);
        }
    };

    const schedule = globalThis.ToolUI.debounce(update);

    viewBtns.forEach((btn) => btn.addEventListener('click', () => { view = btn.dataset.view; update(); }));

    indentEl?.addEventListener('input', () => {
        const v = Number.parseInt(indentEl.value, 10);
        if (Number.isNaN(v) || v < 1) indentEl.value = '1';
        else if (v > 10) indentEl.value = '10';
        schedule();
    });
    minifyEl?.addEventListener('change', schedule);
    sortKeysEl?.addEventListener('change', schedule);
    escapeUnicodeEl?.addEventListener('change', schedule);
    removeNullEl?.addEventListener('change', schedule);
    input.addEventListener('input', schedule);

    document.getElementById('json-clear-btn')?.addEventListener('click', () => {
        input.value = '';
        schedule.cancel();
        update();
        input.focus();
    });

    update();
};

globalThis.initJson = initJson;
