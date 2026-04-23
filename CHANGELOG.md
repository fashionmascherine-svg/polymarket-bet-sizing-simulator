# Changelog

## [1.0.0] — 2026-04-23

### Aggiunto
- `Config.gs`: `getConfig()`, `seededRandom()` LCG, `sampleNormal()` Box-Muller
- `Strategies.gs`: 6 strategie (Fixed, Floor Only, Kelly, Confidence, Price Inverse, Hybrid) + `STRATEGY_REGISTRY`
- `Simulator.gs`: `runSimulation()` con Welford online stats, equity curve campionata
- `MonteCarlo.gs`: `runMonteCarlo()`, `getAllEquityCurves()`, `runSensitivity()`
- `Writer.gs`: `writeResults()`, scrittura RESULTS/EQUITY_CURVES/SENSITIVITY, grafico a linee
- `Main.gs`: `runAll()`, `onOpen()`, `refreshChart()`, `resetSheets()`, `showParamInfo()`, `logEvent()`
- `README.md`: guida completa di setup
- `sheets-setup/SETUP.md`: istruzioni dettagliate per il Google Sheet
