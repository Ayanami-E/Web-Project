const countryCodeMap = {
    "Austria": "AT",
    "Belgium": "BE",
    "Bulgaria": "BG",
    "Croatia": "HR",
    "Cyprus": "CY",
    "Czech Republic": "CZ",
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
    "Slovak Republic": "SK",
    "Slovenia": "SI",
    "Spain": "ES",
    "Sweden": "SE"
};

function getQueryParams() {
    const params = {};
    window.location.search.substring(1).split('&').forEach(function (param) {
        var parts = param.split('=');
        params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
    });
    return params;
}

const params = getQueryParams();
const countryCode = params['code'];
const countryName = params['name'];

document.getElementById('country-name').innerText = `Historical Data for ${countryName}`;

document.getElementById('back-button').addEventListener('click', () => {
    window.history.back();
});


let gdpChart, giniChart, cpiChart, populationChart;

let isEditMode = false;


document.getElementById('edit-button').addEventListener('click', () => {
    isEditMode = !isEditMode;
    toggleEditMode(isEditMode);
});


function toggleEditMode(enable) {
    const dataTables = document.querySelectorAll('.data-table');
    dataTables.forEach(tableDiv => {
        tableDiv.style.display = enable ? 'block' : 'none';
    });
    if (enable) {

        createEditableTable('gdp', gdpChart);
        createEditableTable('gini', giniChart);
        createEditableTable('cpi', cpiChart);
        createEditableTable('population', populationChart);
    }
}


function createEditableTable(idPrefix, chart) {
    if (!chart) return;
    const tableDiv = document.getElementById(`${idPrefix}-table`);
    const years = chart.data.labels;
    const values = chart.data.datasets[0].data;

    let tableHTML = '<table><tr><th>Year</th><th>Value</th></tr>';
    for (let i = 0; i < years.length; i++) {
        tableHTML += `<tr>
            <td>${years[i]}</td>
            <td><input type="number" step="any" data-index="${i}" value="${values[i]}"></td>
        </tr>`;
    }
    tableHTML += '</table>';

    tableDiv.innerHTML = tableHTML;


    const inputs = tableDiv.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            const index = input.getAttribute('data-index');
            const value = parseFloat(input.value);
            if (!isNaN(value)) {
                chart.data.datasets[0].data[index] = value;
                chart.update();
            }
        });
    });
}


if (countryCode === 'EU') {
    displayEUData();
} else {
    displayCountryData(countryCode);
}


function displayCountryData(countryCode) {
    const startYear = 2000;
    const endYear = 2020;


    getHistoricalData(countryCode, 'NY.GDP.MKTP.CD', startYear, endYear).then(data => {
        const ctx = document.getElementById('gdp-chart').getContext('2d');
        gdpChart = createChart(ctx, 'GDP (current US$)', data);
    });


    getHistoricalData(countryCode, 'SI.POV.GINI', startYear, endYear).then(data => {
        const ctx = document.getElementById('gini-chart').getContext('2d');
        giniChart = createChart(ctx, 'Gini Coefficient', data);
    });


    getHistoricalData(countryCode, 'FP.CPI.TOTL.ZG', startYear, endYear).then(data => {
        const ctx = document.getElementById('cpi-chart').getContext('2d');
        cpiChart = createChart(ctx, 'CPI Inflation (%)', data);
    });


    getHistoricalData(countryCode, 'SP.POP.TOTL', startYear, endYear).then(data => {
        const ctx = document.getElementById('population-chart').getContext('2d');
        populationChart = createChart(ctx, 'Population', data);
    });
}


function displayEUData() {
    const startYear = 2000;
    const endYear = 2020;


    const indicators = {
        'gdp': 'NY.GDP.MKTP.CD',
        'gini': 'SI.POV.GINI',
        'cpi': 'FP.CPI.TOTL.ZG',
        'population': 'SP.POP.TOTL'
    };


    for (let [key, indicatorCode] of Object.entries(indicators)) {
        getEUHistoricalData(indicatorCode, startYear, endYear, key);
    }
}


async function getEUHistoricalData(indicatorCode, startYear, endYear, key) {

    const euCountryCodes = Object.values(countryCodeMap);
    const countryCodesString = euCountryCodes.join(';');

    const apiUrl = `https://api.worldbank.org/v2/country/${countryCodesString}/indicator/${indicatorCode}?format=json&date=${startYear}:${endYear}&per_page=5000`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        const yearlyData = {};

        if (data[1]) {
            data[1].forEach(item => {
                const year = item.date;
                const value = item.value;

                if (!yearlyData[year]) {
                    yearlyData[year] = {
                        total: 0,
                        count: 0
                    };
                }

                if (value != null) {
                    yearlyData[year].total += value;
                    yearlyData[year].count += 1;
                }
            });
        }

        const years = [];
        const values = [];

        for (let year = startYear; year <= endYear; year++) {
            const yearStr = year.toString();
            if (yearlyData[yearStr] && yearlyData[yearStr].count > 0) {
                let aggregatedValue;
                if (key === 'gdp' || key === 'population') {
                    aggregatedValue = yearlyData[yearStr].total;
                } else {

                    aggregatedValue = yearlyData[yearStr].total / yearlyData[yearStr].count;
                }
                years.push(yearStr);
                values.push(aggregatedValue);
            }
        }

        const ctx = document.getElementById(`${key}-chart`).getContext('2d');
        const labelMap = {
            'gdp': 'Total GDP (current US$)',
            'gini': 'Average Gini Coefficient',
            'cpi': 'Average CPI Inflation (%)',
            'population': 'Total Population'
        };
        const chartLabel = labelMap[key];


        if (key === 'gdp') {
            gdpChart = createChart(ctx, chartLabel, { years, values });
        } else if (key === 'gini') {
            giniChart = createChart(ctx, chartLabel, { years, values });
        } else if (key === 'cpi') {
            cpiChart = createChart(ctx, chartLabel, { years, values });
        } else if (key === 'population') {
            populationChart = createChart(ctx, chartLabel, { years, values });
        }

    } catch (error) {
        console.error(`Failed to fetch EU data for ${indicatorCode}:`, error);
    }
}


async function getHistoricalData(countryCode, indicator, startYear, endYear) {
    const apiUrl = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json&date=${startYear}:${endYear}&per_page=100`;
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        const years = [];
        const values = [];
        if (data[1]) {
            data[1].forEach(item => {
                if (item.value != null) {
                    years.unshift(item.date); 
                    values.unshift(item.value);
                }
            });
        }
        return { years, values };
    } catch (error) {
        console.error(`Failed to fetch historical data for ${indicator}:`, error);
        return { years: [], values: [] };
    }
}


function createChart(ctx, label, data) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.years,
            datasets: [{
                label: label,
                data: data.values,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: 'Year' } },
                y: { title: { display: true, text: label } }
            }
        }
    });
}


const dragDropArea = document.getElementById('drag-drop-area');

dragDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragDropArea.classList.add('dragover');
});

dragDropArea.addEventListener('dragleave', () => {
    dragDropArea.classList.remove('dragover');
});

dragDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDropArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
});

function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = function (event) {
        const data = event.target.result;

        try {
            const jsonData = JSON.parse(data);
            updateChartsWithData(jsonData);
        } catch (error) {
            alert('Invalid JSON file.');
        }
    };
    reader.readAsText(file);
}


function updateChartsWithData(jsonData) {
    if (jsonData) {
        if (jsonData.gdp && Array.isArray(jsonData.gdp.values) && Array.isArray(jsonData.gdp.years)) {
            gdpChart.data.labels = jsonData.gdp.years;
            gdpChart.data.datasets[0].data = jsonData.gdp.values;
            gdpChart.update();
        }
        if (jsonData.gini && Array.isArray(jsonData.gini.values) && Array.isArray(jsonData.gini.years)) {
            giniChart.data.labels = jsonData.gini.years;
            giniChart.data.datasets[0].data = jsonData.gini.values;
            giniChart.update();
        }
        if (jsonData.cpi && Array.isArray(jsonData.cpi.values) && Array.isArray(jsonData.cpi.years)) {
            cpiChart.data.labels = jsonData.cpi.years;
            cpiChart.data.datasets[0].data = jsonData.cpi.values;
            cpiChart.update();
        }
        if (jsonData.population && Array.isArray(jsonData.population.values) && Array.isArray(jsonData.population.years)) {
            populationChart.data.labels = jsonData.population.years;
            populationChart.data.datasets[0].data = jsonData.population.values;
            populationChart.update();
        }
    }
}

document.querySelectorAll('.download-button').forEach(button => {
    button.addEventListener('click', () => {
        const chartId = button.getAttribute('data-chart-id');
        const chart = getChartById(chartId);
        if (chart) {
            downloadChart(chart, chartId);
        }
    });
});

function getChartById(chartId) {
    switch (chartId) {
        case 'gdp-chart': return gdpChart;
        case 'gini-chart': return giniChart;
        case 'cpi-chart': return cpiChart;
        case 'population-chart': return populationChart;
        default: return null;
    }
}

function downloadChart(chart, chartId) {
    const link = document.createElement('a');
    link.href = chart.toBase64Image();
    link.download = `${chartId}.png`;
    link.click();
}

document.getElementById('download-all-button').addEventListener('click', () => {
    const charts = [gdpChart, giniChart, cpiChart, populationChart];
    const chartIds = ['gdp-chart', 'gini-chart', 'cpi-chart', 'population-chart'];
    charts.forEach((chart, index) => {
        setTimeout(() => {
            downloadChart(chart, chartIds[index]);
        }, index * 500); 
    });
});
