document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search');
    const resultsList = document.getElementById('results');
    let tsvData = [];
    let isTSVLoaded = false;
    let debounceTimeout;

    // Function to create a safe text node that will automatically HTML encode
    function htmlEncode(str) {
        const div = document.createElement('div');
        div.textContent = str; // textContent automatically encodes the string
        return div.innerHTML; // Retrieve the HTML-encoded string
    }

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

    // Function to apply search
    function applySearch(query) {
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


    // Function to update the URL hash
    function updateHash(query) {
        if (query) {
            window.location.hash = query;
        } else {
            window.history.replaceState(null, null, ' '); // Clear the hash if query is empty
        }
    }

    // Debounce function
    function debounce(func, delay) {
        return function(...args) {
            clearTimeout(debounceTimeout); // Clear the previous timeout
            debounceTimeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Fetch the latest TSV file from GitHub repository
    const owner = 'renniepak';
    const repo = 'CSPBypass';
    const branch = 'main';
    const filePath = 'data.tsv';

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

    fetch(apiUrl, {
            headers: {
                'Accept': 'application/vnd.github.v3.raw', // Get raw file content
            },
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text(); // Assuming the TSV is a text file
        })
        .then(data => {
            tsvData = parseTSV(data); // Parse the TSV data
            isTSVLoaded = true; // Indicate that the TSV has been loaded

            // Check if there's a hash in the URL and trigger the search
            if (window.location.hash) {
                const queryFromHash = window.location.hash.substring(1).toLowerCase(); // Remove the '#' and convert to lowercase
                searchInput.value = queryFromHash; // Set the input field to the hash value
                applySearch(queryFromHash); // Apply the search with the hash value
            }
        })
        .catch(error => {
            console.error('Error fetching file:', error);
        });

    // Listen to the input event on the search box with debounce
    searchInput.addEventListener('input', debounce(function() {
        const query = searchInput.value.toLowerCase();
        applySearch(query);
        updateHash(query); // Update the hash as the search query changes
    }, 300)); // Set a debounce delay of 300ms
});