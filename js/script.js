// Load CSV files
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
                skipEmptyLines: true,
                dynamicTyping: false,
                complete: result => {
                    console.log(`Parsed ${file}:`, result.data);
                    if (result.errors.length > 0) {
                        console.error(`Parsing errors in ${file}:`, result.errors);
                    }
                    callback(result);
                }
            });
        })
        .catch(error => console.error(`Error loading ${file}:`, error));
}

// Load cuisine tiles on index.html
if (document.getElementById('cuisine-grid')) {
    loadCSV('Cuisine.csv', result => {
        const cuisineGrid = document.getElementById('cuisine-grid');
        result.data.forEach(cuisine => {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.innerHTML = `
                <img src="${cuisine['Cuisine Image']}" alt="${cuisine['Cuisine ID']}">
                <p>${cuisine['Cuisine ID']}</p>
            `;
            tile.addEventListener('click', () => {
                window.location.href = `cuisine.html?cuisine=${cuisine['Cuisine ID']}`;
            });
            cuisineGrid.appendChild(tile);
        });
    });
}

// Load restaurant grid on cuisine.html and restaurant.html
if (document.getElementById('restaurant-grid')) {
    const urlParams = new URLSearchParams(window.location.search);
    const cuisine = urlParams.get('cuisine');
    const restaurantId = urlParams.get('id');

    if (cuisine || document.getElementById('restaurant-grid')) {
        loadCSV('Restaurant.csv', result => {
            const restaurantGrid = document.getElementById('restaurant-grid');
            const cuisineTitle = document.getElementById('cuisine-title');
            let filteredRestaurants = result.data;

            if (cuisine) {
                filteredRestaurants = result.data.filter(r => r.Cuisine === cuisine);
                cuisineTitle.textContent = `${cuisine} Restaurants`;
            }

            filteredRestaurants.forEach(restaurant => {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.innerHTML = `
                    <img src="${restaurant['Restaurant Image']}" alt="${restaurant['Restaurant ID']}">
                    <p class="name">${restaurant['Restaurant ID']}</p>
                    <p class="keywords">${restaurant['Cuisine']}</p>
                `;
                tile.addEventListener('click', () => {
                    window.location.href = `restaurant.html?id=${restaurant['Restaurant ID']}&cuisine=${cuisine || ''}`;
                });
                restaurantGrid.appendChild(tile);
            });

            // Highlight the selected restaurant
            if (restaurantId) {
                const selectedTile = Array.from(restaurantGrid.children).find(tile => 
                    tile.querySelector('.name').textContent === restaurantId
                );
                if (selectedTile) {
                    selectedTile.style.backgroundColor = '#d4a373';
                    selectedTile.style.color = '#fff';
                    selectedTile.querySelector('.keywords').style.color = '#fff';
                }
            }
        });
    }
}

// Load restaurant profile on restaurant.html
if (document.getElementById('restaurant-profile')) {
    const urlParams = new URLSearchParams(window.location.search);
    const restaurantId = urlParams.get('id');
    const cuisine = urlParams.get('cuisine');

    document.getElementById('back-link').href = cuisine ? `cuisine.html?cuisine=${cuisine}` : 'index.html';

    loadCSV('Restaurant.csv', result => {
        const restaurant = result.data.find(r => r['Restaurant ID'] === restaurantId);
        if (restaurant) {
            const profile = document.getElementById('restaurant-profile');
            profile.innerHTML = `
                <img src="${restaurant['Restaurant Image']}" alt="${restaurant['Restaurant ID']}">
                <h2>${restaurant['Restaurant ID']}</h2>
                <p><strong>Cuisine:</strong> ${restaurant['Cuisine']}</p>
                <p><strong>Chain:</strong> ${restaurant['Chain']}</p>
                <p><strong>Address:</strong> ${restaurant['Address']}</p>
                <p><strong>Neighborhood:</strong> ${restaurant['Neighborhood']}</p>
                <p><a href="${restaurant['Google Maps Link']}" target="_blank"><img src="https://maps.google.com/mapfiles/ms/icons/red-dot.png" alt="Google Maps"></a></p>
            `;
        }
    });

    loadCSV('Call.csv', result => {
        const callsList = document.getElementById('calls-list');
        const calls = result.data.filter(call => call['Restaurant ID'] === restaurantId);
        calls.forEach(call => {
            const callDiv = document.createElement('div');
            callDiv.className = 'call';
            callDiv.innerHTML = `
                <p><strong>Date:</strong> ${call['Date']}</p>
                <p><strong>Sentiment:</strong> ${call['Sentiment']}</p>
                <p><strong>Recommendation:</strong> ${call['Recommendation']}</p>
                <p><strong>Highlights:</strong> ${call['Highlights']}</p>
            `;
            callsList.appendChild(callDiv);
        });
    });
}

// Map page logic
if (document.getElementById('map')) {
    const map = L.map('map').setView([29.4241, -98.4936], 10); // Center on San Antonio

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let markers = [];
    let restaurants = [];

    loadCSV('Restaurant.csv', result => {
        restaurants = result.data;

        // Populate filter dropdowns
        const cuisineFilter = document.getElementById('cuisine-filter');
        const cityFilter = document.getElementById('city-filter');
        const neighborhoodFilter = document.getElementById('neighborhood-filter');
        const chainFilter = document.getElementById('chain-filter');
        const restaurantFilter = document.getElementById('restaurant-filter');

        const cuisines = [...new Set(restaurants.map(r => r.Cuisine))].sort();
        const cities = [...new Set(restaurants.map(r => r.City))].sort();
        const neighborhoods = [...new Set(restaurants.map(r => r.Neighborhood))].sort();

        cuisines.forEach(cuisine => {
            const option = document.createElement('option');
            option.value = cuisine;
            option.textContent = cuisine;
            cuisineFilter.appendChild(option);
        });

        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            cityFilter.appendChild(option);
        });

        neighborhoods.forEach(neighborhood => {
            const option = document.createElement('option');
            option.value = neighborhood;
            option.textContent = neighborhood;
            neighborhoodFilter.appendChild(option);
        });

        function updateMarkers() {
            markers.forEach(marker => map.removeLayer(marker));
            markers = [];

            const selectedCuisine = cuisineFilter.value;
            const selectedCity = cityFilter.value;
            const selectedNeighborhood = neighborhoodFilter.value;
            const selectedChain = chainFilter.value;
            const searchKeyword = restaurantFilter.value.toLowerCase();

            const filteredRestaurants = restaurants.filter(restaurant => {
                const matchesCuisine = !selectedCuisine || restaurant.Cuisine === selectedCuisine;
                const matchesCity = !selectedCity || restaurant.City === selectedCity;
                const matchesNeighborhood = !selectedNeighborhood || restaurant.Neighborhood === selectedNeighborhood;
                const matchesChain = !selectedChain || restaurant.Chain === selectedChain;
                const matchesKeyword = !searchKeyword || restaurant['Restaurant ID'].toLowerCase().includes(searchKeyword);
                return matchesCuisine && matchesCity && matchesNeighborhood && matchesChain && matchesKeyword;
            });

            filteredRestaurants.forEach(restaurant => {
                if (restaurant.Latitude && restaurant.Longitude) {
                    const marker = L.marker([restaurant.Latitude, restaurant.Longitude]).addTo(map);
                    marker.bindPopup(`
                        <b>${restaurant['Restaurant ID']}</b><br>
                        ${restaurant.Cuisine}<br>
                        <a href="restaurant.html?id=${restaurant['Restaurant ID']}&cuisine=${restaurant.Cuisine}" target="_blank">View Details</a>
                    `);
                    markers.push(marker);
                }
            });

            if (filteredRestaurants.length > 0) {
                const group = new L.featureGroup(markers);
                map.fitBounds(group.getBounds());
            }
        }

        cuisineFilter.addEventListener('change', updateMarkers);
        cityFilter.addEventListener('change', updateMarkers);
        neighborhoodFilter.addEventListener('change', updateMarkers);
        chainFilter.addEventListener('change', updateMarkers);
        restaurantFilter.addEventListener('input', updateMarkers);

        updateMarkers();
    });
}
