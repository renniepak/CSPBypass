// Fetch data from the TSV file on GitHub and listen to input events
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search');
    const resultsList = document.getElementById('results');
    let tsvData = [];

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
            if (currentLine.length !== headers.length) continue;

            obj.domain = currentLine[0]; // Assuming the first column is Domain
            obj.code = currentLine[1]; // Assuming the second column is Code

            result.push(obj);
        }

        return result;
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
        })
        .catch(error => {
            console.error('Error fetching file:', error);
        });

    // Listen to the input event on the search box
    searchInput.addEventListener('input', function() {
        const query = searchInput.value.toLowerCase();
        resultsList.innerHTML = ''; // Clear the results list

        // Filter and display matching results
        const filteredData = tsvData.filter(item =>
            item.domain.toLowerCase().includes(query) ||
            item.code.toLowerCase().includes(query)
        );

        // Display the results
        filteredData.forEach(item => {
            const li = document.createElement('li');

            // Combine the domain, two line breaks, and the code in one step
            li.innerHTML = `<strong>${htmlEncode(item.domain)}</strong><br><br>${htmlEncode(item.code)}`;

            resultsList.appendChild(li);
        });

    });
});
