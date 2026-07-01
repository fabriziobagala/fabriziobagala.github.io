/**
 * Renders KaTeX math in the document body when the auto-render helper is loaded.
 * @returns {void}
 */
(() => {
  if (typeof renderMathInElement !== 'function') return;
  renderMathInElement(document.body, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: String.raw`\[`, right: String.raw`\]`, display: true },
      { left: '$', right: '$', display: false },
      { left: String.raw`\(`, right: String.raw`\)`, display: false },
    ],
    throwOnError: false,
  });
})();
