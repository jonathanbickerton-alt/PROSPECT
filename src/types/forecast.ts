/**
 * Forecasting model used to produce a BaseForecast.
 * Holt Linear: Holt's double exponential smoothing — level + trend, no seasonality.
 * Damped Trend: Holt Linear with trend damped toward flat — phi optimised per series.
 * Holt-Winters: triple exponential smoothing with multiplicative seasonality — α, β, γ
 *   optimised per series; requires ≥ 24 months (two full seasonal cycles).
 */
export type ForecastModel = 'Holt Linear' | 'Damped Trend' | 'Holt-Winters';

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
 */
export interface CohortKey {
  segment: string;
  product: string;
  channel: string;
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
  /** Revenue per subscriber unit for this month's forecast */
  arpu: ForecastBand;
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
  };
  /**
   * True when Holt-Winters was requested but at least one series had fewer
   * than 24 historical data points (two full seasonal cycles).  The affected
   * series fell back to Holt Linear automatically.  The UI surfaces a warning
   * so the user knows the seasonal model was not used as selected.
   */
  seasonalFallback?: boolean;
  /**
   * Calendar months (yyyy-MM) that are absent from the historical series but
   * fall between the first and last observed month.  Non-empty only when the
   * input data has gaps.  The model still runs but the UI surfaces a warning
   * because missing months can bias level and trend initialisation.
   */
  missingMonths?: string[];
}

// ---------------------------------------------------------------------------
// Stage 2 — Market-event adjusted forecast
// ---------------------------------------------------------------------------

export type MarketEventType = 'Inflow' | 'Retention' | 'Outflow';

/**
 * A single user-defined market event that modifies one IBRO flow metric.
 * The event is scoped to a cohort dimension subset and spans durationMonths
 * consecutive months starting from startMonth.
 *
 * volumeImpact: absolute subscriber/customer count change per month
 * arpuImpact:   absolute £/$ ARPU change per month (for revenue-bearing events)
 */
export interface MarketEvent {
  id: string;
  eventType: MarketEventType;
  /** Dimensions the event applies to — empty string means "all" for that dimension */
  segment: string;
  product: string;
  channel: string;
  /** First affected month in yyyy-MM format */
  startMonth: string;
  /** Number of consecutive months the event is active (≥ 1) */
  durationMonths: number;
  /** Absolute change in subscriber/customer volume per month (can be negative) */
  volumeImpact: number;
  /** Absolute change in ARPU per month (can be negative, 0 if not applicable) */
  arpuImpact: number;
  /** Optional free-text description */
  comment?: string;
}

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
  marketEvents: MarketEvent[];
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
