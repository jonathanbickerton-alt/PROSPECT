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
  /** Tariff hierarchy level 1 (e.g. 'RED L'). 'All' or absent = no tariff filter. (Phase 2a) */
  tariffL1?: string;
  /** Tariff hierarchy level 2 (e.g. 'SIM-only'). 'All' or absent = no L2 filter. (Phase 2a) */
  tariffL2?: string;
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
 * An ARPU band, whose interval may be ABSENT.
 *
 * A DERIVED aggregate has a real mean - volume-weighted revenue over volume -
 * and no honest interval: combining the intervals of independently-fitted leaf
 * ARPU series does not produce a valid interval for their volume-weighted
 * blend. Absence says that; a zero-width band does not.
 *
 * The distinction is not cosmetic. The band-position penalty
 * (ForecastVsActualsTab, calcComponentDetail) reads `actual >= pess && actual
 * <= opt`, so a zero-width band is in-band only when the actual EXACTLY equals
 * the mean - never, in floating point. Representing 'no interval' as a
 * zero-width one therefore turns an honest refusal into a systematic 5-10
 * point penalty on every derived aggregate.
 *
 * Follows the recorded revenue precedent: the revenue band is SUPPRESSED
 * rather than approximated, because the product of two independently-derived
 * intervals is not a valid interval, and a band users read as a tolerance
 * should not be drawn if it isn't one.
 */
export interface ArpuBand {
  mean: number;
  optimistic?: number;
  pessimistic?: number;
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
  arpu: ArpuBand;
  /** Per-IBRO-scenario ARPU forecast bands — only present on forecasts generated after this schema version */
  inflowArpu?: ArpuBand;
  outflowArpu?: ArpuBand;
  retentionArpu?: ArpuBand;
  baseArpu?: ArpuBand;
}

/**
 * Why a cohort has no forecast.
 *
 * ONE shared vocabulary, defined once. Phase 0 uses it for the bulk run's
 * skipped list; Phase 2 will use the SAME codes for resolveForecast's
 * null-reason. Two vocabularies for one concept is a pattern this codebase has
 * recorded three separate instances of — do not add a second set.
 *
 * These are INTERNAL codes. They are never rendered directly: the UI maps them
 * to i18n keys (`skip_reason_never_enumerated`, `skip_reason_insufficient_history`).
 *
 *   never-enumerated      — no data rows exist for this key at all. Enumeration
 *                           is built from distinct tuples present in the data,
 *                           so a key with no rows was never enumerated from it;
 *                           whoever asked for it invented the key.
 *   insufficient-history  — rows exist, but too few months survive the
 *                           nonzero-flow filter for a model to be fitted
 *                           (calculateBaseForecast returns null below four).
 */
export type SkipReason = 'never-enumerated' | 'insufficient-history';

/**
 * Internal skip codes -> i18n keys. The codes are never rendered directly, and
 * this is the ONLY place they become words, so a new code cannot ship as a
 * hardcoded English string by accident.
 *
 * Lives here rather than in a component because it now has two consumers -
 * BulkGenerateModal's skip panel and Step 2's no-forecast-for-this-selection
 * state. A second copy would be the two-vocabularies-for-one-concept pattern
 * this file's own comment warns about three instances of.
 */
export const SKIP_REASON_KEY: Record<SkipReason, string> = {
  'never-enumerated':     'skip_reason_never_enumerated',
  'insufficient-history': 'skip_reason_insufficient_history',
};

/**
 * A cohort that was asked for and produced no forecast.
 *
 * NAMED, not counted. A count tells a user how many cohorts are missing from an
 * aggregate; only the fKey tells them which, and that is the difference between
 * a warning they can act on and one they cannot.
 */
export interface SkippedCohort {
  fKey: string;
  reason: SkipReason;
}

/** Per-series smoothing parameters chosen by grid search at fit time. */
export interface FittedParamsBundle {
  inflow: FittedParams;
  outflow: FittedParams;
  retention: FittedParams;
  arpu: FittedParams;
  inflowArpu?: FittedParams;
  outflowArpu?: FittedParams;
  retentionArpu?: FittedParams;
  baseArpu?: FittedParams;
}

/**
 * How a BaseForecast came to exist.
 *
 *   fitted   — a model was fitted to this cohort's own history.
 *   accepted — a fitted forecast adopted from the AutoML challenger, carrying
 *              what it replaced and when. Recorded because the store previously
 *              kept NO marker distinguishing an accepted forecast from a
 *              bulk-generated one, and modelAcceptanceLog's 3-part cohortKey was
 *              too coarse to name which 7-part cohorts were affected. Cheap to
 *              record now, impossible retroactively.
 *   derived   — summed from constituent leaves. Has NO single model and NO
 *              fitted parameters, and says so by not carrying the fields.
 *
 * `models` on the derived arm is a histogram of the leaves' models, so the UI
 * can describe the mix instead of naming one.
 */
export type Provenance =
  | { kind: 'fitted';   modelUsed: ForecastModel; fittedParams?: FittedParamsBundle }
  | { kind: 'accepted'; modelUsed: ForecastModel; fittedParams?: FittedParamsBundle;
      replacedModel: ForecastModel; acceptedAt: string }
  | { kind: 'derived';  leafCount: number;
      models: Partial<Record<ForecastModel, number>>;
      coverage: { inScope: number; withForecast: number; skipped: SkippedCohort[] } };

/**
 * The model behind a forecast, or null when there is not one.
 *
 * THE narrowing point. Every consumer that used to read `bf.modelUsed` calls
 * this and must handle `null` — which is exactly the derived case, and exactly
 * the case that used to be answered with a borrowed model name. Returning
 * `null` rather than a default is the whole design: a default would reinstate
 * the fiction the union exists to remove.
 */
export function provenanceModel(p: Provenance): ForecastModel | null {
  return p.kind === 'derived' ? null : p.modelUsed;
}

/** Fitted parameters, or null for a derived aggregate (which has none). */
export function provenanceParams(p: Provenance): FittedParamsBundle | null {
  return p.kind === 'derived' ? null : (p.fittedParams ?? null);
}

/**
 * The full Holt-Winters forecast for a single cohort across all forecast months.
 * Historical months that seeded the model are stored separately for reference.
 */
/**
 * The app's top-level views, and the per-dimension filter/compare toggle.
 *
 * Declared here rather than inline in App so the child prop types can name the
 * same union. They were previously `(v: string) => void` in five components,
 * which a `Dispatch<SetStateAction<union>>` is not assignable to — invisible
 * while React.FC was `any`, and six errors the moment @types/react landed.
 */
export type ActiveView = 'home' | 'standard' | 'whatif' | 'overall' | 'vsactuals' | 'compare';
export type DimMode = 'filter' | 'compare';

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
  /**
   * How this forecast came to exist. Replaces the former top-level
   * `modelUsed` and `fittedParams`, which a DERIVED aggregate cannot
   * honestly supply: it has no single model and no single set of fitted
   * parameters. Reading either off an aggregate produced a number that
   * looked like a fact about the aggregate and was a fact about one leaf.
   *
   * Moving them INTO the union is the point. Leaving them at the top level
   * alongside a discriminant would let every existing site keep compiling
   * while silently reading a fiction.
   */
  provenance: Provenance;
  /**
   * Per-series smoothing parameters chosen by grid search at fit time.
   * Optional so that forecasts produced before this field was introduced
   * (e.g. imported from older save files) remain valid.
   */
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
  /** Tariff L1 — 'All' or absent = no tariff filter (Phase 2b targeting) */
  tariffL1?: string;
  /** Tariff L2 — 'All' or absent = no L2 filter (Phase 2b targeting) */
  tariffL2?: string;
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
  /**
   * Which axis the mix is distributed across (Phase 2b). 'value' (default) =
   * Product L2 tiers; 'tariff' = the user's selected tariffs. Independent axes,
   * never a matrix. Absent = 'value' for backward compatibility.
   */
  mixAxis?: 'value' | 'tariff';
  /** bucket label → mix % (0–100). Must sum to 100. Buckets are Product L2 tiers
   *  when mixAxis='value', or tariff L1 values when mixAxis='tariff'. */
  tariffMix: Record<string, number>;
  /** bucket label → base ARPU derived from data when the event was added */
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
  /** The uplifted values BEFORE the zero floor. Equal to `uplifted` unless an
   *  event drove a metric negative — which is what makes a floor breach
   *  reportable rather than silently clipped. */
  preFloor?: {
    inflow: number;
    retention: number;
    outflow: number;
    arpu: number;
  };
  /** Per-event derivation for percentage events applied this month, emitted
   *  by the engine so the provenance row shows the arithmetic that ran. */
  derivations?: Array<{
    eventId: string;
    metric: 'inflow' | 'outflow' | 'retention';
    basisKind: 'baseline' | 'adjusted';
    basis: number;
    percent: number;
    coverage: number;
    delta: number;
  }>;
  /** Metrics the floor caught this month, empty when none did. */
  flooredMetrics?: Array<'inflow' | 'outflow' | 'retention' | 'arpu'>;
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
