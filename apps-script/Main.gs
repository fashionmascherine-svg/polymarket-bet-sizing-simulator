/**
 * Main.gs
 * Punto di ingresso principale del simulatore.
 *
 * Funzioni esposte:
 *  - onOpen()       → aggiunge menu 🎲 Simulatore alla riapertura del foglio
 *  - runAll()       → esegue la simulazione completa (chiamata dal pulsante)
 *  - refreshChart() → rigenera solo il grafico equity
 *  - resetSheets()  → svuota RESULTS, EQUITY_CURVES, SENSITIVITY, LOG
 *  - showParamInfo()→ mostra dialog con descrizione parametri CONFIG
 *  - logEvent()     → helper per scrivere nel foglio LOG
 */

// ─── MENU ─────────────────────────────────────────────────────────────────────

/**
 * Aggiunge il menu personalizzato alla riapertura del foglio.
 * Trigger automatico di Apps Script.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎲 Simulatore')
    .addItem('▶ Avvia simulazione completa', 'runAll')
    .addSeparator()
    .addItem('📊 Solo grafico equity', 'refreshChart')
    .addItem('🔄 Reset fogli', 'resetSheets')
    .addSeparator()
    .addItem('ℹ️ Info parametri', 'showParamInfo')
    .addToUi();
}

// ─── FUNZIONE PRINCIPALE ──────────────────────────────────────────────────────

/**
 * Esegue la simulazione completa:
 *  1. Legge configurazione
 *  2. Valida parametri
 *  3. Monte Carlo su tutte le strategie
 *  4. Equity curves (1 run di esempio)
 *  5. Sensitivity analysis Kelly
 *  6. Scrive risultati + grafico
 *  7. Toast di completamento
 */
function runAll() {
  try {
    const cfg = getConfig();
    logEvent('START', JSON.stringify(cfg));

    // Validazione timeout safety
    const totalOps = cfg.N_SIM * cfg.N_RUNS * STRATEGY_REGISTRY.length;
    if (totalOps > 3000000) {
      const ui = SpreadsheetApp.getUi();
      const resp = ui.alert(
        '⚠️ Simulazione pesante',
        `Il prodotto N_SIM × N_RUNS × N_STRATEGIE = ${totalOps.toLocaleString()} operazioni.\n` +
        'Questo potrebbe superare il timeout di 6 minuti di Apps Script.\n\n' +
        'Suggerimento: riduci N_RUNS a 10 o N_SIMULATIONS a 10.000.\n\n' +
        'Vuoi continuare comunque?',
        ui.ButtonSet.YES_NO
      );
      if (resp !== ui.Button.YES) {
        logEvent('ABORT', 'Utente ha annullato per limite operazioni: ' + totalOps);
        return;
      }
    }

    // 1. Monte Carlo
    logEvent('PHASE', 'Monte Carlo — tutte le strategie');
    const results = runMonteCarlo(cfg);

    // 2. Equity curves
    logEvent('PHASE', 'Generazione equity curves');
    const equityCurves = getAllEquityCurves(cfg);

    // 3. Sensitivity analysis
    logEvent('PHASE', 'Sensitivity analysis Kelly');
    const sensitivityData = runSensitivity(cfg);

    // 4. Scrittura fogli + grafico
    logEvent('PHASE', 'Scrittura risultati nei fogli');
    writeResults(results, equityCurves, sensitivityData, cfg);

    // 5. Toast finale
    const sorted = [...results].sort((a, b) => b.meanPnl - a.meanPnl);
    const winner = sorted[0];
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `🏆 Vincitrice: ${winner.name} | ROI medio: ${winner.meanRoi.toFixed(2)}%`,
      '✅ Simulazione completata',
      10
    );

    logEvent('END', `Vincitrice: ${winner.name} | ROI: ${winner.meanRoi.toFixed(2)}%`);

  } catch (e) {
    logEvent('ERROR', 'runAll fallito: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Errore durante la simulazione:\n' + e.message);
  }
}

// ─── AZIONI MENU ──────────────────────────────────────────────────────────────

/**
 * Rigenera solo il grafico equity senza rieseguire la simulazione.
 * Richiede che EQUITY_CURVES sia già popolato.
 */
function refreshChart() {
  try {
    const cfg = getConfig();
    const equityCurves = getAllEquityCurves(cfg);
    _writeEquityCurvesSheet(equityCurves);
    _createEquityChart(equityCurves);
    SpreadsheetApp.getActiveSpreadsheet().toast('📊 Grafico equity rigenerato.', 'Completato', 5);
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Errore nel refresh grafico:\n' + e.message);
  }
}

/**
 * Svuota i fogli RESULTS, EQUITY_CURVES, SENSITIVITY, LOG.
 */
function resetSheets() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    '🔄 Reset fogli',
    'Questo cancellerà tutti i dati in RESULTS, EQUITY_CURVES, SENSITIVITY e LOG.\nContinuare?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [SHEET_RESULTS, SHEET_EQUITY, SHEET_SENS, SHEET_LOG].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (sh) {
      sh.clearContents();
      sh.clearFormats();
      sh.getCharts().forEach(c => sh.removeChart(c));
    }
  });

  ui.alert('✅ Fogli resettati.');
  logEvent('RESET', 'Fogli RESULTS, EQUITY_CURVES, SENSITIVITY, LOG svuotati');
}

/**
 * Mostra un dialog con la descrizione di ogni parametro CONFIG.
 */
function showParamInfo() {
  const html = `
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; padding: 12px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #4a4a4a; color: #fff; padding: 6px 10px; text-align: left; }
  td { border: 1px solid #ddd; padding: 5px 10px; vertical-align: top; }
  tr:nth-child(even) { background: #f9f9f9; }
  .param { font-weight: bold; white-space: nowrap; }
</style>
<table>
  <tr><th>Parametro</th><th>Descrizione</th><th>Default</th></tr>
  <tr><td class="param">N_SIMULATIONS</td><td>Numero di trade simulati per singola run</td><td>100,000</td></tr>
  <tr><td class="param">N_RUNS</td><td>Numero di run Monte Carlo per strategia</td><td>30</td></tr>
  <tr><td class="param">MIN_BET_USD</td><td>Scommessa minima in dollari</td><td>1.00</td></tr>
  <tr><td class="param">MAX_BET_USD</td><td>Scommessa massima in dollari</td><td>5.00</td></tr>
  <tr><td class="param">MIN_SHARES</td><td>Numero minimo di shares per trade valido</td><td>5</td></tr>
  <tr><td class="param">WIN_RATE</td><td>Probabilità stimata di vincita (0–1)</td><td>0.60</td></tr>
  <tr><td class="param">STARTING_CASH</td><td>Capitale iniziale in dollari</td><td>100,000</td></tr>
  <tr><td class="param">PRICE_MIN</td><td>Prezzo minimo di entrata sul mercato</td><td>0.06</td></tr>
  <tr><td class="param">PRICE_MAX</td><td>Prezzo massimo di entrata sul mercato</td><td>0.94</td></tr>
  <tr><td class="param">KELLY_FRACTION</td><td>Frazione del Kelly Criterion da applicare (0–1)</td><td>0.25</td></tr>
  <tr><td class="param">CONFIDENCE_SIGMA</td><td>Deviazione standard del rumore sulla confidence</td><td>0.10</td></tr>
  <tr><td class="param">RANDOM_SEED</td><td>Seme per il generatore pseudo-casuale (riproducibilità)</td><td>42</td></tr>
</table>
`;
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setTitle('ℹ️ Parametri CONFIG')
    .setWidth(620)
    .setHeight(380);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'ℹ️ Parametri CONFIG');
}

// ─── LOG HELPER ───────────────────────────────────────────────────────────────

/**
 * Aggiunge una riga al foglio LOG (append-only).
 *
 * @param {string} evento  - Tipo evento (START, END, ERROR, PHASE, ecc.)
 * @param {string} detail  - Dettaglio testuale
 */
function logEvent(evento, detail) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_LOG);
    if (!sheet) return;

    const isFirst = sheet.getLastRow() === 0;
    if (isFirst) {
      // Scrive header se il foglio è vuoto
      const hdr = sheet.getRange(1, 1, 1, 3);
      hdr.setValues([['Timestamp', 'Evento', 'Dettaglio']]);
      hdr.setFontWeight('bold').setBackground('#4a4a4a').setFontColor('#ffffff');
    }

    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([ts, evento, detail]);
  } catch (e) {
    // Silenzioso: il log non deve bloccare la simulazione
    console.warn('logEvent error:', e.message);
  }
}
