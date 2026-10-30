const NASA_API = "https://data.nasa.gov/docs/legacy/gvk9-iz74.json";

// Backup: a copy of the same JSON saved next to index.html,
// used only if the live request fails (e.g. a CORS block)
const LOCAL_FALLBACK = "facilities.json";

const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

// Open-Meteo accepts many coordinates per request, so we batch
// instead of firing ~400 separate requests
const WEATHER_BATCH_SIZE = 50;

// WMO weather codes used by Open-Meteo
const WEATHER_CODES = {
  0: { text: "Clear sky", icon: "☀️" },
  1: { text: "Mainly clear", icon: "🌤️" },
  2: { text: "Partly cloudy", icon: "⛅" },
  3: { text: "Overcast", icon: "☁️" },
  45: { text: "Fog", icon: "🌫️" },
  48: { text: "Rime fog", icon: "🌫️" },
  51: { text: "Light drizzle", icon: "🌦️" },
  53: { text: "Drizzle", icon: "🌦️" },
  55: { text: "Heavy drizzle", icon: "🌧️" },
  56: { text: "Freezing drizzle", icon: "🌧️" },
  57: { text: "Freezing drizzle", icon: "🌧️" },
  61: { text: "Light rain", icon: "🌦️" },
  63: { text: "Rain", icon: "🌧️" },
  65: { text: "Heavy rain", icon: "🌧️" },
  66: { text: "Freezing rain", icon: "🌧️" },
  67: { text: "Freezing rain", icon: "🌧️" },
  71: { text: "Light snow", icon: "🌨️" },
  73: { text: "Snow", icon: "🌨️" },
  75: { text: "Heavy snow", icon: "❄️" },
  77: { text: "Snow grains", icon: "🌨️" },
  80: { text: "Rain showers", icon: "🌦️" },
  81: { text: "Rain showers", icon: "🌧️" },
  82: { text: "Violent showers", icon: "⛈️" },
  85: { text: "Snow showers", icon: "🌨️" },
  86: { text: "Snow showers", icon: "🌨️" },
  95: { text: "Thunderstorm", icon: "⛈️" },
  96: { text: "Thunderstorm with hail", icon: "⛈️" },
  99: { text: "Thunderstorm with hail", icon: "⛈️" },
};

const escapeHTML = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

class Facility {
  constructor(raw) {
    const address = Facility.parseAddress(raw);
    const { lat, lon } = Facility.parseCoords(raw);

    this.name = raw.facility ?? "Unnamed facility";
    this.center = raw.center ?? "";
    this.status = raw.status ?? "";
    this.city = raw.city ?? address.city ?? "";
    this.state = raw.state ?? address.state ?? "";
    this.country = raw.country ?? "";
    this.lat = lat;
    this.lon = lon;
  }

  // The dataset stores the street address as a JSON string
  static parseAddress(raw) {
    const human = raw.location?.human_address;
    if (!human) return {};

    try {
      return typeof human === "string" ? JSON.parse(human) : human;
    } catch {
      return {};
    }
  }

  static parseCoords(raw) {
    const loc = raw.location ?? {};
    const lat = Number(loc.latitude ?? loc.coordinates?.[1] ?? raw.latitude);
    const lon = Number(loc.longitude ?? loc.coordinates?.[0] ?? raw.longitude);

    return Number.isFinite(lat) && Number.isFinite(lon)
      ? { lat, lon }
      : { lat: null, lon: null };
  }

  get hasCoords() {
    return this.lat !== null && this.lon !== null;
  }

  // Facilities at the same center share coordinates, so this key
  // lets us look weather up once per spot instead of once per facility
  get coordKey() {
    return this.hasCoords
      ? `${this.lat.toFixed(3)},${this.lon.toFixed(3)}`
      : null;
  }

  get locationLabel() {
    const parts = [this.city, this.state].filter(Boolean);
    if (this.country && this.country !== "US") parts.push(this.country);
    return parts.length ? parts.join(", ") : "Location not listed";
  }

  get searchText() {
    return [this.name, this.center, this.city, this.state, this.country]
      .join(" ")
      .toLowerCase();
  }
}

class NasaWeatherApp {
  constructor() {
    this.facilities = [];
    this.weather = new Map();
    this.weatherDone = false;

    this.facilityContainer = document.querySelector("#facilityContainer");
    this.facilityCount = document.querySelector("#facilityCount");
    this.statusMessage = document.querySelector("#statusMessage");
    this.searchInput = document.querySelector("#searchInput");
  }

  async init() {
    this.addEventListeners();
    await this.getFacilities();
  }

  addEventListeners() {
    this.searchInput.addEventListener("input", () => {
      this.filterFacilities();
    });
  }

  // ---------- Facilities ----------

  async getFacilities() {
    this.setStatus("Loading NASA facilities...");

    try {
      const rawData = await this.fetchFacilityData();

      this.facilities = NasaWeatherApp.normalize(rawData)
        .map((record) => new Facility(record))
        .sort((a, b) => a.name.localeCompare(b.name));

      this.filterFacilities();

      this.setStatus("Loading current weather...");
      await this.getWeather();

      this.weatherDone = true;
      this.setStatus("");
      this.filterFacilities();
    } catch (error) {
      console.error(error);
      this.facilityCount.textContent = "0 facilities";
      this.setStatus(
        "Couldn't load NASA facilities right now. Please try again later.",
        true,
      );
    }
  }

  async fetchFacilityData() {
    for (const url of [NASA_API, LOCAL_FALLBACK]) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        console.warn(`Could not load ${url}:`, error.message);
      }
    }

    throw new Error("No facility data source responded");
  }

  // Handles both a plain array of records and the
  // { meta, data } row/column export format
  static normalize(data) {
    if (Array.isArray(data)) return data;

    const columns = data?.meta?.view?.columns;
    if (!Array.isArray(columns) || !Array.isArray(data.data)) return [];

    return data.data.map((row) => {
      const record = {};

      columns.forEach((column, index) => {
        if (column.fieldName.startsWith(":")) return;
        record[column.fieldName] = row[index];
      });

      if (Array.isArray(record.location)) {
        const [human_address, latitude, longitude] = record.location;
        record.location = { human_address, latitude, longitude };
      }

      return record;
    });
  }

  // ---------- Weather ----------

  async getWeather() {
    const uniqueSpots = new Map();

    this.facilities
      .filter((facility) => facility.hasCoords)
      .forEach((facility) => uniqueSpots.set(facility.coordKey, facility));

    const spots = [...uniqueSpots.values()];

    for (let i = 0; i < spots.length; i += WEATHER_BATCH_SIZE) {
      const batch = spots.slice(i, i + WEATHER_BATCH_SIZE);

      try {
        const results = await this.fetchWeatherBatch(batch);

        batch.forEach((facility, index) => {
          const current = results[index]?.current;
          if (current) this.weather.set(facility.coordKey, current);
        });
      } catch (error) {
        console.warn("Weather batch failed:", error.message);
      }

      // Show weather as each batch arrives
      this.filterFacilities();
    }
  }

  async fetchWeatherBatch(batch) {
    const params = new URLSearchParams({
      latitude: batch.map((facility) => facility.lat).join(","),
      longitude: batch.map((facility) => facility.lon).join(","),
      current: "temperature_2m,weather_code,wind_speed_10m",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: "auto",
    });

    const response = await fetch(`${WEATHER_API}?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    // One location returns an object, several return an array
    return Array.isArray(data) ? data : [data];
  }

  // ---------- Rendering ----------

  filterFacilities() {
    const query = this.searchInput.value.trim().toLowerCase();

    const results = query
      ? this.facilities.filter((facility) =>
          facility.searchText.includes(query),
        )
      : this.facilities;

    this.facilityCount.textContent = query
      ? `Showing ${results.length} of ${this.facilities.length} facilities`
      : `${this.facilities.length} facilities`;

    this.renderFacilities(results);
  }

  renderFacilities(facilities) {
    if (!facilities.length) {
      this.facilityContainer.innerHTML =
        '<p class="empty-state">No facilities match your search.</p>';
      return;
    }

    this.facilityContainer.innerHTML = facilities
      .map((facility) => this.facilityCard(facility))
      .join("");
  }

  facilityCard(facility) {
    const statusBadge = facility.status
      ? `<span class="badge">${escapeHTML(facility.status)}</span>`
      : "";

    return `
      <article class="facility-card">
        <div class="card-top">
          <p class="facility-center">${escapeHTML(facility.center)}</p>
          ${statusBadge}
        </div>
        <h3>${escapeHTML(facility.name)}</h3>
        <p class="facility-location">📍 ${escapeHTML(facility.locationLabel)}</p>
        ${this.weatherBlock(facility)}
      </article>
    `;
  }

  weatherBlock(facility) {
    if (!facility.hasCoords) {
      return '<div class="weather weather-muted">No coordinates for weather</div>';
    }

    const current = this.weather.get(facility.coordKey);

    if (!current) {
      const message = this.weatherDone
        ? "Weather unavailable"
        : "Loading weather...";
      return `<div class="weather weather-muted">${message}</div>`;
    }

    const condition = WEATHER_CODES[current.weather_code] ?? {
      text: "Unknown",
      icon: "🛰️",
    };

    return `
      <div class="weather">
        <span class="weather-icon" aria-hidden="true">${condition.icon}</span>
        <div>
          <p class="weather-temp">${Math.round(current.temperature_2m)}°F</p>
          <p class="weather-desc">
            ${condition.text} · Wind ${Math.round(current.wind_speed_10m)} mph
          </p>
        </div>
      </div>
    `;
  }

  setStatus(message, isError = false) {
    this.statusMessage.textContent = message;
    this.statusMessage.hidden = !message;
    this.statusMessage.classList.toggle("is-error", isError);
  }
}

const app = new NasaWeatherApp();
app.init();
