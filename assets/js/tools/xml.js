'use strict';

/**
 * Returns the localized strings for the XML tool.
 * @returns {Object} The XML i18n dictionary, or an empty object when unavailable.
 */
const i18n = () => globalThis.toolsI18n?.xml || {};

/**
 * Formats an error into a localized prefixed message.
 * @param {Error} e - The error whose message is shown.
 * @returns {string} The localized error message.
 */
const errMsg = (e) => `${i18n().error || 'Error'}: ${e.message}`;

/**
 * Strips URLs and empty label lines from a raw parser-error string.
 * @param {string} raw - The raw parser-error text.
 * @returns {string} The cleaned, multi-line error text.
 */
const cleanParseError = (raw) => raw
    .split('\n')
    .map((line) => line.replace(/\s*https?:\/\/\S+/g, '').trim())
    .filter((line) => line && !/^[^\s:]+:$/.test(line))
    .join('\n')
    .trim();

/**
 * Parses an XML string and reports either the document or a cleaned error.
 * @param {string} input - The XML source to parse.
 * @returns {{doc: Document|null, error: string|null}} The parsed document or the parse error.
 */
const parseXml = (input) => {
    const doc = new DOMParser().parseFromString(input, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) {
        const raw = err.querySelector('div')?.textContent || err.textContent || '';
        return { doc: null, error: cleanParseError(raw) || i18n().errorInvalid || 'Invalid' };
    }
    return { doc, error: null };
};

/**
 * Escapes XML text-node special characters.
 * @param {string} s - The text to escape.
 * @returns {string} The escaped text.
 */
const escapeXmlText = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * Escapes XML attribute-value special characters.
 * @param {string} s - The attribute value to escape.
 * @returns {string} The escaped attribute value.
 */
const escapeXmlAttr = (s) => escapeXmlText(s).replaceAll('"', '&quot;');

/**
 * Builds the serialized attribute string for an element.
 * @param {Element} node - The element whose attributes are serialized.
 * @param {boolean} sortAttrs - Whether to sort attributes by name.
 * @returns {string} The leading-space-prefixed attribute string.
 */
const buildAttrs = (node, sortAttrs) => {
    const attrs = Array.from(node.attributes);
    if (sortAttrs) attrs.sort((a, b) => a.name.localeCompare(b.name));
    return attrs.map((attr) => ` ${attr.name}="${escapeXmlAttr(attr.value)}"`).join('');
};

/**
 * Serializes a document into indented, human-readable XML.
 * @param {Document} doc - The document to serialize.
 * @param {string} xmlString - The original XML source, used to recover the declaration.
 * @param {string} pad - The indentation unit per depth level.
 * @param {{sortAttrs: boolean, keepComments: boolean}} options - Serialization options.
 * @returns {string} The pretty-printed XML.
 */
const prettyPrint = (doc, xmlString, pad, { sortAttrs, keepComments }) => {
    /**
     * Extracts the XML declaration from the source, with a trailing newline.
     * @returns {string} The declaration line, or an empty string when absent.
     */
    const xmlDeclaration = () => {
        if (!xmlString.trim().startsWith('<?xml')) return '';
        const match = /<\?xml[^?]*\?>/.exec(xmlString);
        return match ? `${match[0]}\n` : '';
    };

    /**
     * Determines whether a child node should be rendered.
     * @param {Node} c - The child node to test.
     * @returns {boolean} True when the node is visible in the output.
     */
    const isVisible = (c) => {
        if (c.nodeType === Node.TEXT_NODE) return c.nodeValue.trim().length > 0;
        return c.nodeType !== Node.COMMENT_NODE || keepComments;
    };

    /**
     * Serializes an element and its visible children at a given depth.
     * @param {Element} node - The element to serialize.
     * @param {number} depth - The current indentation depth.
     * @returns {string} The serialized element.
     */
    const serializeElement = (node, depth) => {
        const prefix = pad.repeat(depth);
        const attrs = buildAttrs(node, sortAttrs);
        const children = Array.from(node.childNodes).filter(isVisible);
        if (children.length === 0) return `${prefix}<${node.nodeName}${attrs}/>\n`;

        const onlyText = children.length === 1 && children[0].nodeType === Node.TEXT_NODE;
        if (onlyText) {
            const text = escapeXmlText(children[0].nodeValue.trim());
            return `${prefix}<${node.nodeName}${attrs}>${text}</${node.nodeName}>\n`;
        }
        let out = `${prefix}<${node.nodeName}${attrs}>\n`;
        for (const child of children) out += serialize(child, depth + 1);
        return `${out}${prefix}</${node.nodeName}>\n`;
    };

    /**
     * Recursively serializes any node at a given depth.
     * @param {Node} node - The node to serialize.
     * @param {number} depth - The current indentation depth.
     * @returns {string} The serialized node.
     */
    const serialize = (node, depth) => {
        const prefix = pad.repeat(depth);
        switch (node.nodeType) {
            case Node.DOCUMENT_NODE: {
                let out = xmlDeclaration();
                for (const child of node.childNodes) out += serialize(child, 0);
                return out;
            }
            case Node.ELEMENT_NODE: return serializeElement(node, depth);
            case Node.TEXT_NODE: { const t = node.nodeValue.trim(); return t ? `${prefix}${escapeXmlText(t)}\n` : ''; }
            case Node.COMMENT_NODE: return keepComments ? `${prefix}<!--${node.nodeValue}-->\n` : '';
            case Node.CDATA_SECTION_NODE: return `${prefix}<![CDATA[${node.nodeValue}]]>\n`;
            case Node.PROCESSING_INSTRUCTION_NODE: return `${prefix}<?${node.target}${node.data ? ' ' + node.data : ''}?>\n`;
            default: return '';
        }
    };

    return serialize(doc, 0).trimEnd();
};

/**
 * Serializes a document into minified, whitespace-collapsed XML.
 * @param {Document} doc - The document to serialize.
 * @param {string} xmlString - The original XML source, used to recover the declaration.
 * @param {{sortAttrs: boolean, keepComments: boolean}} options - Serialization options.
 * @returns {string} The minified XML.
 */
const minify = (doc, xmlString, { sortAttrs, keepComments }) => {
    const decl = xmlString.trim().startsWith('<?xml')
        ? (/<\?xml[^?]*\?>/.exec(xmlString)?.[0] || '')
        : '';

    /**
     * Recursively serializes a node into minified XML.
     * @param {Node} node - The node to serialize.
     * @returns {string} The serialized node.
     */
    const ser = (node) => {
        switch (node.nodeType) {
            case Node.DOCUMENT_NODE: {
                let out = '';
                for (const child of node.childNodes) out += ser(child);
                return out;
            }
            case Node.ELEMENT_NODE: {
                const attrs = buildAttrs(node, sortAttrs);
                const inner = Array.from(node.childNodes).map(ser).join('');
                return inner
                    ? `<${node.nodeName}${attrs}>${inner}</${node.nodeName}>`
                    : `<${node.nodeName}${attrs}/>`;
            }
            case Node.TEXT_NODE: { const t = node.nodeValue; return t.trim() ? escapeXmlText(t.replace(/\s+/g, ' ')) : ''; }
            case Node.COMMENT_NODE: return keepComments ? `<!--${node.nodeValue}-->` : '';
            case Node.CDATA_SECTION_NODE: return `<![CDATA[${node.nodeValue}]]>`;
            case Node.PROCESSING_INSTRUCTION_NODE: return `<?${node.target}${node.data ? ' ' + node.data : ''}?>`;
            default: return '';
        }
    };

    return (decl + ser(doc)).trim();
};

/**
 * Collapses an element object to its text value when it holds only text.
 * @param {Object} obj - The element object produced by elementToJs.
 * @returns {Object|string} The text value, an empty string, or the object unchanged.
 */
const valueOf = (obj) => {
    const keys = Object.keys(obj);
    if (!keys.length) return '';
    if (keys.length === 1 && keys[0] === '#text') return obj['#text'];
    return obj;
};

/**
 * Converts an element subtree into a plain object of attributes, text and children.
 * @param {Element} node - The element to convert.
 * @param {boolean} sortAttrs - Whether to sort attributes by name.
 * @returns {Object} The object representation of the element.
 */
const elementToJs = (node, sortAttrs) => {
    const obj = Object.create(null);
    const attrList = Array.from(node.attributes);
    if (sortAttrs) attrList.sort((a, b) => a.name.localeCompare(b.name));
    for (const attr of attrList) obj[`@${attr.name}`] = attr.value;

    const children = Array.from(node.childNodes).filter((c) =>
        c.nodeType === Node.TEXT_NODE ? c.nodeValue.trim().length > 0
            : c.nodeType === Node.ELEMENT_NODE || c.nodeType === Node.CDATA_SECTION_NODE);

    const elements = children.filter((c) => c.nodeType === Node.ELEMENT_NODE);
    const text = children.filter((c) => c.nodeType !== Node.ELEMENT_NODE)
        .map((c) => c.nodeValue.trim()).join(' ').trim();
    if (text) obj['#text'] = text;

    for (const child of elements) {
        const value = valueOf(elementToJs(child, sortAttrs));
        if (Object.hasOwn(obj, child.nodeName)) {
            const existing = obj[child.nodeName];
            if (Array.isArray(existing)) existing.push(value);
            else obj[child.nodeName] = [existing, value];
        } else obj[child.nodeName] = value;
    }
    return obj;
};

/**
 * Converts an XML document into a JSON string keyed by the root element name.
 * @param {Document} doc - The document to convert.
 * @param {boolean} sortAttrs - Whether to sort attributes by name.
 * @param {number} space - The JSON indentation width.
 * @returns {string} The JSON representation.
 */
const xmlToJson = (doc, sortAttrs, space) => {
    const root = doc.documentElement;
    const value = valueOf(elementToJs(root, sortAttrs));
    return JSON.stringify({ [root.nodeName]: value }, null, space);
};

/**
 * Initializes the XML tool: wires inputs, options, view tabs and live updates.
 * @returns {void}
 */
const initXml = () => {
    const scope = document.querySelector('[data-tool-scope="xml"]');
    if (!scope) return;

    const input = document.getElementById('xml-input');
    const output = document.getElementById('xml-output');
    const validity = document.getElementById('xml-validity');
    if (!input || !output) return;

    input.value = '';
    output.value = '';

    const indentEl = document.getElementById('xml-indent');
    const minifyEl = document.getElementById('xml-minify');
    const sortAttrsEl = document.getElementById('xml-sort-attrs');
    const keepCommentsEl = document.getElementById('xml-preserve-comments');
    if (indentEl) indentEl.value = '2';
    if (minifyEl) minifyEl.checked = false;
    if (sortAttrsEl) sortAttrsEl.checked = false;
    if (keepCommentsEl) keepCommentsEl.checked = false;

    let view = 'xml';

    /**
     * Reads the indentation width clamped to the range 1 to 10.
     * @returns {number} The effective indentation width.
     */
    const indent = () => {
        const n = indentEl ? Number.parseInt(indentEl.value, 10) : 2;
        return Number.isNaN(n) || n < 1 ? 2 : Math.min(n, 10);
    };
    /**
     * Reads the current serialization options from the controls.
     * @returns {{sortAttrs: boolean, keepComments: boolean}} The current options.
     */
    const opts = () => ({
        sortAttrs: sortAttrsEl?.checked ?? false,
        keepComments: keepCommentsEl?.checked ?? true,
    });

    /**
     * Sets the validity indicator state and message.
     * @param {string} state - The validity state key.
     * @param {string} text - The message to display.
     * @returns {void}
     */
    const setValidity = (state, text) => globalThis.ToolUI.setValidity(validity, state, text);

    const viewBtns = scope.querySelectorAll('[data-view]');
    /**
     * Activates the view tab matching the given value.
     * @param {string|null} active - The active view key, or null to deactivate all.
     * @returns {void}
     */
    const updateTabs = (active) => globalThis.ToolUI.activateTabs(viewBtns, active);

    /**
     * Computes the output for the current view and options.
     * @param {Document} doc - The parsed document.
     * @param {string} raw - The original XML source.
     * @returns {string} The formatted output.
     */
    const compute = (doc, raw) => {
        const o = opts();
        if (view === 'json') return xmlToJson(doc, o.sortAttrs, minifyEl?.checked ? 0 : indent());
        if (minifyEl?.checked) return minify(doc, raw, o);
        return prettyPrint(doc, raw, ' '.repeat(indent()), o);
    };

    let cache = { raw: null, doc: null, error: null };
    /**
     * Parses the source, reusing the cached result when the source is unchanged.
     * @param {string} raw - The XML source to parse.
     * @returns {{raw: string, doc: Document|null, error: string|null}} The cached parse result.
     */
    const parseOnce = (raw) => {
        if (cache.raw !== raw) cache = { raw, ...parseXml(raw) };
        return cache;
    };

    /**
     * Parses the input, refreshes validity, tabs and the output value.
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
        const { doc, error } = parseOnce(raw);
        if (error) {
            setValidity('err', i18n().errorInvalid || 'Invalid');
            output.value = error;
            updateTabs(null);
            return;
        }
        setValidity('ok', i18n().validOk || 'Valid');
        updateTabs(view);
        try {
            output.value = compute(doc, raw);
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
    sortAttrsEl?.addEventListener('change', schedule);
    keepCommentsEl?.addEventListener('change', schedule);
    input.addEventListener('input', schedule);

    document.getElementById('xml-clear-btn')?.addEventListener('click', () => {
        input.value = '';
        schedule.cancel();
        update();
        input.focus();
    });

    update();
};

globalThis.initXml = initXml;
