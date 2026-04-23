# 🎲 Polymarket Bet Sizing Simulator

> **Google Sheets + Apps Script** — Simulatore Monte Carlo per confrontare strategie di bet sizing su mercati di predizione binari.

## 📋 Struttura del Progetto

```
📁 apps-script/
├── Config.gs          # Helper getConfig() + seededRandom() LCG
├── Strategies.gs      # 6 strategie di bet sizing (pure functions)
├── Simulator.gs       # Engine Monte Carlo singola run
├── MonteCarlo.gs      # Orchestratore multi-run per ogni strategia
├── Writer.gs          # Scrittura fogli + grafico equity curve
└── Main.gs            # runAll() + onOpen() menu
📁 sheets-setup/
└── SETUP.md           # Istruzioni per configurare il Google Sheet
```

## 🚀 Setup Rapido

### 1. Crea il Google Sheet

1. Vai su [sheets.new](https://sheets.new) per creare un nuovo foglio
2. Rinomina il file in **`Bet Sizing Simulator`**
3. Crea 5 fogli con questi nomi esatti (nell'ordine):
   - `CONFIG`
   - `RESULTS`
   - `EQUITY_CURVES`
   - `SENSITIVITY`
   - `LOG`

### 2. Configura il foglio CONFIG

Nel foglio **CONFIG**, crea la seguente tabella partendo dalla cella **A1**:

| A (Parametro) | B (Valore) |
|---|---|
| Parametro | Valore |
| N_SIMULATIONS | 100000 |
| N_RUNS | 30 |
| MIN_BET_USD | 1.0 |
| MAX_BET_USD | 5.0 |
| MIN_SHARES | 5 |
| WIN_RATE | 0.60 |
| STARTING_CASH | 100000 |
| PRICE_MIN | 0.06 |
| PRICE_MAX | 0.94 |
| KELLY_FRACTION | 0.25 |
| CONFIDENCE_SIGMA | 0.10 |
| RANDOM_SEED | 42 |

### 3. Crea i Named Ranges

Vai su **Dati → Named Ranges** e crea questi 12 named ranges:

| Nome | Cella |
|---|---|
| CFG_N_SIMULATIONS | CONFIG!B2 |
| CFG_N_RUNS | CONFIG!B3 |
| CFG_MIN_BET_USD | CONFIG!B4 |
| CFG_MAX_BET_USD | CONFIG!B5 |
| CFG_MIN_SHARES | CONFIG!B6 |
| CFG_WIN_RATE | CONFIG!B7 |
| CFG_STARTING_CASH | CONFIG!B8 |
| CFG_PRICE_MIN | CONFIG!B9 |
| CFG_PRICE_MAX | CONFIG!B10 |
| CFG_KELLY_FRACTION | CONFIG!B11 |
| CFG_CONFIDENCE_SIGMA | CONFIG!B12 |
| CFG_RANDOM_SEED | CONFIG!B13 |

### 4. Carica gli Apps Script

1. Apri **Estensioni → Apps Script**
2. Elimina il file `Codice.gs` predefinito
3. Crea 6 file `.gs` con i contenuti dalla cartella `apps-script/`:
   - `Config.gs`
   - `Strategies.gs`
   - `Simulator.gs`
   - `MonteCarlo.gs`
   - `Writer.gs`
   - `Main.gs`
4. Salva tutto (Ctrl+S)

### 5. Aggiungi il pulsante nel foglio CONFIG

1. Nel foglio CONFIG, vai su **Inserisci → Disegno**
2. Crea un rettangolo con il testo **`▶ AVVIA SIMULAZIONE`**
3. Clicca sul disegno → **⋮ → Assegna script** → digita `runAll`

### 6. Esegui la prima simulazione

1. Ricarica il foglio Google
2. Clicca su **🎲 Simulatore** nel menu (aggiunto da `onOpen`)
3. Oppure clicca il pulsante **▶ AVVIA SIMULAZIONE**
4. Autorizza lo script quando richiesto
5. Attendi il toast di completamento 🏆

---

## ⚙️ Strategie Implementate

| Strategia | Logica |
|---|---|
| **Fixed** | Scommette sempre `MAX_BET` |
| **Floor Only** | `max(MIN_SHARES × price, MIN_BET)`, cap a `MAX_BET` |
| **Kelly** | Kelly Criterion con frazione configurabile (`KELLY_FRACTION`) |
| **Confidence** | Scala lineare tra `MIN_BET` e `MAX_BET` in base alla confidence |
| **Price Inverse** | Più basso il prezzo → più alta la scommessa |
| **Hybrid** | 60% Kelly + 40% Confidence |

## 📊 Output

- **RESULTS**: tabella KPI per strategia (Mean PnL, Std, ROI, Sharpe, ecc.) con highlight verde/rosso
- **EQUITY_CURVES**: grafico a linee del PnL cumulativo per ogni strategia
- **SENSITIVITY**: heatmap ROI Kelly vs WIN_RATE × KELLY_FRACTION
- **LOG**: log append-only di ogni esecuzione

## ⚠️ Limiti di Performance

- `N_SIM × N_RUNS > 3.000.000` → lo script avvisa e consiglia di ridurre `N_RUNS`
- Timeout Apps Script: max 6 minuti per esecuzione
- Per test rapidi usa `N_SIMULATIONS = 10000`, `N_RUNS = 10`

## 📄 Licenza

MIT — libero uso, modifica e distribuzione.
