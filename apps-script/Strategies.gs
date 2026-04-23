/**
 * Strategies.gs
 * Implementa le 6 strategie di bet sizing come funzioni pure.
 * Ogni funzione riceve (entryPrice, cash, confidence, cfg) e ritorna betUsd.
 *
 * Regole comuni:
 *  - Floor: bet = max(bet, MIN_SHARES * entryPrice, MIN_BET)
 *  - Cap:   bet = min(bet, MAX_BET)
 */

/**
 * Applica il floor e il cap alla scommessa calcolata.
 * @param {number} bet - Importo grezzo
 * @param {number} entryPrice - Prezzo di ingresso
 * @param {Object} cfg - Configurazione
 * @returns {number} Importo clampato
 */
function clampBet(bet, entryPrice, cfg) {
  const floor = Math.max(cfg.MIN_SHARES * entryPrice, cfg.MIN_BET);
  return Math.min(Math.max(bet, floor), cfg.MAX_BET);
}

/**
 * Strategia 1 — FIXED
 * Scommette sempre MAX_BET, indipendentemente dal prezzo o dalla confidence.
 */
function strategyFixed(entryPrice, cash, confidence, cfg) {
  return clampBet(cfg.MAX_BET, entryPrice, cfg);
}

/**
 * Strategia 2 — FLOOR ONLY
 * Usa max(MIN_SHARES * entryPrice, MIN_BET) come base, cappata a MAX_BET.
 * Garantisce sempre il numero minimo di shares.
 */
function strategyFloorOnly(entryPrice, cash, confidence, cfg) {
  const bet = Math.max(cfg.MIN_SHARES * entryPrice, cfg.MIN_BET);
  return clampBet(bet, entryPrice, cfg);
}

/**
 * Strategia 3 — KELLY
 * Applica il Kelly Criterion con frazione configurabile (KELLY_FRAC).
 *
 * Formula:
 *   b = (1 / entryPrice) - 1          → odds netti
 *   f* = (WIN_RATE * b - (1 - WIN_RATE)) / b  → frazione Kelly ottimale
 *   bet = clamp(f* * KELLY_FRAC * cash, floor, MAX_BET)
 */
function strategyKelly(entryPrice, cash, confidence, cfg) {
  const b = (1 / entryPrice) - 1;                              // Odds netti
  const fStar = (cfg.WIN_RATE * b - (1 - cfg.WIN_RATE)) / b;  // Kelly fraction
  if (fStar <= 0) {
    // Kelly negativo: non conviene scommettere, usa il floor
    return clampBet(0, entryPrice, cfg);
  }
  const bet = fStar * cfg.KELLY_FRAC * cash;
  return clampBet(bet, entryPrice, cfg);
}

/**
 * Strategia 4 — CONFIDENCE
 * Scala linearmente la scommessa tra MIN_BET e MAX_BET
 * in base alla confidence stimata.
 *
 *   bet = MIN_BET + (MAX_BET - MIN_BET) * confidence
 */
function strategyConfidence(entryPrice, cash, confidence, cfg) {
  const bet = cfg.MIN_BET + (cfg.MAX_BET - cfg.MIN_BET) * confidence;
  return clampBet(bet, entryPrice, cfg);
}

/**
 * Strategia 5 — PRICE INVERSE
 * Scommette di più quando il prezzo è basso (maggiore potenziale upside).
 *
 *   bet = MIN_BET + (MAX_BET - MIN_BET) * (1 - entryPrice)
 */
function strategyPriceInverse(entryPrice, cash, confidence, cfg) {
  const bet = cfg.MIN_BET + (cfg.MAX_BET - cfg.MIN_BET) * (1 - entryPrice);
  return clampBet(bet, entryPrice, cfg);
}

/**
 * Strategia 6 — HYBRID
 * Combinazione pesata 60% Kelly + 40% Confidence.
 * Bilancia razionalità matematica (Kelly) con segnale informativo (confidence).
 */
function strategyHybrid(entryPrice, cash, confidence, cfg) {
  const kellyBet      = strategyKelly(entryPrice, cash, confidence, cfg);
  const confidenceBet = strategyConfidence(entryPrice, cash, confidence, cfg);
  const bet = 0.6 * kellyBet + 0.4 * confidenceBet;
  return clampBet(bet, entryPrice, cfg);
}

/**
 * Registry delle strategie — usato da MonteCarlo.gs
 * Ogni elemento: { name: string, fn: Function }
 */
var STRATEGY_REGISTRY = [
  { name: 'Fixed',         fn: strategyFixed },
  { name: 'Floor Only',    fn: strategyFloorOnly },
  { name: 'Kelly',         fn: strategyKelly },
  { name: 'Confidence',    fn: strategyConfidence },
  { name: 'Price Inverse', fn: strategyPriceInverse },
  { name: 'Hybrid',        fn: strategyHybrid },
];
