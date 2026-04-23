/**
 * Writer.gs
 * Scrive i risultati nei fogli Google Sheets e genera il grafico equity.
 *
 * Funzione principale: writeResults(results, equityCurves, sensitivityData, cfg)
 */

// ─── Costanti fogli ───────────────────────────────────────────────────────────
var SHEET_RESULTS   = 'RESULTS';
var SHEET_EQUITY    = 'EQUITY_CURVES';
var SHEET_SENS      = 'SENSITIVITY';
var SHEET_LOG       = 'LOG';

// Colori formattazione condizionale
var COLOR_WIN  = '#b7e1cd'; // Verde chiaro
var COLOR_LOSS = '#f4cccc'; // Rosso chiaro

/**
 * Funzione principale di scrittura.
 * Scrive RESULTS, EQUITY_CURVES, SENSITIVITY, LOG e genera il grafico.
 */
function writeResults(results, equityCurves, sensitivityData, cfg) {
  try {
    _writeResultsSheet(results);
    _writeEquityCurvesSheet(equityCurves);
    _writeSensitivitySheet(sensitivityData);
    _createEquityChart(equityCurves);
  } catch (e) {
    logEvent('ERROR', 'writeResults fallito: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Errore nella scrittura dei fogli:\n' + e.message);
    throw e;
  }
}

// ─── FOGLIO RESULTS ───────────────────────────────────────────────────────────

function _writeResultsSheet(results) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RESULTS);
  sheet.clearContents();
  sheet.clearFormats();

  // Header
  const headers = [
    'Strategia', 'Mean PnL ($)', 'Std PnL ($)', 'Mean ROI (%)',
    'Sharpe Ratio', 'Avg Bet ($)', 'Trades Eseguiti', 'Trades Skippati', 'Win Rate Reale'
  ];
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a4a4a');
  headerRange.setFontColor('#ffffff');

  // Dati
  const data = results.map(r => [
    r.name,
    _fmt2(r.meanPnl),
    _fmt2(r.stdPnl),
    _fmt2(r.meanRoi),
    _fmt2(r.sharpe),
    _fmt2(r.avgBet),
    r.tradesExec,
    r.tradesSkip,
    _fmt2(r.winRateReal * 100) + '%'
  ]);
  sheet.getRange(2, 1, data.length, headers.length).setValues(data);

  // Formattazione numero con separatore migliaia
  const numFormat = '#,##0.00';
  sheet.getRange(2, 2, results.length, 6).setNumberFormat(numFormat);

  // Formattazione condizionale: riga max PnL → verde, riga min PnL → rosso
  const meanPnls = results.map(r => r.meanPnl);
  const maxIdx   = meanPnls.indexOf(Math.max(...meanPnls));
  const minIdx   = meanPnls.indexOf(Math.min(...meanPnls));
  sheet.getRange(maxIdx + 2, 1, 1, headers.length).setBackground(COLOR_WIN);
  sheet.getRange(minIdx + 2, 1, 1, headers.length).setBackground(COLOR_LOSS);

  // Riga RANK
  const rankRow = results.length + 2;
  sheet.getRange(rankRow, 1).setValue('RANK (per Mean PnL)');
  sheet.getRange(rankRow, 1).setFontWeight('bold');
  const sorted = [...results].sort((a, b) => b.meanPnl - a.meanPnl);
  results.forEach((r, i) => {
    const rank = sorted.findIndex(s => s.name === r.name) + 1;
    sheet.getRange(rankRow, i + 2).setValue('#' + rank);
  });

  // Cella strategia consigliata
  const winner = [...results].sort((a, b) => b.meanPnl - a.meanPnl)[0];
  const recRow = rankRow + 2;
  sheet.getRange(recRow, 1).setValue('🏆 Strategia consigliata: ' + winner.name);
  sheet.getRange(recRow, 1).setFontWeight('bold').setFontSize(12).setBackground('#fff2cc');

  // Auto-resize colonne
  sheet.autoResizeColumns(1, headers.length);
}

// ─── FOGLIO EQUITY_CURVES ─────────────────────────────────────────────────────

function _writeEquityCurvesSheet(equityCurves) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_EQUITY);
  sheet.clearContents();

  const { tradeNums, curves } = equityCurves;

  // Header: Trade# + nomi strategie
  const headers = ['Trade#'].concat(curves.map(c => c.name));
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#4a4a4a').setFontColor('#ffffff');

  // Costruisci matrice dati
  const rows = tradeNums.map((t, i) => {
    const row = [t];
    curves.forEach(c => row.push(c.data[i] !== undefined ? _fmt2(c.data[i]) : ''));
    return row;
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(2, 2, rows.length, curves.length).setNumberFormat('#,##0.00');
  }

  sheet.autoResizeColumns(1, headers.length);
}

// ─── FOGLIO SENSITIVITY ───────────────────────────────────────────────────────

function _writeSensitivitySheet(sensitivityData) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SENS);
  sheet.clearContents();
  sheet.clearFormats();

  const { winRates, kellyFracs, matrix } = sensitivityData;

  // Titolo
  sheet.getRange(1, 1).setValue('ROI% Kelly — Sensibilità WIN_RATE × KELLY_FRACTION');
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(11);

  // Header colonne (KELLY_FRAC)
  sheet.getRange(2, 1).setValue('WIN_RATE \ KELLY_FRAC');
  sheet.getRange(2, 1).setFontWeight('bold');
  kellyFracs.forEach((kf, c) => {
    sheet.getRange(2, c + 2).setValue(kf.toFixed(2)).setFontWeight('bold');
  });

  // Righe dati
  winRates.forEach((wr, r) => {
    sheet.getRange(r + 3, 1).setValue(wr.toFixed(2)).setFontWeight('bold');
    matrix[r].forEach((val, c) => {
      sheet.getRange(r + 3, c + 2).setValue(_fmt2(val));
    });
  });

  // Formattazione condizionale a scala colore (rosso → giallo → verde)
  const dataRange = sheet.getRange(3, 2, winRates.length, kellyFracs.length);
  dataRange.setNumberFormat('#,##0.00');

  // Calcola min/max per scale manuale colore
  const allVals = matrix.flat();
  const minVal  = Math.min(...allVals);
  const maxVal  = Math.max(...allVals);
  const midVal  = (minVal + maxVal) / 2;

  const rules = sheet.getConditionalFormatRules();
  const newRule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#ea4335', SpreadsheetApp.InterpolationType.NUMBER, minVal.toString())
    .setGradientMidpointWithValue('#fbbc04', SpreadsheetApp.InterpolationType.NUMBER, midVal.toString())
    .setGradientMaxpointWithValue('#34a853', SpreadsheetApp.InterpolationType.NUMBER, maxVal.toString())
    .setRanges([dataRange])
    .build();
  rules.push(newRule);
  sheet.setConditionalFormatRules(rules);

  sheet.autoResizeColumns(1, kellyFracs.length + 1);
}

// ─── GRAFICO EQUITY ───────────────────────────────────────────────────────────

function _createEquityChart(equityCurves) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_EQUITY);

  // Elimina grafici esistenti
  sheet.getCharts().forEach(c => sheet.removeChart(c));

  const { curves } = equityCurves;
  const numRows = sheet.getLastRow();
  if (numRows < 2) return;

  // Colori distinti per strategia
  const COLORS = ['#4285f4', '#ea4335', '#34a853', '#fbbc04', '#9c27b0', '#ff6d00'];

  // Costruisce il chart builder
  let builder = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .setOption('title', 'Equity Curve — Confronto Strategie (1 run)')
    .setOption('titleTextStyle', { fontSize: 14, bold: true })
    .setOption('hAxis', { title: 'Trade #', gridlines: { color: '#eeeeee' } })
    .setOption('vAxis', { title: 'PnL Cumulativo ($)', gridlines: { color: '#eeeeee', count: 6 } })
    .setOption('legend', { position: 'right' })
    .setOption('lineWidth', 2)
    .setOption('curveType', 'function')
    .setOption('backgroundColor', '#ffffff')
    .setOption('chartArea', { width: '70%', height: '80%' })
    .setOption('colors', COLORS);

  // Aggiunge range dati: colonna A (Trade#) come asse X
  builder = builder.addRange(sheet.getRange(1, 1, numRows, 1 + curves.length));

  // Posiziona il grafico sotto i dati
  const chartRow = numRows + 3;
  builder = builder.setPosition(chartRow, 1, 0, 0);

  sheet.insertChart(builder.build());
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

/** Formatta un numero con 2 decimali. */
function _fmt2(val) {
  return Math.round(val * 100) / 100;
}
