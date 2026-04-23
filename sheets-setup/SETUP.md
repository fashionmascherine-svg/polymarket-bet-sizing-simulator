# 📋 Guida Setup Completo — Google Sheet

Questo file descrive passo-passo come configurare il Google Sheet per il simulatore.

---

## Struttura dei Fogli

Il Google Sheet deve contenere **5 fogli** con questi nomi esatti (sensibile alle maiuscole):

1. `CONFIG`
2. `RESULTS`
3. `EQUITY_CURVES`
4. `SENSITIVITY`
5. `LOG`

---

## Foglio 1 — CONFIG

### Struttura tabella (A1:B13)

```
A            | B
-------------|----------
Parametro    | Valore
N_SIMULATIONS| 100000
N_RUNS       | 30
MIN_BET_USD  | 1.0
MAX_BET_USD  | 5.0
MIN_SHARES   | 5
WIN_RATE     | 0.60
STARTING_CASH| 100000
PRICE_MIN    | 0.06
PRICE_MAX    | 0.94
KELLY_FRACTION| 0.25
CONFIDENCE_SIGMA| 0.10
RANDOM_SEED  | 42
```

### Named Ranges da creare

Vai su **Dati → Named Ranges** e crea questi named ranges:

| Nome Named Range    | Cella      |
|---------------------|------------|
| CFG_N_SIMULATIONS   | CONFIG!B2  |
| CFG_N_RUNS          | CONFIG!B3  |
| CFG_MIN_BET_USD     | CONFIG!B4  |
| CFG_MAX_BET_USD     | CONFIG!B5  |
| CFG_MIN_SHARES      | CONFIG!B6  |
| CFG_WIN_RATE        | CONFIG!B7  |
| CFG_STARTING_CASH   | CONFIG!B8  |
| CFG_PRICE_MIN       | CONFIG!B9  |
| CFG_PRICE_MAX       | CONFIG!B10 |
| CFG_KELLY_FRACTION  | CONFIG!B11 |
| CFG_CONFIDENCE_SIGMA| CONFIG!B12 |
| CFG_RANDOM_SEED     | CONFIG!B13 |

### Pulsante AVVIA SIMULAZIONE

1. Vai su **Inserisci → Disegno**
2. Inserisci un rettangolo colorato
3. Aggiungi testo: `▶ AVVIA SIMULAZIONE`
4. Salva e chiudi il dialog
5. Clicca sul disegno appena inserito → **⋮ → Assegna script** → digita `runAll` → **OK**

---

## Foglio 2 — RESULTS

Lascialo **vuoto**: verrà popolato automaticamente dallo script `Writer.gs`.

Conterrà:
- Header riga 1 (sfondo scuro)
- 1 riga per strategia con KPI
- Formattazione verde/rosso per miglior/peggior strategia
- Riga ranking
- Cella "🏆 Strategia consigliata"

---

## Foglio 3 — EQUITY_CURVES

Lascialo **vuoto**: verrà popolato automaticamente.

Conterrà:
- Colonna `Trade#` + 1 colonna per strategia
- Grafico a linee sotto i dati

---

## Foglio 4 — SENSITIVITY

Lascialo **vuoto**: verrà popolato automaticamente.

Conterrà:
- Titolo in A1
- Griglia WIN_RATE × KELLY_FRACTION
- Formattazione condizionale a scala colore (rosso→giallo→verde)

---

## Foglio 5 — LOG

Lascialo **vuoto**: viene popolato append-only ad ogni esecuzione.

Colonne: `Timestamp | Evento | Dettaglio`

---

## Caricamento Apps Script

1. Apri **Estensioni → Apps Script**
2. Elimina il file `Codice.gs` predefinito (vuoto)
3. Crea i seguenti file cliccando su **+** accanto a "File":

| Nome file    | Contenuto da |
|--------------|---------------------------|
| `Config.gs`      | `apps-script/Config.gs`      |
| `Strategies.gs`  | `apps-script/Strategies.gs`  |
| `Simulator.gs`   | `apps-script/Simulator.gs`   |
| `MonteCarlo.gs`  | `apps-script/MonteCarlo.gs`  |
| `Writer.gs`      | `apps-script/Writer.gs`      |
| `Main.gs`        | `apps-script/Main.gs`        |

4. Salva tutto (**Ctrl+S** o icona salva)
5. Assicurati che il runtime sia **V8** (Impostazioni progetto → Runtime)

---

## Prima Esecuzione

1. Ricarica il Google Sheet
2. Comparirà il menu **🎲 Simulatore** nella barra dei menu
3. Clicca **🎲 Simulatore → ▶ Avvia simulazione completa**
4. Alla prima esecuzione Google richiederà **autorizzazioni** (accesso al foglio)
5. Autorizza lo script col tuo account Google
6. Attendi il toast di completamento (può richiedere 2-5 minuti con i default)

---

## Consigli per Test Rapidi

Per testare rapidamente senza aspettare 5 minuti, imposta nel foglio CONFIG:

| Parametro | Valore rapido |
|---|---|
| N_SIMULATIONS | 10000 |
| N_RUNS | 5 |

I risultati saranno meno precisi ma otterrai output in ~15 secondi.

---

## Troubleshooting

| Problema | Soluzione |
|---|---|
| "Named range not found" | Crea tutti i 12 named ranges nel foglio CONFIG |
| Timeout dopo 6 min | Riduci N_RUNS a 10 o N_SIMULATIONS a 10.000 |
| Il menu non appare | Vai su Estensioni → Apps Script → Esegui `onOpen` manualmente |
| Grafico non generato | Clicca **📊 Solo grafico equity** dal menu |
| Risultati diversi tra run | Verifica che RANDOM_SEED sia lo stesso |
