document.addEventListener('DOMContentLoaded', () => {
    /**
     * Elements from the DOM
     */
    const searchInput = document.getElementById('search');
    const resultsList = document.getElementById('results');
    const resultsCount = document.getElementById('resultsCount');
    const creditsSpan = document.getElementById('credits');
    const copyStatus = document.getElementById('copy-status'); // Screen‑reader only
    const toast = document.getElementById('toast');            // Visible toast

    /**
     * Data variables
     */
    let tsvData = [];
    let debounceTimeout;

    /**
     * Encodes a string to prevent HTML injection.
     * @param {string} str - The string to encode.
     * @returns {string} - The encoded string.
     */
    const htmlEncode = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    /**
     * Debounces a function to limit the rate at which it can fire.
     * @param {Function} func - The function to debounce.
     * @param {number} delay - The delay in milliseconds.
     * @returns {Function} - The debounced function.
     */
    const debounce = (func, delay) => {
        return (...args) => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => func(...args), delay);
        };
    };

    /**
     * Parses TSV data into an array of objects.
     * @param {string} tsv - The TSV data as a string.
     * @returns {Array} - An array of parsed objects.
     */
    const parseTSV = (tsv) => {
        return tsv
            .trim()
            // Split on newlines, then ignore the first line (which is presumably headers)
            .split('\n')
            .slice(1)
            .map(line => {
                line = line.trim();
                // This regex captures:
                //   ^(\S+)       => first sequence of non-whitespace (domain)
                //   \s+          => the first block of whitespace
                //   (.*)         => everything else (the code) as the second capture
                const match = line.match(/^(\S+)\s+(.*)$/);

                // If the line doesn't match our pattern, skip it
                if (!match) return null;

                // match[1] = domain, match[2] = entire code block
                const domain = match[1];
                const code = match[2];

                return domain && code ? {
                    domain,
                    code
                } : null;
            })
            .filter(Boolean);
    };

    /**
     * Shows a short-lived toast message.
     * @param {string} message - The message to display.
     */
    const showToast = (message) => {
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(showToast.timeoutId);
        showToast.timeoutId = setTimeout(() => toast.classList.remove('show'), 1500);
    };

    /**
     * Fetches and displays credits from GitHub.
     */
    const fetchCredits = async () => {
        try {
            const response = await fetch('https://api.github.com/repos/renniepak/CSPBypass/contents/credits.txt?ref=main', {
                headers: {
                    'Accept': 'application/vnd.github.v3.raw'
                }
            });
            const data = await response.text();
            creditsSpan.textContent = data.trim().split(/\r?\n/).join(', ');
        } catch (error) {
            console.error('Error fetching credits:', error);
        }
    };

    /**
     * Displays the search results in the results list.
     * @param {Array} data - The data to display.
     */
    const displayResults = (data, options = {}) => {
        const { showUnsafeInline } = options;
        const warningRow = showUnsafeInline
            ? `<li class="result-warning"><strong>NOTICE</strong><br><br><span class="code">'unsafe-inline' allows the execution of unsafe in-page scripts and event handlers.</span></li>`
            : '';

        if (!data.length) {
            resultsList.innerHTML = warningRow || '<li>No results found</li>';
            resultsCount.textContent = showUnsafeInline ? 1 : 0;
            return;
        }

        resultsList.innerHTML =
            warningRow +
            data.map(item => `<li><strong>${htmlEncode(item.domain)}</strong><br><br><span class="code">${htmlEncode(item.code)}</span></li>`).join('');
        resultsCount.textContent = data.length + (showUnsafeInline ? 1 : 0);
    };

    /**
     * Copy handler (event delegation on the results <ul>).
     */
    resultsList.addEventListener('click', (event) => {
        const li = event.target.closest('li');
        if (!li || !resultsList.contains(li)) return;
        if (li.classList.contains('result-warning')) return;

        const codeSpan = li.querySelector('.code');
        if (!codeSpan) return;

        const payload = codeSpan.textContent;

        const onCopySuccess = () => {
            // Visual feedback
            li.classList.add('copied');
            setTimeout(() => li.classList.remove('copied'), 800);
            showToast('Payload copied 📋');
            // Screen‑reader feedback
            copyStatus.textContent = 'Payload copied';
        };

        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            console.error('Clipboard API not available.');
            return;
        }

        navigator.clipboard.writeText(payload)
            .then(onCopySuccess)
            .catch(err => console.error('Clipboard copy failed:', err));
    });

    /**
     * Processes script-src or default-src directives.
     * @param {string} cspDirective - The CSP directive string.
     * @returns {Array} - An array of processed items.
     */
    const processCSPDirective = (cspDirective) => {
        const items = cspDirective.split(' ').flatMap(item => {
            if (item.includes('*')) {
                const cleanItem = item.replace(/https?:\/\//, '').split('*').slice(-2).join('');
                return [cleanItem.startsWith('.') ? cleanItem : '.' + cleanItem];
            }
            return item.includes('.') ? item : [];
        });
        return Array.from(new Set(items));
    };

    /**
     * Parses a CSP header into a directive -> value map.
     * @param {string} csp - The full CSP string.
     * @returns {Object} - Map of directive to value string.
     */
    const parseCSPDirectives = (csp) => {
        const normalized = csp.replace(/\s+/g, ' ').trim();
        return normalized.split(';')
            .map(part => part.trim())
            .filter(Boolean)
            .reduce((acc, part) => {
                const [name, ...rest] = part.split(/\s+/);
                if (!name) return acc;
                acc[name.toLowerCase()] = rest.join(' ');
                return acc;
            }, {});
    };

    /**
     * Applies the search logic based on the query.
     * @param {string} query - The search query.
     */
    const applySearch = (query) => {
        const normalizedQuery = query.replace(/\s+/g, ' ').trim();
        const trimmedQuery = normalizedQuery.toLowerCase();
        if (!trimmedQuery) {
            resultsList.innerHTML = '';
            resultsCount.textContent = 0;
            return;
        }

        const directives = parseCSPDirectives(trimmedQuery);
        const effectiveScriptSrc = directives['script-src'] || directives['default-src'] || '';
        const hasNonceOrHash = /(^|\s)'?nonce-[^\s']+'?/i.test(effectiveScriptSrc) ||
            /(^|\s)'?sha(256|384|512)-[^\s']+'?/i.test(effectiveScriptSrc);
        const showUnsafeInline = effectiveScriptSrc.includes("'unsafe-inline'") && !hasNonceOrHash;

        if (trimmedQuery.includes('script-src') || trimmedQuery.includes('default-src')) {
            const directive = trimmedQuery.includes('script-src') ? 'script-src' : 'default-src';
            const cspDirective = trimmedQuery.split(directive)[1]?.split(';')[0]?.trim();
            if (cspDirective) {
                const processedItems = processCSPDirective(cspDirective);
                const results = tsvData.filter(data =>
                    processedItems.some(item => data.domain.includes(item) || data.code.includes(item))
                );
                displayResults(results, { showUnsafeInline });
                return;
            }
        }

        const results = tsvData.filter(item =>
            item.domain.toLowerCase().includes(trimmedQuery) ||
            item.code.toLowerCase().includes(trimmedQuery)
        );
        displayResults(results, { showUnsafeInline });
    };

    /**
     * Initializes the application by fetching data and setting up event listeners.
     */
    const initialize = async () => {
        await fetchCredits();
        try {
            const response = await fetch('https://api.github.com/repos/renniepak/CSPBypass/contents/data.tsv?ref=main', {
                headers: {
                    'Accept': 'application/vnd.github.v3.raw'
                }
            });
            const data = await response.text();
            tsvData = parseTSV(data);

            if (window.location.hash) {
                const query = decodeURIComponent(window.location.hash.substring(1));
                searchInput.value = query;
                applySearch(query);
            }
        } catch (error) {
            console.error('Error fetching TSV data:', error);
        }

        searchInput.addEventListener('input', debounce(() => {
            const query = searchInput.value;
            applySearch(query);
            window.location.hash = encodeURIComponent(query);
        }, 300));
    };

    // Start the application
    initialize();
});
