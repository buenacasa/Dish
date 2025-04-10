// Load CSV files using PapaParse
function loadCSV(file, callback) {
    const url = `data/${file}`;
    console.log(`Fetching: ${url}`);
    fetch(url)
        .then(response => {
            console.log(`Response status for ${url}: ${response.status}`);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.text();
        })
        .then(data => {
            console.log(`Raw data from ${file}:`, data.substring(0, 100));
            Papa.parse(data, { 
                header: true,
                skipEmptyLines: true, // Skip empty lines
                dynamicTyping: false, // Treat all values as strings
                complete: result => {
                    console.log(`Parsed ${file}:`, result.data);
                    callback(result);
                }
            });
        })
        .catch(error => console.error(`Error loading ${file}:`, error));
}

// Home Page - Load Cuisines
if (document.getElementById('cuisine-grid')) {
    console.log("Cuisine grid element found, loading cuisines...");
    loadCSV('Cuisine.csv', function(result) {
        const grid = document.getElementById('cuisine-grid');
        if (!result.data || result.data.length === 0) {
            console.error("No data found in Cuisine.csv or parsing failed.");
            grid.innerHTML = "<p>Error: Could not load cuisines.</p>";
            return;
        }
        result.data.forEach(cuisine => {
            console.log("Adding tile for:", cuisine['Cuisine ID']);
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.innerHTML = `<img src="${cuisine['Cuisine Image']}" alt="${cuisine['Cuisine ID']}"><p>${cuisine['Cuisine ID']}</p>`;
            tile.onclick = () => window.location.href = `cuisine.html?cuisine=${encodeURIComponent(cuisine['Cuisine ID'])}`;
            grid.appendChild(tile);
        });
    });
}

// Cuisine Page - Load Restaurants
if (document.getElementById('restaurant-grid')) {
    const urlParams = new URLSearchParams(window.location.search);
    const cuisine = decodeURIComponent(urlParams.get('cuisine'));
    document.getElementById('cuisine-title').textContent = `${cuisine} Restaurants`;

    loadCSV('Restaurant.csv', function(result) {
        const grid = document.getElementById('restaurant-grid');
        const filtered = result.data.filter(r => r['Operational (Y/N)'] === 'Y' && r['Cuisine Keywords'].includes(cuisine));
        filtered.forEach(restaurant => {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.innerHTML = `
                <img src="${restaurant['Profile Picture']}" alt="${restaurant['Restaurant Name']}">
                <p class="name">${restaurant['Restaurant Name']}</p>
                <p class="keywords">${restaurant['Cuisine Keywords']}</p>
            `;
            tile.onclick = () => window.location.href = `restaurant.html?id=${restaurant['Restaurant ID']}&back=cuisine.html?cuisine=${encodeURIComponent(cuisine)}`;
            grid.appendChild(tile);
        });
    });
}

// Restaurant Profile Page
if (document.getElementById('restaurant-profile')) {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const back = urlParams.get('back');
    document.getElementById('back-link').href = back;

    loadCSV('Restaurant.csv', function(result) {
        const restaurant = result.data.find(r => r['Restaurant ID'] === id);
        const profile = document.getElementById('restaurant-profile');
        const keywords = restaurant['Cuisine Keywords'].split(', ').map(k => `<a href="cuisine.html?cuisine=${encodeURIComponent(k)}">${k}</a>`).join(', ');
        profile.innerHTML = `
            <img src="${restaurant['Profile Picture']}" alt="${restaurant['Restaurant Name']}">
            <h2>${restaurant['Restaurant Name']}</h2>
            <p><strong>Cuisine:</strong> ${keywords}</p>
            <p><strong>Chain:</strong> ${restaurant['Chain (Y/N)']}</p>
            <p><strong>Address:</strong> ${restaurant['Address']}</p>
            <p><strong>Neighborhood:</strong> ${restaurant['Neighborhood']}</p>
            <p><a href="${restaurant['Google Maps Link']}" target="_blank"><img src="https://maps.google.com/mapfiles/ms/icons/red-dot.png" alt="Google Maps"></a></p>
        `;

        loadCSV('Call.csv', function(callResult) {
            const callsList = document.getElementById('calls-list');
            const calls = callResult.data.filter(c => c['Restaurant ID'] === id);
            calls.forEach(call => {
                const div = document.createElement('div');
                div.className = 'call';
                div.innerHTML = `
                    <p><strong>Date:</strong> ${call['Call Date']}</p>
                    <p><strong>Sentiment:</strong> ${call['Sentiment']}</p>
                    <p><strong>Recommended:</strong> ${call['Recommended Dishes/Quotes']}</p>
                    <p><strong>Highlights:</strong> ${call['Call Highlights']}</p>
                `;
                callsList.appendChild(div);
            });
        });
    });
}

// Map Page - Using Leaflet.js
if (document.getElementById('map')) {
    // Initialize Leaflet map
    const map = L.map('map').setView([29.4241, -98.4936], 10); // San Antonio default

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    loadCSV('Restaurant.csv', function(result) {
        const restaurants = result.data.filter(r => r['Operational (Y/N)'] === 'Y');
        const cuisineFilter = document.getElementById('cuisine-filter');
        const cityFilter = document.getElementById('city-filter');
        const neighborhoodFilter = document.getElementById('neighborhood-filter');
        const chainFilter = document.getElementById('chain-filter');

        // Populate filters
        const cuisines = [...new Set(restaurants.flatMap(r => r['Cuisine Keywords'].split(', ')))];
        const cities = [...new Set(restaurants.map(r => r['City']))];
        const neighborhoods = [...new Set(restaurants.map(r => r['Neighborhood']))];
        cuisines.forEach(c => cuisineFilter.add(new Option(c, c)));
        cities.forEach(c => cityFilter.add(new Option(c, c)));
        neighborhoods.forEach(n => neighborhoodFilter.add(new Option(n, n)));

        let markers = [];

        function updateMap() {
            // Clear existing markers
            markers.forEach(marker => marker.remove());
            markers = [];

            const filtered = restaurants.filter(r => {
                return (!cuisineFilter.value || r['Cuisine Keywords'].includes(cuisineFilter.value)) &&
                       (!cityFilter.value || r['City'] === cityFilter.value) &&
                       (!neighborhoodFilter.value || r['Neighborhood'] === neighborhoodFilter.value) &&
                       (!chainFilter.value || r['Chain (Y/N)'] === chainFilter.value);
            });

            filtered.forEach(r => {
                const [lat, lng] = r['Coordinates'].split(',').map(Number);
                const marker = L.marker([lat, lng]).addTo(map);
                marker.bindPopup(`<b>${r['Restaurant Name']}</b><br><a href="restaurant.html?id=${r['Restaurant ID']}&back=map.html">View Details</a>`);
                markers.push(marker);
            });
        }

        cuisineFilter.onchange = updateMap;
        cityFilter.onchange = updateMap;
        neighborhoodFilter.onchange = updateMap;
        chainFilter.onchange = updateMap;
        updateMap();
    });
}
