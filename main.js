const NASA_API = "https://science.nasa.gov/wp-json/wp/v2/apod-basic";

const Weather_API = "https://api.open-meteo.com/v1/forecast";

class NasaWeatherApp {
  constructor() {
    this.facilities = [];
    this.weather = new Map();

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
}
