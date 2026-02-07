// Weather Dashboard using Open-Meteo (no API key).
// Features: city search (geocoding), current weather, 7-day forecast, unit toggle, persist last city.

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const LAST_CITY_KEY = 'weather_last_city';

const els = {
  cityInput: document.getElementById('cityInput'),
  searchBtn: document.getElementById('searchBtn'),
  unitToggle: document.getElementById('unitToggle'),
  currentContent: document.getElementById('currentContent'),
  forecastGrid: document.getElementById('forecastGrid'),
};

let isFahrenheit = false;

// Map Open-Meteo weathercode to description + emoji
const weatherMap = {
  0: {desc:'Clear', emoji:'☀️'},
  1: {desc:'Mainly clear', emoji:'🌤️'},
  2: {desc:'Partly cloudy', emoji:'⛅'},
  3: {desc:'Overcast', emoji:'☁️'},
  45: {desc:'Fog', emoji:'🌫️'},
  48: {desc:'Depositing rime fog', emoji:'🌫️'},
  51: {desc:'Light drizzle', emoji:'🌦️'},
  53: {desc:'Moderate drizzle', emoji:'🌦️'},
  55: {desc:'Dense drizzle', emoji:'🌧️'},
  56: {desc:'Light freezing drizzle', emoji:'🧊🌧️'},
  57: {desc:'Dense freezing drizzle', emoji:'🧊🌧️'},
  61: {desc:'Slight rain', emoji:'🌧️'},
  63: {desc:'Moderate rain', emoji:'🌧️'},
  65: {desc:'Heavy rain', emoji:'⛈️'},
  66: {desc:'Light freezing rain', emoji:'🧊🌧️'},
  67: {desc:'Heavy freezing rain', emoji:'🧊🌧️'},
  71: {desc:'Slight snow fall', emoji:'🌨️'},
  73: {desc:'Moderate snow fall', emoji:'🌨️'},
  75: {desc:'Heavy snow fall', emoji:'❄️'},
  77: {desc:'Snow grains', emoji:'❄️'},
  80: {desc:'Slight rain showers', emoji:'🌧️'},
  81: {desc:'Moderate rain showers', emoji:'🌧️'},
  82: {desc:'Violent rain showers', emoji:'⛈️'},
  85: {desc:'Slight snow showers', emoji:'🌨️'},
  86: {desc:'Heavy snow showers', emoji:'❄️'},
  95: {desc:'Thunderstorm', emoji:'⛈️'},
  96: {desc:'Thunderstorm with slight hail', emoji:'⛈️🧊'},
  99: {desc:'Thunderstorm with heavy hail', emoji:'⛈️🧊'},
};

function toFahrenheit(c) {
  return (c * 9/5) + 32;
}

function formatTemp(tempC) {
  if (isFahrenheit) return `${Math.round(toFahrenheit(tempC))}°F`;
  return `${Math.round(tempC)}°C`;
}

async function geocodeCity(name) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  return data.results || [];
}

async function fetchWeather(lat, lon) {
  // request daily forecast and current weather
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current_weather: 'true',
    daily: 'temperature_2m_max,temperature_2m_min,weathercode',
    timezone: 'auto'
  });
  const url = `${WEATHER_URL}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather fetch failed');
  return await res.json();
}

function renderCurrent(locationLabel, current) {
  const code = current.weathercode;
  const meta = weatherMap[code] || {desc:'Unknown', emoji:'❓'};
  const html = `
    <div class="current-top">
      <div class="weather-emoji">${meta.emoji}</div>
      <div class="current-details">
        <div class="location">${locationLabel}</div>
        <div class="hour small">Updated: ${current.time}</div>
        <div class="small">${meta.desc}</div>
      </div>
      <div style="flex:1"></div>
      <div style="text-align:right">
        <div class="current-temperature">${formatTemp(current.temperature)}</div>
        <div class="small">Wind ${current.windspeed} ${current.winddirection}°</div>
      </div>
    </div>
  `;
  els.currentContent.innerHTML = html;
}

function renderForecast(daily) {
  // daily: {time: [...], temperature_2m_max: [...], temperature_2m_min: [...], weathercode: [...]}
  els.forecastGrid.innerHTML = '';
  const days = daily.time.length;
  for (let i = 0; i < days; i++) {
    const date = daily.time[i];
    const max = daily.temperature_2m_max[i];
    const min = daily.temperature_2m_min[i];
    const code = daily.weathercode[i];
    const meta = weatherMap[code] || {desc:'Unknown', emoji:'❓'};
    const card = document.createElement('div');
    card.className = 'forecast-day';
    card.innerHTML = `
      <div class="f-day">${date}</div>
      <div style="font-size:28px">${meta.emoji}</div>
      <div class="temp-range">${formatTemp(max)} / ${formatTemp(min)}</div>
      <div class="small">${meta.desc}</div>
    `;
    els.forecastGrid.appendChild(card);
  }
}

async function performSearch(cityName) {
  try {
    els.currentContent.textContent = 'Searching...';
    els.forecastGrid.innerHTML = '';
    const results = await geocodeCity(cityName);
    if (!results.length) {
      els.currentContent.textContent = 'City not found. Try a different search.';
      return;
    }
    // pick the top result
    const top = results[0];
    const label = `${top.name}${top.admin1 ? ', ' + top.admin1 : ''}${top.country ? ', ' + top.country : ''}`;
    // persist last city
    localStorage.setItem(LAST_CITY_KEY, cityName);
    const weather = await fetchWeather(top.latitude, top.longitude);
    if (!weather.current_weather) {
      els.currentContent.textContent = 'No current weather available for this location.';
      return;
    }
    renderCurrent(label, weather.current_weather);
    if (weather.daily) {
      renderForecast(weather.daily);
    } else {
      els.forecastGrid.textContent = 'No forecast data.';
    }
  } catch (err) {
    console.error(err);
    els.currentContent.textContent = 'An error occurred while fetching weather.';
  }
}

function attachHandlers() {
  els.searchBtn.addEventListener('click', () => {
    const q = els.cityInput.value.trim();
    if (!q) return;
    performSearch(q);
  });

  els.cityInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      const q = els.cityInput.value.trim();
      if (!q) return;
      performSearch(q);
    }
  });

  els.unitToggle.addEventListener('change', () => {
    isFahrenheit = els.unitToggle.checked;
    // re-render using last data if present by re-performing search on the same city stored
    const last = localStorage.getItem(LAST_CITY_KEY);
    if (last) performSearch(last);
  });
}

function init() {
  attachHandlers();
  // load last search
  const last = localStorage.getItem(LAST_CITY_KEY);
  if (last) {
    els.cityInput.value = last;
    performSearch(last);
  }
}

init();
