// 初始化地图
var map = L.map('map').setView([50, 10], 4);

// 添加底图
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 定义数据层对象
var dataLayers = {
    gdp: null,
    population: null,
    cpi: null,
    gini: null
};

// 定义当前显示的数据层
var currentLayer = null;

// 定义颜色映射函数
function getColor(d, dataType) {
    var colors;
    switch (dataType) {
        case 'gdp':
            colors = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'];
            break;
        case 'population':
            colors = ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#de2d26', '#a50f15'];
            break;
        case 'cpi':
            colors = ['#ffffe5', '#fff7bc', '#fee391', '#fec44f', '#fe9929', '#d95f0e', '#993404'];
            break;
        case 'gini':
            colors = ['#edf8fb', '#bfd3e6', '#9ebcda', '#8c96c6', '#8c6bb1', '#88419d', '#6e016b'];
            break;
        default:
            colors = ['#FFFFFF'];
    }

    // 根据数据值选择颜色
    var thresholds;
    switch (dataType) {
        case 'gdp':
            thresholds = [0, 1e11, 5e11, 1e12, 2e12, 3e12, 4e12];
            break;
        case 'population':
            thresholds = [0, 5e6, 1e7, 2e7, 4e7, 8e7, 1e8];
            break;
        case 'cpi':
            thresholds = [-1, 0, 1, 2, 3, 4, 5];
            break;
        case 'gini':
            thresholds = [20, 25, 30, 35, 40, 45, 50];
            break;
        default:
            thresholds = [];
    }

    for (var i = thresholds.length - 1; i >= 0; i--) {
        if (d > thresholds[i]) {
            return colors[i + 1];
        }
    }
    return colors[0];
}

// 创建图例控件
var legend = L.control({ position: 'bottomright' });

// 更新图例内容
function updateLegend(dataType) {
    legend.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'legend');
        var labels = [];
        var from, to;

        var grades, colors;
        switch (dataType) {
            case 'gdp':
                grades = [0, 1e11, 5e11, 1e12, 2e12, 3e12, 4e12];
                colors = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'];
                break;
            case 'population':
                grades = [0, 5e6, 1e7, 2e7, 4e7, 8e7, 1e8];
                colors = ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#de2d26', '#a50f15'];
                break;
            case 'cpi':
                grades = [-1, 0, 1, 2, 3, 4, 5];
                colors = ['#ffffe5', '#fff7bc', '#fee391', '#fec44f', '#fe9929', '#d95f0e', '#993404'];
                break;
            case 'gini':
                grades = [20, 25, 30, 35, 40, 45, 50];
                colors = ['#edf8fb', '#bfd3e6', '#9ebcda', '#8c96c6', '#8c6bb1', '#88419d', '#6e016b'];
                break;
            default:
                grades = [];
                colors = [];
        }

        div.innerHTML = `<b>${dataType.toUpperCase()}</b><br>`;
        for (var i = 0; i < grades.length - 1; i++) {
            from = grades[i];
            to = grades[i + 1];

            div.innerHTML +=
                '<i style="background:' + colors[i + 1] + '"></i> ' +
                from + (to ? '&ndash;' + to + '<br>' : '+');
        }
        return div;
    };
    legend.addTo(map);
}

// 加载欧盟国家边界数据
fetch('https://raw.githubusercontent.com/leakyMirror/map-of-europe/master/GeoJSON/europe.geojson')
    .then(response => response.json())
    .then(geoData => {
        // 过滤欧盟国家
        var euCountries = [
            "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Rep.", "Denmark", "Estonia",
            "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia",
            "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania",
            "Slovakia", "Slovenia", "Spain", "Sweden"
        ];

        geoData.features = geoData.features.filter(feature => euCountries.includes(feature.properties.NAME));

        // 获取数据并绘制图层
        Promise.all([
            getGDPData(),
            getPopulationData(),
            getCPIData(),
            getGiniData()
        ]).then(([gdpData, populationData, cpiData, giniData]) => {
            createDataLayers(geoData, gdpData, populationData, cpiData, giniData);
        }).catch(error => {
            console.error('数据加载失败:', error);
        });
    });

// 创建数据层的函数
function createDataLayers(geoData, gdpData, populationData, cpiData, giniData) {
    dataLayers.gdp = L.geoJson(geoData, {
        style: feature => {
            var code = feature.properties.ISO2;
            var value = gdpData[code];
            return {
                fillColor: value ? getColor(value, 'gdp') : '#ccc',
                weight: 1,
                color: 'white',
                fillOpacity: value ? 0.7 : 0.4
            };
        },
        onEachFeature: (feature, layer) => {
            layer.on('click', () => {
                var code = feature.properties.ISO2;
                var popupContent = `<b>${feature.properties.NAME}</b><br>`;
                popupContent += `<b>GDP:</b> ${gdpData[code] ? formatNumber(gdpData[code]) : '不可用'}<br>`;
                L.popup()
                    .setLatLng(layer.getBounds().getCenter())
                    .setContent(popupContent)
                    .openOn(map);
            });
        }
    });

    dataLayers.population = L.geoJson(geoData, {
        style: feature => {
            var code = feature.properties.ISO2;
            var value = populationData[code];
            return {
                fillColor: value ? getColor(value, 'population') : '#ccc',
                weight: 1,
                color: 'white',
                fillOpacity: value ? 0.7 : 0.4
            };
        },
        onEachFeature: (feature, layer) => {
            layer.on('click', () => {
                var code = feature.properties.ISO2;
                var popupContent = `<b>${feature.properties.NAME}</b><br>`;
                popupContent += `<b>人口:</b> ${populationData[code] ? formatNumber(populationData[code]) : '不可用'}<br>`;
                L.popup()
                    .setLatLng(layer.getBounds().getCenter())
                    .setContent(popupContent)
                    .openOn(map);
            });
        }
    });

    dataLayers.cpi = L.geoJson(geoData, {
        style: feature => {
            var code = feature.properties.ISO2;
            var value = cpiData[code];
            return {
                fillColor: value != null ? getColor(value, 'cpi') : '#ccc',
                weight: 1,
                color: 'white',
                fillOpacity: value != null ? 0.7 : 0.4
            };
        },
        onEachFeature: (feature, layer) => {
            layer.on('click', () => {
                var code = feature.properties.ISO2;
                var popupContent = `<b>${feature.properties.NAME}</b><br>`;
                popupContent += `<b>CPI:</b> ${cpiData[code] != null ? cpiData[code].toFixed(2) : '不可用'}<br>`;
                L.popup()
                    .setLatLng(layer.getBounds().getCenter())
                    .setContent(popupContent)
                    .openOn(map);
            });
        }
    });

    dataLayers.gini = L.geoJson(geoData, {
        style: feature => {
            var code = feature.properties.ISO2;
            var value = giniData[code];
            return {
                fillColor: value != null ? getColor(value, 'gini') : '#ccc',
                weight: 1,
                color: 'white',
                fillOpacity: value != null ? 0.7 : 0.4
            };
        },
        onEachFeature: (feature, layer) => {
            layer.on('click', () => {
                var code = feature.properties.ISO2;
                var popupContent = `<b>${feature.properties.NAME}</b><br>`;
                popupContent += `<b>基尼系数:</b> ${giniData[code] != null ? giniData[code].toFixed(2) : '不可用'}<br>`;
                L.popup()
                    .setLatLng(layer.getBounds().getCenter())
                    .setContent(popupContent)
                    .openOn(map);
            });
        }
    });

    // 默认显示 GDP 数据层
    currentLayer = dataLayers.gdp.addTo(map);
    updateLegend('gdp');

    // 添加图层控制器
    var overlays = {
        "GDP": dataLayers.gdp,
        "人口": dataLayers.population,
        "CPI": dataLayers.cpi,
        "基尼系数": dataLayers.gini
    };
    L.control.layers(null, overlays).addTo(map);

    // 监听图层切换事件
    map.on('overlayadd', function (e) {
        currentLayer = e.layer;
        var layerName = e.name;
        var dataType = layerName === 'GDP' ? 'gdp' : layerName === '人口' ? 'population' : layerName === 'CPI' ? 'cpi' : 'gini';
        updateLegend(dataType);
    });

    map.on('overlayremove', function (e) {
        map.removeControl(legend);
    });
}

// 格式化数字
function formatNumber(num) {
    if (num == null) return '不可用';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ISO3 转换为 ISO2
function iso3ToIso2(iso3) {
    var isoMapping = {
        "AUT": "AT",
        "BEL": "BE",
        "BGR": "BG",
        "HRV": "HR",
        "CYP": "CY",
        "CZE": "CZ",
        "DNK": "DK",
        "EST": "EE",
        "FIN": "FI",
        "FRA": "FR",
        "DEU": "DE",
        "GRC": "GR",
        "HUN": "HU",
        "IRL": "IE",
        "ITA": "IT",
        "LVA": "LV",
        "LTU": "LT",
        "LUX": "LU",
        "MLT": "MT",
        "NLD": "NL",
        "POL": "PL",
        "PRT": "PT",
        "ROU": "RO",
        "SVK": "SK",
        "SVN": "SI",
        "ESP": "ES",
        "SWE": "SE"
    };
    return isoMapping[iso3] || null;
}

/////////////////////////////////////
// API 调用函数
/////////////////////////////////////

// 1. 获取 GDP 数据（Eurostat API）
async function getGDPData() {
    try {
        var url = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/namq_10_gdp?format=json&lang=EN&geo=EU27_2020';
        var response = await fetch(url);
        var data = await response.json();

        var gdpData = {};
        // 处理数据
        // TODO: 根据 Eurostat API 的数据格式，解析并提取 GDP 数据

        // 示例：假设 data 包含所需的数据
        // gdpData['AT'] = 数据值;

        return gdpData;
    } catch (error) {
        console.error('获取 GDP 数据失败:', error);
        return {};
    }
}

// 2. 获取人口数据（Eurostat API）
async function getPopulationData() {
    try {
        var url = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/demo_pjan?format=json&lang=EN';
        var response = await fetch(url);
        var data = await response.json();

        var populationData = {};
        // 处理数据
        // TODO: 根据 Eurostat API 的数据格式，解析并提取人口数据

        return populationData;
    } catch (error) {
        console.error('获取人口数据失败:', error);
        return {};
    }
}

// 3. 获取 CPI 数据（OECD API）
async function getCPIData() {
    try {
        var url = 'https://stats.oecd.org/SDMX-JSON/data/DP_LIVE/.CPI.TOT.TOT.GY.M/all?dimensionAtObservation=AllDimensions';
        var response = await fetch(url);
        var data = await response.json();

        var cpiData = {};
        // 处理数据
        // TODO: 根据 OECD API 的数据格式，解析并提取 CPI 数据

        return cpiData;
    } catch (error) {
        console.error('获取 CPI 数据失败:', error);
        return {};
    }
}

// 4. 获取基尼系数数据（World Bank API）
async function getGiniData() {
    try {
        var apiUrl = 'https://api.worldbank.org/v2/country/all/indicator/SI.POV.GINI?format=json&per_page=500&date=2020';
        var response = await fetch(apiUrl);
        var data = await response.json();
        var giniData = {};
        if (data[1]) {
            data[1].forEach(item => {
                if (item.countryiso3code && item.value != null) {
                    var iso2 = iso3ToIso2(item.countryiso3code);
                    if (iso2) {
                        giniData[iso2] = item.value;
                    }
                }
            });
        }
        return giniData;
    } catch (error) {
        console.error('获取基尼系数数据失败:', error);
        return {};
    }
}
