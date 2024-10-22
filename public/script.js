// script.js

document.addEventListener('DOMContentLoaded', function() {
    // Define the map with fixed view and disable interactions
    var map = L.map('map', {
        center: [50, 10],
        zoom: 4,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: false,
        tap: false,
        zoomSnap: 0.1
    });

    // Add base map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Create an object to track selected data items
    var selectedDataLayers = {};

    // Define country code mapping
    const countryCodeMap = {
        "Austria": "AT",
        "Belgium": "BE",
        "Bulgaria": "BG",
        "Croatia": "HR",
        "Cyprus": "CY",
        "Czech Rep.": "CZ",
        "Denmark": "DK",
        "Estonia": "EE",
        "Finland": "FI",
        "France": "FR",
        "Germany": "DE",
        "Greece": "GR",
        "Hungary": "HU",
        "Ireland": "IE",
        "Italy": "IT",
        "Latvia": "LV",
        "Lithuania": "LT",
        "Luxembourg": "LU",
        "Malta": "MT",
        "Netherlands": "NL",
        "Poland": "PL",
        "Portugal": "PT",
        "Romania": "RO",
        "Slovakia": "SK",
        "Slovenia": "SI",
        "Spain": "ES",
        "Sweden": "SE"
    };

    // Define colors for data items
    const dataItemColors = {
        'GDP': '#FFD700', // Gold
        'Population': '#32CD32', // LimeGreen
        'CPI': '#1E90FF', // DodgerBlue
        'Gini Coefficient': '#FF69B4' // HotPink
    };

    // Variables to hold layers and data
    var baseCountriesLayer;
    var dataLayers = {}; // To store layers for each data item
    var countryDataCache = {}; // { countryCode: { dataItem: value, ... }, ... }
    var customDataLoaded = false; // Flag to check if custom data is loaded

    // Load EU countries boundary data
    fetch('https://raw.githubusercontent.com/leakyMirror/map-of-europe/master/GeoJSON/europe.geojson')
        .then(response => response.json())
        .then(data => {
            var geoData = data; // Store geoData locally

            // Filter EU countries
            var euCountries = Object.keys(countryCodeMap);
            geoData.features = geoData.features.filter(feature => euCountries.includes(feature.properties.NAME));

            // Add country codes to features
            geoData.features.forEach(feature => {
                const countryName = feature.properties.NAME;
                feature.properties.countryCode = countryCodeMap[countryName];
            });

            // Create a base layer for countries
            baseCountriesLayer = L.geoJson(geoData, {
                style: {
                    weight: 1,
                    color: 'white',
                    fillColor: '#3182bd',
                    fillOpacity: 0.5
                },
                onEachFeature: (feature, layer) => {
                    layer.on('click', (e) => {
                        showCountryData(feature, layer, e.latlng); // Pass latlng
                    });
                }
            }).addTo(map);

            // Initialize data layers
            initializeDataLayers(geoData);

            // Create custom controls
            createDataControl();
            // Populate country options after controls are created
            populateCountryOptions();

            // Initialize drag-and-drop area
            initializeDragAndDropArea();
        });

    // Initialize data layers
    function initializeDataLayers(geoData) {
        for (let item of Object.keys(dataItemColors)) {
            dataLayers[item] = L.geoJson(geoData, {
                style: feature => getCountryStyle(feature, item),
                onEachFeature: (feature, layer) => {
                    layer.on('click', (e) => {
                        showCountryData(feature, layer, e.latlng); // Pass latlng
                    });
                }
            });
        }
    }

    // Create custom data control
    function createDataControl() {
        var DataControl = L.Control.extend({
            options: {
                position: 'topright'
            },

            onAdd: function (map) {
                var container = L.DomUtil.create('div', 'data-control');

                container.innerHTML = `
                    <div>
                        <label><input type="checkbox" name="dataLayer" value="GDP"> GDP</label><br>
                        <label><input type="checkbox" name="dataLayer" value="Population"> Population</label><br>
                        <label><input type="checkbox" name="dataLayer" value="CPI"> CPI</label><br>
                        <label><input type="checkbox" name="dataLayer" value="Gini Coefficient"> Gini Coefficient</label><br>
                        <button id="calculate-eu-data">Show EU Data</button><br>
                        <button id="download-map-button">Download Map</button>
                    </div>
                `;

                // Prevent click events from propagating to the map
                L.DomEvent.disableClickPropagation(container);

                // Listen for checkbox changes
                var checkboxes = container.querySelectorAll('input[type=checkbox][name=dataLayer]');
                checkboxes.forEach(checkbox => {
                    // Initialize selectedDataLayers based on the initial state of the checkboxes
                    if (checkbox.checked) {
                        selectedDataLayers[checkbox.value] = true;
                    }

                    checkbox.addEventListener('change', async function () {
                        if (this.checked) {
                            selectedDataLayers[this.value] = true;
                            if (!customDataLoaded) {
                                await fetchDataForAllCountries(this.value);
                            }
                            dataLayers[this.value].setStyle(feature => getCountryStyle(feature, this.value));
                            dataLayers[this.value].addTo(map);
                        } else {
                            delete selectedDataLayers[this.value];
                            map.removeLayer(dataLayers[this.value]);
                        }
                        // Update any open popup to reflect the changes
                        updateOpenPopup();
                    });
                });

                // Add event listeners for buttons
                container.querySelector('#calculate-eu-data').addEventListener('click', () => {
                    calculateEUData();
                });

                container.querySelector('#download-map-button').addEventListener('click', () => {
                    downloadMap();
                });

                return container;
            }
        });

        // Add custom control to the map
        map.addControl(new DataControl());
    }

    // Get country style for data item
    function getCountryStyle(feature, dataItem) {
        const countryCode = feature.properties.countryCode;
        const value = countryDataCache[countryCode]?.[dataItem];

        let color = dataItemColors[dataItem];
        let opacity = value != null ? 1 : 0;

        return {
            weight: 4,
            color: color,
            fillColor: '#3182bd',
            fillOpacity: 0.5,
            opacity: opacity
        };
    }

    // Fetch data for all countries for a data item
    async function fetchDataForAllCountries(dataItem) {
        var indicator = getIndicatorCode(dataItem);
        var countryCodes = Object.values(countryCodeMap).join(';');
        // Fetch the most recent available data
        const apiUrl = `https://api.worldbank.org/v2/country/${countryCodes}/indicator/${indicator}?format=json&date=2015:2021&per_page=1000&MRV=1`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data[1]) {
                data[1].forEach(item => {
                    const countryCode = item.countryiso2code;
                    const value = item.value;
                    if (!countryDataCache[countryCode]) {
                        countryDataCache[countryCode] = {};
                    }
                    countryDataCache[countryCode][dataItem] = value;
                });
            }
        } catch (error) {
            console.error(`Failed to fetch data for ${dataItem}:`, error);
        }
    }

    // Show country data
    function showCountryData(feature, layer, latlng) {
        var countryName = feature.properties.NAME;
        var countryCode = feature.properties.countryCode;
        if (!countryCode) return;

        // Create the popup and bind it to the layer
        var popup = L.popup()
            .setContent('<div id="popup-content">Loading...</div>');

        // Bind the popup to the layer and open it at the specified latlng
        layer.bindPopup(popup).openPopup(latlng);

        // Refresh the popup content
        refreshPopupContent(countryName, countryCode, latlng, popup);
    }

    // Function to refresh the popup content
    async function refreshPopupContent(countryName, countryCode, latlng, popup) {
        var popupContent = `<b>${countryName}</b><br>`;

        // Get selected data items
        var selectedItems = Object.keys(selectedDataLayers);

        // Create checkboxes for data items within the popup
        var dataItems = ['GDP', 'Population', 'CPI', 'Gini Coefficient'];
        dataItems.forEach(item => {
            var checked = selectedItems.includes(item) ? 'checked' : '';
            popupContent += `<label><input type="checkbox" name="popupDataItem" value="${item}" ${checked}> ${item}</label><br>`;
        });

        if (selectedItems.length > 0) {
            for (const item of selectedItems) {
                var value = await getDataForCountry(countryCode, item);
                popupContent += `<b>${item}:</b> ${formatNumber(value)} `;
                if (customDataLoaded) {
                    // Add edit button
                    popupContent += `<button class="edit-value-button" data-country="${countryCode}" data-item="${item}">Edit</button>`;
                }
                popupContent += '<br>';
            }
        } else {
            popupContent += 'Please select data items to view.<br>';
        }

        // Add the button to navigate to historical data page
        popupContent += `<button id="view-historical-data">View Historical Data</button>`;

        // Update the popup content
        popup.setContent(popupContent);

        // Add event listeners after updating content
        setTimeout(() => {
            // Event listener for the data item checkboxes in the popup
            var popupCheckboxes = document.querySelectorAll('input[name="popupDataItem"]');
            popupCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', function () {
                    if (this.checked) {
                        selectedDataLayers[this.value] = true;
                        if (!customDataLoaded) {
                            fetchDataForAllCountries(this.value).then(() => {
                                dataLayers[this.value].setStyle(feature => getCountryStyle(feature, this.value));
                                dataLayers[this.value].addTo(map);
                                updateOpenPopup();
                            });
                        } else {
                            dataLayers[this.value].setStyle(feature => getCountryStyle(feature, this.value));
                            dataLayers[this.value].addTo(map);
                            updateOpenPopup();
                        }
                    } else {
                        delete selectedDataLayers[this.value];
                        map.removeLayer(dataLayers[this.value]);
                        updateOpenPopup();
                    }
                    // Update the main controls to reflect the changes
                    updateMainControls();
                });
            });

            var button = document.getElementById('view-historical-data');
            if (button) {
                button.addEventListener('click', () => {
                    // Navigate to the new page, passing the country code and name
                    window.location.href = `country.html?code=${countryCode}&name=${encodeURIComponent(countryName)}`;
                });
            }

            // Add event listeners for edit buttons
            var editButtons = document.querySelectorAll('.edit-value-button');
            editButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    var country = btn.getAttribute('data-country');
                    var item = btn.getAttribute('data-item');
                    editValue(country, item);
                });
            });
        }, 100);
    }

    // Update the main data selection controls to reflect the current selections
    function updateMainControls() {
        var checkboxes = document.querySelectorAll('input[type=checkbox][name=dataLayer]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectedDataLayers.hasOwnProperty(checkbox.value);
        });
    }

    // Update the open popup
    function updateOpenPopup() {
        if (map._popup && map._popup._latlng) {
            var latlng = map._popup._latlng;
            if (map._popup._source && map._popup._source.feature) {
                var feature = map._popup._source.feature;
                var countryName = feature.properties.NAME;
                var countryCode = feature.properties.countryCode;
                refreshPopupContent(countryName, countryCode, latlng, map._popup);
            }
        }
    }

    // Get indicator code
    function getIndicatorCode(item) {
        var dataItems = {
            'GDP': 'NY.GDP.MKTP.CD',
            'Population': 'SP.POP.TOTL',
            'CPI': 'FP.CPI.TOTL.ZG', // CPI Inflation
            'Gini Coefficient': 'SI.POV.GINI'
        };
        return dataItems[item];
    }

    // Format numbers
    function formatNumber(num) {
        if (num == null) return 'N/A';
        if (num >= 1e12) {
            return (num / 1e12).toFixed(2) + ' Trillion';
        } else if (num >= 1e9) {
            return (num / 1e9).toFixed(2) + ' Billion';
        } else if (num >= 1e6) {
            return (num / 1e6).toFixed(2) + ' Million';
        } else if (num >= 1e3) {
            return (num / 1e3).toFixed(2) + ' Thousand';
        } else {
            return num.toFixed(2);
        }
    }

    // Calculate EU Data
    async function calculateEUData() {
        // Get selected data items
        var selectedItems = Object.keys(selectedDataLayers);

        if (selectedItems.length === 0) {
            alert('Please select data items to calculate.');
            return;
        }

        // Initialize variables to hold totals and counts
        var totals = {};
        var counts = {};

        // For each selected data item, fetch data for all EU countries
        for (const item of selectedItems) {
            var data = await getEUDataForItem(item);
            totals[item] = 0;
            counts[item] = 0;
            for (const value of Object.values(data)) {
                if (value != null) {
                    totals[item] += value;
                    counts[item] += 1;
                }
            }
        }

        // Calculate averages or totals
        var resultText = '';
        for (const item of selectedItems) {
            if (item === 'GDP' || item === 'Population') {
                resultText += `<b>Total ${item}:</b> ${formatNumber(totals[item])}<br>`;
            } else if (item === 'CPI' || item === 'Gini Coefficient') {
                var average = totals[item] / counts[item];
                resultText += `<b>Average ${item}:</b> ${average.toFixed(2)}<br>`;
            }
        }

        // Add the button to view EU historical data
        resultText += `<button id="view-eu-historical-data">View EU Historical Data</button>`;

        // Display the results in a popup at the center of the map
        L.popup()
            .setLatLng(map.getCenter())
            .setContent(`<b>EU Data:</b><br>${resultText}`)
            .openOn(map);

        // Add event listener to the button
        setTimeout(() => {
            var button = document.getElementById('view-eu-historical-data');
            if (button) {
                button.addEventListener('click', () => {
                    // Navigate to the new page, passing code=EU and selected data items
                    var selectedDataItems = selectedItems.map(encodeURIComponent).join(',');
                    window.location.href = `country.html?code=EU&name=European%20Union&items=${selectedDataItems}`;
                });
            }
        }, 100);
    }

    // Get EU data for a data item
    async function getEUDataForItem(dataItem) {
        var data = {};
        if (customDataLoaded) {
            // Use custom data
            for (const countryCode of Object.values(countryCodeMap)) {
                data[countryCode] = countryDataCache[countryCode]?.[dataItem];
            }
        } else {
            // Fetch data from API
            var indicator = getIndicatorCode(dataItem);
            var countryCodes = Object.values(countryCodeMap).join(';');
            const apiUrl = `https://api.worldbank.org/v2/country/${countryCodes}/indicator/${indicator}?format=json&date=2015:2021&per_page=1000&MRV=1`;

            try {
                const response = await fetch(apiUrl);
                const apiData = await response.json();

                if (apiData[1]) {
                    apiData[1].forEach(item => {
                        const countryCode = item.countryiso2code;
                        const value = item.value;
                        data[countryCode] = value;
                    });
                }
            } catch (error) {
                console.error(`Failed to fetch EU data for ${dataItem}:`, error);
            }
        }
        return data;
    }

    // Download map as image
    function downloadMap() {
        leafletImage(map, function (err, canvas) {
            if (err) {
                console.error('Error generating map image:', err);
                return;
            }
            var img = canvas.toDataURL('image/png');
            var link = document.createElement('a');
            link.href = img;
            link.download = 'map.png';
            link.click();
        });
    }

    // Populate country select options
    function populateCountryOptions() {
        var countrySelect1 = document.getElementById('country-1');
        var countrySelect2 = document.getElementById('country-2');
        var operationCountrySelect = document.getElementById('operation-country');

        for (const countryName of Object.keys(countryCodeMap)) {
            var option1 = document.createElement('option');
            option1.value = countryName;
            option1.text = countryName;
            if (countrySelect1) countrySelect1.add(option1.cloneNode(true));

            var option2 = document.createElement('option');
            option2.value = countryName;
            option2.text = countryName;
            if (countrySelect2) countrySelect2.add(option2.cloneNode(true));

            // For country data operations
            var option3 = document.createElement('option');
            option3.value = countryName;
            option3.text = countryName;
            if (operationCountrySelect) operationCountrySelect.add(option3.cloneNode(true));
        }
    }

    // Event listener for the compare button
    document.getElementById('compare-button').addEventListener('click', () => {
        var country1 = document.getElementById('country-1').value;
        var country2 = document.getElementById('country-2').value;
        var dataItem = document.getElementById('comparison-data-item').value;

        if (!country1 || !country2 || !dataItem) {
            alert('Please select two countries and a data item.');
            return;
        }

        compareCountries(country1, country2, dataItem);
    });

    // Compare two countries
    async function compareCountries(countryName1, countryName2, dataItem) {
        var countryCode1 = countryCodeMap[countryName1];
        var countryCode2 = countryCodeMap[countryName2];

        var value1 = await getDataForCountry(countryCode1, dataItem);
        var value2 = await getDataForCountry(countryCode2, dataItem);

        // Display the comparison result
        var comparisonResult = `
            <b>${dataItem} Comparison:</b><br>
            ${countryName1}: ${formatNumber(value1)}<br>
            ${countryName2}: ${formatNumber(value2)}<br>
        `;

        // Display the result in a popup at the center of the map
        L.popup()
            .setLatLng(map.getCenter())
            .setContent(comparisonResult)
            .openOn(map);
    }

    // Event listener for country data operation button
    document.getElementById('calculate-country-operation-button').addEventListener('click', () => {
        var countryName = document.getElementById('operation-country').value;
        var dataItem1 = document.getElementById('country-data-item-1').value;
        var dataItem2 = document.getElementById('country-data-item-2').value;
        var operation = document.getElementById('country-operation').value;

        if (!countryName || !dataItem1 || !dataItem2 || !operation) {
            alert('Please select a country, two data items, and an operation.');
            return;
        }

        calculateCountryDataOperation(countryName, dataItem1, dataItem2, operation);
    });

    // Calculate operation on a country's data
    async function calculateCountryDataOperation(countryName, dataItem1, dataItem2, operation) {
        var countryCode = countryCodeMap[countryName];

        var value1 = await getDataForCountry(countryCode, dataItem1);
        var value2 = await getDataForCountry(countryCode, dataItem2);

        if (value1 == null || value2 == null) {
            alert('Data not available for selected items.');
            return;
        }

        var result = null;
        switch (operation) {
            case 'add':
                result = value1 + value2;
                break;
            case 'subtract':
                result = value1 - value2;
                break;
            case 'multiply':
                result = value1 * value2;
                break;
            case 'divide':
                result = value2 !== 0 ? value1 / value2 : null;
                break;
        }

        // Display the result
        var resultText = `
            <b>${countryName}:</b><br>
            ${dataItem1} ${getOperationSymbol(operation)} ${dataItem2} = ${formatNumber(result)}
        `;

        L.popup()
            .setLatLng(map.getCenter())
            .setContent(resultText)
            .openOn(map);
    }

    // Get operation symbol
    function getOperationSymbol(operation) {
        switch (operation) {
            case 'add': return '+';
            case 'subtract': return '-';
            case 'multiply': return '×';
            case 'divide': return '÷';
            default: return '';
        }
    }

    // Get data for a country, either from custom data or API
    async function getDataForCountry(countryCode, dataItem) {
        if (customDataLoaded) {
            return countryDataCache[countryCode]?.[dataItem];
        } else {
            var indicator = getIndicatorCode(dataItem);
            const value = await getWorldBankData(countryCode, indicator);
            // Cache the value
            if (!countryDataCache[countryCode]) {
                countryDataCache[countryCode] = {};
            }
            countryDataCache[countryCode][dataItem] = value;
            return value;
        }
    }

    // Initialize drag-and-drop area
    function initializeDragAndDropArea() {
        var dragAndDropArea = document.getElementById('drag-and-drop-area');

        // Drag over event
        dragAndDropArea.addEventListener('dragover', function (e) {
            e.preventDefault();
            dragAndDropArea.classList.add('dragover');
        });

        // Drag leave event
        dragAndDropArea.addEventListener('dragleave', function (e) {
            dragAndDropArea.classList.remove('dragover');
        });

        // Drop event
        dragAndDropArea.addEventListener('drop', function (e) {
            e.preventDefault();
            dragAndDropArea.classList.remove('dragover');

            var files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileUpload(files[0]);
            }
        });

        // Click event to open file dialog
        dragAndDropArea.addEventListener('click', function () {
            var fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json,application/json';
            fileInput.onchange = function (e) {
                if (e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                }
            };
            fileInput.click();
        });
    }

    // Handle file upload
    function handleFileUpload(file) {
        console.log('File name:', file.name);
        console.log('File type:', file.type);
    
        if (!file.name.endsWith('.json')) {
            alert('Please upload a valid JSON file.');
            return;
        }
    
        const reader = new FileReader();
        reader.onload = function (event) {
            const data = event.target.result;
            // Parse JSON data
            try {
                const jsonData = JSON.parse(data);
                updateMapDataWithJSON(jsonData);
                customDataLoaded = true;
            } catch (error) {
                alert('Invalid JSON file.');
                console.error('JSON parsing error:', error);
            }
        };
        reader.readAsText(file);
    }
    

    // Update map data with JSON
    function updateMapDataWithJSON(jsonData) {
        // Expected format: { countryCode: { dataItem: value, ... }, ... }
        if (typeof jsonData === 'object' && !Array.isArray(jsonData)) {
            countryDataCache = jsonData;

            // Refresh the map layers
            Object.keys(selectedDataLayers).forEach(item => {
                if (dataLayers[item]) {
                    dataLayers[item].setStyle(feature => getCountryStyle(feature, item));
                }
            });

            // Update any open popup to reflect the new data
            updateOpenPopup();

            alert('Custom data loaded successfully.');
        } else {
            alert('Invalid data format.');
        }
    }

    // Edit value function
    function editValue(countryCode, dataItem) {
        var currentValue = countryDataCache[countryCode]?.[dataItem];
        var newValue = prompt(`Edit value for ${dataItem}:`, currentValue);

        if (newValue !== null) {
            newValue = parseFloat(newValue);
            if (!isNaN(newValue)) {
                countryDataCache[countryCode][dataItem] = newValue;

                // Refresh the map layers
                if (dataLayers[dataItem]) {
                    dataLayers[dataItem].setStyle(feature => getCountryStyle(feature, dataItem));
                }

                // Update any open popup to reflect the new data
                updateOpenPopup();
            } else {
                alert('Invalid number.');
            }
        }
    }

    // Get World Bank data
    async function getWorldBankData(countryCode, indicator) {
        // Fetch the most recent available data
        const apiUrl = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json&date=2015:2021&per_page=1&MRV=1`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data[1] && data[1].length > 0) {
                return data[1][0].value;
            }
            return null;
        } catch (error) {
            console.error(`Failed to fetch ${indicator} data:`, error);
            return null;
        }
    }
});
