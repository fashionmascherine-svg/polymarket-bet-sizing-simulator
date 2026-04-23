/**
 * Simulator.gs
 * Engine Monte Carlo per una singola run di simulazione.
 * Funzione principale: runSimulation(strategyFn, cfg, seed)
 */

/**
 * Esegue una singola simulazione Monte Carlo per una strategia.
 *
 * @param {Function} strategyFn - Funzione strategia (da Strategies.gs)
 * @param {Object}   cfg        - Configurazione (da getConfig())
 * @param {number}   seed       - Seme per il generatore RNG
 * @returns {Object} Risultati della simulazione
 */
function runSimulation(strategyFn, cfg, seed) {
  const rng = seededRandom(seed);

  let cash = cfg.CASH;
  let cumulativePnl = 0;
  let tradesExecuted = 0;
  let tradesSkipped  = 0;
  let wins = 0;
  let totalBet = 0;

  // Equity curve campionata ogni SAMPLE_STEP trade
  const SAMPLE_STEP = Math.max(1, Math.floor(cfg.N_SIM / 1000));
  const equityCurve = [0]; // Punto iniziale

  // Array PnL per trade (usato per calcolare Sharpe)
  // Per efficienza memory, usiamo running stats (Welford online algorithm)
  let pnlCount  = 0;
  let pnlMean   = 0;
  let pnlM2     = 0;

  for (let i = 0; i < cfg.N_SIM; i++) {
    // Genera prezzo di ingresso uniforme in [PRICE_MIN, PRICE_MAX]
    const entryPrice = cfg.PRICE_MIN + rng.next() * (cfg.PRICE_MAX - cfg.PRICE_MIN);

    // Genera confidence da distribuzione normale approssimata (Box-Muller)
    const confidence = sampleNormal(rng, cfg.WIN_RATE, cfg.CONF_SIGMA);

    // Calcola la scommessa secondo la strategia
    const betUsd = strategyFn(entryPrice, cash, confidence, cfg);

    // Verifica minimo shares
    const shares = betUsd / entryPrice;
    if (shares < cfg.MIN_SHARES) {
      tradesSkipped++;
      continue;
    }

    tradesExecuted++;
    totalBet += betUsd;

    // Determina esito: win se random < WIN_RATE
    const isWin = rng.next() < cfg.WIN_RATE;
    let tradePnl;
    if (isWin) {
      tradePnl = betUsd / entryPrice - betUsd; // Profitto netto in $
      wins++;
    } else {
      tradePnl = -betUsd; // Perdita totale della scommessa
    }

    cumulativePnl += tradePnl;
    cash += tradePnl;

    // Welford online mean/variance
    pnlCount++;
    const delta = tradePnl - pnlMean;
    pnlMean += delta / pnlCount;
    pnlM2   += delta * (tradePnl - pnlMean);

    // Campiona equity curve
    if (i % SAMPLE_STEP === 0) {
      equityCurve.push(cumulativePnl);
    }
  }

  // Calcoli finali
  const pnlVariance = pnlCount > 1 ? pnlM2 / (pnlCount - 1) : 0;
  const pnlStd      = Math.sqrt(pnlVariance);
  const sharpe      = pnlStd > 0
    ? (pnlMean / pnlStd) * Math.sqrt(tradesExecuted)
    : 0;

  const avgBet = tradesExecuted > 0 ? totalBet / tradesExecuted : 0;
  const roiPct = (cumulativePnl / cfg.CASH) * 100;
  const winRateActual = tradesExecuted > 0 ? wins / tradesExecuted : 0;

  return {
    totalPnl:       cumulativePnl,
    roiPct:         roiPct,
    winRateActual:  winRateActual,
    avgBet:         avgBet,
    tradesExecuted: tradesExecuted,
    tradesSkipped:  tradesSkipped,
    sharpeRatio:    sharpe,
    equityCurve:    equityCurve,
  };
}

/**
 * Statistiche aggregate su un array di valori numerici.
 * @param {number[]} values
 * @returns {{mean: number, std: number}}
 */
function computeStats(values) {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / Math.max(n - 1, 1);
  return { mean: mean, std: Math.sqrt(variance) };
}
