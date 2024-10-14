document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search');
    const resultsList = document.getElementById('results');
    let tsvData = [];
    let debounceTimeout;

    // Function to parse TSV data
    function parseTSV(tsv) {
        const lines = tsv.split('\n');
        const result = [];
        const headers = lines[0].split('\t'); // Splitting by tab for TSV

        for (let i = 1; i < lines.length; i++) { // Skip the first row (header)
            const obj = {};
            const currentLine = lines[i].split('\t'); // Splitting by tab for TSV

            // Skip if the line is empty
            if (currentLine.length < 2) continue; // Ensure at least domain and code are present

            obj.domain = currentLine[0]; // Assuming the first column is Domain
            obj.code = currentLine[1]; // Assuming the second column is Code
            obj.author = currentLine[2] || ''; // Assuming the optional third column is Author

            result.push(obj);
        }

        return result;
    }

    // Function to apply the custom "script-src" search
    function applyScriptSrcSearch(query) {
        // Extract part between 'script-src' and the first semicolon
        let scriptSrcPart = query.split("script-src")[1].split(";")[0].trim();

        // Split the remaining part by spaces
        let items = scriptSrcPart.split(" ");

        // Process each item, handling items with and without "*"
        let prefixedItems = items.flatMap(item => {
            if (item.includes('*')) {
                // Step 1: Remove "http://" and "https://"
                item = item.replace(/https?:\/\//, '');

                // Step 2: Handle "*", keeping the middle part
                let parts = item.split('*');
                if (parts.length >= 2) {
                    item = `${parts[parts.length - 2]}${parts[parts.length - 1]}`;
                }

                // Step 3: Add / and . prefixes to the processed item
                let prefixes = ['/' + item]; // Always add the '/' prefixed version
                if (!item.startsWith('.')) {
                    prefixes.push('.' + item); // Add '.' prefix only if it doesn't start with a dot
                } else {
                    prefixes.push(item);
                }

                // Step 4: Remove double dots after adding the prefixes
                return prefixes.map(prefixedItem => prefixedItem.replace('..', '.'));
            }

            // If no "*", return the item as-is
            return [item];
        });

        // Filter out items that don't contain a dot (to ensure they're domains) or are empty strings
        let processedItems = prefixedItems.filter(item => item.includes('.') && item.trim() !== '');

        // Create a Set to store unique results (both domain and code must be unique)
        let uniqueResults = new Set();

        // Perform search for each prefixed item
        resultsList.innerHTML = ''; // Clear previous results
        processedItems.forEach(item => {
            const filteredData = tsvData.filter(data =>
                (data.domain.includes(item) || data.code.includes(item)) &&
                !uniqueResults.has(`${data.domain}-${data.code}`) // Ensure uniqueness by domain-code combination
            );

            // Log the results found for this search term
            console.log(`Search word: ${item}, Results found:`, filteredData);

            // Add unique results to the set and display them
            filteredData.forEach(result => {
                uniqueResults.add(`${result.domain}-${result.code}`); // Mark this result as seen

                const li = document.createElement('li');
                li.innerHTML = `<strong>${htmlEncode(result.domain)}</strong><br><br>${htmlEncode(result.code)}`;

                if (result.author && result.author.trim() !== '') {
                    li.innerHTML += `<div class="author-footnote">Submitted by ${htmlEncode(result.author)}</div>`;
                }

                resultsList.appendChild(li);
            });
        });
    }



    // Function to apply general search
    function applySearch(query) {
        if (query.includes("script-src")) {
            applyScriptSrcSearch(query);
        } else {
            resultsList.innerHTML = ''; // Clear the results list

            // Filter and display matching results
            const filteredData = tsvData.filter(item =>
                item.domain.toLowerCase().includes(query) ||
                item.code.toLowerCase().includes(query)
            );

            // Display the results
            filteredData.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${htmlEncode(item.domain)}</strong><br><br>${htmlEncode(item.code)}`;

                // Only add the author footnote if it exists and is not an empty string
                if (item.author && item.author.trim() !== '') {
                    li.innerHTML += `<div class="author-footnote">Submitted by ${htmlEncode(item.author)}</div>`;
                }

                resultsList.appendChild(li);
            });
        }
    }

    // Function to create a safe text node that will automatically HTML encode
    function htmlEncode(str) {
        const div = document.createElement('div');
        div.textContent = str; // textContent automatically encodes the string
        return div.innerHTML; // Retrieve the HTML-encoded string
    }

    // Debounce function
    function debounce(func, delay) {
        return function(...args) {
            clearTimeout(debounceTimeout); // Clear the previous timeout
            debounceTimeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Fetch TSV file from GitHub (as per your current logic)
    const apiUrl = 'https://api.github.com/repos/renniepak/CSPBypass/contents/data.tsv?ref=main';

    fetch(apiUrl, {
            headers: {
                'Accept': 'application/vnd.github.v3.raw', // Get raw file content
            },
        })
        .then(response => response.text())
        .then(data => {
            tsvData = parseTSV(data);

            // Trigger search if hash is present
            if (window.location.hash) {
                const queryFromHash = decodeURI(window.location.hash.substring(1).toLowerCase());
                searchInput.value = queryFromHash;
                applySearch(queryFromHash);
            }
        })
        .catch(error => console.error('Error fetching TSV file:', error));

    // Attach input event listener for search
    searchInput.addEventListener('input', debounce(function() {
        const query = searchInput.value.toLowerCase();
        applySearch(query);
        window.location.hash = query; // Update the URL hash
    }, 300)); // Debounce of 300ms
});