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
     * Parses a single CSP source token into a structured object.
     * Handles wildcards (*.example.com), exact hosts, path constraints,
     * and protocol enforcement per the W3C CSP spec.
     *
     * @param {string} token - A single CSP source token.
     * @returns {{ scheme: string|null, host: string, wildcardSubdomain: boolean, pathPrefix: string|null }}
     */
    const parseCSPSource = (token) => {
        // Handle bare scheme like "https:" — matches all URLs with that scheme
        if (/^[a-z][a-z0-9+\-.]*:$/i.test(token)) {
            return { scheme: token.slice(0, -1).toLowerCase(), host: '*', wildcardSubdomain: false, pathPrefix: null };
        }

        // Extract scheme if present (e.g. https://)
        let scheme = null;
        let rest = token;
        const schemeMatch = token.match(/^([a-z][a-z0-9+\-.]*):\/\//i);
        if (schemeMatch) {
            scheme = schemeMatch[1].toLowerCase();
            rest = token.slice(schemeMatch[0].length);
        }

        // Separate host from path
        const slashIdx = rest.indexOf('/');
        let host = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
        // CSP path prefix: present only if a slash exists after the host
        const pathPrefix = slashIdx === -1 ? null : rest.slice(slashIdx);

        // Strip port number (CSP ports would need their own matching logic — for now ignored)
        host = host.split(':')[0].toLowerCase();

        // Detect wildcard subdomain (*.example.com)
        const wildcardSubdomain = host.startsWith('*.');
        if (wildcardSubdomain) {
            host = host.slice(2); // remove "*."
        }

        return { scheme, host, wildcardSubdomain, pathPrefix };
    };

    /**
     * Tests whether a TSV entry is allowed by a single parsed CSP source.
     * Extracts the URL from the code snippet (src="...") and matches scheme,
     * host, and path prefix per the CSP spec.
     *
     * Path matching rule: the CSP path is a prefix.
     *   https://example.com/gtag/js  → allows /gtag/js and /gtag/js/anything
     *                                   but NOT /gtag/jsloader or /gtag/other
     *
     * @param {string} entryDomain - Domain column from the TSV.
     * @param {string} entryCode   - Code column (HTML snippet containing a URL).
     * @param {object} cspSource   - Output of parseCSPSource().
     * @returns {boolean}
     */
    const matchesCspSource = (entryDomain, entryCode, cspSource) => {
        // Try to extract the URL from src="..." or href="..." in the code snippet.
        // Only fall back to the domain column if the code has no explicit URL — otherwise
        // the synthetic https:// fallback would bypass scheme-specific CSP tokens.
        const urlMatch = entryCode.match(/(?:src|href)=["']?([^"' >]+)/i);
        const candidateUrls = urlMatch
            ? [urlMatch[1]]
            : ['https://' + entryDomain];

        for (const candidate of candidateUrls) {
            const m = candidate.match(/^([a-z][a-z0-9+\-.]*):\/\/([^/?#]+)(\/[^?#]*)?/i);
            if (!m) continue;

            const urlScheme = m[1].toLowerCase();
            const urlHost   = m[2].split(':')[0].toLowerCase(); // strip port
            const urlPath   = m[3] || '/';

            const { scheme, host, wildcardSubdomain, pathPrefix } = cspSource;

            // 1. Scheme check — only enforced when the CSP token included a scheme
            if (scheme && scheme !== urlScheme) continue;

            // 2. Host check
            if (host !== '*') {
                if (wildcardSubdomain) {
                    // *.example.com matches sub.example.com but NOT example.com itself
                    if (!urlHost.endsWith('.' + host)) continue;
                } else {
                    if (urlHost !== host) continue;
                }
            }

            // 3. Path prefix check (only when a path was specified in the CSP token)
            if (pathPrefix && pathPrefix !== '/') {
                // Per spec: path is a prefix match at a path-segment boundary.
                // /gtag/js allows /gtag/js and /gtag/js/foo but NOT /gtag/jsloader
                const prefixWithSlash = pathPrefix.endsWith('/') ? pathPrefix : pathPrefix + '/';
                if (urlPath !== pathPrefix && !urlPath.startsWith(prefixWithSlash)) continue;
            }

            return true;
        }
        return false;
    };

    const processCSPDirective = (cspDirective) => {
        const keywords = new Set([
            "'self'", "'unsafe-inline'", "'unsafe-eval'", "'none'",
            "'strict-dynamic'", "'wasm-unsafe-eval'", "'report-sample'"
        ]);
        return cspDirective
            .split(/\s+/)
            .filter(token =>
                token &&
                !keywords.has(token.toLowerCase()) &&
                !token.match(/^'(nonce|sha(256|384|512))-/i)
            )
            .map(parseCSPSource);
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

        // Use normalizedQuery (original case) for CSP parsing so URL paths match correctly
        const directives = parseCSPDirectives(normalizedQuery);
        const effectiveScriptSrc = directives['script-src'] || directives['default-src'] || '';
        // Per CSP3 spec: if a hash OR nonce is present, 'unsafe-inline' is ignored by the browser
        // for ALL inline checks (script elements and event handlers alike).
        // Hashes don't *allow* event handlers — they suppress unsafe-inline entirely.
        // Only warn about unsafe-inline when there are no hashes or nonces neutralising it.
        const hasNonceOrHash = /(^|\s)'nonce-[^\s']+'/i.test(effectiveScriptSrc) ||
            /(^|\s)'sha(256|384|512)-[^\s']+'/i.test(effectiveScriptSrc);
        const showUnsafeInline = /(^|\s)'unsafe-inline'/i.test(effectiveScriptSrc) && !hasNonceOrHash;

        if (trimmedQuery.includes('script-src') || trimmedQuery.includes('default-src')) {
            const directive = trimmedQuery.includes('script-src') ? 'script-src' : 'default-src';
            // Use the case-preserved directive value for accurate URL matching
            const cspDirective = directives[directive];
            if (cspDirective) {
                const processedItems = processCSPDirective(cspDirective);
                const results = tsvData.filter(data =>
                    processedItems.some(source => matchesCspSource(data.domain, data.code, source))
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
