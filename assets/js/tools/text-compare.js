'use strict';

/**
 * Wires up the text comparison tool: caches DOM nodes, builds the character and line diff engine, renders the diff output, statistics and donut chart, and binds compare/clear/option event handlers.
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
     * Normalizes text for character-level diffing and display according to the active options.
     * @param {string} text - The raw input text.
     * @param {Object} options - The active comparison options.
     * @returns {string} The transformed text.
     */
    const transformDisplay = (text, options) => {
        let t = text;
        if (options.trimLines) t = t.split('\n').map((l) => l.trim()).join('\n');
        if (options.ignoreEmptyLines) t = t.split('\n').filter((l) => l.length > 0).join('\n');
        if (options.ignorePunctuation) t = t.replaceAll(/[\p{P}\p{S}]/gu, '');
        if (options.ignoreWhitespace) t = t.replaceAll(/\s/g, '');
        return t;
    };

    /**
     * Normalizes text for line-level diffing according to the active options, preserving newlines.
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
     * @param {Array<string>|string} str1 - The first sequence.
     * @param {Array<string>|string} str2 - The second sequence.
     * @returns {void}
     */
    const fillDiffMatrix = (matrix, str1, str2) => {
        const len1 = str1.length;
        const len2 = str2.length;

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1[i - 1] === str2[j - 1]) {
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
     * @param {Array<string>|string} str1 - The first sequence.
     * @param {Array<string>|string} str2 - The second sequence.
     * @param {number} i - The current row index in the first sequence.
     * @param {number} j - The current column index in the second sequence.
     * @returns {Object} An operation descriptor with a type and the relevant characters and positions.
     */
    const getNextOperation = (matrix, str1, str2, i, j) => {
        if (i > 0 && j > 0 && str1[i - 1] === str2[j - 1]) {
            return { type: 'equal', char1: str1[i - 1], char2: str2[j - 1], pos1: i - 1, pos2: j - 1 };
        } else if (i > 0 && (j === 0 || matrix[i][j] === matrix[i - 1][j] + 1)) {
            return { type: 'delete', char1: str1[i - 1], pos1: i - 1, pos2: j };
        } else if (j > 0 && (i === 0 || matrix[i][j] === matrix[i][j - 1] + 1)) {
            return { type: 'insert', char2: str2[j - 1], pos1: i, pos2: j - 1 };
        } else {
            return { type: 'substitute', char1: str1[i - 1], char2: str2[j - 1], pos1: i - 1, pos2: j - 1 };
        }
    };

    /**
     * Backtracks through a filled matrix to produce the ordered list of diff operations.
     * @param {Array<Array<number>>} matrix - The filled edit-distance matrix.
     * @param {Array<string>|string} str1 - The first sequence.
     * @param {Array<string>|string} str2 - The second sequence.
     * @returns {Array<Object>} The ordered diff operations.
     */
    const backtrackOperations = (matrix, str1, str2) => {
        const operations = [];
        let i = str1.length;
        let j = str2.length;

        while (i > 0 || j > 0) {
            const operation = getNextOperation(matrix, str1, str2, i, j);
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
     * Computes the character-level diff operations between two strings.
     * @param {string} str1 - The first string.
     * @param {string} str2 - The second string.
     * @returns {Array<Object>} The ordered diff operations.
     * @throws {Error} When the resulting matrix would exceed the maximum allowed cell count.
     */
    const computeDiff = (str1, str2) => {
        const a = Array.from(str1);
        const b = Array.from(str2);
        if ((a.length + 1) * (b.length + 1) > MAX_MATRIX_CELLS) {
            const msg = globalThis.toolsI18n?.textCompare?.errorTooLarge || 'Inputs are too large to compare';
            throw new Error(msg);
        }
        const matrix = createDiffMatrix(a.length, b.length);
        fillDiffMatrix(matrix, a, b);
        return backtrackOperations(matrix, a, b);
    };

    /**
     * Renders character diff operations into paired HTML markup and tallies the change counts.
     * @param {Array<Object>} operations - The diff operations.
     * @param {string} originalText1 - The display text for the first pane.
     * @param {string} originalText2 - The display text for the second pane.
     * @returns {Object} An object with html1, html2, additions, deletions and modifications.
     */
    const renderDiff = (operations, originalText1, originalText2) => {
        const chars1 = Array.from(originalText1);
        const chars2 = Array.from(originalText2);
        let html1 = '';
        let html2 = '';
        let pos1 = 0, pos2 = 0;
        let additions = 0, deletions = 0, modifications = 0;

        operations.forEach((op) => {
            switch (op.type) {
                case 'equal':
                    html1 += `<span class="diff-equal">${escapeHtml(chars1[pos1])}</span>`;
                    html2 += `<span class="diff-equal">${escapeHtml(chars2[pos2])}</span>`;
                    pos1++;
                    pos2++;
                    break;
                case 'delete':
                    html1 += `<span class="diff-deleted">${escapeHtml(chars1[pos1])}</span>`;
                    html2 += `<span class="diff-placeholder"></span>`;
                    pos1++;
                    deletions++;
                    break;
                case 'insert':
                    html1 += `<span class="diff-placeholder"></span>`;
                    html2 += `<span class="diff-added">${escapeHtml(chars2[pos2])}</span>`;
                    pos2++;
                    additions++;
                    break;
                case 'substitute':
                    html1 += `<span class="diff-modified">${escapeHtml(chars1[pos1])}</span>`;
                    html2 += `<span class="diff-modified">${escapeHtml(chars2[pos2])}</span>`;
                    pos1++;
                    pos2++;
                    modifications++;
                    break;
            }
        });

        return { html1, html2, additions, deletions, modifications };
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
     * Computes the similarity percentage between the two sequences from their diff operations.
     * @param {Array<Object>} operations - The diff operations.
     * @returns {number} The similarity as an integer percentage.
     */
    const calculateSimilarity = (operations) => {
        const equalOps = operations.filter((op) => op.type === 'equal').length;
        const len1 = operations.filter((op) => op.type === 'equal' || op.type === 'delete' || op.type === 'substitute').length;
        const len2 = operations.filter((op) => op.type === 'equal' || op.type === 'insert' || op.type === 'substitute').length;
        return Math.round((equalOps / Math.max(len1, len2, 1)) * 100);
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
     * Computes line-level diff statistics between two newline-separated strings.
     * @param {string} compare1 - The first comparison string.
     * @param {string} compare2 - The second comparison string.
     * @returns {Object} An object with additions, deletions and modifications line counts.
     */
    const computeLineDiff = (compare1, compare2) => {
        const lines1 = compare1.split('\n');
        const lines2 = compare2.split('\n');
        const matrix = createDiffMatrix(lines1.length, lines2.length);
        fillDiffMatrix(matrix, lines1, lines2);
        const ops = backtrackOperations(matrix, lines1, lines2);
        return {
            additions: ops.filter((o) => o.type === 'insert').length,
            deletions: ops.filter((o) => o.type === 'delete').length,
            modifications: ops.filter((o) => o.type === 'substitute').length
        };
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
     * Writes the rendered diff into the output panes, or a no-changes message when sequences are identical.
     * @param {Array<Object>} operations - The diff operations.
     * @param {Object} result - The render result containing html1 and html2.
     * @returns {void}
     */
    const renderOutputs = (operations, result) => {
        if (operations.every(op => op.type === 'equal')) {
            const msg = `<div class="diff-no-changes">${globalThis.toolsI18n?.textCompare?.noChanges || 'No differences found'}</div>`;
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
     * @param {Object} result - The render result with additions, deletions and modifications.
     * @param {number} equalCount - The count of equal characters.
     * @param {Object} lineStats - The line-level diff statistics.
     * @param {number} similarity - The similarity percentage.
     * @returns {void}
     */
    const updateStats = (result, equalCount, lineStats, similarity) => {
        const cells = [
            [additionsCount, result.additions],
            [deletionsCount, result.deletions],
            [modificationsCount, result.modifications],
            [equalCharsCount, equalCount],
            [lineAdditionsCount, lineStats.additions],
            [lineDeletionsCount, lineStats.deletions],
            [lineModificationsCount, lineStats.modifications],
            [similarityPercentage, `${similarity}%`]
        ];
        cells.forEach(([el, val]) => { if (el) el.textContent = val; });
    };

    /**
     * Clears the panes and shows the empty-input error status.
     * @returns {void}
     */
    const showEmptyMessage = () => {
        const msg = globalThis.toolsI18n?.textCompare?.errorEmptyTexts || 'Please enter texts to compare';
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
        const msg = `${globalThis.toolsI18n?.textCompare?.error || 'Error'}: ${error.message}`;
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
            const display1 = transformDisplay(text1, options);
            const display2 = transformDisplay(text2, options);
            const compare1 = transformCompare(display1, options);
            const compare2 = transformCompare(display2, options);
            const operations = computeDiff(compare1, compare2);
            const result = renderDiff(operations, display1, display2);

            renderOutputs(operations, result);

            const equalCount = operations.filter((op) => op.type === 'equal').length;
            const lineCompare1 = transformCompare(transformLineSource(text1, options), options);
            const lineCompare2 = transformCompare(transformLineSource(text2, options), options);
            const lineStats = computeLineDiff(lineCompare1, lineCompare2);
            updateStats(result, equalCount, lineStats, calculateSimilarity(operations));

            updateDonut({
                equal: equalCount,
                added: result.additions,
                deleted: result.deletions,
                modified: result.modifications
            });

            setMode('diff');
            compareStats.style.display = 'grid';
            const total = result.additions + result.deletions + result.modifications;
            const doneLabel = globalThis.toolsI18n?.textCompare?.comparisonDone || 'Comparison complete';
            const noChangesLabel = globalThis.toolsI18n?.textCompare?.noChanges || 'No differences found';
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
