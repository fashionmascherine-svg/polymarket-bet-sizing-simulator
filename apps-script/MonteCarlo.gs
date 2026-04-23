/**
 * MonteCarlo.gs
 * Orchestratore multi-run: esegue N_RUNS simulazioni per ogni strategia
 * e calcola statistiche aggregate (media, std) su tutti i KPI.
 *
 * Include anche:
 *  - getAllEquityCurves(): 1 run di esempio per il grafico
 *  - runSensitivity():     analisi sensibilità Kelly su WIN_RATE × KELLY_FRAC
 */

/**
 * Esegue il Monte Carlo completo su tutte le strategie.
 *
 * @param {Object} cfg - Configurazione da getConfig()
 * @returns {Array<Object>} Array di risultati aggregati, uno per strategia
 */
function runMonteCarlo(cfg) {
  try {
    const results = [];

    for (let s = 0; s < STRATEGY_REGISTRY.length; s++) {
      const strategy = STRATEGY_REGISTRY[s];
      logEvent('RUN', 'Strategia: ' + strategy.name + ' — ' + cfg.N_RUNS + ' runs...');

      const pnlValues     = [];
      const roiValues     = [];
      const sharpeValues  = [];
      const betValues     = [];
      const execValues    = [];
      const skipValues    = [];
      const wrValues      = [];

      for (let r = 0; r < cfg.N_RUNS; r++) {
        const seed = cfg.SEED + r + s * 10000; // Seed unico per ogni (strategia, run)
        const sim = runSimulation(strategy.fn, cfg, seed);

        pnlValues.push(sim.totalPnl);
        roiValues.push(sim.roiPct);
        sharpeValues.push(sim.sharpeRatio);
        betValues.push(sim.avgBet);
        execValues.push(sim.tradesExecuted);
        skipValues.push(sim.tradesSkipped);
        wrValues.push(sim.winRateActual);

        // Yield al thread ogni 5 run per evitare timeout
        if (r % 5 === 4) {
          Utilities.sleep(0);
        }
      }

      const pnlStats    = computeStats(pnlValues);
      const roiStats    = computeStats(roiValues);
      const sharpeStats = computeStats(sharpeValues);
      const betStats    = computeStats(betValues);
      const execStats   = computeStats(execValues);
      const skipStats   = computeStats(skipValues);
      const wrStats     = computeStats(wrValues);

      results.push({
        name:          strategy.name,
        meanPnl:       pnlStats.mean,
        stdPnl:        pnlStats.std,
        meanRoi:       roiStats.mean,
        sharpe:        sharpeStats.mean,
        avgBet:        betStats.mean,
        tradesExec:    Math.round(execStats.mean),
        tradesSkip:    Math.round(skipStats.mean),
        winRateReal:   wrStats.mean,
      });
    }

    return results;
  } catch (e) {
    logEvent('ERROR', 'runMonteCarlo fallito: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Errore nel Monte Carlo:\n' + e.message);
    throw e;
  }
}

/**
 * Genera le equity curve per 1 run di esempio (seed fisso = cfg.SEED).
 * Usata per il grafico nel foglio EQUITY_CURVES.
 *
 * @param {Object} cfg - Configurazione
 * @returns {Object} { tradeNums: number[], curves: { name, data }[] }
 */
function getAllEquityCurves(cfg) {
  try {
    const curves = [];
    let maxLen = 0;

    for (let s = 0; s < STRATEGY_REGISTRY.length; s++) {
      const strategy = STRATEGY_REGISTRY[s];
      const sim = runSimulation(strategy.fn, cfg, cfg.SEED + s * 10000);
      curves.push({ name: strategy.name, data: sim.equityCurve });
      maxLen = Math.max(maxLen, sim.equityCurve.length);
    }

    // Genera indici Trade# (0, SAMPLE_STEP, 2*SAMPLE_STEP, ...)
    const sampleStep = Math.max(1, Math.floor(cfg.N_SIM / 1000));
    const tradeNums = [];
    for (let i = 0; i < maxLen; i++) {
      tradeNums.push(i * sampleStep);
    }

    return { tradeNums: tradeNums, curves: curves };
  } catch (e) {
    logEvent('ERROR', 'getAllEquityCurves fallito: ' + e.message);
    throw e;
  }
}

/**
 * Analisi di sensibilità del ROI della strategia Kelly
 * al variare di WIN_RATE (righe) e KELLY_FRACTION (colonne).
 *
 * Righe:    WIN_RATE     da 0.50 a 0.70, step 0.02
 * Colonne:  KELLY_FRAC   da 0.10 a 0.50, step 0.05
 *
 * @param {Object} cfg - Configurazione base
 * @returns {Object} { winRates, kellyFracs, matrix }
 */
function runSensitivity(cfg) {
  try {
    const winRates   = [];
    for (let w = 0.50; w <= 0.701; w += 0.02) winRates.push(Math.round(w * 100) / 100);

    const kellyFracs = [];
    for (let k = 0.10; k <= 0.501; k += 0.05) kellyFracs.push(Math.round(k * 100) / 100);

    const matrix = [];

    for (let r = 0; r < winRates.length; r++) {
      const row = [];
      for (let c = 0; c < kellyFracs.length; c++) {
        // Configurazione modificata per questo punto della griglia
        const cfgMod = Object.assign({}, cfg, {
          WIN_RATE:   winRates[r],
          KELLY_FRAC: kellyFracs[c],
          N_SIM:      Math.min(cfg.N_SIM, 20000), // Ridotto per performance
        });
        const sim = runSimulation(strategyKelly, cfgMod, cfg.SEED);
        row.push(sim.roiPct);
      }
      matrix.push(row);
      Utilities.sleep(0); // Yield
    }

    return { winRates: winRates, kellyFracs: kellyFracs, matrix: matrix };
  } catch (e) {
    logEvent('ERROR', 'runSensitivity fallito: ' + e.message);
    throw e;
  }
}
