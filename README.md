# 🎲 Polymarket Bet Sizing Simulator

> **Google Sheets + Apps Script** — Simulatore Monte Carlo per confrontare 6 strategie di bet sizing su mercati di predizione binari (Polymarket).

---

## 📖 Come funziona

### Idea di fondo

Su Polymarket ogni mercato ha un **prezzo** (es. `0.30` = 30% probabilità implicita). Se acquisti shares a `0.30` e il mercato risolve YES, ogni share ti rende `1.00 - 0.30 = 0.70$` di profitto. Se risolve NO, perdi `0.30$` per share.

La domanda che questo simulatore risponde è:

> **Dati un win rate stimato e un range di prezzi, quale strategia di sizing massimizza il PnL atteso minimizzando la varianza?**

### Pipeline di esecuzione

```
onOpen()  │  setupSpreadsheet()       │  runAll()
──────────┼─────────────────────────┼─────────────────────────────
Menu UI   │  Crea 5 fogli              │  1. getConfig()
          │  Popola CONFIG base        │  2. runMonteCarlo()
          │  Crea 12 Named Ranges      │  3. getAllEquityCurves()
          │  Inserisce cella-pulsante  │  4. runSensitivity()
                                       │  5. writeResults()
                                       │  6. Toast vincitrice
```

### Monte Carlo (cuore del sistema)

```
Per ogni strategia:
  Per ogni run r in [1..N_RUNS]:  (seed = BASE_SEED + r)
    Per ogni trade t in [1..N_SIM]:
      entryPrice  = uniforme [PRICE_MIN, PRICE_MAX]     ← LCG seeded
      confidence  = normale(WIN_RATE, CONF_SIGMA)       ← Box-Muller
      betUsd      = strategiaFn(entryPrice, cash, confidence, cfg)
      shares      = betUsd / entryPrice
      if shares < MIN_SHARES → skip
      esito       = random() < WIN_RATE ? WIN : LOSS
      pnl         = WIN  ? betUsd/entryPrice - betUsd
                         : -betUsd
      cumPnl     += pnl
    fine trade
    registra: totalPnl, ROI%, Sharpe, avgBet, tradesExec, tradesSkip
  fine run
  calcola: mean ± std di tutti i KPI su N_RUNS
fine strategia
```

Lo **Sharpe Ratio** è calcolato con l’algoritmo di Welford (online, senza array) per efficienza di memoria:

```
Sharpe = mean(pnlPerTrade) / std(pnlPerTrade) × √N_trades
```

### Generatore pseudo-casuale deterministico (LCG)

Per garantire **riproducibilità** (stesso seed → stessi risultati), tutto il codice usa un Linear Congruential Generator invece di `Math.random()`:

```js
// Parametri Numerical Recipes
state = (1664525 × state + 1013904223) mod 2^32
return state / 2^32   // float in [0, 1)
```

La confidence viene campionata da una distribuzione normale approssimata con **Box-Muller**:

```js
z = sqrt(-2 × ln(u1)) × cos(2π × u2)
confidence = clamp(WIN_RATE + CONF_SIGMA × z, 0, 1)
```

---

## ⚙️ Strategie implementate

| # | Nome | Formula | Logica |
|---|------|---------|--------|
| 1 | **Fixed** | `bet = MAX_BET` | Baseline: sempre scommessa massima |
| 2 | **Floor Only** | `bet = max(MIN_SHARES × price, MIN_BET)` | Garantisce shares minimi, cap a MAX_BET |
| 3 | **Kelly** | `f* = (p·b - q)/b`; `bet = f* × KELLY_FRAC × cash` | Sizing matematicamente ottimale con frazione di sicurezza |
| 4 | **Confidence** | `bet = MIN + (MAX-MIN) × confidence` | Più sicuro sei, più scommetti |
| 5 | **Price Inverse** | `bet = MIN + (MAX-MIN) × (1 - price)` | Prezzi bassi = upside maggiore = bet maggiore |
| 6 | **Hybrid** | `bet = 0.6 × Kelly + 0.4 × Confidence` | Blend razionale tra ottimalità e segnale informativo |

**Ogni strategia applica sempre:**
- **Floor**: `bet = max(bet, MIN_SHARES × price, MIN_BET)`
- **Cap**: `bet = min(bet, MAX_BET)`
- **Skip**: se `betUsd / price < MIN_SHARES` il trade viene saltato

### Kelly Criterion — dettaglio

```
b     = (1 / entryPrice) - 1          ← odds netti
p     = WIN_RATE                       ← probabilità stimata
q     = 1 - p
f*    = (p·b - q) / b                 ← frazione Kelly ottimale
betKelly = clamp(f* × KELLY_FRAC × cash, floor, MAX_BET)
```

Se `f* ≤ 0` (edge negativo) la strategia usa il floor minimo, non scommette 0.

---

## 📁 Struttura file

```
📁 apps-script/
├── Config.gs        # getConfig() + seededRandom() LCG + sampleNormal() Box-Muller
├── Strategies.gs    # 6 strategie pure + clampBet() + STRATEGY_REGISTRY[]
├── Simulator.gs     # runSimulation() + computeStats() (Welford online)
├── MonteCarlo.gs    # runMonteCarlo() + getAllEquityCurves() + runSensitivity()
├── Writer.gs        # writeResults() + _createEquityChart() (fix grafico)
└── Main.gs          # runAll() + setupSpreadsheet() + onOpen() + logEvent()
📁 sheets-setup/
└── SETUP.md         # Istruzioni dettagliate setup manuale
```

---

## 🚀 Setup (da zero in 3 minuti)

### 1. Crea il Google Sheet

Vai su [sheets.new](https://sheets.new) e crea un nuovo foglio.

### 2. Carica gli Apps Script

1. **Estensioni → Apps Script**
2. Elimina il file `Codice.gs` predefinito
3. Crea 6 file `.gs` copiando i contenuti dalla cartella `apps-script/`:

| File | Contenuto |
|------|-----------|
| `Config.gs` | Helper config + RNG |
| `Strategies.gs` | 6 strategie di bet sizing |
| `Simulator.gs` | Engine Monte Carlo |
| `MonteCarlo.gs` | Orchestratore multi-run |
| `Writer.gs` | Scrittura fogli + grafico |
| `Main.gs` | Entry point + setup |

4. Salva tutto (**Ctrl+S**)
5. Verifica che il runtime sia **V8**: Impostazioni progetto → Runtime V8 ✔️

### 3. Esegui il setup iniziale

1. Ricarica il Google Sheet
2. Comparirà il menu **🎲 Simulatore** nella barra in alto
3. Clicca **🎲 Simulatore → ⚙️ Setup iniziale (crea fogli + config)**
4. Alla prima esecuzione Google chiederà di **autorizzare** lo script → accetta
5. Il setup creerà automaticamente:
   - 5 fogli: `CONFIG`, `RESULTS`, `EQUITY_CURVES`, `SENSITIVITY`, `LOG`
   - 12 Named Ranges (`CFG_N_SIMULATIONS`, `CFG_WIN_RATE`, ecc.)
   - Tabella CONFIG con valori di default
   - Cella-pulsante visiva nel foglio CONFIG

### 4. (Opzionale) Aggiungi il pulsante cliccabile

Per avere un vero pulsante cliccabile nel foglio:
1. **Inserisci → Disegno**
2. Crea un rettangolo con testo `▶ AVVIA SIMULAZIONE`
3. Chiudi il dialog → clicca sul disegno → **⋮ → Assegna script** → digita `runAll` → OK

> In alternativa usa sempre il menu **🎲 Simulatore → ▶ Avvia simulazione completa**.

### 5. Avvia la simulazione

Clicca **🎲 Simulatore → ▶ Avvia simulazione completa** e attendi.
Al termine apparirà un toast con la strategia vincitrice e il ROI medio.

---

## 📊 Output generato

### Foglio RESULTS
Tabella con 1 riga per strategia:
- **Mean PnL ($)** — profitto medio su N_RUNS simulazioni
- **Std PnL ($)** — deviazione standard del PnL (misura di rischio)
- **Mean ROI (%)** — rendimento percentuale sul capitale iniziale
- **Sharpe Ratio** — rendimento aggiustato per il rischio
- **Avg Bet ($)** — scommessa media effettiva
- **Trades Eseguiti / Skippati** — quanti trade superano il vincolo MIN_SHARES
- **Win Rate Reale** — win rate realizzato (verifica statistica)

Formattazione: riga verde = strategia migliore, riga rossa = peggiore. In fondo: ranking e cella "🏆 Strategia consigliata".

### Foglio EQUITY_CURVES
Dati del PnL cumulativo campionati ogni ~1000 trade per una run di esempio. Sotto i dati: **grafico a linee** con 6 serie colorate (una per strategia), asse X = Trade#, asse Y = PnL $.

### Foglio SENSITIVITY
Heatmap ROI% della strategia Kelly al variare di:
- **Righe**: WIN_RATE da 0.50 a 0.70 (step 0.02)
- **Colonne**: KELLY_FRACTION da 0.10 a 0.50 (step 0.05)

Formattazione condizionale a scala colore: 🔴 rosso (ROI basso) → 🟡 giallo → 🟢 verde (ROI alto).

### Foglio LOG
Log append-only di ogni esecuzione: timestamp, fase, dettagli e strategia vincitrice finale.

---

## ⚠️ Limiti di performance

| Situazione | Soluzione |
|---|---|
| `N_SIM × N_RUNS × 6 > 3.000.000` | Lo script avvisa e chiede conferma |
| Timeout dopo 6 minuti | Riduci `N_RUNS` a 10 o `N_SIMULATIONS` a 10.000 |
| Grafico non appare | Usa **🎲 Simulatore → 📊 Solo grafico equity** |
| Menu non appare | Estensioni → Apps Script → esegui `onOpen` manualmente |
| Named range not found | Riesegui `setupSpreadsheet()` dal menu |

### Valori consigliati per test rapido

```
N_SIMULATIONS = 10000
N_RUNS        = 5
```
Risultati in ~15 secondi invece di 3-5 minuti.

---

## 🔧 Parametri CONFIG

| Parametro | Default | Descrizione |
|---|---|---|
| `N_SIMULATIONS` | 100,000 | Trade simulati per singola run |
| `N_RUNS` | 30 | Run Monte Carlo per strategia (più è alto, più è stabile la media) |
| `MIN_BET_USD` | 1.00 | Scommessa minima in $ |
| `MAX_BET_USD` | 5.00 | Scommessa massima in $ |
| `MIN_SHARES` | 5 | Shares minimi per considerare valido un trade |
| `WIN_RATE` | 0.60 | Probabilità di vincita stimata (edge sul mercato) |
| `STARTING_CASH` | 100,000 | Capitale iniziale in $ |
| `PRICE_MIN` | 0.06 | Prezzo minimo di ingresso considerato |
| `PRICE_MAX` | 0.94 | Prezzo massimo di ingresso considerato |
| `KELLY_FRACTION` | 0.25 | Frazione del Kelly ottimale da usare (0.25 = Kelly/4, conservativo) |
| `CONFIDENCE_SIGMA` | 0.10 | Rumore sulla stima della confidence (0 = certezza assoluta) |
| `RANDOM_SEED` | 42 | Seme RNG — stesso valore = risultati identici tra run |

---

## 📄 Licenza

MIT — libero uso, modifica e distribuzione.
