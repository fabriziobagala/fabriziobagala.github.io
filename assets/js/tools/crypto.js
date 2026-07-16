'use strict';

const MD5_K = new Uint32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
]);

const MD5_S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];

/**
 * Computes the MD5 digest of a byte array.
 * @param {Uint8Array} bytes - The input bytes to hash.
 * @returns {Uint8Array} The 16-byte MD5 digest.
 */
const md5Bytes = (bytes) => {
    const msgLen = bytes.length;
    const bitLen = BigInt(msgLen) * 8n;
    const totalLen = Math.ceil((msgLen + 9) / 64) * 64;
    const padded = new Uint8Array(totalLen);
    padded.set(bytes);
    padded[msgLen] = 0x80;

    const view = new DataView(padded.buffer);
    view.setUint32(totalLen - 8, Number(bitLen & 0xffffffffn), true);
    view.setUint32(totalLen - 4, Number((bitLen >> 32n) & 0xffffffffn), true);

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    /**
     * Rotates a 32-bit integer left by a given number of bits.
     * @param {number} x - The value to rotate.
     * @param {number} n - The number of bits to rotate by.
     * @returns {number} The rotated value.
     */
    const rotl = (x, n) => (x << n) | (x >>> (32 - n));

    for (let chunk = 0; chunk < totalLen; chunk += 64) {
        const M = new Uint32Array(16);
        for (let i = 0; i < 16; i++) M[i] = view.getUint32(chunk + i * 4, true);

        let A = a0, B = b0, C = c0, D = d0;
        for (let i = 0; i < 64; i++) {
            let F, g;
            if (i < 16) { F = (B & C) | ((~B) & D); g = i; }
            else if (i < 32) { F = (D & B) | ((~D) & C); g = (5 * i + 1) & 15; }
            else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
            else { F = C ^ (B | (~D)); g = (7 * i) & 15; }
            F = (F + A + MD5_K[i] + M[g]) >>> 0;
            A = D; D = C; C = B;
            B = (B + rotl(F, MD5_S[i])) >>> 0;
        }

        a0 = (a0 + A) >>> 0;
        b0 = (b0 + B) >>> 0;
        c0 = (c0 + C) >>> 0;
        d0 = (d0 + D) >>> 0;
    }

    const out = new Uint8Array(16);
    const outView = new DataView(out.buffer);
    outView.setUint32(0, a0, true);
    outView.setUint32(4, b0, true);
    outView.setUint32(8, c0, true);
    outView.setUint32(12, d0, true);
    return out;
};

const DIGEST_BITS = { 'MD5': 128, 'SHA-1': 160, 'SHA-256': 256, 'SHA-384': 384, 'SHA-512': 512 };

/**
 * Concatenates two byte arrays into a new array.
 * @param {Uint8Array} a - The first byte array.
 * @param {Uint8Array} b - The second byte array.
 * @returns {Uint8Array} A new array containing the bytes of a followed by b.
 */
const concatBytes = (a, b) => {
    const out = new Uint8Array(a.length + b.length);
    out.set(a);
    out.set(b, a.length);
    return out;
};

/**
 * Converts a byte array to its lowercase hexadecimal string representation.
 * @param {Uint8Array} bytes - The bytes to convert.
 * @returns {string} The hexadecimal string.
 */
const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Encodes a byte array as a standard base64 string.
 * @param {Uint8Array} bytes - The bytes to encode.
 * @returns {string} The base64-encoded string.
 */
const bytesToBase64 = (bytes) => {
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCodePoint(...bytes.subarray(i, i + CHUNK));
    return btoa(binary);
};

/**
 * Computes a hash digest of the given bytes using the specified algorithm.
 * @param {string} algorithm - The digest algorithm ('MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512').
 * @param {Uint8Array} bytes - The input bytes to hash.
 * @returns {Promise<Uint8Array>} The digest bytes.
 * @throws {Error} When a non-MD5 algorithm is requested outside a secure context.
 */
const digestBytes = async (algorithm, bytes) => {
    if (algorithm === 'MD5') return md5Bytes(bytes);
    if (!globalThis.crypto?.subtle) throw new Error('Hashing requires a secure context (HTTPS)');
    return new Uint8Array(await crypto.subtle.digest(algorithm, bytes));
};

const HMAC_BLOCK = { 'MD5': 64, 'SHA-1': 64, 'SHA-256': 64, 'SHA-384': 128, 'SHA-512': 128 };

/**
 * Computes an HMAC of the message bytes using the given key and algorithm.
 * @param {string} algorithm - The digest algorithm to use for the HMAC.
 * @param {Uint8Array} keyBytes - The key bytes.
 * @param {Uint8Array} msgBytes - The message bytes to authenticate.
 * @returns {Promise<Uint8Array>} The HMAC digest bytes.
 */
const hmacBytes = async (algorithm, keyBytes, msgBytes) => {
    const BLOCK = HMAC_BLOCK[algorithm] || 64;
    let key = keyBytes;
    if (key.length > BLOCK) key = await digestBytes(algorithm, key);
    const k = new Uint8Array(BLOCK);
    k.set(key);
    const ipad = new Uint8Array(BLOCK);
    const opad = new Uint8Array(BLOCK);
    for (let i = 0; i < BLOCK; i++) { ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5c; }
    const inner = await digestBytes(algorithm, concatBytes(ipad, msgBytes));
    return digestBytes(algorithm, concatBytes(opad, inner));
};

/**
 * Computes a hash or HMAC of text, selecting HMAC when a key is provided.
 * @param {string} algorithm - The digest algorithm to use.
 * @param {string} text - The text to hash.
 * @param {string} key - The HMAC key; when falsy a plain hash is computed.
 * @returns {Promise<Uint8Array>} The resulting digest bytes.
 */
const computeDigest = (algorithm, text, key) => {
    const enc = new TextEncoder();
    const msg = enc.encode(text);
    return key ? hmacBytes(algorithm, enc.encode(key), msg) : digestBytes(algorithm, msg);
};

/**
 * Encodes digest bytes as a string in the requested encoding.
 * @param {Uint8Array} bytes - The digest bytes to encode.
 * @param {string} encoding - The output encoding ('hex', 'base64', or 'base64url').
 * @param {boolean} uppercase - Whether hex output should be uppercased.
 * @returns {string} The encoded digest string.
 */
const encodeDigest = (bytes, encoding, uppercase) => {
    if (encoding === 'base64') return bytesToBase64(bytes);
    if (encoding === 'base64url') return bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    const hex = toHex(bytes);
    return uppercase ? hex.toUpperCase() : hex;
};

/**
 * Wires up the crypto tool UI within the given scope, binding inputs, controls and events.
 * @param {HTMLElement|null} scope - The tool scope element, or null when absent.
 * @returns {void}
 */
const wireCrypto = (scope) => {
    if (!scope) return;

    const input = document.getElementById('crypto-input');
    const output = document.getElementById('crypto-output');
    if (!input || !output) return;

    input.value = '';
    output.value = '';

    const algoSel = document.getElementById('crypto-algo');
    const encTabs = scope.querySelectorAll('[data-enc]');
    const uppercaseEl = document.getElementById('crypto-uppercase');
    const hmacEl = document.getElementById('crypto-hmac');
    const wrapEl = document.getElementById('crypto-wrap');
    const outTitle = document.getElementById('crypto-out-label');
    const outWrapper = output.closest('.textarea-numbered');
    const baseTitle = outTitle ? outTitle.textContent : 'Hash';

    if (uppercaseEl) uppercaseEl.checked = false;
    if (wrapEl) wrapEl.checked = false;

    /**
     * Returns the crypto tool's i18n string map, or an empty object when unavailable.
     * @returns {Object} The i18n string map.
     */
    const i18n = () => globalThis.toolsI18n?.crypto || {};
    let algo = algoSel?.value || 'SHA-256';
    let encoding = 'hex';

    /**
     * Marks the button matching the given value as active and updates its pressed state.
     * @param {NodeList} btns - The buttons to update.
     * @param {string} value - The value identifying the active button.
     * @param {string} attr - The dataset attribute name to compare against.
     * @returns {void}
     */
    const setActive = (btns, value, attr) => btns.forEach((b) => {
        const on = b.dataset[attr] === value;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (encTabs.length) setActive(encTabs, encoding, 'enc');

    const verifyInput = document.getElementById('crypto-verify-popup');
    const verifyResult = document.getElementById('crypto-verify-popup-result');
    /**
     * Compares an expected digest string against the current output.
     * @param {string} expected - The expected digest value to verify.
     * @returns {string} 'empty', 'match', or 'mismatch'.
     */
    const verifyState = (expected) => {
        const exp = (expected || '').trim();
        if (!output.value || !exp) return 'empty';
        /**
         * Normalizes a digest string for comparison by stripping whitespace and casing.
         * @param {string} s - The digest string to normalize.
         * @returns {string} The normalized string.
         */
        const norm = (s) => encoding === 'hex'
            ? s.replace(/\s+/g, '').toLowerCase()
            : s.replace(/\s+/g, '');
        return norm(exp) === norm(output.value) ? 'match' : 'mismatch';
    };
    /**
     * Renders the verification result label for the given state.
     * @param {string} state - The verification state ('empty', 'match', or 'mismatch').
     * @returns {void}
     */
    const renderVerify = (state) => {
        if (!verifyResult) return;
        verifyResult.dataset.state = state;
        const labels = { match: i18n().verifyMatch || 'Match', mismatch: i18n().verifyMismatch || 'No match' };
        verifyResult.textContent = labels[state] || '';
    };
    /**
     * Recomputes and re-renders the verification result from the current verify input.
     * @returns {void}
     */
    const refreshVerify = () => { if (verifyInput) renderVerify(verifyState(verifyInput.value)); };
    verifyInput?.addEventListener('input', () => renderVerify(verifyState(verifyInput.value)));

    const popPanel = document.getElementById('crypto-verify-popup-panel');
    const popBtn = document.getElementById('crypto-verify-popup-btn');
    /**
     * Closes the verify popup panel and restores focus to its trigger button.
     * @returns {void}
     */
    const closePop = () => {
        if (!popPanel?.classList.contains('is-open')) return;
        const hadFocus = popPanel.contains(document.activeElement);
        popPanel.classList.remove('is-open');
        popBtn?.setAttribute('aria-expanded', 'false');
        if (hadFocus) popBtn?.focus();
    };
    popBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = popPanel?.classList.toggle('is-open');
        popBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) document.getElementById('crypto-verify-popup')?.focus();
    });
    popPanel?.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', closePop);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });

    /**
     * Toggles the output wrapper's line-wrap class to match the wrap checkbox state.
     * @returns {void}
     */
    const syncWrap = () => outWrapper?.classList.toggle('textarea-numbered--wrap', wrapEl?.checked ?? false);

    /**
     * Updates the output title, appending the digest bit length when text is present.
     * @param {string} text - The source text; falsy resets the title to its base label.
     * @returns {void}
     */
    const setTitle = (text) => {
        if (!outTitle) return;
        outTitle.textContent = text ? `${baseTitle} · ${DIGEST_BITS[algo]} bit` : baseTitle;
    };

    /**
     * Enables the uppercase control only when the hex encoding is active.
     * @returns {void}
     */
    const syncUppercase = () => { if (uppercaseEl) uppercaseEl.disabled = encoding !== 'hex'; };

    let reqId = 0;
    /**
     * Recomputes the digest from current inputs and refreshes the output, title and verification.
     * @returns {Promise<void>}
     */
    const update = async () => {
        syncUppercase();
        const text = input.value;
        if (!text) { output.value = ''; setTitle(''); refreshVerify(); return; }
        const key = hmacEl?.value || '';
        const myReq = ++reqId;
        try {
            const bytes = await computeDigest(algo, text, key);
            if (myReq !== reqId) return;
            output.value = encodeDigest(bytes, encoding, uppercaseEl?.checked ?? false);
            setTitle(text);
        } catch (error) {
            if (myReq !== reqId) return;
            console.debug('Hash generation failed:', error.message);
            output.value = `${i18n().error || 'Error'}: ${error.message}`;
            setTitle('');
        }
        refreshVerify();
    };

    let timer = null;
    /**
     * Debounces an update, recomputing the digest after a short delay.
     * @returns {void}
     */
    const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(update, 150);
    };

    input.addEventListener('input', schedule);
    hmacEl?.addEventListener('input', schedule);
    wrapEl?.addEventListener('change', syncWrap);
    uppercaseEl?.addEventListener('change', update);
    algoSel?.addEventListener('change', () => { algo = algoSel.value; update(); });

    encTabs.forEach((btn) => btn.addEventListener('click', () => {
        encoding = btn.dataset.enc;
        setActive(encTabs, encoding, 'enc');
        update();
    }));

    document.getElementById('crypto-clear-btn')?.addEventListener('click', () => {
        if (timer) clearTimeout(timer);
        reqId++;
        input.value = '';
        if (hmacEl) hmacEl.value = '';
        output.value = '';
        setTitle('');
        if (verifyInput) verifyInput.value = '';
        renderVerify('empty');
        input.focus();
    });

    syncWrap();
    update();
};

/**
 * Initializes the crypto tool by wiring up its scope element.
 * @returns {void}
 */
const initCrypto = () => wireCrypto(document.querySelector('[data-tool-scope="crypto"]'));
globalThis.initCrypto = initCrypto;
