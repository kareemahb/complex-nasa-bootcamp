# 🚀 NASA Facility Weather

A web app that lists NASA's facilities (~400) and shows the name, location, and **current weather** for each one.

Built for the **Complex NASA API** challenge:

> Use NASA's API to return all of their facility locations (~400). Display the name of the facility, its location, and the weather at the facility currently.

## Features

- **All NASA facilities** loaded from the NASA Open Data Portal
- **Live weather** for each facility: temperature (°F), conditions, and wind speed
- **Search** by facility name, center, city, or state, with a live results count
- **Batched weather requests.** About 400 facilities load in around 8 requests instead of 400, and facilities that share a location are only looked up once
- **Progressive loading.** Facility cards show up right away, and weather fills in as each batch comes back
- **Fallback data.** If NASA's server blocks the browser request, the app loads a local copy of the dataset instead
- **Responsive layout** that works on phone, tablet, and desktop

## Built With

- HTML5
- CSS3 (custom properties, Grid, Flexbox)
- JavaScript (ES6+ classes, Fetch API)
- [Orbitron](https://fonts.google.com/specimen/Orbitron) and [Inter](https://fonts.google.com/specimen/Inter) from Google Fonts

### APIs

| API                                                                      | Purpose                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| [NASA Facilities API](https://data.nasa.gov/dataset/nasa-facilities-api) | Facility names, centers, addresses, and coordinates             |
| [Open-Meteo](https://open-meteo.com/)                                    | Current weather by latitude/longitude (free, no API key needed) |

## How It Works

The JavaScript is organized into two classes:

- **`Facility`**: turns one raw record from NASA's dataset into a clean object (name, center, city, state, coordinates). It also builds the location label and the text used for search.
- **`NasaWeatherApp`**: runs the app. It loads the facilities, fetches weather in batches, handles search, and renders the cards.
  The app flow:

1. Load facility data, trying the NASA API first and falling back to `facilities.json`
2. Convert each record into a `Facility` and sort them alphabetically
3. Render the cards right away with a "Loading weather..." placeholder
4. Group facilities by unique coordinates and request weather from Open-Meteo in batches of 50
5. Update the cards as each batch comes back

## What I Learned

- Handling **CORS** errors and why `file://` pages can't fetch local files
- **Batching API requests** to avoid sending hundreds of calls at once
- Organizing code with **ES6 classes**, plus static methods and getters
- Combining data from **two APIs** into one view
- Using CSS custom properties to keep a brand color system consistent

## Created By

[GitHub @kareemahb](https://github.com/kareemahb)
