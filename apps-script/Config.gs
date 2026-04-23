/**
 * Config.gs
 * Funzione centrale per leggere tutti i parametri dai Named Ranges del foglio CONFIG.
 * Include anche il generatore pseudo-casuale deterministico (LCG).
 */

/**
 * Legge tutti i parametri di configurazione dai Named Ranges.
 * @returns {Object} Oggetto con tutti i parametri di simulazione.
 */
function getConfig() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return {
      N_SIM:      Number(ss.getRangeByName('CFG_N_SIMULATIONS').getValue()),
      N_RUNS:     Number(ss.getRangeByName('CFG_N_RUNS').getValue()),
      MIN_BET:    Number(ss.getRangeByName('CFG_MIN_BET_USD').getValue()),
      MAX_BET:    Number(ss.getRangeByName('CFG_MAX_BET_USD').getValue()),
      MIN_SHARES: Number(ss.getRangeByName('CFG_MIN_SHARES').getValue()),
      WIN_RATE:   Number(ss.getRangeByName('CFG_WIN_RATE').getValue()),
      CASH:       Number(ss.getRangeByName('CFG_STARTING_CASH').getValue()),
      PRICE_MIN:  Number(ss.getRangeByName('CFG_PRICE_MIN').getValue()),
      PRICE_MAX:  Number(ss.getRangeByName('CFG_PRICE_MAX').getValue()),
      KELLY_FRAC: Number(ss.getRangeByName('CFG_KELLY_FRACTION').getValue()),
      CONF_SIGMA: Number(ss.getRangeByName('CFG_CONFIDENCE_SIGMA').getValue()),
      SEED:       Number(ss.getRangeByName('CFG_RANDOM_SEED').getValue()),
    };
  } catch (e) {
    logEvent('ERROR', 'getConfig fallito: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Errore nella lettura dei parametri CONFIG.\n' +
      'Verifica che tutti i Named Ranges siano definiti correttamente.\n\nDettaglio: ' + e.message);
    throw e;
  }
}

/**
 * Generatore pseudo-casuale deterministico basato su LCG (Linear Congruential Generator).
 * Parametri standard di Numerical Recipes.
 * Restituisce un oggetto con metodo next() che ritorna float in [0, 1).
 *
 * @param {number} seed - Seme iniziale (intero positivo)
 * @returns {{next: function(): number}} Oggetto generatore
 */
function seededRandom(seed) {
  // Costanti LCG (Numerical Recipes)
  const A = 1664525;
  const C = 1013904223;
  const M = Math.pow(2, 32);
  let state = seed >>> 0; // Forza uint32

  return {
    /**
     * Restituisce il prossimo numero pseudo-casuale in [0, 1).
     * @returns {number}
     */
    next: function () {
      state = (A * state + C) >>> 0; // >>> 0 mantiene uint32
      return state / M;
    }
  };
}

/**
 * Approssimazione Box-Muller per generare un campione da distribuzione normale.
 * Usa due valori uniformi dal generatore seeded per garantire riproducibilità.
 *
 * @param {Object} rng - Generatore seeded (da seededRandom)
 * @param {number} mu - Media
 * @param {number} sigma - Deviazione standard
 * @returns {number} Campione normale clampato in [0, 1]
 */
function sampleNormal(rng, mu, sigma) {
  const u1 = rng.next();
  const u2 = rng.next();
  // Box-Muller transform
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return Math.min(1, Math.max(0, mu + sigma * z));
}
