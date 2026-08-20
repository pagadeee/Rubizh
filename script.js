// ================================
// СОЗДАНИЕ КАРТЫ
// ================================

const map = L.map('map', {
    zoomControl: false,
    keyboard: false
}).setView([48.46, 35.05], 7);


// ================================
// ОТДЕЛЬНЫЙ СЛОЙ ТЕРРИТОРИЙ
// ================================

map.createPane(
    'territoriesPane'
);


const territoriesPane =
    map.getPane(
        'territoriesPane'
    );


// Территории выше подложки,
// но ниже маркеров и popup
territoriesPane.style.zIndex =
    '450';


territoriesPane.style.opacity =
    '1';


// ================================
// ПОДЛОЖКИ
// ================================

// Обычная OpenStreetMap
const normalMap = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }
);


// 🛰️ Гибридная спутниковая карта MapTiler

const MAPTILER_KEY = 'hr7Oet5V73fczRoKMyH7';

const satelliteMap = L.tileLayer(
    `https://api.maptiler.com/maps/hybrid-v4/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
    {
        minZoom: 1,
        maxZoom: 20,
        attribution:
            '&copy; MapTiler &copy; OpenStreetMap contributors',
        crossOrigin: true
    }
);


// Топографическая
const topoMap = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 17,
        attribution:
            'Map data: &copy; OpenStreetMap contributors | Map style: &copy; OpenTopoMap'
    }
);


// CARTO Dark Matter
const darkMap = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
        subdomains: 'abcd',

        maxZoom: 20,

        attribution:
            '&copy; OpenStreetMap contributors &copy; CARTO'
    }
);


// По умолчанию гибридная карта
satelliteMap.addTo(map);


const baseLayers = {
    normal: normalMap,
    satellite: satelliteMap,
    topo: topoMap,
    dark: darkMap
};

let currentBasemapName = 'satellite';


function applyGrayZoneBasemapOpacity() {

    if (!currentGeoJsonLayer) {
        return;
    }


    currentGeoJsonLayer.eachLayer(
        function(layer) {

            if (
                typeof layer.setStyle !==
                'function'
            ) {
                return;
            }


            const properties =
                layer.feature?.properties || {};


            const umapColorName =
                properties
                    ._umap_options
                    ?.color;


            const umapColor =
                umapColors[
                    umapColorName
                ];


            const fillColor =
                (
                    umapColor ||
                    properties.fill ||
                    '#3388ff'
                ).toLowerCase();


            const originalOpacity =
                properties[
                    'fill-opacity'
                ] ?? 0.4;


            // Только серая зона
            if (
                fillColor === '#bdbdbd'
            ) {

                // На светлых подложках
                // делаем серую зону заметнее
                if (
                    currentBasemapName ===
                        'normal' ||
                    currentBasemapName ===
                        'topo'
                ) {

                    layer.setStyle({
                        fillOpacity: 0.45
                    });

                } else {

                    // На гибридной и тёмной
                    // оставляем исходную прозрачность
                    layer.setStyle({
                        fillOpacity:
                            originalOpacity
                    });
                }

                return;
            }


            // Остальные территории
            // вообще не меняем
            layer.setStyle({
                fillOpacity:
                    originalOpacity
            });

        }
    );
}

let currentBaseLayer = satelliteMap;


// ================================
// ЦВЕТА UMAP
// ================================

const umapColors = {

    DarkRed: '#a52714',

    Red: '#ff0000',

    Gold: '#ffd700',
    Yellow: '#ffff00',

    Grey: '#bdbdbd',
    Gray: '#bdbdbd',

    DarkGrey: '#555555',
    DarkGray: '#555555',

    Blue: '#3388ff',
    DarkBlue: '#0055aa',
    LightBlue: '#87ceeb',

    Green: '#2e8b57',
    DarkGreen: '#006400',

    Orange: '#ff8c00'
};


// ================================
// ИСТОРИЯ И ЗАГРУЗКА GEOJSON
// ================================


// Все сохранённые версии карты
let mapVersions = [];


// Какая версия сейчас выбрана
let currentVersionIndex = 0;


// Текущий GeoJSON-слой
let currentGeoJsonLayer = null;


// ================================
// ПЛАВНАЯ СМЕНА ВЕРСИЙ КАРТЫ
// ================================

let mapLoadRequestId = 0;


// Меняет прозрачность GeoJSON-слоя
function setGeoJsonOpacity(layerGroup, opacity) {

    if (!layerGroup) {
        return;
    }


    function applyOpacity(layer) {

        if (
            typeof layer.getElement === 'function'
        ) {

            const element =
                layer.getElement();


            if (element) {

                element.style.transition =
                    'opacity 280ms ease';

                element.style.opacity =
                    String(opacity);
            }
        }


        if (
            typeof layer.eachLayer === 'function'
        ) {

            layer.eachLayer(
                applyOpacity
            );
        }
    }


    applyOpacity(layerGroup);
}


// Функция загрузки карты
function loadMapVersion(file, fitMap = false) {

    const requestId =
        ++mapLoadRequestId;


    fetch(file + '?v=' + Date.now())

        .then(response => {

            if (!response.ok) {

                throw new Error(
                    'Не удалось загрузить ' + file
                );
            }

            return response.json();
        })


        .then(data => {

            // Если пользователь очень быстро
            // переключил несколько дат,
            // игнорируем устаревший запрос
            if (
                requestId !==
                mapLoadRequestId
            ) {

                return;
            }


            // Сохраняем старую версию
            const oldGeoJsonLayer =
                currentGeoJsonLayer;


            // Создаём новую версию
            const newGeoJsonLayer =
                L.geoJSON(data, {

                    pane: 'territoriesPane',

                    style: function(feature) {

                        const properties =
                            feature.properties || {};


                        const umapColorName =
                            properties
                                ._umap_options
                                ?.color;


                        const umapColor =
                            umapColors[
                                umapColorName
                            ];


                        const fillColor =
                            umapColor ||
                            properties.fill ||
                            '#3388ff';


                        const strokeColor =
                            umapColor ||
                            properties.stroke ||
                            fillColor;


                        return {

                            color:
                                strokeColor,

                            fillColor:
                                fillColor,

                            fillOpacity:
                                properties[
                                    'fill-opacity'
                                ] ?? 0.4,

                            opacity:
                                properties[
                                    'stroke-opacity'
                                ] ?? 1,

                            weight:
                                Math.max(

                                    Number(
                                        properties[
                                            'stroke-width'
                                        ]
                                    ) || 0,

                                    2
                                )
                        };
                    },


                    onEachFeature:
                        function(
                            feature,
                            layer
                        ) {

                            if (
                                feature
                                    .properties
                                    ?.name
                            ) {

                                layer.bindPopup(
                                    feature
                                        .properties
                                        .name
                                );
                            }
                        }

                }).addTo(map);


            // Новая версия становится текущей
currentGeoJsonLayer =
    newGeoJsonLayer;


// Возвращаем настройки границ
applyTerritoryBorderSettings();


// Настраиваем серую зону
// под текущую подложку
applyGrayZoneBasemapOpacity();


// Территории поверх подложки
currentGeoJsonLayer
    .bringToFront();


            // Новая версия сначала прозрачная
            setGeoJsonOpacity(
                newGeoJsonLayer,
                0
            );


            // На следующем кадре
            // плавно показываем её
            requestAnimationFrame(() => {

                requestAnimationFrame(() => {

                    setGeoJsonOpacity(
                        newGeoJsonLayer,
                        1
                    );

                });

            });


            // Старую версию плавно скрываем
            if (oldGeoJsonLayer) {

                setGeoJsonOpacity(
                    oldGeoJsonLayer,
                    0
                );


                // После окончания анимации
                // полностью удаляем старый слой
                setTimeout(() => {

                    if (
                        map.hasLayer(
                            oldGeoJsonLayer
                        )
                    ) {

                        map.removeLayer(
                            oldGeoJsonLayer
                        );
                    }

                }, 320);
            }


            // При первом запуске
            // автоматически показываем всю карту
            if (fitMap) {

                const bounds =
                    newGeoJsonLayer
                        .getBounds();


                if (bounds.isValid()) {

                    map.fitBounds(
                        bounds
                    );
                }
            }

        })


        .catch(error => {

            console.error(
                'Ошибка GeoJSON:',
                error
            );

        });
}


// ================================
// ЗАГРУЗКА СПИСКА ВЕРСИЙ
// ================================

fetch('versions.json?v=' + Date.now())

    .then(response => {

        if (!response.ok) {
            throw new Error(
                'Не удалось загрузить versions.json'
            );
        }

        return response.json();
    })

    .then(versions => {

        if (
            !Array.isArray(versions) ||
            versions.length === 0
        ) {
            throw new Error(
                'В versions.json нет версий карты'
            );
        }

        mapVersions = versions;

        // Выбираем самую новую версию
        currentVersionIndex =
            mapVersions.length - 1;

        // Обновляем дату и стрелки
        updateHistoryControls();

        buildHistoryDateList();

        // Загружаем последнюю версию карты
       loadMapVersion(
    mapVersions[
        currentVersionIndex
    ].file,
    false
);

    })

    .catch(error => {

        console.error(
            'Ошибка списка версий:',
            error
        );

    });


// ================================
// БОКОВАЯ ПАНЕЛЬ
// ================================

const sidebar =
    document.getElementById('sidebar');

const openSidebar =
    document.getElementById('open-sidebar');

const closeSidebar =
    document.getElementById('close-sidebar');


openSidebar.addEventListener(
    'click',
    function() {

        sidebar.classList.remove('hidden');

        openSidebar.classList.remove('visible');

    }
);


closeSidebar.addEventListener(
    'click',
    function() {

        sidebar.classList.add('hidden');

        openSidebar.classList.add('visible');

    }
);


// ================================
// МЕНЮ ПОДЛОЖЕК
// ================================

const basemapControl =
    document.getElementById('basemap-control');

const basemapToggle =
    document.getElementById('basemap-toggle');

const basemapMenu =
    document.getElementById('basemap-menu');

const basemapOptions =
    document.querySelectorAll(
        '.basemap-option'
    );


// Открыть / закрыть меню
basemapToggle.addEventListener(
    'click',
    function(event) {

        event.stopPropagation();


        searchPanel.classList.add(
    'hidden'
);


        basemapMenu.classList.toggle(
            'hidden'
        );

    }
);


// Выбор подложки
basemapOptions.forEach(button => {

    button.addEventListener(
        'click',
        function() {

            const mapType =
                this.dataset.map;


            const newLayer =
                baseLayers[mapType];


            if (!newLayer) {
                return;
            }


            // Запоминаем выбранную подложку
            currentBasemapName =
                mapType;


            // Удаляем старую подложку
            if (
                map.hasLayer(
                    currentBaseLayer
                )
            ) {

                map.removeLayer(
                    currentBaseLayer
                );

            }


            // Включаем новую подложку
            currentBaseLayer =
                newLayer;


            currentBaseLayer.addTo(map);


// У обычных raster-подложек есть
// bringToBack(), а у MapTiler
// он может отсутствовать
if (
    typeof currentBaseLayer
        .bringToBack === 'function'
) {

    currentBaseLayer
        .bringToBack();
}


            // Настраиваем серую зону
            // под выбранную подложку
            applyGrayZoneBasemapOpacity();


            // Убираем active
            // со всех кнопок
            basemapOptions.forEach(
                option => {

                    option.classList.remove(
                        'active'
                    );

                }
            );


            // Выделяем выбранную
            this.classList.add(
                'active'
            );


            // Закрываем меню
            basemapMenu.classList.add(
                'hidden'
            );

        }
    );

});


// Нажатие вне меню закрывает его
document.addEventListener(
    'click',
    function(event) {

        if (
            !basemapControl.contains(
                event.target
            )
        ) {

            basemapMenu.classList.add(
                'hidden'
            );

        }

    }
);


// ================================
// ПОИСК НАСЕЛЁННЫХ ПУНКТОВ
// ================================

const searchControl =
    document.getElementById(
        'search-control'
    );


const searchToggle =
    document.getElementById(
        'search-toggle'
    );


const searchPanel =
    document.getElementById(
        'search-panel'
    );


const placeSearchInput =
    document.getElementById(
        'place-search-input'
    );


const placeSearchButton =
    document.getElementById(
        'place-search-button'
    );


const placeSearchStatus =
    document.getElementById(
        'place-search-status'
    );


const placeSearchResults =
    document.getElementById(
        'place-search-results'
    );


// Маркер найденного населённого пункта
let placeSearchMarker = null;


const searchResultIcon =
    L.divIcon({
        className:
            'search-result-marker-wrapper',

        html:
            '<div class="search-result-marker"></div>',

        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10]
    });


// Клик по карте убирает маркер поиска
map.on(
    'click',
    function() {

        if (
            placeSearchMarker &&
            map.hasLayer(
                placeSearchMarker
            )
        ) {

            map.removeLayer(
                placeSearchMarker
            );

            placeSearchMarker = null;
        }

    }
);


// Защита от старых запросов
let placeSearchRequestId = 0;


// ================================
// ПОКАЗ СТАТУСА
// ================================

function setPlaceSearchStatus(text) {

    if (!text) {

        placeSearchStatus.textContent =
            '';

        placeSearchStatus.classList.remove(
            'visible'
        );

        return;
    }


    placeSearchStatus.textContent =
        text;


    placeSearchStatus.classList.add(
        'visible'
    );
}


// ================================
// ОЧИСТКА РЕЗУЛЬТАТОВ
// ================================

function clearPlaceSearchResults() {

    placeSearchResults.innerHTML =
        '';


    placeSearchResults.classList.add(
        'hidden'
    );
}


// ================================
// ПЕРЕХОД К НАЙДЕННОМУ МЕСТУ
// ================================

function goToSearchResult(feature) {

    if (
        !feature ||
        !Array.isArray(
            feature.center
        ) ||
        feature.center.length < 2
    ) {
        return;
    }


    const longitude =
        feature.center[0];


    const latitude =
        feature.center[1];


    // Удаляем предыдущий маркер
    if (
        placeSearchMarker &&
        map.hasLayer(
            placeSearchMarker
        )
    ) {

        map.removeLayer(
            placeSearchMarker
        );
    }


    // Добавляем новый маркер
placeSearchMarker =
    L.marker(
        [
            latitude,
            longitude
        ],
        {
            icon:
                searchResultIcon
        }
    )
        .addTo(map);


    const placeName =
        feature.place_name ||
        feature.text ||
        'Найденное место';


    placeSearchMarker
        .bindPopup(
            placeName
        )
        .openPopup();


    // Плавно перелетаем
    map.flyTo(
        [
            latitude,
            longitude
        ],
        12,
        {
            duration: 1
        }
    );


    // После выбора закрываем
    // панель поиска
    searchPanel.classList.add(
        'hidden'
    );


    clearPlaceSearchResults();

    setPlaceSearchStatus('');
}


// ================================
// ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ
// ================================

function showPlaceSearchResults(
    features
) {

    clearPlaceSearchResults();


    if (
        !Array.isArray(features) ||
        features.length === 0
    ) {

        setPlaceSearchStatus(
            'Ничего не найдено'
        );

        return;
    }


    setPlaceSearchStatus('');


    features.forEach(
        function(feature) {

            const button =
                document.createElement(
                    'button'
                );


            button.type =
                'button';


            button.className =
                'place-search-result';


            const name =
                document.createElement(
                    'span'
                );


            name.className =
                'place-search-result-name';


            name.textContent =
                feature.text ||
                'Без названия';


            const fullName =
                document.createElement(
                    'span'
                );


            fullName.className =
                'place-search-result-full';


            fullName.textContent =
                feature.place_name ||
                '';


            button.appendChild(
                name
            );


            button.appendChild(
                fullName
            );


            button.addEventListener(
                'click',
                function() {

                    goToSearchResult(
                        feature
                    );
                }
            );


            placeSearchResults
                .appendChild(
                    button
                );
        }
    );


    placeSearchResults.classList.remove(
        'hidden'
    );
}


// ================================
// ВЫПОЛНЕНИЕ ПОИСКА
// ================================

function performPlaceSearch() {

    const query =
        placeSearchInput
            .value
            .trim();


    if (
        query.length < 2
    ) {

        clearPlaceSearchResults();

        setPlaceSearchStatus(
            'Введите название населённого пункта'
        );

        return;
    }


    const requestId =
        ++placeSearchRequestId;


    clearPlaceSearchResults();


    setPlaceSearchStatus(
        'Поиск...'
    );


    const searchUrl =
        'https://api.maptiler.com/geocoding/' +
        encodeURIComponent(query) +
        '.json' +
        '?key=' +
        encodeURIComponent(
            MAPTILER_KEY
        ) +
        '&country=ua' +
        '&language=' +
encodeURIComponent(
    currentLanguage
) +
        '&types=municipality,locality,place' +
        '&limit=5' +
        '&autocomplete=false';


    fetch(searchUrl)

        .then(response => {

            if (!response.ok) {

                throw new Error(
                    'Ошибка поиска: ' +
                    response.status
                );
            }


            return response.json();
        })


        .then(data => {

            // Если уже был новый запрос —
            // игнорируем старый
            if (
                requestId !==
                placeSearchRequestId
            ) {

                return;
            }


            showPlaceSearchResults(
                data.features || []
            );

        })


        .catch(error => {

            console.error(
                'Ошибка поиска:',
                error
            );


            setPlaceSearchStatus(
                'Не удалось выполнить поиск'
            );

        });
}


// ================================
// ОТКРЫТЬ / СВЕРНУТЬ ПОИСК
// ================================

searchToggle.addEventListener(
    'click',
    function(event) {

        event.stopPropagation();


        const opening =
            searchPanel
                .classList
                .contains('hidden');


        searchPanel.classList.toggle(
            'hidden'
        );


        // Чтобы меню подложек
        // не лежало поверх поиска
        basemapMenu.classList.add(
            'hidden'
        );


        if (opening) {

            setTimeout(
                function() {

                    placeSearchInput
                        .focus();

                },
                0
            );
        }

    }
);


// ================================
// КНОПКА "НАЙТИ"
// ================================

placeSearchButton.addEventListener(
    'click',
    performPlaceSearch
);


// ================================
// ENTER В СТРОКЕ ПОИСКА
// ================================

placeSearchInput.addEventListener(
    'keydown',
    function(event) {

        if (
            event.key === 'Enter'
        ) {

            event.preventDefault();

            performPlaceSearch();
        }

    }
);


// ================================
// УПРАВЛЕНИЕ ИСТОРИЕЙ
// ================================

const historyToggle =
    document.getElementById(
        'history-toggle'
    );

const historyPanel =
    document.getElementById(
        'history-panel'
    );

const historyPrev =
    document.getElementById(
        'history-prev'
    );

const historyNext =
    document.getElementById(
        'history-next'
    );

const historyDate =
    document.getElementById(
        'history-date'
    );

const historyDateList =
    document.getElementById(
        'history-date-list'
    );

    const historyStatus =
    document.getElementById(
        'history-status'
    );


    const historyLatest =
    document.getElementById(
        'history-latest'
    );


    // ================================
// ПЕРЕХОД К АКТУАЛЬНОЙ ВЕРСИИ
// ================================

historyLatest.addEventListener(
    'click',
    function() {

        if (
            mapVersions.length === 0
        ) {
            return;
        }


        // Выбираем самую новую версию
        currentVersionIndex =
            mapVersions.length - 1;


        // Загружаем её
        loadMapVersion(
            mapVersions[
                currentVersionIndex
            ].file
        );


        // Обновляем интерфейс
        updateHistoryControls();

        buildHistoryDateList();


        // Закрываем список дат,
        // если он был открыт
        historyDateList
            .classList
            .add('hidden');
    }
);


// ================================
// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ИСТОРИИ
// ================================

function updateHistoryControls() {

    if (mapVersions.length === 0) {
        return;
    }


    historyDate.textContent =
        mapVersions[
            currentVersionIndex
        ].date + ' ▾';


    historyPrev.disabled =
        currentVersionIndex === 0;


    historyNext.disabled =
        currentVersionIndex ===
        mapVersions.length - 1;


    // Если выбрана самая свежая дата
    if (
        currentVersionIndex ===
        mapVersions.length - 1
    ) {

        historyStatus.textContent =
            'Актуальная версия';


        // Кнопка возврата больше не нужна
        historyLatest.classList.add(
            'hidden'
        );

    } else {

        historyStatus.textContent =
            'Архив';


        // В архиве показываем кнопку
        historyLatest.classList.remove(
            'hidden'
        );
    }
}


// ================================
// СОЗДАНИЕ СПИСКА ДАТ
// ================================

function buildHistoryDateList() {

    historyDateList.innerHTML = '';


    // Самые новые даты сверху
    for (
        let i = mapVersions.length - 1;
        i >= 0;
        i--
    ) {

        const version =
            mapVersions[i];


        const button =
            document.createElement(
                'button'
            );


        button.type = 'button';

        button.className =
            'history-date-option';

        button.textContent =
            version.date;


        if (
            i === currentVersionIndex
        ) {

            button.classList.add(
                'active'
            );
        }


        button.addEventListener(
            'click',
            function() {

                currentVersionIndex = i;


                loadMapVersion(
                    mapVersions[
                        currentVersionIndex
                    ].file
                );


                updateHistoryControls();

                buildHistoryDateList();


                historyDateList
                    .classList
                    .add('hidden');
            }
        );


        historyDateList.appendChild(
            button
        );
    }
}


// ================================
// КНОПКА С ДАТОЙ
// ================================

historyDate.addEventListener(
    'click',
    function(event) {

        event.stopPropagation();

        historyDateList
            .classList
            .toggle('hidden');
    }
);


// Закрытие списка при клике вне него
document.addEventListener(
    'click',
    function(event) {

        if (
            !historyDateList.contains(
                event.target
            ) &&
            event.target !== historyDate
        ) {

            historyDateList
                .classList
                .add('hidden');
        }
    }
);


// ================================
// ПРЕДЫДУЩАЯ ДАТА
// ================================

historyPrev.addEventListener(
    'click',
    function() {

        if (
            currentVersionIndex > 0
        ) {

            currentVersionIndex--;


            loadMapVersion(
                mapVersions[
                    currentVersionIndex
                ].file
            );


            updateHistoryControls();

            buildHistoryDateList();
        }
    }
);


// ================================
// СЛЕДУЮЩАЯ ДАТА
// ================================

historyNext.addEventListener(
    'click',
    function() {

        if (
            currentVersionIndex <
            mapVersions.length - 1
        ) {

            currentVersionIndex++;


            loadMapVersion(
                mapVersions[
                    currentVersionIndex
                ].file
            );


            updateHistoryControls();

            buildHistoryDateList();
        }
    }
);


// ================================
// ПЕРЕКЛЮЧЕНИЕ ДАТ С КЛАВИАТУРЫ
// ================================

document.addEventListener(
    'keydown',
    function(event) {

        // Не мешаем вводу текста,
        // если в будущем появятся поля поиска
        const target = event.target;

        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable
        ) {
            return;
        }


        // Стрелка влево — предыдущая дата
        if (
            event.key === 'ArrowLeft' &&
            currentVersionIndex > 0
        ) {

            event.preventDefault();

            currentVersionIndex--;

            loadMapVersion(
                mapVersions[
                    currentVersionIndex
                ].file
            );

            updateHistoryControls();
            buildHistoryDateList();
        }


        // Стрелка вправо — следующая дата
        if (
            event.key === 'ArrowRight' &&
            currentVersionIndex <
            mapVersions.length - 1
        ) {

            event.preventDefault();

            currentVersionIndex++;

            loadMapVersion(
                mapVersions[
                    currentVersionIndex
                ].file
            );

            updateHistoryControls();
            buildHistoryDateList();
        }

    }
);


// ================================
// ОТКРЫТЬ / ЗАКРЫТЬ ИСТОРИЮ
// ================================

historyToggle.addEventListener(
    'click',
    function() {

        historyPanel.classList.toggle(
            'hidden'
        );
    }
);


// ================================
// НАСТРОЙКИ: ТЕМА И ЯЗЫК
// ================================


// Главное меню настроек
const settingsControl =
    document.getElementById(
        'settings-control'
    );


const settingsToggle =
    document.getElementById(
        'settings-toggle'
    );


const settingsPanel =
    document.getElementById(
        'settings-panel'
    );


// Кнопка темы внутри настроек
const themeToggle =
    document.getElementById(
        'theme-toggle'
    );


    const themeToggleLabel =
    document.getElementById(
        'theme-toggle-label'
    );


const themeIconMoon =
    themeToggle.querySelector(
        '.theme-icon-moon'
    );


const themeIconSun =
    themeToggle.querySelector(
        '.theme-icon-sun'
    );


// Кнопки UA / RU / EN
const languageOptions =
    document.querySelectorAll(
        '.language-option'
    );


// Заголовки внутри настроек
const settingsTitle =
    document.getElementById(
        'settings-title'
    );


const settingsThemeLabel =
    document.getElementById(
        'settings-theme-label'
    );


const settingsLanguageLabel =
    document.getElementById(
        'settings-language-label'
    );


// ================================
// ПЕРЕВОДЫ
// ================================

const translations = {

    ru: {
        settings: 'Настройки',
        theme: 'Тема',
        language: 'Язык',

        darkTheme: 'Тёмная тема',
lightTheme: 'Светлая тема',

        legend: 'Легенда',
        occupied: 'Оккупировано',
        uncertain: 'Под вопросом',
        liberated: 'Освобождено',

        updates: 'Лента обновлений',

        tools: 'Инструменты',
territories: 'Территории',
borders: 'Границы',
opacity: 'Прозрачность',
on: 'Вкл',
off: 'Выкл',

cursorCoordinates:
    'Координаты курсора',

coordinatesCopied: '✓ Скопировано',

measureDistance:
    'Измерить расстояние',
clearDistance: 'Очистить',
metersShort: 'м',
kilometersShort: 'км',

        basemap: 'Подложка',
        normal: 'Обычная',
        hybrid: 'Гибрид',
        topo: 'Топографическая',
        darkBasemap: 'Тёмная',

        searchPlaceholder:
            'Найти населённый пункт...',

        find: 'Найти',

        history: 'История карты',
        currentVersion: 'Актуальная версия',
        archive: 'Архив'
    },


    uk: {
        settings: 'Налаштування',
        theme: 'Тема',
        language: 'Мова',

        darkTheme: 'Темна тема',
lightTheme: 'Світла тема',

        legend: 'Легенда',
        occupied: 'Окуповано',
        uncertain: 'Під питанням',
        liberated: 'Звільнено',

        updates: 'Стрічка оновлень',

        tools: 'Інструменти',
territories: 'Території',
borders: 'Межі',
opacity: 'Прозорість',
on: 'Увімк',
off: 'Вимк',

cursorCoordinates:
    'Координати курсора',

coordinatesCopied: '✓ Скопійовано',

measureDistance:
    'Виміряти відстань',
clearDistance: 'Очистити',
metersShort: 'м',
kilometersShort: 'км',

        basemap: 'Підкладка',
        normal: 'Звичайна',
        hybrid: 'Гібрид',
        topo: 'Топографічна',
        darkBasemap: 'Темна',

        searchPlaceholder:
            'Знайти населений пункт...',

        find: 'Знайти',

        history: 'Історія карти',
        currentVersion: 'Актуальна версія',
        archive: 'Архів'
    },


    en: {
        settings: 'Settings',
        theme: 'Theme',
        language: 'Language',

        darkTheme: 'Dark theme',
lightTheme: 'Light theme',

        legend: 'Legend',
        occupied: 'Occupied',
        uncertain: 'Uncertain',
        liberated: 'Liberated',

        updates: 'Update feed',

        tools: 'Tools',
territories: 'Territories',
borders: 'Borders',
opacity: 'Opacity',
on: 'On',
off: 'Off',

cursorCoordinates:
    'Cursor coordinates',

coordinatesCopied: '✓ Copied',

measureDistance:
    'Measure distance',
clearDistance: 'Clear',
metersShort: 'm',
kilometersShort: 'km',

        basemap: 'Basemap',
        normal: 'Standard',
        hybrid: 'Hybrid',
        topo: 'Topographic',
        darkBasemap: 'Dark',

        searchPlaceholder:
            'Find a settlement...',

        find: 'Search',

        history: 'Map history',
        currentVersion: 'Current version',
        archive: 'Archive'
    }

};


// ================================
// СОХРАНЁННЫЕ НАСТРОЙКИ
// ================================

let currentTheme =
    localStorage.getItem(
        'rubizh-theme'
    ) || 'dark';


let currentLanguage =
    localStorage.getItem(
        'rubizh-language'
    ) || 'ru';


if (
    !translations[currentLanguage]
) {

    currentLanguage = 'ru';
}


// Получить перевод
function t(key) {

    return (
        translations[
            currentLanguage
        ]?.[key] ||
        translations.ru[key] ||
        key
    );
}


// ================================
// ТЕМА
// ================================

function updateThemeButton() {

    if (
        currentTheme === 'dark'
    ) {

        // Сейчас тёмная тема,
        // значит предлагаем перейти на светлую
        themeToggleLabel.textContent =
            t('lightTheme');


        themeIconMoon.classList.add(
            'is-hidden'
        );


        themeIconSun.classList.remove(
            'is-hidden'
        );

    } else {

        // Сейчас светлая тема,
        // предлагаем перейти на тёмную
        themeToggleLabel.textContent =
            t('darkTheme');


        themeIconSun.classList.add(
            'is-hidden'
        );


        themeIconMoon.classList.remove(
            'is-hidden'
        );
    }
}


function applyTheme(theme) {

    if (
        theme === 'dark'
    ) {

        document.body.classList.add(
            'dark-theme'
        );

        currentTheme = 'dark';

    } else {

        document.body.classList.remove(
            'dark-theme'
        );

        currentTheme = 'light';
    }


    localStorage.setItem(
        'rubizh-theme',
        currentTheme
    );


    updateThemeButton();
}


themeToggle.addEventListener(
    'click',
    function() {

        if (
            currentTheme === 'light'
        ) {

            applyTheme('dark');

        } else {

            applyTheme('light');
        }

    }
);


// ================================
// ЯЗЫК
// ================================

function applyLanguage(language) {

    if (
        !translations[language]
    ) {
        return;
    }


    currentLanguage =
        language;


    localStorage.setItem(
        'rubizh-language',
        language
    );


    // Настройки
    settingsTitle.textContent =
        t('settings');

    settingsThemeLabel.textContent =
        t('theme');

    settingsLanguageLabel.textContent =
        t('language');


    // Легенда
    const legendTitle =
        document.querySelector(
            '.legend-box h2'
        );


    if (legendTitle) {
        legendTitle.textContent =
            t('legend');
    }


    const legendTexts =
        document.querySelectorAll(
            '.legend-item span:last-child'
        );


    if (legendTexts[0]) {
        legendTexts[0].textContent =
            t('occupied');
    }


    if (legendTexts[1]) {
        legendTexts[1].textContent =
            t('uncertain');
    }


    if (legendTexts[2]) {
        legendTexts[2].textContent =
            t('liberated');
    }


    // Лента обновлений
    const updatesTitle =
        document.querySelector(
            '.updates-box h2'
        );


    if (updatesTitle) {
        updatesTitle.textContent =
            t('updates');
    }


    // Подложки
    const basemapTitle =
        document.querySelector(
            '.basemap-title'
        );


    if (basemapTitle) {
        basemapTitle.textContent =
            t('basemap');
    }


    const normalButton =
        document.querySelector(
            '.basemap-option[data-map="normal"]'
        );


    const hybridButton =
        document.querySelector(
            '.basemap-option[data-map="satellite"]'
        );


    const topoButton =
        document.querySelector(
            '.basemap-option[data-map="topo"]'
        );


        const darkButton =
    document.querySelector(
        '.basemap-option[data-map="dark"]'
    );


    if (normalButton) {
        normalButton.textContent =
            t('normal');
    }


    if (hybridButton) {
        hybridButton.textContent =
            t('hybrid');
    }


    if (topoButton) {
        topoButton.textContent =
            t('topo');
    }


    if (darkButton) {
    darkButton.textContent =
        t('darkBasemap');
}


    // Поиск
    placeSearchInput.placeholder =
        t('searchPlaceholder');


    placeSearchButton.textContent =
        t('find');


    // История
    const historyTitle =
        document.querySelector(
            '.history-title'
        );


    if (historyTitle) {
        historyTitle.textContent =
            t('history');
    }


    historyLatest.textContent =
        t('currentVersion');


    if (
        mapVersions.length > 0
    ) {

        if (
            currentVersionIndex ===
            mapVersions.length - 1
        ) {

            historyStatus.textContent =
                t('currentVersion');

        } else {

            historyStatus.textContent =
                t('archive');
        }
    }


    // ================================
// ИНСТРУМЕНТЫ
// ================================

const toolsTitleElement =
    document.getElementById(
        'tools-title'
    );


const toolsTerritoriesLabel =
    document.getElementById(
        'tools-territories-label'
    );


const toolsOpacityLabel =
    document.getElementById(
        'tools-opacity-label'
    );


const toolsToggleElement =
    document.getElementById(
        'tools-toggle'
    );


if (toolsTitleElement) {

    toolsTitleElement.textContent =
        t('tools');
}


if (toolsTerritoriesLabel) {

    toolsTerritoriesLabel.textContent =
        t('territories');
}


if (toolsBordersLabel) {

    toolsBordersLabel.textContent =
        t('borders');
}


if (toolsOpacityLabel) {

    toolsOpacityLabel.textContent =
        t('opacity');
}


if (toolsToggleElement) {

    toolsToggleElement.title =
        t('tools');
}


// Линейка
if (distanceToggle) {

    distanceToggleLabel.textContent =
    t('measureDistance');
}


// Координаты курсора
if (coordinatesToggle) {

    coordinatesToggleLabel.textContent =
    t('cursorCoordinates');
}


if (distanceClear) {

    distanceClear.textContent =
        t('clearDistance');
}


// Если уже что-то измерено,
// сразу обновляем единицы
if (
    typeof updateMeasurementDistance ===
    'function'
) {

    updateMeasurementDistance();
}


// Обновляем также Вкл / Выкл,
// если функция инструментов уже загружена
if (
    typeof applyTerritorySettings ===
    'function'
) {

    applyTerritorySettings();
    applyTerritoryBorderSettings();
}


    // Выделяем выбранный язык
    languageOptions.forEach(
        function(button) {

            button.classList.toggle(
                'active',

                button.dataset.language ===
                currentLanguage
            );

        }
    );


    updateThemeButton();
}


languageOptions.forEach(
    function(button) {

        button.addEventListener(
            'click',
            function() {

                applyLanguage(
                    this.dataset.language
                );

            }
        );

    }
);


// ================================
// ОТКРЫТИЕ НАСТРОЕК
// ================================

settingsToggle.addEventListener(
    'click',
    function(event) {

        event.stopPropagation();


        settingsPanel.classList.toggle(
            'hidden'
        );


        // Закрываем поиск и подложки
        searchPanel.classList.add(
            'hidden'
        );


        basemapMenu.classList.add(
            'hidden'
        );

    }
);


// Клик вне меню закрывает настройки
document.addEventListener(
    'click',
    function(event) {

        if (
            !settingsControl.contains(
                event.target
            )
        ) {

            settingsPanel.classList.add(
                'hidden'
            );
        }

    }
);


// ================================
// ИНСТРУМЕНТЫ КАРТЫ
// ================================

const toolsControl =
    document.getElementById(
        'tools-control'
    );


const toolsToggle =
    document.getElementById(
        'tools-toggle'
    );


const toolsPanel =
    document.getElementById(
        'tools-panel'
    );


const territoriesToggle =
    document.getElementById(
        'territories-toggle'
    );


    const territoryBordersToggle =
    document.getElementById(
        'territory-borders-toggle'
    );


const toolsBordersLabel =
    document.getElementById(
        'tools-borders-label'
    );


const territoryOpacity =
    document.getElementById(
        'territory-opacity'
    );


const territoryOpacityValue =
    document.getElementById(
        'territory-opacity-value'
    );


    // ================================
// ИЗМЕРЕНИЕ РАССТОЯНИЯ — ЭЛЕМЕНТЫ
// ================================

const distanceToggle =
    document.getElementById(
        'distance-toggle'
    );


    const distanceToggleLabel =
    document.getElementById(
        'distance-toggle-label'
    );


const distanceInfo =
    document.getElementById(
        'distance-info'
    );


const distanceValue =
    document.getElementById(
        'distance-value'
    );


const distanceClear =
    document.getElementById(
        'distance-clear'
    );


    // ================================
// КООРДИНАТЫ КУРСОРА — ЭЛЕМЕНТЫ
// ================================

const coordinatesToggle =
    document.getElementById(
        'coordinates-toggle'
    );


    const coordinatesToggleLabel =
    document.getElementById(
        'coordinates-toggle-label'
    );


const coordinatesInfo =
    document.getElementById(
        'coordinates-info'
    );


const coordinatesValue =
    document.getElementById(
        'coordinates-value'
    );


// ================================
// СОСТОЯНИЕ ТЕРРИТОРИЙ
// ================================

let territoriesVisible =
    true;


    let territoryBordersVisible =
    true;


let territoriesOpacity =
    100;


// ================================
// ПРИМЕНИТЬ НАСТРОЙКИ ТЕРРИТОРИЙ
// ================================


function applyTerritoryBorderSettings() {

    // Обновляем кнопку
    territoryBordersToggle.textContent =
        territoryBordersVisible
            ? t('on')
            : t('off');


    territoryBordersToggle.classList.toggle(
        'enabled',
        territoryBordersVisible
    );


    // Если карта ещё не загружена
    if (!currentGeoJsonLayer) {
        return;
    }


    // Проходим по всем полигонам
    currentGeoJsonLayer.eachLayer(
        function(layer) {

            if (
                typeof layer.setStyle !==
                'function'
            ) {
                return;
            }


            // Выключаем границы
            if (!territoryBordersVisible) {

                layer.setStyle({
                    opacity: 0,
                    weight: 0
                });

                return;
            }


            // Возвращаем исходный стиль
            const properties =
                layer.feature?.properties || {};


            const umapColorName =
                properties
                    ._umap_options
                    ?.color;


            const umapColor =
                umapColors[
                    umapColorName
                ];


            const fillColor =
                umapColor ||
                properties.fill ||
                '#3388ff';


            const strokeColor =
                umapColor ||
                properties.stroke ||
                fillColor;


            layer.setStyle({

                color:
                    strokeColor,

                opacity:
                    properties[
                        'stroke-opacity'
                    ] ?? 1,

                weight:
                    Math.max(
                        Number(
                            properties[
                                'stroke-width'
                            ]
                        ) || 0,

                        2
                    )
            });

        }
    );
}


function applyTerritorySettings() {

    // Показ / скрытие
    if (territoriesVisible) {

        territoriesPane.style.display =
            '';

        territoriesToggle.textContent =
    t('on');

        territoriesToggle.classList.add(
            'enabled'
        );

    } else {

        territoriesPane.style.display =
            'none';

        territoriesToggle.textContent =
    t('off');

        territoriesToggle.classList.remove(
            'enabled'
        );
    }


    // Прозрачность всего слоя
    territoriesPane.style.opacity =
        String(
            territoriesOpacity / 100
        );


    territoryOpacity.value =
        String(
            territoriesOpacity
        );


    territoryOpacityValue.textContent =
        territoriesOpacity + '%';


    // Если слой полностью прозрачный,
    // он не должен перехватывать клики
   
    if (
    !territoriesVisible ||
    territoriesOpacity === 0 ||
    distanceMode
) {

    territoriesPane.style.pointerEvents =
        'none';

} else {

    territoriesPane.style.pointerEvents =
        'auto';
}


// ================================
// ИНТЕРАКТИВНОСТЬ САМИХ ПОЛИГОНОВ
// ================================

const territoryElements =
    territoriesPane.querySelectorAll(
        '.leaflet-interactive'
    );


territoryElements.forEach(
    function(element) {

        if (distanceMode) {

            // Во время измерения
            // мышь проходит сквозь полигоны
            element.style.pointerEvents =
                'none';

            element.style.cursor =
                'crosshair';

        } else {

            // После измерения
            // возвращаем обычные клики
            element.style.pointerEvents =
                '';

            element.style.cursor =
                '';
        }

    }
);

}


// ================================
// ВКЛ / ВЫКЛ ТЕРРИТОРИИ
// ================================

territoriesToggle.addEventListener(
    'click',
    function() {

        territoriesVisible =
            !territoriesVisible;


        applyTerritorySettings();

    }
);


// ================================
// ВКЛ / ВЫКЛ ГРАНИЦЫ
// ================================

territoryBordersToggle.addEventListener(
    'click',
    function() {

        territoryBordersVisible =
            !territoryBordersVisible;


        applyTerritoryBorderSettings();

    }
);


// ================================
// ПРОЗРАЧНОСТЬ
// ================================

territoryOpacity.addEventListener(
    'input',
    function() {

        territoriesOpacity =
            Number(
                this.value
            );


        applyTerritorySettings();

    }
);


// ================================
// ИЗМЕРЕНИЕ РАССТОЯНИЯ
// ================================


// Отдельный слой поверх территорий
map.createPane(
    'measurementPane'
);


const measurementPane =
    map.getPane(
        'measurementPane'
    );


measurementPane.style.zIndex =
    '650';


measurementPane.style.pointerEvents =
    'none';


// Включён ли режим измерения
let distanceMode =
    false;


// Все поставленные точки
let measurementPoints =
    [];


// Кружки на карте
let measurementMarkers =
    [];


    // Тёмная окантовка линии
let measurementOutline =
    null;


// Линия
let measurementLine =
    null;


    // Подпись общего расстояния
let measurementLabel =
    null;


// ================================
// ФОРМАТ РАССТОЯНИЯ
// ================================

function formatDistance(meters) {

    if (meters < 1000) {

        return (
            Math.round(meters) +
            ' ' + t('metersShort')
        );
    }


    const kilometers =
        meters / 1000;


    if (kilometers < 10) {

        return (
            kilometers
              .toFixed(2)
.replace('.', ',') +
' ' +
t('kilometersShort')
        );
    }


    return (
        kilometers
            .toFixed(2)
.replace('.', ',') +
' ' +
t('kilometersShort')
    );
}


// ================================
// ПОДСЧЁТ ОБЩЕГО РАССТОЯНИЯ
// ================================

function calculateMeasurementDistance() {

    let total =
        0;


    for (
        let i = 1;
        i < measurementPoints.length;
        i++
    ) {

        total +=
            measurementPoints[
                i - 1
            ].distanceTo(
                measurementPoints[i]
            );
    }


    return total;
}


// ================================
// ОБНОВЛЕНИЕ РЕЗУЛЬТАТА
// ================================

function updateMeasurementDistance() {

    const total =
        calculateMeasurementDistance();


    const formattedDistance =
        formatDistance(total);


    // Значение в меню
    distanceValue.textContent =
        formattedDistance;


    // Если есть хотя бы одна точка
    if (
        measurementPoints.length > 0
    ) {

        const lastPoint =
            measurementPoints[
                measurementPoints.length - 1
            ];


        // Если подписи ещё нет —
        // создаём её
        if (!measurementLabel) {

            measurementLabel =
                L.tooltip(
                    {
                        permanent: true,

                        direction: 'top',

                        offset: [0, -9],

                        className:
                            'measurement-distance-label',

                        interactive: false,

                        pane:
                            'measurementPane'
                    }
                )
                    .setLatLng(
                        lastPoint
                    )
                    .setContent(
                        formattedDistance
                    )
                    .addTo(map);

        } else {

            // Перемещаем к последней точке
            measurementLabel
                .setLatLng(
                    lastPoint
                );


            // Обновляем значение
            measurementLabel
                .setContent(
                    formattedDistance
                );
        }
    }
}


// ================================
// ДОБАВЛЕНИЕ ТОЧКИ
// ================================

function addMeasurementPoint(latlng) {

    measurementPoints.push(
        latlng
    );


    // Рисуем точку
   const marker =
    L.circleMarker(
        latlng,
        {
            pane:
                'measurementPane',

            radius:
                5,

            // Тёмный контур точки
            color:
                '#202020',

            weight:
                2,

            // Белый центр
            fillColor:
                '#ffffff',

            fillOpacity:
                1,

            interactive:
                false
        }
    ).addTo(map);


    measurementMarkers.push(
        marker
    );


    // Создаём или обновляем линию
    if (
        measurementPoints.length >= 2
    ) {

        if (!measurementLine) {

    // Сначала рисуем толстую
    // тёмную линию снизу
    measurementOutline =
        L.polyline(
            measurementPoints,
            {
                pane:
                    'measurementPane',

                color:
                    '#202020',

                weight:
                    7,

                opacity:
                    0.75,

                lineCap:
                    'round',

                lineJoin:
                    'round',

                interactive:
                    false
            }
        ).addTo(map);


    // Поверх неё — тонкую белую
    measurementLine =
        L.polyline(
            measurementPoints,
            {
                pane:
                    'measurementPane',

                color:
                    '#ffffff',

                weight:
                    3,

                opacity:
                    1,

                lineCap:
                    'round',

                lineJoin:
                    'round',

                interactive:
                    false
            }
        ).addTo(map);

} else {

    measurementOutline
        .setLatLngs(
            measurementPoints
        );


    measurementLine
        .setLatLngs(
            measurementPoints
        );
}
    }


    updateMeasurementDistance();
}


// ================================
// ОЧИСТИТЬ ИЗМЕРЕНИЕ
// ================================

function clearMeasurement() {

    measurementMarkers.forEach(
        function(marker) {

            if (
                map.hasLayer(marker)
            ) {

                map.removeLayer(
                    marker
                );
            }
        }
    );


    measurementMarkers =
        [];


    measurementPoints =
        [];


        if (
    measurementOutline &&
    map.hasLayer(
        measurementOutline
    )
) {

    map.removeLayer(
        measurementOutline
    );
}


measurementOutline =
    null;


    if (
        measurementLine &&
        map.hasLayer(
            measurementLine
        )
    ) {

        map.removeLayer(
            measurementLine
        );
    }


    measurementLine =
        null;


        // Удаляем подпись расстояния
if (
    measurementLabel &&
    map.hasLayer(
        measurementLabel
    )
) {

    map.removeLayer(
        measurementLabel
    );
}


measurementLabel =
    null;


    distanceValue.textContent =
    formatDistance(0);


    if (!distanceMode) {

        distanceInfo.classList.add(
            'hidden'
        );
    }
}


// ================================
// ВКЛ / ВЫКЛ РЕЖИМ
// ================================

distanceToggle.addEventListener(
    'click',
    function() {

        distanceMode =
            !distanceMode;


        distanceToggle.classList.toggle(
            'active',
            distanceMode
        );


        // Во время измерения полигоны
// не должны перехватывать мышь
applyTerritorySettings();


        if (distanceMode) {

            distanceInfo.classList.remove(
                'hidden'
            );


            map.getContainer()
                .style.cursor =
                'crosshair';

        } else {

            map.getContainer()
                .style.cursor =
                '';


            // Если точек вообще нет,
            // результат можно скрыть
            if (
                measurementPoints.length ===
                0
            ) {

                distanceInfo.classList.add(
                    'hidden'
                );
            }
        }
    }
);


// ================================
// КНОПКА ОЧИСТИТЬ
// ================================

distanceClear.addEventListener(
    'click',
    function(event) {

        event.stopPropagation();

        clearMeasurement();
    }
);


// ================================
// КЛИК ПО КАРТЕ
// ================================

map.on(
    'click',
    function(event) {

        if (!distanceMode) {
            return;
        }


        addMeasurementPoint(
            event.latlng
        );
    }
);


// ================================
// КООРДИНАТЫ КУРСОРА
// ================================


// Включён ли режим координат
let coordinatesMode =
    false;


    // Последние координаты курсора
let currentCoordinatesText =
    '0.00000, 0.00000';


// Контейнер самой карты
const mapContainer =
    map.getContainer();


// ================================
// ОБНОВЛЕНИЕ КООРДИНАТ
// ================================

function updateCursorCoordinates(
    latlng
) {

    const latitude =
        latlng.lat.toFixed(5);


    const longitude =
        latlng.lng.toFixed(5);


    currentCoordinatesText =
    latitude +
    ', ' +
    longitude;


coordinatesValue.textContent =
    currentCoordinatesText;
}


// ================================
// КОПИРОВАНИЕ КООРДИНАТ
// ================================

coordinatesValue.addEventListener(
    'click',
    async function() {

        if (!coordinatesMode) {
            return;
        }


        try {

            await navigator.clipboard.writeText(
                currentCoordinatesText
            );


            coordinatesValue.textContent =
                t('coordinatesCopied');


            setTimeout(
                function() {

                    if (coordinatesMode) {

                        coordinatesValue.textContent =
                            currentCoordinatesText;
                    }

                },
                1000
            );

        } catch (error) {

            console.error(
                'Не удалось скопировать координаты:',
                error
            );
        }

    }
);


// ================================
// ВКЛ / ВЫКЛ КООРДИНАТЫ
// ================================

coordinatesToggle.addEventListener(
    'click',
    function() {

        coordinatesMode =
            !coordinatesMode;


        coordinatesToggle.classList.toggle(
            'active',
            coordinatesMode
        );


        if (coordinatesMode) {

            coordinatesInfo.classList.remove(
                'hidden'
            );

        } else {

            coordinatesInfo.classList.add(
                'hidden'
            );
        }

    }
);


// ================================
// ДВИЖЕНИЕ МЫШИ ПО КАРТЕ
// ================================

mapContainer.addEventListener(
    'mousemove',
    function(event) {

        if (!coordinatesMode) {
            return;
        }


        const rect =
            mapContainer
                .getBoundingClientRect();


        const point =
            L.point(
                event.clientX -
                    rect.left,

                event.clientY -
                    rect.top
            );


        const latlng =
            map.containerPointToLatLng(
                point
            );


        updateCursorCoordinates(
            latlng
        );

    }
);


// ================================
// ОТКРЫТЬ / ЗАКРЫТЬ ИНСТРУМЕНТЫ
// ================================

toolsToggle.addEventListener(
    'click',
    function(event) {

        event.stopPropagation();


        toolsPanel.classList.toggle(
            'hidden'
        );


        // Закрываем остальные окна
        basemapMenu.classList.add(
            'hidden'
        );


        searchPanel.classList.add(
            'hidden'
        );


        settingsPanel.classList.add(
            'hidden'
        );

    }
);


// ================================
// КЛИК ВНЕ ИНСТРУМЕНТОВ
// ================================

document.addEventListener(
    'click',
    function(event) {

     if (
    !toolsControl.contains(
        event.target
    ) &&
    !distanceMode &&
    !coordinatesMode
) {

    toolsPanel.classList.add(
        'hidden'
    );
}

    }
);


// Первоначальное состояние
applyTerritorySettings();


// ================================
// ЗАПУСК
// ================================

applyLanguage(
    currentLanguage
);


applyTheme(
    currentTheme
);