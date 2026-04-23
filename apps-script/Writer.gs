/**
 * Writer.gs
 * Scrive i risultati nei fogli Google Sheets e genera il grafico equity.
 *
 * PROBLEMA GRAFICO RISOLTO:
 *  - Apps Script richiede che le serie siano aggiunte come range SEPARATI
 *    (una colonna per serie) oppure come singolo range con useRow1AsHeaders=true
 *    e setNumHeaders(1). Senza queste opzioni il grafico viene creato vuoto.
 *  - La colonna A (Trade#) deve essere aggiunta come range separato e
 *    impostata come asse X tramite setOption('useFirstColumnAsDomain', true).
 */

// ─── Costanti fogli ───────────────────────────────────────────────────────────
var SHEET_RESULTS = 'RESULTS';
var SHEET_EQUITY  = 'EQUITY_CURVES';
var SHEET_SENS    = 'SENSITIVITY';
var SHEET_LOG     = 'LOG';

var COLOR_WIN  = '#b7e1cd';
var COLOR_LOSS = '#f4cccc';

// ─── ENTRY POINT ────────────────────────────────────────────────────────────────

function writeResults(results, equityCurves, sensitivityData, cfg) {
  try {
    _writeResultsSheet(results);
    _writeEquityCurvesSheet(equityCurves);
    _writeSensitivitySheet(sensitivityData);
    _createEquityChart();          // legge direttamente dal foglio già scritto
  } catch (e) {
    logEvent('ERROR', 'writeResults fallito: ' + e.message);
    SpreadsheetApp.getUi().alert('❌ Errore scrittura fogli:\n' + e.message);
    throw e;
  }
}

// ─── FOGLIO RESULTS ───────────────────────────────────────────────────────────

function _writeResultsSheet(results) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_RESULTS);
  sheet.clearContents();
  sheet.clearFormats();

  const headers = [
    'Strategia', 'Mean PnL ($)', 'Std PnL ($)', 'Mean ROI (%)',
    'Sharpe Ratio', 'Avg Bet ($)', 'Trades Eseguiti', 'Trades Skippati', 'Win Rate Reale'
  ];
  const hdrRange = sheet.getRange(1, 1, 1, headers.length);
  hdrRange.setValues([headers]);
  hdrRange.setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');

  const data = results.map(r => [
    r.name,
    _fmt2(r.meanPnl),
    _fmt2(r.stdPnl),
    _fmt2(r.meanRoi),
    _fmt2(r.sharpe),
    _fmt2(r.avgBet),
    r.tradesExec,
    r.tradesSkip,
    (_fmt2(r.winRateReal * 100)) + '%'
  ]);
  sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  sheet.getRange(2, 2, results.length, 6).setNumberFormat('#,##0.00');

  // Highlight verde/rosso
  const pnls   = results.map(r => r.meanPnl);
  const maxIdx = pnls.indexOf(Math.max(...pnls));
  const minIdx = pnls.indexOf(Math.min(...pnls));
  sheet.getRange(maxIdx + 2, 1, 1, headers.length).setBackground(COLOR_WIN);
  sheet.getRange(minIdx + 2, 1, 1, headers.length).setBackground(COLOR_LOSS);

  // Riga RANK
  const rankRow = results.length + 3;
  sheet.getRange(rankRow, 1).setValue('🏅 RANK per Mean PnL').setFontWeight('bold');
  const sorted = [...results].sort((a, b) => b.meanPnl - a.meanPnl);
  results.forEach((r, i) => {
    const rank = sorted.findIndex(s => s.name === r.name) + 1;
    sheet.getRange(rankRow, i + 2).setValue('#' + rank).setFontWeight('bold');
  });

  // Strategia consigliata
  const winner = sorted[0];
  const recRow = rankRow + 2;
  sheet.getRange(recRow, 1, 1, 3).merge();
  sheet.getRange(recRow, 1)
    .setValue('🏆 Strategia consigliata: ' + winner.name +
              '  |  ROI medio: ' + _fmt2(winner.meanRoi) + '%' +
              '  |  Sharpe: ' + _fmt2(winner.sharpe))
    .setFontWeight('bold').setFontSize(12).setBackground('#fff2cc');

  sheet.autoResizeColumns(1, headers.length);
}

// ─── FOGLIO EQUITY_CURVES ─────────────────────────────────────────────────────

function _writeEquityCurvesSheet(equityCurves) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_EQUITY);
  sheet.clearContents();
  sheet.clearFormats();
  sheet.getCharts().forEach(c => sheet.removeChart(c));

  const { tradeNums, curves } = equityCurves;
  const headers = ['Trade#'].concat(curves.map(c => c.name));

  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1a1a2e')
    .setFontColor('#ffffff');

  if (tradeNums.length === 0) return;

  const rows = tradeNums.map((t, i) => {
    const row = [t];
    curves.forEach(c => {
      row.push(c.data[i] !== undefined ? _fmt2(c.data[i]) : 0);
    });
    return row;
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  // Colonna A: numero intero (indice trade)
  sheet.getRange(2, 1, rows.length, 1).setNumberFormat('#,##0');
  // Colonne B-G: PnL con 2 decimali
  sheet.getRange(2, 2, rows.length, curves.length).setNumberFormat('#,##0.00');
  sheet.autoResizeColumns(1, headers.length);
}

// ─── FOGLIO SENSITIVITY ───────────────────────────────────────────────────────

function _writeSensitivitySheet(sensitivityData) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SENS);
  sheet.clearContents();
  sheet.clearFormats();

  const { winRates, kellyFracs, matrix } = sensitivityData;

  sheet.getRange(1, 1).setValue('ROI% Kelly — Sensibilità WIN_RATE × KELLY_FRACTION')
    .setFontWeight('bold').setFontSize(12);

  sheet.getRange(2, 1).setValue('WIN_RATE \ KELLY_FRAC').setFontWeight('bold');
  kellyFracs.forEach((kf, c) => {
    sheet.getRange(2, c + 2).setValue(kf.toFixed(2)).setFontWeight('bold');
  });

  winRates.forEach((wr, r) => {
    sheet.getRange(r + 3, 1).setValue(wr.toFixed(2)).setFontWeight('bold');
    matrix[r].forEach((val, c) => {
      sheet.getRange(r + 3, c + 2).setValue(_fmt2(val));
    });
  });

  const dataRange = sheet.getRange(3, 2, winRates.length, kellyFracs.length);
  dataRange.setNumberFormat('#,##0.00');

  const allVals = matrix.flat();
  const minVal  = Math.min(...allVals);
  const maxVal  = Math.max(...allVals);
  const midVal  = (minVal + maxVal) / 2;

  const newRule = SpreadsheetApp.newConditionalFormatRule()
    .setGradientMinpointWithValue('#ea4335', SpreadsheetApp.InterpolationType.NUMBER, String(minVal))
    .setGradientMidpointWithValue('#fbbc04', SpreadsheetApp.InterpolationType.NUMBER, String(midVal))
    .setGradientMaxpointWithValue('#34a853', SpreadsheetApp.InterpolationType.NUMBER, String(maxVal))
    .setRanges([dataRange])
    .build();
  sheet.setConditionalFormatRules([newRule]);
  sheet.autoResizeColumns(1, kellyFracs.length + 1);
}

// ─── GRAFICO EQUITY (FIX COMPLETO) ───────────────────────────────────────────────

/**
 * Crea il grafico a linee nel foglio EQUITY_CURVES.
 *
 * FIX applicati rispetto alla versione precedente:
 *  1. Si usa UN SOLO addRange() con l'intero blocco dati (A1:G{n})
 *  2. setNumHeaders(1) dice al grafico che la riga 1 è l'intestazione
 *  3. useRow1AsHeaders = true espone i nomi delle serie dalla riga 1
 *  4. useFirstColumnAsDomain = true usa la colonna Trade# come asse X
 *  5. Il grafico viene inserito DOPO che il foglio è stato scritto,
 *     quindi sheet.getLastRow() restituisce il valore corretto.
 *  6. La dimensione del grafico è impostata esplicitamente (pixel)
 *     tramite setPosition(row, col, offsetX, offsetY) con width/height.
 */
function _createEquityChart() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_EQUITY);

  // Rimuovi grafici esistenti
  sheet.getCharts().forEach(c => sheet.removeChart(c));

  const numRows = sheet.getLastRow();
  const numCols = sheet.getLastColumn(); // 7 = Trade# + 6 strategie
  if (numRows < 2 || numCols < 2) {
    logEvent('WARN', '_createEquityChart: dati insufficienti nel foglio EQUITY_CURVES');
    return;
  }

  const COLORS = ['#4285f4', '#ea4335', '#34a853', '#fbbc04', '#9c27b0', '#ff6d00'];

  // Range completo: riga 1 (header) + tutte le righe dati
  const dataRange = sheet.getRange(1, 1, numRows, numCols);

  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    // ✔ Chiave: senza questi due il grafico appare vuoto
    .setNumHeaders(1)
    .addRange(dataRange)
    .setOption('useFirstColumnAsDomain', true)
    .setOption('useRow1AsHeaders', true)
    // Titolo e assi
    .setOption('title', 'Equity Curve — Confronto Strategie (1 run)')
    .setOption('titleTextStyle', { fontSize: 14, bold: true, color: '#1a1a2e' })
    .setOption('hAxis', {
      title: 'Trade #',
      titleTextStyle: { italic: false, bold: true },
      gridlines: { color: '#eeeeee' },
      minorGridlines: { color: '#f8f8f8' }
    })
    .setOption('vAxis', {
      title: 'PnL Cumulativo ($)',
      titleTextStyle: { italic: false, bold: true },
      gridlines: { color: '#eeeeee', count: 6 },
      format: '#,##0'
    })
    // Legenda a destra
    .setOption('legend', { position: 'right', textStyle: { fontSize: 11 } })
    // Stile linee
    .setOption('lineWidth', 2)
    .setOption('curveType', 'none')   // linee dritte → più veloci da renderizzare
    .setOption('pointSize', 0)        // nessun punto, solo linea
    // Colori distinti per ogni strategia
    .setOption('colors', COLORS)
    // Sfondo e area grafico
    .setOption('backgroundColor', { fill: '#ffffff', stroke: '#dddddd', strokeWidth: 1 })
    .setOption('chartArea', { left: 80, top: 50, width: '65%', height: '78%' })
    // Dimensione esplicita (px) — fondamentale per non avere grafico "vuoto"
    .setOption('width', 900)
    .setOption('height', 480)
    // Posizionamento: sotto i dati, colonna A, offset 0
    .setPosition(numRows + 3, 1, 0, 0)
    .build();

  sheet.insertChart(chart);
  logEvent('CHART', 'Grafico equity generato — righe dati: ' + (numRows - 1));
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function _fmt2(val) {
  return Math.round(val * 100) / 100;
}
