// Load CSV files
function loadCSV(file, callback) {
    const url = `https://raw.githubusercontent.com/buenacasa/Dish/main/data/${file}`;
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.text();
        })
        .then(data => {
            Papa.parse(data, { 
                header: true,
                skipEmptyLines: true,
                dynamicTyping: false,
                complete: result => callback(result)
            });
        })
        .catch(error => console.error(`Error loading ${file}:`, error));
}

// Cuisine tiles on index.html and cuisine.html
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

// Restaurant grid on cuisine.html and restaurant.html
if (document.getElementById('restaurant-grid')) {
    const urlParams = new URLSearchParams(window.location.search);
    const cuisine = urlParams.get('cuisine');
    const restaurantId = urlParams.get('id');

    loadCSV('Restaurant.csv', result => {
        const restaurantGrid = document.getElementById('restaurant-grid');
        const cuisineTitle = document.getElementById('cuisine-title');
        let filteredRestaurants = result.data;

        if (cuisine) {
            filteredRestaurants = result.data.filter(r => 
                r['Cuisine Keywords'].split(',').map(k => k.trim()).includes(cuisine)
            );
            cuisineTitle.textContent = `${cuisine} Restaurants`;
        }

        filteredRestaurants.forEach(restaurant => {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.innerHTML = `
                <img src="${restaurant['Profile Picture']}" alt="${restaurant['Restaurant Name']}">
                <p class="name">${restaurant['Restaurant Name']}</p>
                <p class="keywords">${restaurant['Cuisine Keywords']}</p>
            `;
            tile.addEventListener('click', () => {
                window.location.href = `restaurant.html?id=${restaurant['Restaurant ID']}&cuisine=${cuisine || ''}`;
            });
            restaurantGrid.appendChild(tile);
        });
    });
}

// Restaurant profile on restaurant.html
if (document.getElementById('restaurant-profile')) {
    const urlParams = new URLSearchParams(window.location.search);
    const restaurantId = urlParams.get('id');
    const cuisine = urlParams.get('cuisine');

    document.getElementById('back-link').href = cuisine ? `cuisine.html?cuisine=${cuisine}` : 'index.html';

    loadCSV('Restaurant.csv', result => {
        const restaurant = result.data.find(r => r['Restaurant ID'] === restaurantId);
        if (restaurant) {
            document.getElementById('restaurant-profile').innerHTML = `
                <img src="${restaurant['Profile Picture']}" alt="${restaurant['Restaurant Name']}">
                <h2>${restaurant['Restaurant Name']}</h2>
                <p><strong>Cuisine:</strong> ${restaurant['Cuisine Keywords']}</p>
                <p><strong>Chain:</strong> ${restaurant['Chain (Y/N)']}</p>
                <p><strong>Address:</strong> ${restaurant['Address']}</p>
                <p><strong>Neighborhood:</strong> ${restaurant['Neighborhood']}</p>
                <p><a href="${restaurant['Google Maps Link']}" target="_blank"><img src="https://maps.google.com/mapfiles/ms/icons/red-dot.png" alt="Google Maps"></a></p>
            `;
        }
    });

    loadCSV('Call.csv', result => {
        const callsList = document.getElementById('calls-list');
        const calls = result.data.filter(c => c['Restaurant ID'] === restaurantId);
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
}

// Map page logic
if (document.getElementById('map')) {
    const map = L.map('map').setView([29.4241, -98.4936], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let markers = [];
    let restaurants = [];

    loadCSV('Restaurant.csv', result => {
        restaurants = result.data.map(restaurant => {
            let latitude = null;
            let longitude = null;
            if (restaurant['Coordinates']) {
                const coords = restaurant['Coordinates'].replace(/"/g, '').split(',');
                if (coords.length === 2) {
                    latitude = parseFloat(coords[0]);
                    longitude = parseFloat(coords[1]);
                    if (isNaN(latitude) || isNaN(longitude)) {
                        console.warn(`Invalid coordinates for ${restaurant['Restaurant ID']}: ${restaurant['Coordinates']}`);
                    }
                }
            }
            return { ...restaurant, Latitude: latitude, Longitude: longitude };
        });

        const cuisineFilter = document.getElementById('cuisine-filter');
        const cityFilter = document.getElementById('city-filter');
        const neighborhoodFilter = document.getElementById('neighborhood-filter');
        const chainFilter = document.getElementById('chain-filter');
        const restaurantFilter = document.getElementById('restaurant-filter');

        const allCuisines = restaurants.flatMap(r => r['Cuisine Keywords'].split(',').map(k => k.trim()));
        const uniqueCuisines = [...new Set(allCuisines)].sort();
        uniqueCuisines.forEach(cuisine => {
            const option = document.createElement('option');
            option.value = cuisine;
            option.textContent = cuisine;
            cuisineFilter.appendChild(option);
        });

        const cities = [...new Set(restaurants.map(r => r['City']))].sort();
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            cityFilter.appendChild(option);
        });

        const neighborhoods = [...new Set(restaurants.map(r => r['Neighborhood']))].sort();
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
                const cuisineKeywords = restaurant['Cuisine Keywords'].split(',').map(k => k.trim());
                const matchesCuisine = !selectedCuisine || cuisineKeywords.includes(selectedCuisine);
                const matchesCity = !selectedCity || restaurant['City'] === selectedCity;
                const matchesNeighborhood = !selectedNeighborhood || restaurant['Neighborhood'] === selectedNeighborhood;
                const matchesChain = !selectedChain || restaurant['Chain (Y/N)'] === selectedChain;
                const matchesKeyword = !searchKeyword || restaurant['Restaurant Name'].toLowerCase().includes(searchKeyword);
                return matchesCuisine && matchesCity && matchesNeighborhood && matchesChain && matchesKeyword;
            });

            filteredRestaurants.forEach(restaurant => {
                if (restaurant.Latitude && restaurant.Longitude) {
                    const marker = L.marker([restaurant.Latitude, restaurant.Longitude]).addTo(map);
                    marker.bindPopup(`
                        <b>${restaurant['Restaurant Name']}</b><br>
                        ${restaurant['Cuisine Keywords']}<br>
                        <a href="restaurant.html?id=${restaurant['Restaurant ID']}&cuisine=${restaurant['Cuisine Keywords']}" target="_blank">View Details</a>
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
        restaurantFilter.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') updateMarkers();
        });

        updateMarkers();
    });
}
