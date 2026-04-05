// Copy to astronomy-config.js and fill in (see astronomy/SETUP.txt).
// astronomy-config.js is gitignored — do not commit secrets.

/** From https://dashboard.astronomyapi.com — Application ID */
window.MADHU_ASTRONOMY_APP_ID = "";

/** Application secret (shown once at creation) */
window.MADHU_ASTRONOMY_APP_SECRET = "";

/**
 * Observer on Earth: use a meaningful place (e.g. birthplace or home).
 * Decimal degrees. Example: Hyderabad ~ 17.385, 78.4866
 */
window.MADHU_STAR_CHART_LAT = "";
window.MADHU_STAR_CHART_LON = "";

/** Local calendar date for the chart (API uses observer location for context). */
window.MADHU_STAR_CHART_DATE = "2006-06-30";

/**
 * IAU constellation id (lowercase). June 30 → Cancer → "cnc".
 * See https://docs.astronomyapi.com/requests-and-response/constellation-enums
 */
window.MADHU_STAR_CHART_CONSTELLATION = "cnc";

/** "default" | "inverted" | "navy" | "red" — navy fits this site */
window.MADHU_STAR_CHART_STYLE = "navy";
