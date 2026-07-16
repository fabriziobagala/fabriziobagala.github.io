'use strict';

/**
 * Manages the document color theme: persists a pinned preference, reacts to the
 * OS color-scheme, syncs theme meta tags and wires the theme toggle control.
 */
const Theme = (() => {
  const KEY = 'fb-theme';
  const root = document.documentElement;
  const THEME_COLORS = { dark: '#0a0e14', light: '#ffffff' };

  /**
   * Syncs the color-scheme and theme-color meta tags to the effective theme.
   * @returns {void}
   */
  const syncMeta = () => {
    const pinned = root.dataset.theme === 'light' || root.dataset.theme === 'dark' ? root.dataset.theme : null;
    const effective = pinned || (globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const cs = document.querySelector('meta[name="color-scheme"]');
    if (cs) cs.content = pinned || 'dark light';
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.content = THEME_COLORS[effective];
  };

  /**
   * Applies a pinned theme to the document root and syncs theme meta tags.
   * @param {string} theme - 'light', 'dark', or any other value to clear the pin.
   * @returns {void}
   */
  const apply = (theme) => {
    if (theme === 'light' || theme === 'dark') {
      root.dataset.theme = theme;
    } else {
      delete root.dataset.theme;
    }
    syncMeta();
  };

  /**
   * Restores any stored theme, watches the OS color-scheme and wires the toggle.
   * @returns {void}
   */
  const init = () => {
    let stored = null;
    try { stored = localStorage.getItem(KEY); } catch (err) { console.debug('Theme: localStorage unavailable', err); }
    if (stored) apply(stored);
    syncMeta();

    globalThis.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!root.dataset.theme) syncMeta();
    });

    const btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;

    const labelEl = btn.querySelector('[data-theme-label]');
    /**
     * Computes the theme that the toggle would switch to.
     * @returns {string} 'light' or 'dark'.
     */
    const nextTheme = () => {
      const current =
        root.dataset.theme ||
        (globalThis.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      return current === 'dark' ? 'light' : 'dark';
    };
    /**
     * Updates the toggle tooltip and label to reflect the next theme.
     * @returns {void}
     */
    const syncLabel = () => {
      const text = nextTheme() === 'light' ? btn.dataset.labelLight : btn.dataset.labelDark;
      btn.dataset.tooltip = text;
      if (labelEl) labelEl.textContent = text;
    };

    syncLabel();

    btn.addEventListener('click', () => {
      const next = nextTheme();
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (err) { console.debug('Theme: localStorage unavailable', err); }
      syncLabel();
    });
  };

  return { init };
})();

/**
 * Controls the mobile navigation drawer: toggling, focus handling, inert
 * background content and closing on Escape or wide-viewport resize.
 */
const MobileNav = (() => {
  /**
   * Wires the mobile navigation toggle and its open/close behaviour.
   * @returns {void}
   */
  const init = () => {
    const header = document.querySelector('[data-site-header]');
    const btn = document.querySelector('[data-nav-toggle]');
    if (!header || !btn) return;

    const outside = [document.querySelector('main'), document.querySelector('footer')].filter(Boolean);
    const navList = document.querySelector('[data-nav-list]');
    const labelEl = btn.querySelector('[data-nav-label]');
    /**
     * Sets the toggle's visible label text.
     * @param {string} text - The label to display.
     * @returns {void}
     */
    const setLabel = (text) => { if (labelEl && text) labelEl.textContent = text; };

    /**
     * Closes the mobile navigation drawer and restores background content.
     * @returns {void}
     */
    const close = () => {
      if (header.dataset.mobileOpen !== 'true') return;
      header.dataset.mobileOpen = 'false';
      btn.setAttribute('aria-expanded', 'false');
      setLabel(btn.dataset.labelOpen);
      outside.forEach((el) => el.removeAttribute('inert'));
      btn.focus();
    };
    /**
     * Opens the mobile navigation drawer and makes background content inert.
     * @returns {void}
     */
    const open = () => {
      header.dataset.mobileOpen = 'true';
      btn.setAttribute('aria-expanded', 'true');
      setLabel(btn.dataset.labelClose);
      outside.forEach((el) => el.setAttribute('inert', ''));
      const first = navList?.querySelector('a, button');
      if (first) first.focus();
    };

    btn.addEventListener('click', () => {
      const isOpen = header.dataset.mobileOpen === 'true';
      isOpen ? close() : open();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    globalThis.addEventListener('resize', () => {
      if (globalThis.innerWidth > 880) close();
    });
  };
  return { init };
})();

/**
 * Positions the sliding navigation indicator under the active link and keeps it
 * aligned on layout changes.
 */
const NavIndicator = (() => {
  /**
   * Places the indicator on the active link and observes the list for resizes.
   * @returns {void}
   */
  const init = () => {
    const list = document.querySelector('[data-nav-list]');
    if (!list) return;
    const indicator = document.querySelector('[data-nav-indicator]');
    if (!indicator) return;

    const current = list.querySelector('.nav__link.is-active, .nav__link[aria-current="page"]');

    /**
     * Moves the indicator to cover the current active link.
     * @returns {void}
     */
    const place = () => {
      if (!current) { indicator.style.opacity = '0'; return; }
      indicator.style.transition = 'none';
      indicator.style.opacity = '1';
      indicator.style.setProperty('--indicator-x', `${current.offsetLeft}px`);
      indicator.style.setProperty('--indicator-width', `${current.offsetWidth}px`);
      indicator.getBoundingClientRect();
      indicator.style.transition = '';
    };

    place();
    new ResizeObserver(place).observe(list);
  };
  return { init };
})();

/**
 * Wires contact forms: client-side validation, AJAX submission and success or
 * error result panes.
 */
const ContactPanes = (() => {
  /**
   * Attaches validation, input handlers and submit logic to one contact form.
   * @param {HTMLFormElement} form - The contact form to wire up.
   * @returns {void}
   */
  const wireForm = (form) => {
    const maxMessage = Number.parseInt(form.dataset.maxMessage || '2000', 10);
    const msgRequired = form.dataset.i18nRequired;
    const msgEmail = form.dataset.i18nEmail;
    const submitBtn = form.querySelector('[type="submit"]');
    const pane = form.closest('[data-contact-pane]');
    const results = pane ? pane.querySelectorAll('[data-contact-result]') : [];
    /**
     * Finds the result panel for a given outcome kind.
     * @param {string} kind - The result kind, e.g. 'success' or 'error'.
     * @returns {HTMLElement|null} The matching result panel, or null.
     */
    const resultOf = (kind) =>
      pane ? pane.querySelector(`[data-contact-result="${kind}"]`) : null;

    /**
     * Finds the field wrapper containing an input.
     * @param {HTMLInputElement} input - The input element.
     * @returns {HTMLElement|null} The enclosing field element, or null.
     */
    const fieldOf = (input) => input.closest('.field');
    /**
     * Finds the error message element for an input's field.
     * @param {HTMLInputElement} input - The input element.
     * @returns {HTMLElement|null} The error element, or null.
     */
    const errorOf = (input) => {
      const f = fieldOf(input);
      return f ? f.querySelector('[data-field-error]') : null;
    };

    /**
     * Marks an input invalid and shows an error message.
     * @param {HTMLInputElement} input - The input to flag.
     * @param {string} message - The error message to display.
     * @returns {void}
     */
    const setError = (input, message) => {
      const f = fieldOf(input);
      const err = errorOf(input);
      if (f) f.classList.add('field--invalid');
      input.setAttribute('aria-invalid', 'true');
      if (err) { err.textContent = message; err.hidden = false; }
    };

    /**
     * Clears the invalid state and error message for an input.
     * @param {HTMLInputElement} input - The input to clear.
     * @returns {void}
     */
    const clearError = (input) => {
      const f = fieldOf(input);
      const err = errorOf(input);
      if (f) f.classList.remove('field--invalid');
      input.removeAttribute('aria-invalid');
      if (err) { err.textContent = ''; err.hidden = true; }
    };

    /**
     * Validates all fields, flagging errors as needed.
     * @returns {HTMLInputElement|null} The first invalid input, or null if valid.
     */
    const validate = () => {
      let firstInvalid = null;
      form.querySelectorAll('.field__input').forEach((input) => {
        const value = input.value.trim();
        clearError(input);
        if (input.required && !value) {
          setError(input, msgRequired);
          firstInvalid = firstInvalid || input;
        } else if (value && input.validity.typeMismatch) {
          setError(input, msgEmail);
          firstInvalid = firstInvalid || input;
        }
      });
      return firstInvalid;
    };

    form.querySelectorAll('.field__input').forEach((input) => {
      input.addEventListener('input', () => {
        if (fieldOf(input)?.classList.contains('field--invalid')) clearError(input);
      });
    });

    /**
     * Hides the form and shows the result panel for the given outcome kind.
     * @param {string} kind - The result kind, e.g. 'success' or 'error'.
     * @returns {void}
     */
    const showResult = (kind) => {
      const panel = resultOf(kind);
      if (!panel) return;
      form.hidden = true;
      results.forEach((p) => { p.hidden = p !== panel; });
      const again = panel.querySelector('[data-contact-reset]');
      if (again) again.focus();
    };

    /**
     * Hides result panels, resets the form and restores it for re-entry.
     * @returns {void}
     */
    const restoreForm = () => {
      results.forEach((p) => { p.hidden = true; });
      form.reset();
      form.hidden = false;
      const first = form.querySelector('.field__input');
      if (first) first.focus();
    };

    results.forEach((panel) => {
      const again = panel.querySelector('[data-contact-reset]');
      if (again) again.addEventListener('click', restoreForm);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstInvalid = validate();
      if (firstInvalid) { firstInvalid.focus(); return; }

      const message = form.elements.message;
      if (message && message.value.length > maxMessage) {
        message.value = message.value.substring(0, maxMessage);
      }

      form.classList.add('is-sending');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          form.reset();
          showResult('success');
        } else {
          showResult('error');
        }
      } catch {
        showResult('error');
      } finally {
        form.classList.remove('is-sending');
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  };

  /**
   * Wires every contact form on the page.
   * @returns {void}
   */
  const initForms = () => {
    document.querySelectorAll('[data-contact-form]').forEach(wireForm);
  };

  return { init: () => { initForms(); } };
})();

/**
 * Client-side blog search: lazily fetches the post index, filters posts by
 * query terms and renders matching results.
 */
const BlogSearch = (() => {
  const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /**
   * Escapes HTML-special characters in a value.
   * @param {string} s - The value to escape.
   * @returns {string} The escaped string.
   */
  const escapeHTML = (s) => String(s).replaceAll(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
  /**
   * Normalises a string to lowercase, accent-free form for matching.
   * @param {string} s - The value to normalise.
   * @returns {string} The normalised string.
   */
  const normalise = (s) => String(s || '').toLowerCase().normalize('NFD').replaceAll(/[̀-ͯ]/g, '');
  const ICON_TAG =
    '<svg class="icon" fill="currentColor" aria-hidden="true" focusable="false" viewBox="0 0 512 512"><path d="M32.5 96l0 149.5c0 17 6.7 33.3 18.7 45.3l192 192c25 25 65.5 25 90.5 0L483.2 333.3c25-25 25-65.5 0-90.5l-192-192C279.2 38.7 263 32 246 32L96.5 32c-35.3 0-64 28.7-64 64zm112 16a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>';

  /**
   * Renders a tag chip list item.
   * @param {Object} t - The tag with url and name properties.
   * @returns {string} The tag chip HTML.
   */
  const renderTag = (t) =>
    `<li class="tag-list__item"><a class="tag-chip" href="${escapeHTML(t.url)}" rel="tag">${ICON_TAG}<span>${escapeHTML(t.name)}</span></a></li>`;

  /**
   * Renders a single post search result list item.
   * @param {Object} post - The post record to render.
   * @returns {string} The post list item HTML.
   */
  const renderItem = (post) => {
    const tags = (post.tags || []).map(renderTag).join('');
    const dateDisplay = post.dateDisplay || post.date;
    return `
      <li class="post-list__item">
        <div class="post-list__meta">
          <span class="post__meta-item">
            <time datetime="${escapeHTML(post.date)}">${escapeHTML(dateDisplay)}</time>
          </span>
          <span class="post__meta-item">
            <span>${escapeHTML(String(post.readingTime))} ${escapeHTML(post._labels.minutesRead)}</span>
          </span>
        </div>
        <h2 class="post-list__title"><a href="${escapeHTML(post.url)}">${escapeHTML(post.title)}</a></h2>
        ${post.description ? `<p class="post-list__excerpt">${escapeHTML(post.description)}</p>` : ''}
        ${tags ? `<ul class="tag-list">${tags}</ul>` : ''}
      </li>
    `;
  };

  /**
   * Builds the normalised searchable text for a post.
   * @param {Object} post - The post record.
   * @returns {string} The normalised haystack string.
   */
  const haystackOf = (post) => [
    post.title, post.description || '',
    (post.tags || []).map((t) => `${t.name} ${t.slug}`).join(' '),
    post.summary || '',
  ].map(normalise).join(' ');

  /**
   * Tests whether a post matches every term in a query.
   * @param {Object} post - The post record.
   * @param {string} query - The normalised search query.
   * @returns {boolean} True if the post matches the query.
   */
  const matches = (post, query) => {
    if (!query) return true;
    const hay = haystackOf(post);
    return query.split(/\s+/).filter(Boolean).every((term) => hay.includes(term));
  };

  /**
   * Builds a mapper that attaches i18n labels to a post record.
   * @param {Object} labels - The labels to attach.
   * @returns {function(Object): Object} A mapper that returns the post with labels.
   */
  const attachLabels = (labels) => (p) => ({ ...p, _labels: labels });

  /**
   * Fetches and parses the post index, attaching labels to each entry.
   * @param {string} url - The index URL.
   * @param {Object} labels - The labels to attach to each post.
   * @returns {Promise<Array<Object>>} A promise resolving to the post records.
   */
  const fetchIndex = (url, labels) =>
    fetch(url, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error(`index fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data) => (data || []).map(attachLabels(labels)));

  /**
   * Wires the blog search input, clear button and lazy index loading.
   * @returns {void}
   */
  const init = () => {
    const root = document.querySelector('[data-blog-search]');
    if (!root) return;

    const input = root.querySelector('[data-blog-search-input]');
    const clearBtn = root.querySelector('[data-blog-search-clear]');
    const status = root.querySelector('[data-blog-search-status]');
    const results = document.querySelector('[data-blog-search-results]');
    const defaultView = document.querySelector('[data-blog-search-default]');
    if (!input || !results || !defaultView || !clearBtn || !status) return;

    const labels = {
      minutesRead: root.dataset.minutesLabel || '',
    };
    const noResultsText = root.dataset.noResults || 'No results.';
    const searchErrorText = root.dataset.searchError || 'Search is unavailable right now. Try again.';
    const resultsCountTpl = root.dataset.resultsCount || '__N__';
    const indexURL = root.dataset.indexUrl;

    const state = { posts: null, pending: null };
    /**
     * Loads the post index once, caching the result and in-flight promise; a
     * failed fetch clears the pending promise so the next call retries.
     * @returns {Promise<Array<Object>>} A promise resolving to the post records.
     */
    const loadIndex = () => {
      if (state.posts) return Promise.resolve(state.posts);
      if (!state.pending) {
        state.pending = fetchIndex(indexURL, labels).then((data) => {
          state.posts = data;
          return data;
        }).catch((err) => {
          state.pending = null;
          throw err;
        });
      }
      return state.pending;
    };

    /**
     * Shows the default (non-search) view and clears any results.
     * @returns {void}
     */
    const showDefault = () => {
      results.hidden = true;
      results.innerHTML = '';
      defaultView.hidden = false;
      status.hidden = true;
      status.textContent = '';
      clearBtn.hidden = !input.value;
    };

    /**
     * Renders the filtered results and result count for a query.
     * @param {string} query - The normalised search query.
     * @returns {void}
     */
    const showResults = (query) => {
      defaultView.hidden = true;
      results.hidden = false;
      clearBtn.hidden = false;

      const filtered = state.posts.filter((p) => matches(p, query));
      if (filtered.length === 0) {
        results.innerHTML = '';
        status.textContent = noResultsText;
        status.hidden = false;
        return;
      }
      results.innerHTML = filtered.map(renderItem).join('');
      status.textContent = resultsCountTpl.replace('__N__', String(filtered.length));
      status.hidden = false;
    };

    /**
     * Shows the search-unavailable error status for the results area.
     * @returns {void}
     */
    const showSearchError = () => {
      defaultView.hidden = true;
      results.hidden = false;
      results.innerHTML = '';
      status.textContent = searchErrorText;
      status.hidden = false;
    };

    /**
     * Reads the input, loads the index and renders matching results, ignoring
     * responses that arrive after the input has changed.
     * @returns {void}
     */
    const runSearch = () => {
      const raw = input.value.trim();
      if (!raw) { showDefault(); return; }
      const query = normalise(raw);
      loadIndex().then(() => {
        if (normalise(input.value.trim()) !== query) return;
        showResults(query);
      }).catch((err) => {
        console.debug('BlogSearch: index load failed', err);
        if (normalise(input.value.trim()) !== query) return;
        showSearchError();
      });
    };

    let timer = null;
    /**
     * Debounces search execution on input and toggles the clear button.
     * @returns {void}
     */
    const onInput = () => {
      clearBtn.hidden = !input.value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(runSearch, 120);
    };

    input.addEventListener('input', onInput);
    clearBtn.addEventListener('click', () => {
      input.value = '';
      input.focus();
      showDefault();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value) {
        input.value = '';
        showDefault();
      }
    });

    input.addEventListener('focus', () => { loadIndex(); }, { once: true });
  };

  return { init };
})();

/**
 * Enhances rendered code blocks with a language label and a copy-to-clipboard
 * button.
 */
const CodeBlocks = (() => {
  const ICON_COPY =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
  const ICON_CHECK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12l5 5L20 7"/></svg>';

  const LANG_LABELS = {
    cs: 'C#', csharp: 'C#', fs: 'F#', fsharp: 'F#',
    js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX',
    ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX',
    py: 'Python', python: 'Python',
    rb: 'Ruby', go: 'Go', rs: 'Rust', kt: 'Kotlin',
    sh: 'Shell', bash: 'Bash', zsh: 'Zsh', ps: 'PowerShell', powershell: 'PowerShell',
    html: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'Sass',
    json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', xml: 'XML',
    md: 'Markdown', markdown: 'Markdown',
    sql: 'SQL', dockerfile: 'Dockerfile', docker: 'Dockerfile',
    cpp: 'C++', 'c++': 'C++', c: 'C', java: 'Java', php: 'PHP',
    diff: 'Diff', plaintext: 'Text', text: 'Text', txt: 'Text',
  };

  /**
   * Resolves a human-readable language label from a raw language key.
   * @param {string} raw - The raw language identifier.
   * @returns {string} The display label.
   */
  const labelFor = (raw) => {
    if (!raw) return 'Text';
    const key = raw.toLowerCase();
    return LANG_LABELS[key] || (key.charAt(0).toUpperCase() + key.slice(1));
  };

  /**
   * Reads the localized copy and copied button labels.
   * @returns {Object} An object with copy and copied label strings.
   */
  const labels = () => {
    const d = document.documentElement.dataset;
    return { copy: d.i18nCopy || 'Copy', copied: d.i18nCopied || 'Copied', failed: d.i18nCopyFailed || 'Copy failed' };
  };

  /**
   * Adds a language label and copy-to-clipboard control to a code block.
   * @param {HTMLElement} block - The highlight block to enhance.
   * @returns {void}
   */
  const enhance = (block) => {
    if (block.dataset.enhanced === 'true') return;
    const code = block.querySelector('pre code');
    if (!code) return;
    block.dataset.enhanced = 'true';

    const lang = labelFor(code.dataset.lang || '');
    const { copy, copied, failed } = labels();

    const header = document.createElement('div');
    header.className = 'highlight__header';
    header.innerHTML =
      `<span class="highlight__lang">${lang}</span>` +
      `<button type="button" class="highlight__copy" aria-label="${copy}">` +
      `<span class="highlight__copy-icon">${ICON_COPY}</span>` +
      `<span class="highlight__copy-label">${copy}</span>` +
      `</button>`;
    block.prepend(header);

    const btn = header.querySelector('.highlight__copy');
    const iconSpan = header.querySelector('.highlight__copy-icon');
    const labelSpan = header.querySelector('.highlight__copy-label');
    let timer = null;

    /**
     * Restores the copy button to its idle label and icon.
     * @returns {void}
     */
    const reset = () => {
      btn.classList.remove('is-copied', 'is-copy-failed');
      btn.setAttribute('aria-label', copy);
      iconSpan.innerHTML = ICON_COPY;
      labelSpan.textContent = copy;
    };

    /**
     * Shows a transient outcome state on the copy button.
     * @param {string} className - The state class to apply.
     * @param {string} label - The label and accessible name to show.
     * @param {string} icon - The icon markup to show.
     * @returns {void}
     */
    const showState = (className, label, icon) => {
      btn.classList.remove('is-copied', 'is-copy-failed');
      btn.classList.add(className);
      btn.setAttribute('aria-label', label);
      iconSpan.innerHTML = icon;
      labelSpan.textContent = label;
      if (timer) clearTimeout(timer);
      timer = setTimeout(reset, 1800);
    };

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
      } catch (err) {
        console.debug('CodeBlocks: copy failed', err);
        showState('is-copy-failed', failed, ICON_COPY);
        return;
      }
      showState('is-copied', copied, ICON_CHECK);
    });
  };

  /**
   * Enhances every code block on the page.
   * @returns {void}
   */
  const init = () => {
    document.querySelectorAll('.highlight').forEach(enhance);
  };

  return { init };
})();

globalThis.ToolStatus = {
  /**
   * Shows a status message on an element with an optional success/error style.
   * @param {HTMLElement} el - The status element.
   * @param {string} msg - The message to display.
   * @param {string} kind - 'success', 'error', or any other value for neutral.
   * @returns {void}
   */
  set(el, msg, kind) {
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('tool-status--success', kind === 'success');
    el.classList.toggle('tool-status--error', kind === 'error');
  },
  /**
   * Empties a status element and removes its state styling.
   * @param {HTMLElement} el - The status element.
   * @returns {void}
   */
  clear(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.remove('tool-status--success', 'tool-status--error');
  },
};

globalThis.ToolUI = {
  /**
   * Sets a validity state and message on an element.
   * @param {HTMLElement} el - The target element.
   * @param {string} state - The validity state to store on the dataset.
   * @param {string} text - The message text to display.
   * @returns {void}
   */
  setValidity(el, state, text) {
    if (!el) return;
    el.dataset.state = state;
    el.textContent = text || '';
  },
  /**
   * Toggles active and aria-pressed state across a set of tab buttons.
   * @param {Array<HTMLElement>|NodeList} buttons - The tab buttons.
   * @param {string} active - The dataset value identifying the active tab.
   * @param {string} attr - The dataset key to compare against, defaults to 'view'.
   * @returns {void}
   */
  activateTabs(buttons, active, attr = 'view') {
    buttons.forEach((b) => {
      const on = b.dataset[attr] === active;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  },
  /**
   * Creates a debounced wrapper that delays calling the given function.
   * @param {function(): void} fn - The function to debounce.
   * @param {number} ms - The debounce delay in milliseconds, defaults to 150.
   * @returns {function(): void} The debounced runner with a cancel method.
   */
  debounce(fn, ms = 150) {
    let timer = null;
    const run = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, ms);
    };
    run.cancel = () => { if (timer) clearTimeout(timer); };
    return run;
  },
};

/**
 * Wires shared tool-page controls: copy-to-clipboard buttons and
 * Ctrl/Cmd+Enter run shortcuts.
 */
const ToolKit = (() => {
  const ICON_COPY =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
  const ICON_CHECK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12l5 5L20 7"/></svg>';

  /**
   * Reads the localized copy and copied button labels.
   * @returns {Object} An object with copy and copied label strings.
   */
  const copyLabels = () => {
    const d = document.documentElement.dataset;
    return { copy: d.i18nCopy || 'Copy', copied: d.i18nCopied || 'Copied', failed: d.i18nCopyFailed || 'Copy failed' };
  };

  /**
   * Wires a copy button to copy its target element's text to the clipboard.
   * @param {HTMLElement} btn - The copy button.
   * @returns {void}
   */
  const wireCopy = (btn) => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    const { copy, copied, failed } = copyLabels();
    const iconSpan = btn.querySelector('.tool-copy__icon');
    if (iconSpan && !iconSpan.innerHTML.trim()) iconSpan.innerHTML = ICON_COPY;
    let timer = null;
    const hasTooltip = btn.dataset.tooltip !== undefined;
    /**
     * Restores the copy button to its idle label, tooltip and icon.
     * @returns {void}
     */
    const reset = () => {
      btn.classList.remove('is-copied', 'is-copy-failed');
      btn.setAttribute('aria-label', copy);
      if (hasTooltip) btn.dataset.tooltip = copy;
      if (iconSpan) iconSpan.innerHTML = ICON_COPY;
    };
    /**
     * Shows a transient outcome state on the copy button.
     * @param {string} className - The state class to apply.
     * @param {string} label - The label, tooltip and accessible name to show.
     * @param {string} icon - The icon markup to show.
     * @returns {void}
     */
    const showState = (className, label, icon) => {
      btn.classList.remove('is-copied', 'is-copy-failed');
      btn.classList.add(className);
      btn.setAttribute('aria-label', label);
      if (hasTooltip) btn.dataset.tooltip = label;
      if (iconSpan) iconSpan.innerHTML = icon;
      if (timer) clearTimeout(timer);
      timer = setTimeout(reset, 1800);
    };
    btn.addEventListener('click', async () => {
      const target = document.getElementById(btn.dataset.copyTarget);
      if (!target) return;
      const text = 'value' in target ? target.value : target.textContent;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        console.debug('ToolKit: copy failed', err);
        showState('is-copy-failed', failed, ICON_COPY);
        return;
      }
      showState('is-copied', copied, ICON_CHECK);
    });
  };

  /**
   * Wires a Ctrl/Cmd+Enter shortcut that clicks the element's run target.
   * @param {HTMLElement} el - The element to bind the shortcut to.
   * @returns {void}
   */
  const wireRun = (el) => {
    if (el.dataset.runBound === '1') return;
    el.dataset.runBound = '1';
    el.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById(el.dataset.run)?.click();
      }
    });
  };

  /**
   * Wires every copy button and run-shortcut element on the page.
   * @returns {void}
   */
  const init = () => {
    document.querySelectorAll('[data-copy-target]').forEach(wireCopy);
    document.querySelectorAll('[data-run]').forEach(wireRun);
  };

  return { init };
})();

/**
 * Adds a synced line-number gutter to numbered textareas.
 */
const TextareaNumbered = (() => {
  /**
   * Builds a newline-separated run of line numbers for the given text.
   * @param {string} text - The textarea content.
   * @returns {string} The line numbers, one per line.
   */
  const lineNumbers = (text) => {
    const count = text.length === 0 ? 1 : text.split('\n').length;
    const buf = new Array(count);
    for (let i = 0; i < count; i++) buf[i] = String(i + 1);
    return buf.join('\n');
  };

  /**
   * Wires a textarea's gutter to track its content and scroll position.
   * @param {HTMLElement} wrapper - The wrapper containing the textarea and gutter.
   * @returns {void}
   */
  const attach = (wrapper) => {
    const textarea = wrapper.querySelector('textarea');
    const gutter = wrapper.querySelector('.textarea-numbered__gutter');
    if (!textarea || !gutter) return;

    /**
     * Recomputes the gutter line numbers from the textarea content.
     * @returns {void}
     */
    const update = () => { gutter.textContent = lineNumbers(textarea.value); };
    /**
     * Syncs the gutter scroll position to the textarea.
     * @returns {void}
     */
    const syncScroll = () => { gutter.scrollTop = textarea.scrollTop; };

    update();
    textarea.addEventListener('input', update);
    textarea.addEventListener('scroll', syncScroll, { passive: true });

    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (descriptor?.set) {
      Object.defineProperty(textarea, 'value', {
        configurable: true,
        get() { return descriptor.get.call(this); },
        set(v) { descriptor.set.call(this, v); update(); },
      });
    }
  };

  /**
   * Attaches a numbered gutter to every numbered textarea on the page.
   * @returns {void}
   */
  const init = () => {
    document.querySelectorAll('[data-numbered]').forEach(attach);
  };

  return { init };
})();

/**
 * Manages the "more technologies" modal dialog and its tablist navigation.
 */
const StackMore = (() => {
  /**
   * Wires keyboard and click tab navigation within the dialog.
   * @param {HTMLElement} dialog - The dialog containing the tablist.
   * @returns {void}
   */
  const initTabs = (dialog) => {
    const tabs = Array.from(dialog.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));

    /**
     * Activates the tab at the given index and reveals its panel.
     * @param {number} index - The tab index to activate.
     * @param {boolean} focus - Whether to focus the activated tab, defaults to true.
     * @returns {void}
     */
    const activate = (index, focus = true) => {
      tabs.forEach((tab, i) => {
        const selected = i === index;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.setAttribute('tabindex', selected ? '0' : '-1');
        if (panels[i]) panels[i].hidden = !selected;
      });
      if (focus) tabs[index].focus();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => activate(i));
      tab.addEventListener('keydown', (e) => {
        const last = tabs.length - 1;
        let next = null;
        if (e.key === 'ArrowRight') next = i === last ? 0 : i + 1;
        else if (e.key === 'ArrowLeft') next = i === 0 ? last : i - 1;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = last;
        if (next !== null) {
          e.preventDefault();
          activate(next);
        }
      });
    });
  };

  /**
   * Wires the trigger, dialog dismissal and tablist for the modal.
   * @returns {void}
   */
  const init = () => {
    const trigger = document.querySelector('[data-stack-more-trigger]');
    const dialog = document.querySelector('[data-stack-more-popover]');
    if (!trigger || !dialog || typeof dialog.showModal !== 'function') return;

    /**
     * Opens the modal dialog.
     * @returns {void}
     */
    const open = () => {
      trigger.setAttribute('aria-expanded', 'true');
      dialog.showModal();
    };

    /**
     * Closes the modal dialog if open.
     * @returns {void}
     */
    const close = () => {
      if (dialog.open) dialog.close();
    };

    trigger.addEventListener('click', open);

    dialog.addEventListener('close', () => {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus({ preventScroll: true });
    });

    dialog.querySelectorAll('[data-stack-more-close]').forEach((el) => {
      el.addEventListener('click', close);
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close();
    });

    initTabs(dialog);
  };

  return { init };
})();

/**
 * Wires post-share controls: copy-link buttons and the Mastodon instance dialog.
 */
const PostShare = (() => {
  /**
   * Sets a share button's label text and accessible label.
   * @param {HTMLElement} btn - The share button.
   * @param {HTMLElement|null} labelEl - The label element, or null.
   * @param {string} text - The text to apply.
   * @returns {void}
   */
  const setCopyState = (btn, labelEl, text) => {
    if (labelEl) labelEl.textContent = text;
    btn.setAttribute('aria-label', text);
  };

  /**
   * Wires a copy-link button to copy the share URL to the clipboard.
   * @param {HTMLElement} btn - The copy-link button.
   * @returns {void}
   */
  const wireCopyButton = (btn) => {
    const url = btn.dataset.shareUrl;
    if (!url) return;
    const labelEl = btn.querySelector('.share-btn__label');
    const copyText = btn.dataset.labelCopy || 'Copy link';
    const copiedText = btn.dataset.labelCopied || 'Copied';
    const failedText = btn.dataset.labelCopyFailed || 'Copy failed';
    let timer = null;

    /**
     * Restores the share button to its idle label.
     * @returns {void}
     */
    const reset = () => {
      btn.classList.remove('is-copied', 'is-copy-failed');
      setCopyState(btn, labelEl, copyText);
    };

    /**
     * Copies the share URL and shows the copied state briefly.
     * @returns {Promise<void>} A promise that resolves once handling completes.
     */
    const handleClick = async () => {
      try {
        await navigator.clipboard.writeText(url);
      } catch (err) {
        console.debug('PostShare: copy failed', err);
        btn.classList.add('is-copy-failed');
        setCopyState(btn, labelEl, failedText);
        if (timer) clearTimeout(timer);
        timer = setTimeout(reset, 1800);
        return;
      }
      btn.classList.add('is-copied');
      setCopyState(btn, labelEl, copiedText);
      if (timer) clearTimeout(timer);
      timer = setTimeout(reset, 1800);
    };

    btn.addEventListener('click', handleClick);
  };

  const MASTODON_KEY = 'fb-mastodon-instance';
  const MASTODON_DEFAULT = 'mastodon.social';

  /**
   * Normalises a raw Mastodon instance entry to a bare host name.
   * @param {string} raw - The raw instance value.
   * @returns {string} The normalised host name, or an empty string.
   */
  const normaliseInstance = (raw) => {
    if (!raw) return '';
    const host = String(raw).trim().replace(/^https?:\/\//i, '');
    return (host.split('/')[0] || '').toLowerCase();
  };

  /**
   * Wires the Mastodon share dialog: open, dismissal and submit handling.
   * @returns {void}
   */
  const wireMastodonDialog = () => {
    const dialog = document.querySelector('[data-share-mastodon-dialog]');
    const trigger = document.querySelector('[data-share-mastodon-trigger]');
    if (!dialog || !trigger || typeof dialog.showModal !== 'function') return;

    const form = dialog.querySelector('[data-share-mastodon-form]');
    const input = dialog.querySelector('input[name="instance"]');
    const url = dialog.dataset.shareUrl;
    const title = dialog.dataset.shareTitle || '';
    if (!form || !input || !url) return;

    /**
     * Opens the Mastodon dialog, prefilling the stored or default instance.
     * @returns {void}
     */
    const open = () => {
      let stored = '';
      try { stored = localStorage.getItem(MASTODON_KEY) || ''; } catch (err) { console.debug('Mastodon: localStorage unavailable', err); }
      input.value = stored || MASTODON_DEFAULT;
      dialog.showModal();
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    };

    /**
     * Closes the Mastodon dialog if open.
     * @returns {void}
     */
    const close = () => {
      if (dialog.open) dialog.close();
    };

    trigger.addEventListener('click', open);

    dialog.addEventListener('close', () => {
      trigger.focus({ preventScroll: true });
    });

    dialog.querySelectorAll('[data-share-mastodon-cancel]').forEach((el) => {
      el.addEventListener('click', close);
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const instance = normaliseInstance(input.value);
      if (!instance) {
        input.focus();
        return;
      }
      try { localStorage.setItem(MASTODON_KEY, instance); } catch (err) { console.debug('Mastodon: localStorage unavailable', err); }
      const text = encodeURIComponent(`${title} ${url}`.trim());
      globalThis.open(`https://${instance}/share?text=${text}`, '_blank', 'noopener,noreferrer');
      close();
    });
  };

  /**
   * Wires every copy-link button and the Mastodon share dialog.
   * @returns {void}
   */
  const init = () => {
    document.querySelectorAll('[data-share-copy]').forEach(wireCopyButton);
    wireMastodonDialog();
  };

  return { init };
})();

/**
 * Tracks whether the user is interacting via pointer or keyboard and mirrors
 * it on the root element's data-input-modality attribute for CSS.
 */
const InputModality = (() => {
  /**
   * Wires the pointerdown and keydown listeners that stamp the modality.
   * @returns {void}
   */
  const init = () => {
    document.addEventListener('pointerdown', () => {
      document.documentElement.dataset.inputModality = 'pointer';
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      document.documentElement.dataset.inputModality = 'keyboard';
    }, true);
  };

  return { init };
})();

/**
 * Lets keyboard users dismiss the CSS tooltips with Escape, per WCAG 1.4.13.
 */
const Tooltips = (() => {
  /**
   * Wires the Escape dismissal and its reset on hover/focus leaving a tooltip.
   * @returns {void}
   */
  const init = () => {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      document.documentElement.classList.add('tooltips-dismissed');
    });
    /**
     * Re-enables tooltips once hover or focus leaves a tooltip element.
     * @param {Event} e - The mouseout or focusout event.
     * @returns {void}
     */
    const clear = (e) => {
      if (e.target instanceof Element && e.target.closest('[data-tooltip]')) {
        document.documentElement.classList.remove('tooltips-dismissed');
      }
    };
    document.addEventListener('mouseout', clear, true);
    document.addEventListener('focusout', clear, true);
  };

  return { init };
})();

/**
 * Syncs the portfolio category filter to the URL hash.
 */
const PortfolioFilter = (() => {
  /**
   * Selects the filter radio matching the current URL hash.
   * @returns {void}
   */
  const apply = () => {
    const match = /^#filter-(.+)$/.exec(location.hash);
    if (!match) return;
    const radio = document.getElementById(`portfolio-filter-${match[1]}`);
    if (radio?.classList.contains('portfolio-radio')) radio.checked = true;
  };

  /**
   * Applies the hash filter on load and on subsequent hash changes.
   * @returns {void}
   */
  const init = () => {
    if (!document.getElementById('portfolio-showcase')) return;
    apply();
    globalThis.addEventListener('hashchange', apply);
  };

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  MobileNav.init();
  InputModality.init();
  Tooltips.init();
  PortfolioFilter.init();
  NavIndicator.init();
  ContactPanes.init();
  BlogSearch.init();
  CodeBlocks.init();
  StackMore.init();
  TextareaNumbered.init();
  PostShare.init();

  const initFns = [
    'initJson',
    'initXml',
    'initBase64Converter',
    'initUuidV4',
    'initTextCompare',
    'initCrypto',
  ];
  initFns.forEach((fn) => { if (typeof globalThis[fn] === 'function') globalThis[fn](); });

  ToolKit.init();
});
