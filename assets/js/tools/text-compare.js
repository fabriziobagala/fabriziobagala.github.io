'use strict';

/**
 * Wires up the text comparison tool: caches DOM nodes, builds the line-first diff engine (line-level diff with character-level refinement inside modified line pairs), renders the diff output, statistics and donut chart, and binds compare/clear/option event handlers.
 * @returns {void}
 */
const initTextCompare = () => {
    const compareBtn = document.getElementById('compare-btn');
    const clearBtn = document.getElementById('clear-compare');
    const text1Input = document.getElementById('text1-input');
    const text2Input = document.getElementById('text2-input');
    const text1Output = document.getElementById('text1-output');
    const text2Output = document.getElementById('text2-output');
    const caseSensitive = document.getElementById('case-sensitive');
    const ignoreWhitespace = document.getElementById('ignore-whitespace');
    const ignoreEmptyLines = document.getElementById('ignore-empty-lines');
    const trimLines = document.getElementById('trim-lines');
    const ignorePunctuation = document.getElementById('ignore-punctuation');
    const compareStats = document.getElementById('compare-stats');
    const compareStatus = document.getElementById('compare-status');
    const additionsCount = document.getElementById('additions-count');
    const deletionsCount = document.getElementById('deletions-count');
    const modificationsCount = document.getElementById('modifications-count');
    const equalCharsCount = document.getElementById('equal-chars-count');
    const lineAdditionsCount = document.getElementById('line-additions-count');
    const lineDeletionsCount = document.getElementById('line-deletions-count');
    const lineModificationsCount = document.getElementById('line-modifications-count');
    const similarityPercentage = document.getElementById('similarity-percentage');
    const donutSegments = [
        { id: 'donut-equal', kind: 'equal' },
        { id: 'donut-added', kind: 'added' },
        { id: 'donut-deleted', kind: 'deleted' },
        { id: 'donut-modified', kind: 'modified' }
    ].map((s) => ({ ...s, el: document.getElementById(s.id) }));

    if (!text1Input || !text2Input || !text1Output || !text2Output) {
        return;
    }

    /**
     * Returns the text comparison tool's i18n string map, or an empty object when unavailable.
     * @returns {Object} The i18n string map.
     */
    const i18n = () => globalThis.toolsI18n?.textCompare || {};

    /**
     * Returns the screen-reader prefix labels for changed diff runs.
     * @returns {Object} Labels keyed by added, deleted and modified.
     */
    const srLabels = () => ({
        added: i18n().srAdded || 'added:',
        deleted: i18n().srDeleted || 'deleted:',
        modified: i18n().srModified || 'modified:'
    });

    /**
     * Normalizes text for line-based diffing and display according to the active options, preserving newlines.
     * @param {string} text - The raw input text.
     * @param {Object} options - The active comparison options.
     * @returns {string} The transformed text.
     */
    const transformLineSource = (text, options) => {
        let t = text;
        if (options.trimLines) t = t.split('\n').map((l) => l.trim()).join('\n');
        if (options.ignoreEmptyLines) t = t.split('\n').filter((l) => l.length > 0).join('\n');
        if (options.ignorePunctuation) t = t.replaceAll(/[\p{P}\p{S}]/gu, '');
        if (options.ignoreWhitespace) t = t.replaceAll(/[^\S\n]/g, '');
        return t;
    };

    /**
     * Produces the comparison key for a display string, lowercasing it unless case sensitivity is enabled.
     * @param {string} displayText - The display-normalized text.
     * @param {Object} options - The active comparison options.
     * @returns {string} The comparison key.
     */
    const transformCompare = (displayText, options) =>
        options.caseSensitive ? displayText : displayText.toLowerCase();

    /**
     * Builds an edit-distance matrix initialized with the base-case first row and column.
     * @param {number} len1 - The length of the first sequence.
     * @param {number} len2 - The length of the second sequence.
     * @returns {Array<Array<number>>} The initialized matrix.
     */
    const createDiffMatrix = (len1, len2) => {
        const matrix = new Array(len1 + 1).fill().map(() => new Array(len2 + 1).fill(0));

        for (let i = 0; i <= len1; i++) matrix[i][0] = i;
        for (let j = 0; j <= len2; j++) matrix[0][j] = j;

        return matrix;
    };

    /**
     * Fills an edit-distance matrix in place using the Levenshtein recurrence.
     * @param {Array<Array<number>>} matrix - The matrix to populate.
     * @param {Array<string>} seq1 - The first sequence.
     * @param {Array<string>} seq2 - The second sequence.
     * @returns {void}
     */
    const fillDiffMatrix = (matrix, seq1, seq2) => {
        const len1 = seq1.length;
        const len2 = seq2.length;

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (seq1[i - 1] === seq2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j - 1] + 1
                    );
                }
            }
        }
    };

    /**
     * Determines the diff operation that produced the matrix cell at the given position.
     * @param {Array<Array<number>>} matrix - The filled edit-distance matrix.
     * @param {Array<string>} seq1 - The first sequence.
     * @param {Array<string>} seq2 - The second sequence.
     * @param {number} i - The current row index in the first sequence.
     * @param {number} j - The current column index in the second sequence.
     * @returns {Object} An operation descriptor with a type.
     */
    const getNextOperation = (matrix, seq1, seq2, i, j) => {
        if (i > 0 && j > 0 && seq1[i - 1] === seq2[j - 1]) {
            return { type: 'equal' };
        } else if (i > 0 && (j === 0 || matrix[i][j] === matrix[i - 1][j] + 1)) {
            return { type: 'delete' };
        } else if (j > 0 && (i === 0 || matrix[i][j] === matrix[i][j - 1] + 1)) {
            return { type: 'insert' };
        } else {
            return { type: 'substitute' };
        }
    };

    /**
     * Backtracks through a filled matrix to produce the ordered list of diff operations.
     * @param {Array<Array<number>>} matrix - The filled edit-distance matrix.
     * @param {Array<string>} seq1 - The first sequence.
     * @param {Array<string>} seq2 - The second sequence.
     * @returns {Array<Object>} The ordered diff operations.
     */
    const backtrackOperations = (matrix, seq1, seq2) => {
        const operations = [];
        let i = seq1.length;
        let j = seq2.length;

        while (i > 0 || j > 0) {
            const operation = getNextOperation(matrix, seq1, seq2, i, j);
            operations.unshift(operation);

            if (operation.type === 'equal' || operation.type === 'substitute') {
                i--;
                j--;
            } else if (operation.type === 'delete') {
                i--;
            } else {
                j--;
            }
        }

        return operations;
    };

    const MAX_MATRIX_CELLS = 9_000_000;

    /**
     * Computes the diff operations between two sequences.
     * @param {Array<string>} seq1 - The first sequence.
     * @param {Array<string>} seq2 - The second sequence.
     * @returns {Array<Object>} The ordered diff operations.
     * @throws {Error} When the resulting matrix would exceed the maximum allowed cell count.
     */
    const computeDiff = (seq1, seq2) => {
        if ((seq1.length + 1) * (seq2.length + 1) > MAX_MATRIX_CELLS) {
            const msg = i18n().errorTooLarge || 'Inputs are too large to compare';
            throw new Error(msg);
        }
        const matrix = createDiffMatrix(seq1.length, seq2.length);
        fillDiffMatrix(matrix, seq1, seq2);
        return backtrackOperations(matrix, seq1, seq2);
    };

    /**
     * Groups consecutive diff operations of the same type into runs.
     * @param {Array<Object>} operations - The ordered diff operations.
     * @returns {Array<Object>} Runs with a type and a length.
     */
    const groupOperations = (operations) => {
        const runs = [];
        operations.forEach((op) => {
            const last = runs.at(-1);
            if (last && last.type === op.type) last.length++;
            else runs.push({ type: op.type, length: 1 });
        });
        return runs;
    };

    /**
     * Escapes a string for safe insertion into HTML.
     * @param {string} text - The text to escape.
     * @returns {string} The HTML-escaped text.
     */
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    /**
     * Renders a diff span for a run of text, prefixing changed runs with a visually hidden label.
     * @param {string} className - The diff state class.
     * @param {string} text - The run text.
     * @param {string} srLabel - The screen-reader prefix; empty for equal runs.
     * @returns {string} The span markup, or an empty string for empty text.
     */
    const renderRun = (className, text, srLabel) => {
        if (!text) return '';
        const sr = srLabel ? `<span class="sr-only">${escapeHtml(srLabel)} </span>` : '';
        return `<span class="${className}">${sr}${escapeHtml(text)}</span>`;
    };

    /**
     * Renders the placeholder span that keeps the opposite pane aligned.
     * @returns {string} The placeholder markup.
     */
    const renderPlaceholder = () => '<span class="diff-placeholder"></span>';

    /**
     * Renders the character-level diff between one pair of modified lines and tallies change counts, falling back to whole-line modified rendering when the pair is too large.
     * @param {string} line1 - The display line from the first text.
     * @param {string} line2 - The display line from the second text.
     * @param {Object} options - The active comparison options.
     * @returns {Object} An object with html1, html2, additions, deletions, modifications and equal counts.
     */
    const renderModifiedLinePair = (line1, line2, options) => {
        const sr = srLabels();
        const chars1 = Array.from(line1);
        const chars2 = Array.from(line2);
        if ((chars1.length + 1) * (chars2.length + 1) > MAX_MATRIX_CELLS) {
            return {
                html1: renderRun('diff-modified', line1, sr.modified),
                html2: renderRun('diff-modified', line2, sr.modified),
                additions: 0,
                deletions: 0,
                modifications: Math.max(chars1.length, chars2.length),
                equal: 0
            };
        }
        const keys1 = chars1.map((c) => transformCompare(c, options));
        const keys2 = chars2.map((c) => transformCompare(c, options));
        const runs = groupOperations(computeDiff(keys1, keys2));

        let html1 = '';
        let html2 = '';
        let pos1 = 0, pos2 = 0;
        let additions = 0, deletions = 0, modifications = 0, equal = 0;

        runs.forEach((run) => {
            const n = run.length;
            switch (run.type) {
                case 'equal':
                    html1 += renderRun('diff-equal', chars1.slice(pos1, pos1 + n).join(''), '');
                    html2 += renderRun('diff-equal', chars2.slice(pos2, pos2 + n).join(''), '');
                    pos1 += n;
                    pos2 += n;
                    equal += n;
                    break;
                case 'delete':
                    html1 += renderRun('diff-deleted', chars1.slice(pos1, pos1 + n).join(''), sr.deleted);
                    html2 += renderPlaceholder();
                    pos1 += n;
                    deletions += n;
                    break;
                case 'insert':
                    html1 += renderPlaceholder();
                    html2 += renderRun('diff-added', chars2.slice(pos2, pos2 + n).join(''), sr.added);
                    pos2 += n;
                    additions += n;
                    break;
                case 'substitute':
                    html1 += renderRun('diff-modified', chars1.slice(pos1, pos1 + n).join(''), sr.modified);
                    html2 += renderRun('diff-modified', chars2.slice(pos2, pos2 + n).join(''), sr.modified);
                    pos1 += n;
                    pos2 += n;
                    modifications += n;
                    break;
            }
        });

        return { html1, html2, additions, deletions, modifications, equal };
    };

    /**
     * Renders the full line diff into paired HTML markup and tallies character and line change counts.
     * @param {Array<Object>} lineOps - The line-level diff operations.
     * @param {Array<string>} lines1 - The display lines from the first text.
     * @param {Array<string>} lines2 - The display lines from the second text.
     * @param {Object} options - The active comparison options.
     * @returns {Object} An object with html1, html2, hasChanges, character counts and similarity.
     */
    const renderLineDiff = (lineOps, lines1, lines2, options) => {
        const sr = srLabels();
        const parts1 = [];
        const parts2 = [];
        let i1 = 0, i2 = 0;
        let additions = 0, deletions = 0, modifications = 0, equal = 0;
        let hasChanges = false;

        lineOps.forEach((op) => {
            switch (op.type) {
                case 'equal':
                    parts1.push(renderRun('diff-equal', lines1[i1], ''));
                    parts2.push(renderRun('diff-equal', lines2[i2], ''));
                    equal += Array.from(lines1[i1]).length;
                    i1++;
                    i2++;
                    break;
                case 'delete':
                    hasChanges = true;
                    parts1.push(renderRun('diff-deleted', lines1[i1], sr.deleted) || renderPlaceholder());
                    parts2.push(renderPlaceholder());
                    deletions += Array.from(lines1[i1]).length;
                    i1++;
                    break;
                case 'insert':
                    hasChanges = true;
                    parts1.push(renderPlaceholder());
                    parts2.push(renderRun('diff-added', lines2[i2], sr.added) || renderPlaceholder());
                    additions += Array.from(lines2[i2]).length;
                    i2++;
                    break;
                case 'substitute': {
                    hasChanges = true;
                    const pair = renderModifiedLinePair(lines1[i1], lines2[i2], options);
                    parts1.push(pair.html1);
                    parts2.push(pair.html2);
                    additions += pair.additions;
                    deletions += pair.deletions;
                    modifications += pair.modifications;
                    equal += pair.equal;
                    i1++;
                    i2++;
                    break;
                }
            }
        });

        const total1 = lines1.reduce((sum, l) => sum + Array.from(l).length, 0);
        const total2 = lines2.reduce((sum, l) => sum + Array.from(l).length, 0);
        const similarity = Math.round((equal / Math.max(total1, total2, 1)) * 100);

        return {
            html1: parts1.join('\n'),
            html2: parts2.join('\n'),
            hasChanges,
            additions,
            deletions,
            modifications,
            equal,
            similarity
        };
    };

    /**
     * Updates the donut chart segment stroke attributes to reflect the supplied category counts.
     * @param {Object} values - Counts keyed by segment kind (equal, added, deleted, modified).
     * @returns {void}
     */
    const updateDonut = (values) => {
        const total = donutSegments.reduce((s, x) => s + (values[x.kind] || 0), 0);
        let cumulative = 0;
        donutSegments.forEach((seg) => {
            if (!seg.el) return;
            const pct = total === 0 ? 0 : (values[seg.kind] / total) * 100;
            seg.el.setAttribute('stroke-dasharray', `${pct.toFixed(3)} ${(100 - pct).toFixed(3)}`);
            seg.el.setAttribute('stroke-dashoffset', (-cumulative).toFixed(3));
            cumulative += pct;
        });
    };

    /**
     * Reads the current state of the comparison option checkboxes.
     * @returns {Object} The active comparison options.
     */
    const getCompareOptions = () => ({
        caseSensitive: caseSensitive?.checked ?? false,
        ignoreWhitespace: ignoreWhitespace?.checked ?? false,
        ignoreEmptyLines: ignoreEmptyLines?.checked ?? false,
        trimLines: trimLines?.checked ?? false,
        ignorePunctuation: ignorePunctuation?.checked ?? false
    });

    /**
     * Writes the rendered diff into the output panes, or a no-changes message when texts are equal.
     * @param {Object} result - The render result with html1, html2 and hasChanges.
     * @returns {void}
     */
    const renderOutputs = (result) => {
        if (!result.hasChanges) {
            const msg = `<div class="diff-no-changes">${i18n().noChanges || 'No differences found'}</div>`;
            text1Output.innerHTML = msg;
            text2Output.innerHTML = msg;
            return;
        }
        text1Output.innerHTML = result.html1;
        text2Output.innerHTML = result.html2;
    };

    /**
     * Clears the HTML content of both output panes.
     * @returns {void}
     */
    const clearPanes = () => {
        text1Output.innerHTML = '';
        text2Output.innerHTML = '';
    };

    /**
     * Writes the character, line and similarity statistics into their display elements.
     * @param {Object} result - The render result with additions, deletions, modifications and equal counts.
     * @param {Object} lineStats - The line-level diff statistics.
     * @returns {void}
     */
    const updateStats = (result, lineStats) => {
        const cells = [
            [additionsCount, result.additions],
            [deletionsCount, result.deletions],
            [modificationsCount, result.modifications],
            [equalCharsCount, result.equal],
            [lineAdditionsCount, lineStats.additions],
            [lineDeletionsCount, lineStats.deletions],
            [lineModificationsCount, lineStats.modifications],
            [similarityPercentage, `${result.similarity}%`]
        ];
        cells.forEach(([el, val]) => { if (el) el.textContent = val; });
    };

    /**
     * Clears the panes and shows the empty-input error status.
     * @returns {void}
     */
    const showEmptyMessage = () => {
        const msg = i18n().errorEmptyTexts || 'Please enter texts to compare';
        clearPanes();
        compareStats.style.display = 'none';
        globalThis.ToolStatus.set(compareStatus, msg, 'error');
    };

    /**
     * Clears the panes and shows an error status built from the given error.
     * @param {Error} error - The error to display.
     * @returns {void}
     */
    const showErrorMessage = (error) => {
        const msg = `${i18n().error || 'Error'}: ${error.message}`;
        clearPanes();
        compareStats.style.display = 'none';
        globalThis.ToolStatus.set(compareStatus, msg, 'error');
    };

    /**
     * Runs the full comparison pipeline against the current inputs and updates the outputs, statistics, donut chart and status.
     * @returns {void}
     */
    const compareTexts = () => {
        try {
            const text1 = text1Input.value;
            const text2 = text2Input.value;
            if (!text1 && !text2) { showEmptyMessage(); return; }

            const options = getCompareOptions();
            const lines1 = transformLineSource(text1, options).split('\n');
            const lines2 = transformLineSource(text2, options).split('\n');
            const keys1 = lines1.map((l) => transformCompare(l, options));
            const keys2 = lines2.map((l) => transformCompare(l, options));
            const lineOps = computeDiff(keys1, keys2);
            const result = renderLineDiff(lineOps, lines1, lines2, options);

            renderOutputs(result);

            const lineStats = {
                additions: lineOps.filter((o) => o.type === 'insert').length,
                deletions: lineOps.filter((o) => o.type === 'delete').length,
                modifications: lineOps.filter((o) => o.type === 'substitute').length
            };
            updateStats(result, lineStats);

            updateDonut({
                equal: result.equal,
                added: result.additions,
                deleted: result.deletions,
                modified: result.modifications
            });

            setMode('diff');
            compareStats.style.display = 'grid';
            const total = result.additions + result.deletions + result.modifications;
            const doneLabel = i18n().comparisonDone || 'Comparison complete';
            const noChangesLabel = i18n().noChanges || 'No differences found';
            globalThis.ToolStatus.set(compareStatus, total === 0 ? noChangesLabel : `${doneLabel}: ${total}`, 'success');
        } catch (error) {
            showErrorMessage(error);
        }
    };

    const panes = document.querySelectorAll('.compare-pane');
    /**
     * Sets the data-mode attribute on every compare pane.
     * @param {string} mode - The mode to apply (e.g. 'input' or 'diff').
     * @returns {void}
     */
    const setMode = (mode) => panes.forEach((p) => { p.dataset.mode = mode; });

    /**
     * Resets the inputs, outputs, statistics and status to their initial empty state.
     * @returns {void}
     */
    const clearAll = () => {
        if (text1Input) text1Input.value = '';
        if (text2Input) text2Input.value = '';
        if (text1Output) text1Output.innerHTML = '';
        if (text2Output) text2Output.innerHTML = '';
        if (compareStats) compareStats.style.display = 'none';
        globalThis.ToolStatus.clear(compareStatus);
        setMode('input');
    };

    [text1Output, text2Output].forEach((out, i) => {
        out?.addEventListener('click', () => {
            setMode('input');
            (i === 0 ? text1Input : text2Input)?.focus();
        });
    });

    compareBtn?.addEventListener('click', compareTexts);
    clearBtn?.addEventListener('click', clearAll);

    /**
     * Re-runs the comparison when an option changes and at least one input has content.
     * @returns {void}
     */
    const onOptionChange = () => {
        if (text1Input.value || text2Input.value) compareTexts();
    };
    [caseSensitive, ignoreWhitespace, ignoreEmptyLines, trimLines, ignorePunctuation]
        .forEach((el) => el?.addEventListener('change', onOptionChange));
};

globalThis.initTextCompare = initTextCompare;
