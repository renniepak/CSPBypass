document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search');
    const resultsList = document.getElementById('results');
    const creditsSpan = document.getElementById('credits');
    let tsvData = [], debounceTimeout;

    const parseTSV = tsv => tsv.split('\n').slice(1)
        .map(line => {
            const [domain, code] = line.split('\t');
            return domain && code ? { domain, code } : null;
        }).filter(Boolean);

    const fetchCredits = () => {
        fetch('https://api.github.com/repos/renniepak/CSPBypass/contents/credits.txt?ref=main', {
            headers: { 'Accept': 'application/vnd.github.v3.raw' }
        })
        .then(response => response.text())
        .then(data => creditsSpan.textContent = data.split('\r\n').filter(Boolean).join(', '))
        .catch(console.error);
    };

    const displayResults = data => {
        resultsList.innerHTML = data.length ? data.map(item => 
            `<li><strong>${htmlEncode(item.domain)}</strong><br><br>${htmlEncode(item.code)}</li>`
        ).join('') : '<li>No results found</li>';
    };

    const processItems = scriptSrcPart => {
        return [...new Set(scriptSrcPart.split(" ").flatMap(item => {
            if (item.includes('*')) {
                item = item.replace(/https?:\/\//, '').split('*').slice(-2).join('');
                return ['/' + item, item.startsWith('.') ? item : '.' + item].map(i => i.replace('..', '.'));
            }
            return item;
        }).filter(i => i.includes('.')))];
    };

    const filterAndDisplay = (queryItems) => {
        const uniqueResults = new Set();
        queryItems.forEach(item => {
            tsvData.filter(data =>
                (data.domain.includes(item) || data.code.includes(item)) &&
                uniqueResults.add(`${data.domain}-${data.code}`)
            ).forEach(result => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${htmlEncode(result.domain)}</strong><br><br>${htmlEncode(result.code)}`;
                resultsList.appendChild(li);
            });
        });
    };

    const applyScriptSrcSearch = (query, cspSrc) => {
        let scriptSrcPart = query.split(cspSrc)[1]?.split(";")[0].trim() || '';
        let processedItems = processItems(scriptSrcPart);
        resultsList.innerHTML = '';
        filterAndDisplay(processedItems);
    };

    const applySearch = query => {
        if (!query.trim()) return resultsList.innerHTML = '';
        query.includes("script-src") || query.includes("default-src")
            ? applyScriptSrcSearch(query, query.includes("script-src") ? "script-src" : "default-src")
            : displayResults(tsvData.filter(item =>
                item.domain.toLowerCase().includes(query) ||
                item.code.toLowerCase().includes(query)
            ));
    };

    const htmlEncode = str => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    const debounce = (func, delay) => (...args) => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => func.apply(this, args), delay);
    };

    fetchCredits();
    fetch('https://api.github.com/repos/renniepak/CSPBypass/contents/data.tsv?ref=main', {
        headers: { 'Accept': 'application/vnd.github.v3.raw' }
    })
    .then(response => response.text())
    .then(data => {
        tsvData = parseTSV(data);
        if (window.location.hash) {
            const query = decodeURI(window.location.hash.substring(1).toLowerCase());
            searchInput.value = query;
            applySearch(query);
        }
    })
    .catch(console.error);

    searchInput.addEventListener('input', debounce(() => {
        const query = searchInput.value.toLowerCase();
        applySearch(query);
        window.location.hash = query;
    }, 300));
});
