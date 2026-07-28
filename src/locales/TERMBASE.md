# PROSPECT — Translation Termbase

Extracted from the multilingual user guide. **This file governs the app's
locale values.** Where a term appears here, the app must use the same
translation, so the interface and the guide agree.

The relationship is bidirectional: if a translator finds a better rendering,
change it here **and** in both the app locale files and the guide, rather than
letting them drift.

---

## 1. Keep in English — never translate

Per the business ruling. These carry no translation in any locale.

| Category | Terms |
|---|---|
| IBRO components | `Inflow` `Base` `Retention` `Outflow` — including compounds such as Inflow Identifier, Retention Uplift %, Inflow Lag (Months) |
| Revenue metric | `ARPU` |
| Framework | `IBRO` `IBRO Scenario` |
| Product name | `PROSPECT` |
| Model names | `Simple Exponential Smoothing` `Holt Linear` `Damped Trend` `Holt-Winters` `AutoML` |
| Statistical acronym | `MAPE` (translate the expansion, keep the acronym — see §4) |
| Formulae & symbols | `Base[t] = Base[t-1] + Inflow[t-1] − Outflow[t-1]`, `ARPU Δ`, `Base Δ`, `ARPU (+/−)` |

---

## 2. Compound handling — the three categories

**(a) Sentence mentioning a domain term → translate the sentence, keep the term.**

> EN: Base reflects Inflow / Outflow from the prior month — an event in month T first appears in Base in T+1
> DE: Base spiegelt Inflow / Outflow des Vormonats wider — ein Ereignis in Monat T erscheint erstmals in T+1 in Base

**(b) Modifier + domain term → translate the modifier, keep the noun.**

| EN | DE | ES | FR | IT | PT |
|---|---|---|---|---|---|
| Blended ARPU | gemischter ARPU | ARPU combinado | ARPU mixte | ARPU medio | ARPU combinado |
| Baseline ARPU | Basis-ARPU | ARPU base | ARPU de référence | ARPU di base | ARPU base |
| Historical ARPU | historischer ARPU | ARPU histórico | ARPU historique | ARPU storico | ARPU histórico |
| Forecast ARPU | prognostizierter ARPU | ARPU previsto | ARPU prévu | ARPU previsto | ARPU previsto |
| Mean (Base) | Mittelwert (Base) | Media (Base) | Moyenne (Base) | Media (Base) | Média (Base) |
| Acquisition (Inflow) | Akquisition (Inflow) | Captación (Inflow) | Acquisition (Inflow) | Acquisizione (Inflow) | Angariação (Inflow) |
| Value (ARPU) | Wert (ARPU) | Valor (ARPU) | Valeur (ARPU) | Valore (ARPU) | Valor (ARPU) |

> **German note:** adjective forms like *gemischter ARPU* decline by case. In a
> standalone UI label the nominative is correct. Flag to translators that these
> are labels, not sentence fragments.

**(c) Formulae and symbols → verbatim, no translation.**

---

## 3. Feature names — must match the guide exactly

These are the product's own names and appear throughout the guide.

| EN | DE | ES | FR | IT | PT |
|---|---|---|---|---|---|
| Baseline Forecast | Basisprognose | Previsión base | Prévision de référence | Previsione di base | Previsão base |
| Market Events | Marktereignisse | Eventos de mercado | Événements de marché | Eventi di mercato | Eventos de mercado |
| Actuals Review | Ist-Abgleich | Revisión de valores reales | Revue des données réelles | Revisione dei dati effettivi | Revisão de dados reais |
| Adjusted Forecast | Angepasste Prognose | Previsión ajustada | Prévision ajustée | Previsione rettificata | Previsão ajustada |
| Custom Promotion | Individuelle Promotion | Promoción personalizada | Promotion personnalisée | Promozione personalizzata | Promoção personalizada |
| Scenario | Szenario | Escenario | Scénario | Scenario | Cenário |
| Base Case | Basisfall | Caso base | Cas de base | Caso base | Caso base |

---

## 4. Core vocabulary

| EN | DE | ES | FR | IT | PT |
|---|---|---|---|---|---|
| Actuals | Ist-Werte | Valores reales | Données réelles | Dati effettivi | Dados reais |
| Cohort | Kohorte | Cohorte | Cohorte | Coorte | Coorte |
| Leaf cohort | Blattkohorte | Cohorte hoja | Cohorte feuille | Coorte foglia | Coorte folha |
| Aggregate | Aggregat | Agregado | Agrégat | Aggregato | Agregado |
| Reconciliation | Übereinstimmung | Conciliación | Rapprochement | Quadratura | Conciliação |
| Confidence band | Konfidenzband | Banda de confianza | Intervalle de confiance | Banda di confidenza | Banda de confiança |
| Optimistic | Optimistisch | Optimista | Optimiste | Ottimistico | Otimista |
| Pessimistic | Pessimistisch | Pesimista | Pessimiste | Pessimistico | Pessimista |
| Variance | Abweichung | Desviación | Écart | Scostamento | Desvio |
| In Band | Im Band | En banda | Dans l'intervalle | Nella banda | Dentro da banda |
| Score | Bewertung | Puntuación | Note | Punteggio | Pontuação |
| Mean Absolute Percentage Error | Mittlerer absoluter prozentualer Fehler | Error porcentual absoluto medio | Erreur absolue moyenne en pourcentage | Errore percentuale medio assoluto | Erro percentual absoluto médio |

---

## 5. Dimensions

| EN | DE | ES | FR | IT | PT |
|---|---|---|---|---|---|
| Customer Segment | Kundensegment | Segmento de cliente | Segment client | Segmento cliente | Segmento de cliente |
| Product | Produkt | Producto | Produit | Prodotto | Produto |
| Channel | Kanal | Canal | Canal | Canale | Canal |
| Tariff | Tarif | Tarifa | Tarif | Tariffa | Tarifário |
| All | Alle | Todos | Tous | Tutti | Todos |
| Month | Monat | Mes | Mois | Mese | Mês |
| Volume | Volumen | Volumen | Volume | Volume | Volume |

> L1 / L2 suffixes stay as-is: *Produkt L1*, *Producto L2*, *Tarif L1*.
> Dimension **values** (Corporate, SME, SOHO, Mobile Data, RED L, SIM Only,
> High/Medium/Low Value) are data, not UI copy — never translated.

---

## 6. Event mechanics

| EN | DE | ES | FR | IT | PT |
|---|---|---|---|---|---|
| Campaign name | Kampagnenname | Nombre de campaña | Nom de campagne | Nome di campagna | Nome de campanha |
| Ramp | Anlauf | Progresión | Montée en charge | Avvio graduale | Progressão |
| Decay | Abklingen | Decaimiento | Atténuation | Attenuazione | Atenuação |
| Mix | Mix | Mix | Mix | Mix | Mix |
| Value mix | Wertmix | Mix de valor | Mix de valeur | Mix di valore | Mix de valor |
| Tariff mix | Tarifmix | Mix de tarifa | Mix tarifaire | Mix tariffario | Mix tarifário |
| Acquisition | Akquisition | Captación | Acquisition | Acquisizione | Angariação |
| Re-contracting | Neuvertragsbindung | Renovación de contrato | Réengagement | Rinnovo contrattuale | Renovação contratual |
| Pro-rata distribution | Anteilige Verteilung | Distribución proporcional | Répartition proportionnelle | Distribuzione proporzionale | Distribuição proporcional |

---

## 7. Forecast operations

| EN | DE | ES | FR | IT | PT |
|---|---|---|---|---|---|
| Bulk generation | Massenerstellung | Generación masiva | Génération en masse | Generazione massiva | Geração em massa |
| Auto model selection | Automatische Modellauswahl | Selección automática de modelo | Sélection automatique de modèle | Selezione automatica del modello | Seleção automática de modelo |
| Gap detection | Lückenerkennung | Detección de huecos | Détection de lacunes | Rilevamento lacune | Deteção de lacunas |
| One-off flag | Einmal-Kennzeichnung | Marca de evento puntual | Signalement ponctuel | Contrassegno occasionale | Marcação pontual |
| Substituted value | Ersatzwert | Valor sustituido | Valeur de substitution | Valore sostitutivo | Valor substituto |
| Export Session | Sitzung exportieren | Exportar sesión | Exporter la session | Esporta sessione | Exportar sessão |
| Import Actuals | Ist-Werte importieren | Importar valores reales | Importer les données réelles | Importa dati effettivi | Importar dados reais |
| Remove Actuals | Ist-Werte entfernen | Eliminar valores reales | Supprimer les données réelles | Rimuovi dati effettivi | Remover dados reais |

---

## 8. Score colours and directional labels

| EN | DE | ES | FR | IT | PT |
|---|---|---|---|---|---|
| Green | Grün | Verde | Vert | Verde | Verde |
| Amber | Gelb | Ámbar | Orange clair | Ambra | Âmbar |
| Orange | Orange | Naranja | Orange | Arancione | Laranja |
| Red | Rot | Rojo | Rouge | Rosso | Vermelho |
| Over | Über | Por encima | Au-dessus | Sopra | Acima |
| Under | Unter | Por debajo | En dessous | Sotto | Abaixo |

> `Over` / `Under` are the shortened directional labels in the accuracy table.
> They must stay short — the column is narrow and DE/FR run longer. If a
> translation cannot fit, raise it rather than silently truncating.

---

## 9. Placeholder hints

Translate, including the abbreviation:

| EN | DE | ES | FR | IT | PT |
|---|---|---|---|---|---|
| e.g. | z. B. | p. ej. | p. ex. | per es. | p. ex. |

Example values inside hints (`Summer Promo 2026`, `CPI Rise Jan 2026`) should be
localised to plausible local equivalents, not left English.

---

## 10. Layout risk — read before translating

German and French run 20–30% longer than English. The pressure points, in order:

1. **Accuracy table** — score badges with Over/Under beneath, in narrow columns.
2. **Hierarchical dropdown triggers** — already show `L1 — L2` compounds.
3. **Buttons in the Actuals Review header** — Import / Remove / Export sit in a row.
4. **Tariff selection control** — multi-select with select-all.
5. **MAPE cards** — five across the page width.

Where a translation cannot fit, raise it for a shortened alternative rather
than allowing truncation or wrapping that breaks the layout. A UI review in
DE and FR is required before the locale work is considered complete.

---

## 11. Display strings vs identifiers — the split rule

A string that is **both displayed and used as an identifier** must be split:
a stable English key for the lookup, a separate translated label for display.
**Never one string doing both jobs.**

Where splitting is not cheap, **the identifier wins** — the string stays
English and a comment records why.

Translating an identifier fails silently rather than loudly: cohort IDs
written under one locale simply stop matching those written under another,
so saved sessions and scenario comparisons break with no error.

### Worked example 1 — `Base Case` (§3)

Listed above as a feature name with translations, but in code it is also an
identifier:

```
App.tsx   cohortId: `${Segment}|${Product}|${Channel}|Standard Forecast|${Scenario ?? 'Base Case'}`
App.tsx   } else if (wiScen === 'Base Case') {
```

It sits inside a composite cohort key *and* an equality comparison. Until it
is split, **the literal stays English**; the §3 translations apply only to a
separately-keyed display label.

### Worked example 2 — `All` (§5)

The clearest case, because it looks like ordinary vocabulary. `All` is listed
in Dimensions with full translations, but in code it is a **sentinel** serving
thirteen dimension comparisons and select values in WhatIfTab alone:

```
event.productL2 !== 'All'                    // comparison
value={newPricingEvent.segment ?? 'All'}     // select value
```

Translating the sentinel breaks every dimension filter. The sentinel stays
English; the §5 translations apply to the separately-keyed **display** label
only. A user sees *Alle*; the code still compares `'All'`.

### Entries in this termbase carrying the constraint

| Term | Section | Identifier use | Treatment |
|---|---|---|---|
| `Base Case` | §3 | cohortId key + equality comparison | Literal stays English; translations are display-only |
| `All` | §5 | 13+ dimension comparisons and select values | Literal stays English; translations are display-only |
| `Optimistic` | §4 | scenario band identifier | Literal stays English; translations are display-only |
| `Pessimistic` | §4 | scenario band identifier | Literal stays English; translations are display-only |

### Already correctly split — no action

`Standard Forecast` and `What-If Analysis` are the code's **internal**
forecast-type names and appear only in composite keys and comparisons, never
as display text. The user-facing equivalents are the separately-keyed §3
entries *Baseline Forecast* and *Market Events*. Verified: no JSX text
occurrence of either internal name.

**Open question — needs confirmation:** `forecastType` values are rendered in
a "Forecast Type" column in the Overall Forecast view. If that column prints
the raw internal value rather than a mapped display label, the internal name
does surface to the user and needs a display mapping. Confirm before phase 2.
