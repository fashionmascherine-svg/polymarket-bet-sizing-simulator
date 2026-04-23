/**
 * Main.gs
 * Punto di ingresso principale del simulatore.
 *
 * Funzioni esposte:
 *  - onOpen()              → menu 🎲 Simulatore
 *  - setupSpreadsheet()    → crea fogli, CONFIG base, Named Ranges, pulsante ▶
 *  - runAll()              → simulazione completa (pulsante / menu)
 *  - refreshChart()        → rigenera solo il grafico equity
 *  - resetSheets()         → svuota RESULTS, EQUITY_CURVES, SENSITIVITY, LOG
 *  - showParamInfo()       → dialog descrizione parametri
 *  - logEvent()            → helper append LOG
 */

// ─── COSTANTI FOGLI ───────────────────────────────────────────────────────────
var SHEET_CONFIG  = 'CONFIG';
var SHEET_RESULTS = 'RESULTS';
var SHEET_EQUITY  = 'EQUITY_CURVES';
var SHEET_SENS    = 'SENSITIVITY';
var SHEET_LOG     = 'LOG';

// ─── MENU ─────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎲 Simulatore')
    .addItem('⚙️ Setup iniziale (crea fogli + config)', 'setupSpreadsheet')
    .addSeparator()
    .addItem('▶ Avvia simulazione completa', 'runAll')
    .addSeparator()
    .addItem('📊 Solo grafico equity', 'refreshChart')
    .addItem('🔄 Reset fogli dati', 'resetSheets')
    .addSeparator()
    .addItem('ℹ️ Info parametri', 'showParamInfo')
    .addToUi();
}

// ─── SETUP AUTOMATICO ─────────────────────────────────────────────────────────

/**
 * Crea (o ricrea) l'intera struttura del Google Sheet:
 *  1. Crea i 5 fogli richiesti (CONFIG, RESULTS, EQUITY_CURVES, SENSITIVITY, LOG)
 *  2. Popola il foglio CONFIG con la tabella parametri e la formattazione
 *  3. Crea i 12 Named Ranges che puntano alle celle CONFIG!B2:B13
 *  4. Inserisce il pulsante ▶ AVVIA SIMULAZIONE nel foglio CONFIG
 *
 * Sicuro da rieseguire: se un foglio esiste già non viene eliminato.
 */
function setupSpreadsheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();

    // ── 1. Crea i fogli necessari ────────────────────────────────────────────
    const sheetDefs = [
      SHEET_CONFIG,
      SHEET_RESULTS,
      SHEET_EQUITY,
      SHEET_SENS,
      SHEET_LOG,
    ];

    sheetDefs.forEach(name => {
      if (!ss.getSheetByName(name)) {
        ss.insertSheet(name);
      }
    });

    // Rimuovi il foglio predefinito "Foglio1" / "Sheet1" se esiste ed è vuoto
    ['Foglio1', 'Sheet1', 'Foglio 1', 'Sheet 1'].forEach(defaultName => {
      const sh = ss.getSheetByName(defaultName);
      if (sh && sh.getLastRow() === 0 && ss.getSheets().length > sheetDefs.length) {
        ss.deleteSheet(sh);
      }
    });

    // ── 2. Popola il foglio CONFIG ───────────────────────────────────────────
    _setupConfigSheet(ss);

    // ── 3. Crea i Named Ranges ───────────────────────────────────────────────
    _setupNamedRanges(ss);

    // ── 4. Inserisce il pulsante ▶ ──────────────────────────────────────────
    _insertRunButton(ss);

    // ── Fine ─────────────────────────────────────────────────────────────────
    logEvent('SETUP', 'setupSpreadsheet completato — fogli e config pronti');

    ui.alert(
      '✅ Setup completato!',
      'Struttura creata:\n' +
      '• 5 fogli: CONFIG, RESULTS, EQUITY_CURVES, SENSITIVITY, LOG\n' +
      '• 12 Named Ranges configurati\n' +
      '• Tabella CONFIG popolata con valori di default\n' +
      '• Pulsante ▶ AVVIA SIMULAZIONE inserito nel foglio CONFIG\n\n' +
      'Ora clicca il pulsante oppure usa il menu\n' +
      '🎲 Simulatore → ▶ Avvia simulazione completa',
      ui.ButtonSet.OK
    );

  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Errore nel setup:\n' + e.message);
    throw e;
  }
}

/**
 * Popola il foglio CONFIG con intestazione, parametri, formattazione.
 * @param {Spreadsheet} ss
 */
function _setupConfigSheet(ss) {
  const sheet = ss.getSheetByName(SHEET_CONFIG);
  sheet.clearContents();
  sheet.clearFormats();

  // ── Titolo ──
  const titleRange = sheet.getRange('A1:B1');
  titleRange.merge();
  titleRange.setValue('🎲 BET SIZING SIMULATOR — CONFIG');
  titleRange.setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center')
    .setBackground('#1a1a2e')
    .setFontColor('#e0e0e0');
  sheet.setRowHeight(1, 36);

  // ── Header colonne ──
  const hdrRange = sheet.getRange('A2:B2');
  hdrRange.setValues([['Parametro', 'Valore']]);
  hdrRange.setFontWeight('bold')
    .setBackground('#16213e')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // ── Dati parametri (riga 3 = CFG_N_SIMULATIONS ... riga 14 = CFG_RANDOM_SEED) ──
  const params = [
    ['N_SIMULATIONS',    100000],
    ['N_RUNS',           30],
    ['MIN_BET_USD',      1.0],
    ['MAX_BET_USD',      5.0],
    ['MIN_SHARES',       5],
    ['WIN_RATE',         0.60],
    ['STARTING_CASH',    100000],
    ['PRICE_MIN',        0.06],
    ['PRICE_MAX',        0.94],
    ['KELLY_FRACTION',   0.25],
    ['CONFIDENCE_SIGMA', 0.10],
    ['RANDOM_SEED',      42],
  ];

  const dataRange = sheet.getRange(3, 1, params.length, 2);
  dataRange.setValues(params);

  // Colonna A: nomi parametri (grassetto, sfondo alternato)
  params.forEach((p, i) => {
    const row = i + 3;
    const bg = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
    sheet.getRange(row, 1).setFontWeight('bold').setBackground(bg).setFontColor('#1a1a2e');
    sheet.getRange(row, 2).setBackground(bg).setHorizontalAlignment('right');
  });

  // Formati numerici colonna B
  sheet.getRange('B3').setNumberFormat('#,##0');        // N_SIMULATIONS
  sheet.getRange('B4').setNumberFormat('#,##0');        // N_RUNS
  sheet.getRange('B5').setNumberFormat('#,##0.00');     // MIN_BET_USD
  sheet.getRange('B6').setNumberFormat('#,##0.00');     // MAX_BET_USD
  sheet.getRange('B7').setNumberFormat('#,##0');        // MIN_SHARES
  sheet.getRange('B8').setNumberFormat('0.00');         // WIN_RATE
  sheet.getRange('B9').setNumberFormat('#,##0');        // STARTING_CASH
  sheet.getRange('B10').setNumberFormat('0.00');        // PRICE_MIN
  sheet.getRange('B11').setNumberFormat('0.00');        // PRICE_MAX
  sheet.getRange('B12').setNumberFormat('0.00');        // KELLY_FRACTION
  sheet.getRange('B13').setNumberFormat('0.00');        // CONFIDENCE_SIGMA
  sheet.getRange('B14').setNumberFormat('#,##0');       // RANDOM_SEED

  // Bordi
  sheet.getRange(2, 1, params.length + 1, 2)
    .setBorder(true, true, true, true, true, true, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);

  // Larghezze colonne
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 140);

  // Riga istruzioni sotto la tabella
  const infoRow = params.length + 4;
  sheet.getRange(infoRow, 1, 1, 2).merge();
  sheet.getRange(infoRow, 1).setValue(
    '👆 Modifica i valori nella colonna B, poi clicca ▶ AVVIA SIMULAZIONE'
  );
  sheet.getRange(infoRow, 1)
    .setFontStyle('italic')
    .setFontColor('#888888')
    .setFontSize(10);
}

/**
 * Crea i 12 Named Ranges puntando alle celle CONFIG!B3:B14.
 * Se il named range esiste già, lo sovrascrive.
 * @param {Spreadsheet} ss
 */
function _setupNamedRanges(ss) {
  const namedRangeDefs = [
    { name: 'CFG_N_SIMULATIONS',    cell: 'B3'  },
    { name: 'CFG_N_RUNS',           cell: 'B4'  },
    { name: 'CFG_MIN_BET_USD',      cell: 'B5'  },
    { name: 'CFG_MAX_BET_USD',      cell: 'B6'  },
    { name: 'CFG_MIN_SHARES',       cell: 'B7'  },
    { name: 'CFG_WIN_RATE',         cell: 'B8'  },
    { name: 'CFG_STARTING_CASH',    cell: 'B9'  },
    { name: 'CFG_PRICE_MIN',        cell: 'B10' },
    { name: 'CFG_PRICE_MAX',        cell: 'B11' },
    { name: 'CFG_KELLY_FRACTION',   cell: 'B12' },
    { name: 'CFG_CONFIDENCE_SIGMA', cell: 'B13' },
    { name: 'CFG_RANDOM_SEED',      cell: 'B14' },
  ];

  const configSheet = ss.getSheetByName(SHEET_CONFIG);

  // Rimuovi named ranges esistenti con lo stesso nome
  const existing = ss.getNamedRanges();
  existing.forEach(nr => {
    if (namedRangeDefs.some(d => d.name === nr.getName())) {
      nr.remove();
    }
  });

  // Ricrea tutti i named ranges
  namedRangeDefs.forEach(def => {
    ss.setNamedRange(def.name, configSheet.getRange(def.cell));
  });
}

/**
 * Inserisce il pulsante ▶ AVVIA SIMULAZIONE come Over-the-grid button
 * usando un disegno (DrawingAnchor) nel foglio CONFIG.
 *
 * Nota: Apps Script non espone l'API "Inserisci disegno" direttamente;
 * usiamo insertButton via SpreadsheetApp oppure, per compatibilità massima,
 * aggiungiamo una cella stilizzata cliccabile con nota che rimanda al menu.
 * Il pulsante vero (Drawing) deve essere aggiunto manualmente (vedi istruzioni).
 * Questa funzione crea però una cella-pulsante visiva nella colonna D.
 * @param {Spreadsheet} ss
 */
function _insertRunButton(ss) {
  const sheet = ss.getSheetByName(SHEET_CONFIG);

  // Cella-pulsante visiva D3:E4
  const btnRange = sheet.getRange('D3:E5');
  btnRange.merge();
  btnRange.setValue('▶  AVVIA\nSIMULAZIONE');
  btnRange.setBackground('#0f3460')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(12)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 20);

  // Istruzione accanto al pulsante
  const noteRange = sheet.getRange('D7:E8');
  noteRange.merge();
  noteRange.setValue('💡 Per attivare il pulsante:\nInsert → Drawing → assegna "runAll"');
  noteRange.setFontSize(9)
    .setFontStyle('italic')
    .setFontColor('#aaaaaa')
    .setWrap(true)
    .setHorizontalAlignment('center');

  // Intestazione colonna D
  sheet.getRange('D1:E1').merge()
    .setValue('AZIONI')
    .setBackground('#1a1a2e')
    .setFontColor('#e0e0e0')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}

// ─── FUNZIONE PRINCIPALE ──────────────────────────────────────────────────────

function runAll() {
  try {
    // Controlla che il setup sia stato fatto
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss.getSheetByName(SHEET_CONFIG)) {
      SpreadsheetApp.getUi().alert(
        '⚠️ Setup non eseguito',
        'Esegui prima:\n🎲 Simulatore → ⚙️ Setup iniziale',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    const cfg = getConfig();
    logEvent('START', JSON.stringify(cfg));

    // Validazione timeout safety
    const totalOps = cfg.N_SIM * cfg.N_RUNS * STRATEGY_REGISTRY.length;
    if (totalOps > 3000000) {
      const ui = SpreadsheetApp.getUi();
      const resp = ui.alert(
        '⚠️ Simulazione pesante',
        `N_SIM × N_RUNS × 6 strategie = ${totalOps.toLocaleString()} operazioni.\n` +
        'Potrebbe superare il timeout di 6 minuti.\n\n' +
        'Suggerimento: riduci N_RUNS a 10 o N_SIMULATIONS a 10.000.\n\n' +
        'Continuare comunque?',
        ui.ButtonSet.YES_NO
      );
      if (resp !== ui.Button.YES) {
        logEvent('ABORT', 'Annullato — operazioni totali: ' + totalOps);
        return;
      }
    }

    logEvent('PHASE', 'Monte Carlo — tutte le strategie');
    const results = runMonteCarlo(cfg);

    logEvent('PHASE', 'Generazione equity curves');
    const equityCurves = getAllEquityCurves(cfg);

    logEvent('PHASE', 'Sensitivity analysis Kelly');
    const sensitivityData = runSensitivity(cfg);

    logEvent('PHASE', 'Scrittura risultati nei fogli');
    writeResults(results, equityCurves, sensitivityData, cfg);

    const winner = [...results].sort((a, b) => b.meanPnl - a.meanPnl)[0];
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `🏆 Vincitrice: ${winner.name} | ROI medio: ${winner.meanRoi.toFixed(2)}%`,
      '✅ Simulazione completata', 10
    );
    logEvent('END', `Vincitrice: ${winner.name} | ROI: ${winner.meanRoi.toFixed(2)}%`);

  } catch (e) {
    logEvent('ERROR', 'runAll fallito: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Errore durante la simulazione:\n' + e.message);
  }
}

// ─── AZIONI MENU ──────────────────────────────────────────────────────────────

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

function resetSheets() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    '🔄 Reset fogli dati',
    'Cancella tutti i dati in RESULTS, EQUITY_CURVES, SENSITIVITY e LOG.\nContinuare?',
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
  logEvent('RESET', 'RESULTS, EQUITY_CURVES, SENSITIVITY, LOG svuotati');
}

function showParamInfo() {
  const html = `
<style>
  body{font-family:Arial,sans-serif;font-size:13px;padding:12px}
  table{border-collapse:collapse;width:100%}
  th{background:#1a1a2e;color:#fff;padding:6px 10px;text-align:left}
  td{border:1px solid #ddd;padding:5px 10px;vertical-align:top}
  tr:nth-child(even){background:#f9f9f9}
  .p{font-weight:bold;white-space:nowrap;color:#0f3460}
</style>
<table>
  <tr><th>Parametro</th><th>Descrizione</th><th>Default</th></tr>
  <tr><td class="p">N_SIMULATIONS</td><td>Trade simulati per singola run</td><td>100,000</td></tr>
  <tr><td class="p">N_RUNS</td><td>Run Monte Carlo per strategia</td><td>30</td></tr>
  <tr><td class="p">MIN_BET_USD</td><td>Scommessa minima ($)</td><td>1.00</td></tr>
  <tr><td class="p">MAX_BET_USD</td><td>Scommessa massima ($)</td><td>5.00</td></tr>
  <tr><td class="p">MIN_SHARES</td><td>Shares minimi per trade valido</td><td>5</td></tr>
  <tr><td class="p">WIN_RATE</td><td>Probabilità vincita stimata (0–1)</td><td>0.60</td></tr>
  <tr><td class="p">STARTING_CASH</td><td>Capitale iniziale ($)</td><td>100,000</td></tr>
  <tr><td class="p">PRICE_MIN</td><td>Prezzo minimo di entrata</td><td>0.06</td></tr>
  <tr><td class="p">PRICE_MAX</td><td>Prezzo massimo di entrata</td><td>0.94</td></tr>
  <tr><td class="p">KELLY_FRACTION</td><td>Frazione Kelly da applicare (0–1)</td><td>0.25</td></tr>
  <tr><td class="p">CONFIDENCE_SIGMA</td><td>Std dev del rumore sulla confidence</td><td>0.10</td></tr>
  <tr><td class="p">RANDOM_SEED</td><td>Seme RNG — stesso seed = stessi risultati</td><td>42</td></tr>
</table>`;
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(640).setHeight(390),
    'ℹ️ Parametri CONFIG'
  );
}

// ─── LOG HELPER ───────────────────────────────────────────────────────────────

function logEvent(evento, detail) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_LOG);
    if (!sheet) return;
    if (sheet.getLastRow() === 0) {
      const hdr = sheet.getRange(1, 1, 1, 3);
      hdr.setValues([['Timestamp', 'Evento', 'Dettaglio']]);
      hdr.setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    }
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([ts, evento, detail]);
  } catch (e) {
    console.warn('logEvent error:', e.message);
  }
}
