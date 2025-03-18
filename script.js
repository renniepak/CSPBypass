document.addEventListener('DOMContentLoaded', () => {
    /**
     * Elements from the DOM
     */
    const searchInput = document.getElementById('search');
    const resultsList = document.getElementById('results');
    const creditsSpan = document.getElementById('credits');

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
            creditsSpan.textContent = data.trim().split('\r\n').join(', ');
        } catch (error) {
            console.error('Error fetching credits:', error);
        }
    };

    /**
     * Displays the search results in the results list.
     * @param {Array} data - The data to display.
     */
    const displayResults = (data) => {
        resultsList.innerHTML = data.length ?
            data.map(item => `<li><strong>${htmlEncode(item.domain)}</strong><br><br>${htmlEncode(item.code)}</li>`).join('') :
            '<li>No results found</li>';
    };

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
     * Filters the data based on query items and displays the results.
     * @param {Array} queryItems - The items to filter by.
     */
    const filterAndDisplay = (queryItems) => {
        const results = tsvData.filter(data =>
            queryItems.some(item => data.domain.includes(item) || data.code.includes(item))
        );
        displayResults(results);
    };

    /**
     * Applies the search logic based on the query.
     * @param {string} query - The search query.
     */
    const applySearch = (query) => {
        const trimmedQuery = query.trim().toLowerCase();
        if (!trimmedQuery) {
            resultsList.innerHTML = '';
            return;
        }

        if (trimmedQuery.includes('script-src') || trimmedQuery.includes('default-src')) {
            const directive = trimmedQuery.includes('script-src') ? 'script-src' : 'default-src';
            const cspDirective = trimmedQuery.split(directive)[1]?.split(';')[0]?.trim();
            if (cspDirective) {
                const processedItems = processCSPDirective(cspDirective);
                filterAndDisplay(processedItems);
                return;
            }
        }

        const results = tsvData.filter(item =>
            item.domain.toLowerCase().includes(trimmedQuery) ||
            item.code.toLowerCase().includes(trimmedQuery)
        );
        displayResults(results);
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