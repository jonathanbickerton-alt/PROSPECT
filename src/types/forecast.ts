/**
 * Forecasting model used to produce a BaseForecast.
 * Holt Linear: Holt's double exponential smoothing — level + trend, no seasonality.
 * Damped Trend: Holt Linear with trend damped toward flat — phi optimised per series.
 * Holt-Winters: triple exponential smoothing with multiplicative seasonality — α, β, γ
 *   optimised per series; requires ≥ 24 months (two full seasonal cycles).
 * Simple Exponential Smoothing: level smoothing — α optimised per series.
 */
export type ForecastModel = 'Holt Linear' | 'Damped Trend' | 'Holt-Winters' | 'Simple Exponential Smoothing';

/**
 * Smoothing parameters chosen by per-series MSE grid search.
 * Stored alongside BaseForecast so the UI can display what the optimiser selected.
 */
export interface FittedParams {
  /** Level smoothing weight — from ALPHA_GRID [0.1 … 0.9] */
  alpha: number;
  /** Trend smoothing weight — from BETA_GRID [0.05 … 0.5] */
  beta: number;
  /** Damping factor — only present for Damped Trend, from PHI_GRID [0.80 … 0.98] */
  phi?: number;
  /** Seasonal smoothing weight — only present for Holt-Winters, from GAMMA_GRID [0.05 … 0.5] */
  gamma?: number;
  /** In-sample one-step-ahead MSE at the winning parameter combination */
  mse: number;
  /**
   * For Holt Linear and Damped Trend: absolute residual standard deviation (σ) in original
   * series units — used as the base width for additive confidence bands: band = z × σ × √h.
   * For Holt-Winters: relative residual standard deviation (σ_rel = std dev of
   * (actual − fitted) / fitted) — used for proportional bands: band = z × σ_rel × |mean| × √h.
   */
  sigma: number;
}

/**
 * Audit record for a single bulk generation run.
 * Stored in ForecastContext so any tab can read the run history.
 */
export interface BulkRunRecord {
  id: string;
  /** Display name — defaults to 'Bulk Run — [timestamp]' when left blank */
  name: string;
  /** Optional free-text comment saved with the run */
  comment: string;
  /** ISO-8601 timestamp of when the run was executed */
  timestamp: string;
  settings: {
    model: ForecastModel;
    preHorizonUncertainty: number;
    postHorizonExpansionRate: number;
    confidenceHorizon: number;
    forecastLength: number;
  };
  /** IDs of the cohorts that were written by this run (matches savedForecasts keys) */
  cohortIds: string[];
  generated: number;
  failed: number;
}

/**
 * Cohort dimensions that identify a unique forecast series.
 *
 * L2 fields are optional so that cohorts generated before this field was
 * introduced (e.g. imported from older save files) remain valid.
 * When absent, 'All' is assumed (no L2 filter applied).
 */
export interface CohortKey {
  segment: string;
  /** Product hierarchy level 1 (e.g. 'Mobile Data'). 'All' = no filter. */
  product: string;
  /** Product hierarchy level 2 (e.g. 'High Value'). 'All' or absent = no L2 filter. */
  productL2?: string;
  /** Channel hierarchy level 1 (e.g. 'Direct'). 'All' = no filter. */
  channel: string;
  /** Channel hierarchy level 2 (e.g. 'Dealer'). 'All' or absent = no L2 filter. */
  channelL2?: string;
  scenario: string; // e.g. "Base", "Optimistic", "Pessimistic" — IBRO_Scenario_Type
}

/**
 * A single Holt-Winters forecast band for one metric and one month.
 * Mean is the point forecast; optimistic/pessimistic are the confidence bands.
 */
export interface ForecastBand {
  mean: number;
  optimistic: number;
  pessimistic: number;
}

/**
 * Holt-Winters output for a single month within one cohort.
 * Base volume is NOT stored here — it is always derived as:
 *   base(t) = base(t-1) + inflow(t) - outflow(t)
 */
export interface BaseForecastMonth {
  /** Calendar month in yyyy-MM format */
  month: string;
  inflow: ForecastBand;
  retention: ForecastBand;
  outflow: ForecastBand;
  /** Revenue per subscriber unit for this month's forecast (blended across all 4 IBRO scenarios) */
  arpu: ForecastBand;
  /** Per-IBRO-scenario ARPU forecast bands — only present on forecasts generated after this schema version */
  inflowArpu?: ForecastBand;
  outflowArpu?: ForecastBand;
  retentionArpu?: ForecastBand;
  baseArpu?: ForecastBand;
}

/**
 * The full Holt-Winters forecast for a single cohort across all forecast months.
 * Historical months that seeded the model are stored separately for reference.
 */
export interface BaseForecast {
  cohort: CohortKey;
  /** The last known actual base volume — used as the seed for derived base stock */
  seedBaseVolume: number;
  /** Months of historical actuals used to fit the model (yyyy-MM) */
  historicalMonths: string[];
  /** Ordered forecast months produced by the model */
  months: BaseForecastMonth[];
  /**
   * Actual inflow for the final historical month.
   * Needed to seed the lagged base derivation:
   *   Base[t] = Base[t-1] + Inflow[t-1] - Outflow[t-1]
   * so the first forecast month uses this value as Inflow[t-1].
   */
  lastHistoricalInflow: number;
  /** Actual outflow for the final historical month — counterpart to lastHistoricalInflow */
  lastHistoricalOutflow: number;
  /** The model used to generate this baseline forecast */
  modelUsed: ForecastModel;
  /**
   * Per-series smoothing parameters chosen by grid search at fit time.
   * Optional so that forecasts produced before this field was introduced
   * (e.g. imported from older save files) remain valid.
   */
  fittedParams?: {
    inflow: FittedParams;
    outflow: FittedParams;
    retention: FittedParams;
    arpu: FittedParams;
    inflowArpu?: FittedParams;
    outflowArpu?: FittedParams;
    retentionArpu?: FittedParams;
    baseArpu?: FittedParams;
  };
  /**
   * True when Holt-Winters was requested but at least one series had fewer
   * than 24 historical data points (two full seasonal cycles).  The affected
   * series fell back to Holt Linear automatically.  The UI surfaces a warning
   * so the user knows the seasonal model was not used as selected.
   */
  seasonalFallback?: boolean;
  /** Confidence params actually used to generate this forecast (may differ from UI sliders when auto-confidence is active). */
  preHorizonUncertaintyUsed?: number;
  postHorizonExpansionRateUsed?: number;
  confidenceHorizonUsed?: number;
  /**
   * Calendar months (yyyy-MM) that are absent from the historical series but
   * fall between the first and last observed month.  Non-empty only when the
   * input data has gaps.  The model still runs but the UI surfaces a warning
   * because missing months can bias level and trend initialisation.
   */
  missingMonths?: string[];
}

// ---------------------------------------------------------------------------
// Stage 2 — Pricing Events (ARPU delta overrides)
// ---------------------------------------------------------------------------

/**
 * A user-defined pricing event that applies an ARPU delta (percentage or
 * absolute) to a cohort slice for one or more months.
 *
 * Dimension filters: segment, product (L1), productL2, channelL1, channelL2.
 * 'All' means no filter on that dimension.
 *
 * Order of operations: Yield Events (Pass 2) → Pricing Events (Pass 3).
 *
 * For one-off events, originalBaseArpu stores the pre-event blended ARPU
 * captured at creation time — used for display in the results table.
 */
export interface PricingEvent {
  id: string;
  segment: string;
  /** Product L1 */
  product: string;
  /** Product L2 (tariff tier) — 'All' = no L2 filter */
  productL2: string;
  channelL1: string;
  channelL2: string;
  /** First affected month (yyyy-MM) */
  month: string;
  /** Whether amount is a % change or an absolute € delta */
  inputMode: 'percentage' | 'absolute';
  /** Positive = price rise, negative = discount/promotion */
  amount: number;
  /** 'cohorts' = new inflow/retention only; 'cohorts+base' = all subscribers; 'base-only' = existing base pool only */
  target: 'cohorts' | 'cohorts+base' | 'base-only';
  /** When target involves cohorts: which cohort type is affected. Ignored for 'base-only'. */
  cohortScope: 'inflow' | 'retention' | 'both';
  /** 'one-off' = reverts next month; 'recurring' = persists from month onwards */
  duration: 'one-off' | 'recurring';
  /**
   * Pre-event blended ARPU snapshot taken at event-creation time.
   * Used in the results table to show baseline vs adjusted ARPU.
   */
  originalBaseArpu: number;
  name?: string;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Stage 2 — Yield Events (Tariff Mix overrides)
// ---------------------------------------------------------------------------

/**
 * A user-defined yield event that overrides the Product L2 (tariff tier) mix
 * for a specific Inflow or Retention cohort, driving a new blended ARPU.
 *
 * Cohort grain: ibro + segment + product (L1) + channelL1 + channelL2
 * Product L2 is NOT a filter dimension — it is the dimension being redistributed.
 *
 * tariffMix:     productL2 → percentage (0–100); values must sum to 100
 * tariffBaseArpu: productL2 → base ARPU derived from data at event-creation time
 *
 * blendedArpu = Σ (tariffMix[t] / 100 × tariffBaseArpu[t])
 */
export interface YieldEvent {
  id: string;
  /** IBRO type this event targets */
  ibro: 'Inflow' | 'Retention';
  segment: string;
  /** Product L1 */
  product: string;
  /** Channel L1 */
  channelL1: string;
  /** Channel L2 — 'All' means apply across all L2 within the L1 */
  channelL2: string;
  /** Activity month in yyyy-MM format */
  month: string;
  /** productL2 label → mix % (0–100). Must sum to 100. */
  tariffMix: Record<string, number>;
  /** productL2 label → base ARPU derived from data when the event was added */
  tariffBaseArpu: Record<string, number>;
  /**
   * When false: applies to this cohort's inflow/retention for `month` only.
   * When true:  rolls the mix forward to all subsequent months' inflow/retention
   *             for this cohort (segment + product + channelL1 + channelL2 + ibro).
   */
  rollForward: boolean;
  name?: string;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Stage 2 — Market-event adjusted forecast
// ---------------------------------------------------------------------------

export type MarketEventType = 'Inflow' | 'Retention' | 'Outflow';

/**
 * The IBRO metrics for a single month after market events have been applied.
 * Base is still not stored — callers derive it from the running stock.
 */
export interface AdjustedForecastMonth {
  month: string;
  /** The baseline Holt-Winters values before any event adjustment */
  baseline: {
    inflow: number;
    retention: number;
    outflow: number;
    arpu: number;
  };
  /** The uplifted values after applying all applicable market events */
  uplifted: {
    inflow: number;
    retention: number;
    outflow: number;
    arpu: number;
  };
  /** IDs of market events that contributed to the uplift for this month */
  appliedEventIds: string[];
}

/**
 * A BaseForecast extended with market events and the resulting adjusted IBRO series.
 */
export interface MarketEventAdjustedForecast {
  base: BaseForecast;
  marketEvents: unknown[];
  /** Adjusted monthly series — same length and order as base.months */
  adjustedMonths: AdjustedForecastMonth[];
}

// ---------------------------------------------------------------------------
// Stage 3 — Actuals comparison
// ---------------------------------------------------------------------------

/**
 * Actual IBRO values for a single month, sourced from the imported dataset.
 * All fields are optional because actuals may be partially available (e.g.
 * the current month is incomplete or future months have no actuals yet).
 */
export interface ActualMonth {
  month: string;
  inflow?: number;
  retention?: number;
  outflow?: number;
  arpu?: number;
  /** Derived from actuals: prev_actual_base + inflow - outflow */
  derivedBase?: number;
  revenue?: number;
}

/**
 * Variance metrics for a single IBRO field in a single month.
 */
export interface VarianceMetrics {
  /** Actual minus forecast (positive = above forecast) */
  absoluteVariance: number;
  /** Percentage variance relative to forecast value */
  percentageVariance: number;
  /** Whether the actual falls within the optimistic/pessimistic confidence band */
  withinConfidenceBand: boolean;
}

/**
 * The full comparison for one month: actuals alongside the adjusted forecast,
 * with computed variance metrics for each IBRO flow.
 */
export interface ComparisonMonth {
  month: string;
  actuals: ActualMonth | null; // null if no actuals exist for this month
  forecast: AdjustedForecastMonth;
  variance: {
    inflow: VarianceMetrics | null;
    retention: VarianceMetrics | null;
    outflow: VarianceMetrics | null;
    arpu: VarianceMetrics | null;
  } | null; // null when actuals are missing
}

/**
 * Accuracy summary across all months that have both actuals and a forecast.
 */
export interface AccuracySummary {
  /** Mean Absolute Percentage Error across all months with actuals */
  mape: {
    inflow: number | null;
    retention: number | null;
    outflow: number | null;
    arpu: number | null;
  };
  /** Number of months used to compute MAPE */
  monthsWithActuals: number;
  /** Total months in the comparison window (actuals + forecast-only) */
  totalMonths: number;
}

/**
 * Full actuals-vs-forecast comparison for a single cohort.
 * Partial actuals are supported: months without actuals still appear in
 * comparisonMonths with actuals = null and variance = null.
 */
export interface ActualsComparison {
  cohort: CohortKey;
  adjustedForecast: MarketEventAdjustedForecast;
  comparisonMonths: ComparisonMonth[];
  accuracy: AccuracySummary;
}
