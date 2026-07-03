import { addMonths, format, isValid } from 'date-fns';
import type { BaseForecast, BaseForecastMonth, CohortKey, ForecastBand, ForecastModel, FittedParams } from '../types/forecast';

export interface MarketEvent {
  id: string;
  scenario: 'Inflow' | 'Retention' | 'Outflow' | 'ARPU';
  segment: string;
  product: string;
  /** L2 product sub-category — 'All' or absent means apply to all L2 within the L1 product */
  productL2?: string;
  channel: string;
  /** L2 channel sub-category — 'All' or absent means apply to all L2 within the L1 channel */
  channelL2?: string;
  date: string; // yyyy-MM
  subscriberVolume: number;
  customerVolume: number;
  revenue: number;
  arpu: number;
  name?: string;
  /** Campaign name groups multiple events into one named campaign — empty string = uncategorised */
  campaignName: string;
  comment: string;
  /** Months of churn protection for inflow-event subscribers before they enter the at-risk pool. Default 24. */
  contractLength: number;
}

// ---------------------------------------------------------------------------
// Private HW helpers
// ---------------------------------------------------------------------------

interface HWModel {
  L: number;
  T: number;
}

// ---------------------------------------------------------------------------
// Grid search parameter ranges
// ---------------------------------------------------------------------------

const ALPHA_GRID = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] as const;
const BETA_GRID  = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5] as const;
/** Only used for Damped Trend */
const PHI_GRID   = [0.80, 0.85, 0.88, 0.90, 0.92, 0.95, 0.98] as const;
/** Only used for Holt-Winters triple exponential smoothing */
const GAMMA_GRID = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5] as const;

// ---------------------------------------------------------------------------
// Robust level / trend initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise the HW level (L) and trend (T) using a window of the first
 * w = min(6, n) observations rather than just y[0] and y[1]−y[0].
 *
 * L = mean of the window.
 * T = OLS slope over x = 0 … w−1 (least-squares best-fit line through the window).
 *
 * This substantially reduces sensitivity to outliers in the first one or two
 * months of a cohort's history.
 */
function initLT(y: number[]): { L: number; T: number } {
  const w = Math.min(6, y.length);
  const slice = y.slice(0, w);
  const L = slice.reduce((a, b) => a + b, 0) / w;
  const xBar = (w - 1) / 2;
  let num = 0, den = 0;
  for (let i = 0; i < w; i++) {
    const dx = i - xBar;
    num += dx * (slice[i] - L);
    den += dx * dx;
  }
  const T = den > 0 ? num / den : (w >= 2 ? slice[w - 1] - slice[0] : 0);
  return { L, T };
}

// ---------------------------------------------------------------------------
// Parameterised fit functions (accept explicit α / β / φ)
// ---------------------------------------------------------------------------

function fitHoltWintersParams(y: number[], alpha: number, beta: number): HWModel {
  let { L, T } = initLT(y);
  for (let i = 1; i < y.length; i++) {
    const prevL = L;
    L = alpha * y[i] + (1 - alpha) * (L + T);
    T = beta * (L - prevL) + (1 - beta) * T;
  }
  return { L, T };
}

function fitDampedTrendParams(y: number[], alpha: number, beta: number, phi: number): HWModel {
  let { L, T } = initLT(y);
  for (let i = 1; i < y.length; i++) {
    const prevL = L;
    L = alpha * y[i] + (1 - alpha) * (L + phi * T);
    T = beta * (L - prevL) + (1 - beta) * phi * T;
  }
  return { L, T };
}

// ---------------------------------------------------------------------------
// In-sample residual helpers (one-step-ahead fitted values → MSE and σ)
// ---------------------------------------------------------------------------

/**
 * Runs the HW recursion and returns { mse, sigma } in one pass.
 * One-step-ahead fitted value at step i is L_{i-1} + T_{i-1}.
 * Returns Infinity values when any observation is non-finite.
 * Every parameter combination is evaluated over the full series — no early stopping.
 */
function hwResiduals(
  y: number[],
  alpha: number,
  beta: number,
): { mse: number; sigma: number } {
  let { L, T } = initLT(y);
  let sse = 0;
  const n = y.length - 1;
  for (let i = 1; i < y.length; i++) {
    const fitted = L + T;
    const err = y[i] - fitted;
    if (!isFinite(err)) return { mse: Infinity, sigma: Infinity };
    sse += err * err;
    const prevL = L;
    L = alpha * y[i] + (1 - alpha) * (L + T);
    T = beta * (L - prevL) + (1 - beta) * T;
  }
  const mse = sse / n;
  return { mse, sigma: Math.sqrt(mse) };
}

/**
 * Runs the Damped Trend recursion and returns { mse, sigma }.
 * One-step-ahead fitted value at step i is L_{i-1} + φ·T_{i-1}.
 * Every parameter combination is evaluated over the full series — no early stopping.
 */
function dtResiduals(
  y: number[],
  alpha: number,
  beta: number,
  phi: number,
): { mse: number; sigma: number } {
  let { L, T } = initLT(y);
  let sse = 0;
  const n = y.length - 1;
  for (let i = 1; i < y.length; i++) {
    const fitted = L + phi * T;
    const err = y[i] - fitted;
    if (!isFinite(err)) return { mse: Infinity, sigma: Infinity };
    sse += err * err;
    const prevL = L;
    L = alpha * y[i] + (1 - alpha) * (L + phi * T);
    T = beta * (L - prevL) + (1 - beta) * phi * T;
  }
  const mse = sse / n;
  return { mse, sigma: Math.sqrt(mse) };
}

function fitSESParams(y: number[], alpha: number): { L: number } {
  const w = Math.min(6, y.length);
  const slice = y.slice(0, w);
  let L = slice.reduce((a, b) => a + b, 0) / w;
  for (let i = 1; i < y.length; i++) {
    L = alpha * y[i] + (1 - alpha) * L;
  }
  return { L };
}

function sesResiduals(
  y: number[],
  alpha: number,
): { mse: number; sigma: number } {
  const w = Math.min(6, y.length);
  const slice = y.slice(0, w);
  let L = slice.reduce((a, b) => a + b, 0) / w;
  let sse = 0;
  const n = y.length - 1;
  for (let i = 1; i < y.length; i++) {
    const fitted = L;
    const err = y[i] - fitted;
    if (!isFinite(err)) return { mse: Infinity, sigma: Infinity };
    sse += err * err;
    L = alpha * y[i] + (1 - alpha) * L;
  }
  const mse = sse / n;
  return { mse, sigma: Math.sqrt(mse) };
}

// ---------------------------------------------------------------------------
// Grid search optimisers — return the winning FittedParams
// ---------------------------------------------------------------------------

function optimiseHW(y: number[]): FittedParams {
  let bestMse = Infinity;
  let best: FittedParams = { alpha: 0.3, beta: 0.1, mse: Infinity, sigma: Infinity };
  for (const alpha of ALPHA_GRID) {
    for (const beta of BETA_GRID) {
      const { mse, sigma } = hwResiduals(y, alpha, beta);
      if (mse < bestMse) { bestMse = mse; best = { alpha, beta, mse, sigma }; }
    }
  }
  return best;
}

function optimiseDampedTrend(y: number[]): FittedParams {
  let bestMse = Infinity;
  let best: FittedParams = { alpha: 0.3, beta: 0.1, phi: 0.85, mse: Infinity, sigma: Infinity };
  for (const alpha of ALPHA_GRID) {
    for (const beta of BETA_GRID) {
      for (const phi of PHI_GRID) {
        const { mse, sigma } = dtResiduals(y, alpha, beta, phi);
        if (mse < bestMse) { bestMse = mse; best = { alpha, beta, phi, mse, sigma }; }
      }
    }
  }
  return best;
}

function optimiseSES(y: number[]): FittedParams {
  let bestMse = Infinity;
  let best: FittedParams = { alpha: 0.3, beta: 0, mse: Infinity, sigma: Infinity };
  for (const alpha of ALPHA_GRID) {
    const { mse, sigma } = sesResiduals(y, alpha);
    if (mse < bestMse) {
      bestMse = mse;
      best = { alpha, beta: 0, mse, sigma };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Holt-Winters Triple Exponential Smoothing (multiplicative seasonal)
// ---------------------------------------------------------------------------

/**
 * Initialise L, T and the seasonal index array S[0..11] from the first
 * 12 observations (one full seasonal cycle).
 *
 * L and T come from initLT on the first-cycle window.
 * S[slot] = y[k] / (L + k·T)  — ratio of each observation to its detrended
 * level estimate — then normalised so mean(S) = 1.
 */
function initHWTriple(y: number[], calStartMonth: number): { L: number; T: number; S: number[] } {
  const m = 12;
  const initY = y.slice(0, m);
  const { L, T } = initLT(initY);
  const S = new Array(m).fill(1.0);
  for (let k = 0; k < m; k++) {
    const slot = (calStartMonth + k) % m;
    const trendAdj = L + k * T;
    S[slot] = trendAdj > 0 ? initY[k] / trendAdj : 1.0;
  }
  const meanS = S.reduce((a, b) => a + b, 0) / m;
  if (meanS > 0) for (let k = 0; k < m; k++) S[k] /= meanS;
  return { L, T, S };
}

/**
 * Run the multiplicative HW triple recursion and return both the in-sample
 * absolute MSE (used as the grid-search objective) and σ_relative (used for
 * proportional confidence bands).
 *
 * Recursion starts at i = 12 (first post-initialisation observation).
 * One-step-ahead fitted value at step i: (L + T) × S[slotPrev].
 * Every parameter combination is evaluated over the full post-init series — no early stopping.
 */
function hwTripleResiduals(
  y: number[],
  alpha: number,
  beta: number,
  gamma: number,
  calStartMonth: number,
): { mse: number; sigmaRelative: number } {
  const m = 12;
  const n = y.length - m;
  if (n <= 0) return { mse: Infinity, sigmaRelative: Infinity };

  const { L: initL, T: initT, S: initS } = initHWTriple(y, calStartMonth);
  let L = initL, T = initT;
  const S = [...initS];

  let sse = 0;
  const relErrors: number[] = [];

  for (let i = m; i < y.length; i++) {
    const slotPrev = (calStartMonth + i - m) % m;
    const slotCurr = (calStartMonth + i) % m;
    const fitted = (L + T) * S[slotPrev];
    if (!isFinite(fitted) || fitted === 0) return { mse: Infinity, sigmaRelative: Infinity };
    const err = y[i] - fitted;
    if (!isFinite(err)) return { mse: Infinity, sigmaRelative: Infinity };
    sse += err * err;
    relErrors.push(err / fitted);
    const prevL = L;
    L = alpha * (y[i] / S[slotPrev]) + (1 - alpha) * (L + T);
    T = beta * (L - prevL) + (1 - beta) * T;
    S[slotCurr] = gamma * (y[i] / L) + (1 - gamma) * S[slotPrev];
  }

  const mse = sse / n;
  const meanRel = relErrors.reduce((a, b) => a + b, 0) / n;
  const varRel = relErrors.reduce((a, b) => a + (b - meanRel) ** 2, 0) / n;
  return { mse, sigmaRelative: Math.sqrt(varRel) };
}

/**
 * Full multiplicative HW triple fit — returns final L, T and the seasonal
 * index array S after processing all observations beyond the first cycle.
 */
function fitHWTripleParams(
  y: number[],
  alpha: number,
  beta: number,
  gamma: number,
  calStartMonth: number,
): { L: number; T: number; S: number[] } {
  const m = 12;
  const { L: initL, T: initT, S: initS } = initHWTriple(y, calStartMonth);
  let L = initL, T = initT;
  const S = [...initS];
  for (let i = m; i < y.length; i++) {
    const slotPrev = (calStartMonth + i - m) % m;
    const slotCurr = (calStartMonth + i) % m;
    const prevL = L;
    L = alpha * (y[i] / S[slotPrev]) + (1 - alpha) * (L + T);
    T = beta * (L - prevL) + (1 - beta) * T;
    S[slotCurr] = gamma * (y[i] / L) + (1 - gamma) * S[slotPrev];
  }
  return { L, T, S };
}

/** Grid search over α × β × γ for Holt-Winters triple, minimising in-sample MSE. */
function optimiseHWTriple(y: number[], calStartMonth: number): FittedParams {
  let bestMse = Infinity;
  let best: FittedParams = { alpha: 0.3, beta: 0.1, gamma: 0.1, mse: Infinity, sigma: Infinity };
  for (const alpha of ALPHA_GRID) {
    for (const beta of BETA_GRID) {
      for (const gamma of GAMMA_GRID) {
        const { mse, sigmaRelative } = hwTripleResiduals(y, alpha, beta, gamma, calStartMonth);
        if (mse < bestMse) { bestMse = mse; best = { alpha, beta, gamma, mse, sigma: sigmaRelative }; }
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Public-compatible fitHoltWinters wrapper (used by legacy calculateHoltWinters)
// — runs the optimiser then fits with winning params
// ---------------------------------------------------------------------------

/**
 * Fit Holt's linear model with optimised α/β.
 * Returns null when the series is too short (< 4 points).
 */
function fitHoltWinters(y: number[]): HWModel | null {
  if (y.length < 4) return null;
  const { alpha, beta } = optimiseHW(y);
  return fitHoltWintersParams(y, alpha, beta);
}

/**
 * Build forecast bands using residual standard deviation (σ) from the fitted model.
 *
 * Band formula — two-phase statistical interval:
 *   Within confidenceHorizon (t ≤ h₀):
 *     half-width = preHorizonZ × σ × √t
 *   Beyond confidenceHorizon (t > h₀):
 *     half-width = 1.96 × postHorizonExpansionRate × σ × √t
 *
 * where:
 *   σ             = residual std dev from in-sample one-step-ahead errors
 *   preHorizonZ   = user-controlled z-score for the near-term interval (e.g. 1.0 = 1σ ≈ 68%)
 *   1.96          = z for 95% interval applied beyond the horizon
 *   postHorizonExpansionRate = multiplier on top of 1.96σ (1.0 = no extra expansion)
 *   √t            = uncertainty growth proportional to forecast horizon
 *
 * sigmaScale can be set to < 1 for metrics that are naturally more stable (e.g. ARPU).
 */
function buildBands(
  getMean: (t: number) => number,
  months: number,
  sigma: number,
  confidenceHorizon: number,
  postHorizonExpansionRate: number,
  preHorizonZ: number,
  sigmaScale = 1,
): ForecastBand[] {
  const s = sigma * sigmaScale;
  // Pre-horizon: FLAT (no sqrt(t) growth). Width = preHorizonZ × σ, controlled by the
  // user z-score slider so the near-term band is tight and consistent.
  const preHalfWidth = preHorizonZ * s;
  // Post-horizon grows from the pre-horizon endpoint — anchored formula guarantees
  // exact continuity at t = confidenceHorizon + 1 with no visible jump.
  // Growth after the horizon: +1.96 × postRate × σ × (√t − √(horizon+1)).
  const sqrtBoundary = Math.sqrt(confidenceHorizon + 1);
  const bands: ForecastBand[] = [];
  for (let t = 1; t <= months; t++) {
    const mean = getMean(t);
    const halfWidth =
      t <= confidenceHorizon
        ? preHalfWidth
        : preHalfWidth + 1.96 * postHorizonExpansionRate * s * (Math.sqrt(t) - sqrtBoundary);
    bands.push({
      mean: Number(mean.toFixed(2)),
      optimistic:  Number((mean + halfWidth).toFixed(2)),
      pessimistic: Number((mean - halfWidth).toFixed(2)),
    });
  }
  return bands;
}

/**
 * Build proportional confidence bands for the Holt-Winters multiplicative model.
 *
 * Band formula:
 *   halfWidth(t) = z × σ_rel × |mean(t)| × √t
 *
 * where σ_rel is the standard deviation of in-sample relative residuals
 * (actual − fitted) / fitted.  The interval therefore scales with the
 * forecast level, which is appropriate for a multiplicative seasonal model.
 *
 * The two-phase z switch mirrors buildBands:
 *   t ≤ confidenceHorizon : z = preHorizonZ
 *   t > confidenceHorizon : z = 1.96 × postHorizonExpansionRate
 */
function buildProportionalBands(
  getMean: (t: number) => number,
  months: number,
  sigmaRelative: number,
  confidenceHorizon: number,
  postHorizonExpansionRate: number,
  preHorizonZ: number,
  sigmaScale = 1,
): ForecastBand[] {
  const scaledSigma = sigmaRelative * sigmaScale;
  // Pre-horizon: FLAT relative band — no sqrt(t) growth.
  // Width = preHorizonZ × σ_rel × |mean|, constant in relative terms so the
  // near-term band is tight and consistent.
  const preRelHalfWidth = preHorizonZ * scaledSigma;
  // Anchor point so post-horizon starts exactly where pre-horizon ends.
  const sqrtBoundary = Math.sqrt(confidenceHorizon + 1);
  const bands: ForecastBand[] = [];
  for (let t = 1; t <= months; t++) {
    const mean = getMean(t);
    const relHalfWidth = t <= confidenceHorizon
      ? preRelHalfWidth
      : preRelHalfWidth + 1.96 * postHorizonExpansionRate * scaledSigma * (Math.sqrt(t) - sqrtBoundary);
    const halfWidth = relHalfWidth * Math.abs(mean);
    bands.push({
      mean:        Number(mean.toFixed(2)),
      optimistic:  Number((mean + halfWidth).toFixed(2)),
      pessimistic: Number((mean - halfWidth).toFixed(2)),
    });
  }
  return bands;
}

// ---------------------------------------------------------------------------
// FitResult — bands + the winning parameters that produced them
// ---------------------------------------------------------------------------

interface FitResult {
  bands: ForecastBand[];
  params: FittedParams;
  /**
   * Set to true when Holt-Winters was requested but the series had fewer
   * than 24 observations and fell back to Holt Linear automatically.
   */
  seasonalFallback?: boolean;
}

/** Minimum historical observations required for the Holt-Winters seasonal path. */
const SEASONAL_MIN_POINTS = 24;

/**
 * Fit a series with the given ForecastModel, running a per-series MSE grid
 * search to choose α, β (and φ for Damped Trend) before projecting.
 *
 * @param values                  Historical series, oldest first.
 * @param model                   Model to use.
 * @param forecastMonths          Number of future periods to project.
 * @param preHorizonZ             z-score applied within the confidence horizon
 *                                (e.g. 1.0 = ±1σ√h ≈ 68%). User-controlled.
 * @param postHorizonExpansionRate  Multiplier on top of z=1.96 beyond the horizon
 *                                (1.0 = exactly ±1.96σ√h; 1.5 = 50% wider).
 * @param confidenceHorizon       Months at which bands switch from preHorizonZ to 1.96×mult.
 * @param sigmaScale              Scale applied to σ before band construction (0.5 for ARPU).
 * @param calendarStartMonth      Calendar month (0=Jan … 11=Dec) of values[0].
 *
 * Returns null when the series is too short (< 4 points).
 * Holt-Winters requires ≥ 24 points; fewer causes a Holt Linear fallback with seasonalFallback=true.
 */
function fitAndBuildBands(
  values: number[],
  model: ForecastModel,
  forecastMonths: number,
  preHorizonZ: number,
  postHorizonExpansionRate: number,
  confidenceHorizon: number,
  sigmaScale = 1,
  calendarStartMonth = 0,
): FitResult | null {
  if (values.length < 4) return null;

  if (model === 'Simple Exponential Smoothing') {
    const params = optimiseSES(values);
    const m = fitSESParams(values, params.alpha);
    const bands = buildBands(
      t => m.L,
      forecastMonths, params.sigma, confidenceHorizon, postHorizonExpansionRate, preHorizonZ, sigmaScale,
    );
    return { bands, params };
  }

  if (model === 'Damped Trend') {
    const params = optimiseDampedTrend(values);
    const phi = params.phi!;
    const m = fitDampedTrendParams(values, params.alpha, params.beta, phi);
    const bands = buildBands(
      t => m.L + m.T * phi * (1 - Math.pow(phi, t)) / (1 - phi),
      forecastMonths, params.sigma, confidenceHorizon, postHorizonExpansionRate, preHorizonZ, sigmaScale,
    );
    return { bands, params };
  }

  if (model === 'Holt-Winters') {
    // Require at least two full seasonal cycles (24 months).
    // If the series is shorter, fall back to Holt Linear and flag the result.
    if (values.length < SEASONAL_MIN_POINTS) {
      const params = optimiseHW(values);
      const m = fitHoltWintersParams(values, params.alpha, params.beta);
      const bands = buildBands(
        t => m.L + t * m.T,
        forecastMonths, params.sigma, confidenceHorizon, postHorizonExpansionRate, preHorizonZ, sigmaScale,
      );
      return { bands, params, seasonalFallback: true };
    }

    // Grid-search α, β, γ on the full seasonal series.
    const params = optimiseHWTriple(values, calendarStartMonth);
    const { L, T, S } = fitHWTripleParams(values, params.alpha, params.beta, params.gamma!, calendarStartMonth);

    // σ stored in params.sigma is σ_relative (relative residual SD).
    // Proportional bands scale the interval with the forecast level.
    const forecastCalendarStart = (calendarStartMonth + values.length) % 12;
    const bands = buildProportionalBands(
      t => (L + t * T) * S[(forecastCalendarStart + t - 1) % 12],
      forecastMonths, params.sigma, confidenceHorizon, postHorizonExpansionRate, preHorizonZ, sigmaScale,
    );
    return { bands, params };
  }

  // Default: Holt Linear
  const params = optimiseHW(values);
  const m = fitHoltWintersParams(values, params.alpha, params.beta);
  const bands = buildBands(
    t => m.L + t * m.T,
    forecastMonths, params.sigma, confidenceHorizon, postHorizonExpansionRate, preHorizonZ, sigmaScale,
  );
  return { bands, params };
}

// ---------------------------------------------------------------------------
// Public legacy API — unchanged output format, used by App.tsx and computeWhatIfData
// ---------------------------------------------------------------------------

/**
 * Single-metric Holt-Winters forecast.
 * Returns an array of row objects with 'Mean (Base)', 'Optimistic', 'Pessimistic', 'Type'.
 * The output format and field names are unchanged from the original implementation.
 */
export function calculateHoltWinters(
  data: any[],
  dateCol: string,
  targetCol: string,
  months: number,
  preHorizonUncertainty: number,
  postHorizonExpansionRate: number,
  confidenceHorizon: number = 3,
  model: ForecastModel = 'Holt Linear',
) {
  const y = data.map(row => Number(row[targetCol]) || 0);
  // fitAndBuildBands handles the full optimise → fit → band pipeline.
  // preHorizonUncertainty is now the pre-horizon z-score; postHorizonExpansionRate is the multiplier.
  const result = fitAndBuildBands(y, model, months, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon);
  if (!result) return null;

  const lastDate: Date = data[data.length - 1]._parsedDate;
  return result.bands.map((band, idx) => ({
    [dateCol]: addMonths(lastDate, idx + 1),
    _parsedDate: addMonths(lastDate, idx + 1),
    'Mean (Base)': band.mean,
    Optimistic: band.optimistic,
    Pessimistic: band.pessimistic,
    Type: 'Forecast',
  }));
}

// ---------------------------------------------------------------------------
// New IBRO-aware engine — returns BaseForecast (never directly forecasts Base)
// ---------------------------------------------------------------------------

/**
 * Pre-aggregated IBRO row (one entry per calendar month for a single cohort).
 * The caller is responsible for aggregating raw data into this shape before
 * calling calculateBaseForecast.
 */
export interface AggregatedIBRORow {
  _parsedDate: Date;
  inflow: number;
  outflow: number;
  /** Retained subscriber volume — forecast independently, not used in Base derivation */
  retention: number;
  /** Blended ARPU for the month (revenue / total subs). 0 if revenue data unavailable. */
  arpu: number;
  /** Per-scenario ARPU: revenue for that scenario / subscriber volume for that scenario */
  inflowArpu: number;
  outflowArpu: number;
  retentionArpu: number;
  baseArpu: number;
}

/**
 * Forecast Inflow, Retention volume, Outflow, and ARPU independently using
 * Holt-Winters double exponential smoothing.
 *
 * Base is NEVER forecast directly. Callers derive it for any month t as:
 *   base[t] = base[t-1] + inflow[t-1] - outflow[t-1]
 * using seedBaseVolume as the starting stock and lastHistoricalInflow/Outflow
 * from the returned BaseForecast to seed the first month's derivation.
 *
 * Retention events should be applied in the MarketEventAdjustedForecast stage
 * by reducing Outflow (consistent with the what-if market event model).
 *
 * Returns null when the input series is too short (< 4 months).
 */
export function calculateBaseForecast(
  aggregatedData: AggregatedIBRORow[],
  cohort: CohortKey,
  seedBaseVolume: number,
  forecastMonths: number,
  preHorizonUncertainty: number,
  postHorizonExpansionRate: number,
  confidenceHorizon: number = 3,
  model: ForecastModel = 'Holt Linear',
): BaseForecast | null {
  const sorted = [...aggregatedData].sort(
    (a, b) => a._parsedDate.getTime() - b._parsedDate.getTime(),
  );

  if (sorted.length < 4) return null;

  // Detect gaps: walk consecutive pairs and collect any calendar months that are
  // absent between the first and last observed month.
  const missingMonths: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    let expected = addMonths(sorted[i - 1]._parsedDate, 1);
    const actual = sorted[i]._parsedDate;
    while (
      expected.getFullYear() < actual.getFullYear() ||
      (expected.getFullYear() === actual.getFullYear() && expected.getMonth() < actual.getMonth())
    ) {
      missingMonths.push(format(expected, 'yyyy-MM'));
      expected = addMonths(expected, 1);
    }
  }

  // Calendar month (0=Jan…11=Dec) of the first historical observation.
  // Passed to fitAndBuildBands so the Holt-Winters path aligns seasonal indices
  // to real calendar months rather than array positions.
  const calStartMonth = sorted[0]._parsedDate.getMonth();

  const inflowResult = fitAndBuildBands(
    sorted.map(r => r.inflow), model, forecastMonths, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon, 1, calStartMonth,
  );
  const outflowResult = fitAndBuildBands(
    sorted.map(r => r.outflow), model, forecastMonths, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon, 1, calStartMonth,
  );
  const retentionResult = fitAndBuildBands(
    sorted.map(r => r.retention), model, forecastMonths, preHorizonUncertainty, postHorizonExpansionRate, confidenceHorizon, 1, calStartMonth,
  );

  if (!inflowResult || !outflowResult || !retentionResult) return null;

  // Helper: fit ARPU series with reduced uncertainty — ARPU is a very stable rate
  // metric and should not have wide confidence bands.
  // Both pre- and post-horizon are scaled to 10% of the volume rates so that the
  // band widths are consistent across the horizon (pre-horizon never exceeds post).
  // Pessimistic band is clamped to ≥ 0 since negative ARPU is not physically possible.
  const arpuPostHorizonRate = postHorizonExpansionRate * 0.1;
  const arpuPreHorizonZ     = preHorizonUncertainty    * 0.1;
  const fitArpuSeries = (values: number[]): ForecastBand[] => {
    const result: FitResult | null =
      fitAndBuildBands(values, model, forecastMonths, arpuPreHorizonZ, arpuPostHorizonRate, confidenceHorizon, 0.5, calStartMonth);
    let bands: ForecastBand[] = result?.bands ?? (() => {
      const slice = values.slice(-3);
      const flat = Number((slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length)).toFixed(2));
      return Array.from({ length: forecastMonths }, () => ({ mean: flat, optimistic: flat, pessimistic: flat }));
    })();
    // Boundary correction: anchor the first forecast mean exactly to the last historical actual.
    const lastActual = values[values.length - 1];
    if (lastActual > 0 && bands.length > 0) {
      const offset = lastActual - bands[0].mean;
      console.log('[ARPU boundary] cohort=', `${cohort.segment}|${cohort.product}|${cohort.channel}`, 'lastActual=', lastActual, 'rawFittedFirst=', bands[0].mean, 'offset=', offset, 'correctionApplied=', offset !== 0);
      if (offset !== 0) {
        bands = bands.map(b => ({
          mean:        b.mean        + offset,
          optimistic:  b.optimistic  + offset,
          pessimistic: b.pessimistic + offset,
        }));
      }
    }
    // Clamp pessimistic band — ARPU cannot be negative.
    bands = bands.map(b => ({ ...b, pessimistic: Math.max(0, b.pessimistic) }));
    return bands;
  };

  // Blended ARPU: reduced pre- and post-horizon uncertainty for stability.
  const arpuValues = sorted.map(r => r.arpu);
  const arpuResult: FitResult | null =
    fitAndBuildBands(arpuValues, model, forecastMonths, arpuPreHorizonZ, arpuPostHorizonRate, confidenceHorizon, 0.5, calStartMonth);

  const fallbackArpuParams: FittedParams = { alpha: 0.3, beta: 0.1, mse: 0, sigma: 0 };
  let arpuBands: ForecastBand[] = arpuResult?.bands ?? (() => {
    const slice = arpuValues.slice(-3);
    const flat = Number((slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length)).toFixed(2));
    return Array.from({ length: forecastMonths }, () => ({ mean: flat, optimistic: flat, pessimistic: flat }));
  })();

  // Boundary correction for blended ARPU
  {
    const lastActualArpu = arpuValues[arpuValues.length - 1];
    if (lastActualArpu > 0 && arpuBands.length > 0) {
      const offset = lastActualArpu - arpuBands[0].mean;
      console.log('[ARPU boundary] cohort=', `${cohort.segment}|${cohort.product}|${cohort.channel}`, 'series=blended', 'lastActual=', lastActualArpu, 'rawFittedFirst=', arpuBands[0].mean, 'offset=', offset, 'correctionApplied=', offset !== 0);
      if (offset !== 0) {
        arpuBands = arpuBands.map(b => ({
          mean:        b.mean        + offset,
          optimistic:  b.optimistic  + offset,
          pessimistic: b.pessimistic + offset,
        }));
      }
    }
  }
  // Clamp blended ARPU pessimistic band — ARPU cannot be negative.
  arpuBands = arpuBands.map(b => ({ ...b, pessimistic: Math.max(0, b.pessimistic) }));

  // Per-scenario ARPU: fit independent HW models for each IBRO scenario
  const inflowArpuBands    = fitArpuSeries(sorted.map(r => r.inflowArpu));
  const outflowArpuBands   = fitArpuSeries(sorted.map(r => r.outflowArpu));
  const retentionArpuBands = fitArpuSeries(sorted.map(r => r.retentionArpu));
  const baseArpuBands      = fitArpuSeries(sorted.map(r => r.baseArpu));

  // Fit results for per-scenario ARPU params (used for fittedParams storage)
  const inflowArpuResult    = fitAndBuildBands(sorted.map(r => r.inflowArpu),    model, forecastMonths, arpuPreHorizonZ, arpuPostHorizonRate, confidenceHorizon, 0.5, calStartMonth);
  const outflowArpuResult   = fitAndBuildBands(sorted.map(r => r.outflowArpu),   model, forecastMonths, arpuPreHorizonZ, arpuPostHorizonRate, confidenceHorizon, 0.5, calStartMonth);
  const retentionArpuResult = fitAndBuildBands(sorted.map(r => r.retentionArpu), model, forecastMonths, arpuPreHorizonZ, arpuPostHorizonRate, confidenceHorizon, 0.5, calStartMonth);
  const baseArpuResult      = fitAndBuildBands(sorted.map(r => r.baseArpu),      model, forecastMonths, arpuPreHorizonZ, arpuPostHorizonRate, confidenceHorizon, 0.5, calStartMonth);

  const lastDate = sorted[sorted.length - 1]._parsedDate;
  const historicalMonths = sorted.map(r => format(r._parsedDate, 'yyyy-MM'));

  const months: BaseForecastMonth[] = Array.from({ length: forecastMonths }, (_, i) => ({
    month: format(addMonths(lastDate, i + 1), 'yyyy-MM'),
    inflow: inflowResult.bands[i],
    outflow: outflowResult.bands[i],
    // Retention is forecast independently. When market events are applied in the
    // MarketEventAdjustedForecast stage, retention events reduce Outflow rather
    // than modifying Base directly — consistent with the what-if engine.
    retention: retentionResult.bands[i],
    arpu: arpuBands[i],
    inflowArpu:    inflowArpuBands[i],
    outflowArpu:   outflowArpuBands[i],
    retentionArpu: retentionArpuBands[i],
    baseArpu:      baseArpuBands[i],
  }));

  // Any series that fell back to HW due to insufficient data for seasonal model
  const anySeasonalFallback =
    inflowResult.seasonalFallback ||
    outflowResult.seasonalFallback ||
    retentionResult.seasonalFallback ||
    arpuResult?.seasonalFallback;

  return {
    cohort,
    seedBaseVolume,
    historicalMonths,
    months,
    lastHistoricalInflow: sorted[sorted.length - 1].inflow,
    lastHistoricalOutflow: sorted[sorted.length - 1].outflow,
    modelUsed: model,
    fittedParams: {
      inflow:    inflowResult.params,
      outflow:   outflowResult.params,
      retention: retentionResult.params,
      arpu:      arpuResult?.params ?? fallbackArpuParams,
      inflowArpu:    inflowArpuResult?.params,
      outflowArpu:   outflowArpuResult?.params,
      retentionArpu: retentionArpuResult?.params,
      baseArpu:      baseArpuResult?.params,
    },
    ...(anySeasonalFallback ? { seasonalFallback: true } : {}),
    ...(missingMonths.length > 0 ? { missingMonths } : {}),
    preHorizonUncertaintyUsed: preHorizonUncertainty,
    postHorizonExpansionRateUsed: postHorizonExpansionRate,
    confidenceHorizonUsed: confidenceHorizon,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Phase 1 — Pre-Aggregation helper for bulk forecasting
// ---------------------------------------------------------------------------

/**
 * A raw data row enriched with a pre-parsed `_parsedDate` field.
 * The remaining fields are the original row values as-is.
 */
export type PreAggRow = Record<string, any> & { _parsedDate: Date };

/**
 * Map produced by `buildCohortDataMap`.
 * Key: `seg|prod|prodL2|chan|chanL2` (the 5-part cohort identifier).
 * Value: every valid row that belongs to that cohort across ALL metrics.
 *
 * The caller decides which metric(s) to select from the bucket.
 * Rows are NOT sorted — callers must sort by `_parsedDate.getTime()` themselves.
 */
export type CohortDataMap = Map<string, PreAggRow[]>;

/**
 * Single O(N) pass over `data` that groups each valid row into a CohortDataMap.
 *
 * Call this ONCE before the bulk forecasting loop, then replace per-cohort
 * `.filter()` chains with a direct O(1) `.get(key)` lookup.
 *
 * Rows whose `wiDateCol` value is not a valid Date are silently skipped.
 *
 * @param data           Raw input rows (the same array passed to WhatIfConfig.data).
 * @param wiDateCol      Column name for the date field.
 * @param wiSegmentCol   Column name for segment  ('' → every row keyed as 'All').
 * @param wiProductCol   Column name for product L1 ('' → 'All').
 * @param wiProductL2Col Column name for product L2 ('' → 'All').
 * @param wiChannelCol   Column name for channel L1 ('' → 'All').
 * @param wiChannelL2Col Column name for channel L2 ('' → 'All').
 */
export function buildCohortDataMap(
  data: any[],
  wiDateCol: string,
  wiSegmentCol: string,
  wiProductCol: string,
  wiProductL2Col: string,
  wiChannelCol: string,
  wiChannelL2Col: string,
): CohortDataMap {
  const map: CohortDataMap = new Map();
  for (const row of data) {
    const d = new Date(row[wiDateCol]);
    if (!isValid(d)) continue;
    const seg    = wiSegmentCol   ? String(row[wiSegmentCol]   || 'All').trim() : 'All';
    const prod   = wiProductCol   ? String(row[wiProductCol]   || 'All').trim() : 'All';
    const prodL2 = wiProductL2Col ? (String(row[wiProductL2Col] || '').trim() || 'All') : 'All';
    const chan   = wiChannelCol   ? String(row[wiChannelCol]   || 'All').trim() : 'All';
    const chanL2 = wiChannelL2Col ? (String(row[wiChannelL2Col] || '').trim() || 'All') : 'All';
    const key = `${seg}|${prod}|${prodL2}|${chan}|${chanL2}`;
    const enriched: PreAggRow = { ...row, _parsedDate: d };
    const bucket = map.get(key);
    if (bucket) bucket.push(enriched);
    else map.set(key, [enriched]);
  }
  return map;
}

export const getUniqueCombos = (
  processedData: any[],
  segVal: string,
  prodVal: string,
  wiSegmentCol: string,
  wiProductCol: string,
  chanVal: string,
  wiChannelCol: string,
) => {
  const combos = new Map<string, { s: string; p: string; c: string }>();
  processedData.forEach(r => {
    const s =
      wiSegmentCol && segVal === 'All (Aggregated)'
        ? String(r[wiSegmentCol])
        : segVal === 'All (Aggregated)'
        ? 'All'
        : segVal;
    const p =
      wiProductCol && prodVal === 'All (Aggregated)'
        ? String(r[wiProductCol])
        : prodVal === 'All (Aggregated)'
        ? 'All'
        : prodVal;
    const c =
      wiChannelCol && chanVal === 'All (Aggregated)'
        ? String(r[wiChannelCol])
        : chanVal === 'All (Aggregated)'
        ? 'All'
        : chanVal;
    const key = `${s}|${p}|${c}`;
    if (!combos.has(key)) combos.set(key, { s, p, c });
  });
  return Array.from(combos.values());
};

export interface WhatIfConfig {
  wiDateCol: string;
  wiMetricCol: string;
  wiValueCol: string;
  wiInflowVal: string;
  wiOutflowVal: string;
  wiBaseVal: string;
  wiRetentionVal: string;
  wiSegmentCol: string;
  wiProductCol: string;
  wiChannelCol: string;
  wiCustomerCol: string;
  wiRevenueCol: string;
  wiArpuCol: string;
  data: any[];
  /** Smoothing model to use for Inflow / Outflow / Retention projections. Defaults to 'Holt Linear'. */
  forecastModel?: ForecastModel;
  /** Pre-horizon uncertainty % passed to the band builder. Defaults to 0. */
  preHorizonUncertainty?: number;
  /** Post-horizon expansion rate % passed to the band builder. Defaults to 0. */
  postHorizonExpansionRate?: number;
  /** Confidence horizon in months passed to the band builder. Defaults to 3. */
  confidenceHorizon?: number;
}

export function computeWhatIfData(
  config: WhatIfConfig,
  segmentFilter: string,
  productFilter: string,
  channelFilter: string,
  length: number,
  inUplift: number,
  inLag: number,
  retUplift: number,
  retLag: number,
  arpuUplift: number,
  events: MarketEvent[] = [],
): {
  error?: string;
  combined?: any[];
  totalBaseBaseline?: number;
  totalBaseUplifted?: number;
  totalRevBaselineSum?: number;
  totalRevUpliftedSum?: number;
  missingMonths?: string[];
} {
  const {
    wiDateCol,
    wiMetricCol,
    wiValueCol,
    wiInflowVal,
    wiOutflowVal,
    wiBaseVal,
    wiRetentionVal,
    wiSegmentCol,
    wiProductCol,
    wiChannelCol,
    wiCustomerCol,
    wiRevenueCol,
    wiArpuCol,
    data,
  } = config;

  if (
    !wiDateCol ||
    !wiMetricCol ||
    !wiValueCol ||
    !wiInflowVal ||
    !wiOutflowVal ||
    !wiBaseVal ||
    !wiRetentionVal
  ) {
    return { error: 'Please select Date, Metric, and Value columns, and map all identifiers.' };
  }

  // Filter events for this segment/product/channel combo
  const relevantEvents = events.filter(
    e =>
      (e.segment === 'All' || e.segment === segmentFilter) &&
      (e.product === 'All' || e.product === productFilter) &&
      (e.channel === 'All' || e.channel === channelFilter),
  );

  let processedData = data
    .map(row => ({ ...row, _parsedDate: new Date(row[wiDateCol]) }))
    .filter(row => isValid(row._parsedDate))
    .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

  if (wiSegmentCol && segmentFilter !== 'All' && segmentFilter !== 'All (Aggregated)') {
    processedData = processedData.filter(row => String(row[wiSegmentCol]) === segmentFilter);
  }

  if (wiProductCol && productFilter !== 'All' && productFilter !== 'All (Aggregated)') {
    processedData = processedData.filter(row => String(row[wiProductCol]) === productFilter);
  }

  if (wiChannelCol && channelFilter !== 'All' && channelFilter !== 'All (Aggregated)') {
    processedData = processedData.filter(row => String(row[wiChannelCol]) === channelFilter);
  }

  const timeMap = new Map<number, any>();
  processedData.forEach(row => {
    const t = row._parsedDate.getTime();
    if (!timeMap.has(t)) {
      timeMap.set(t, {
        _parsedDate: row._parsedDate,
        inflow: 0,
        inflowCust: 0,
        inflowRev: 0,
        outflow: 0,
        outflowCust: 0,
        outflowRev: 0,
        base: 0,
        baseCust: 0,
        baseRev: 0,
        retention: 0,
        retentionCust: 0,
        retentionRev: 0,
      });
    }
    const entry = timeMap.get(t);
    const metric = String(row[wiMetricCol]);
    const val = Number(row[wiValueCol]);
    const cust = Number(row[wiCustomerCol]) || 0;
    let rev = Number(row[wiRevenueCol]) || 0;
    const arpu = Number(row[wiArpuCol]) || 0;

    if (wiArpuCol && arpu && (!wiRevenueCol || !rev)) {
      rev = val * arpu;
    }

    if (!isNaN(val)) {
      if (metric === wiInflowVal) {
        entry.inflow += val;
        entry.inflowCust += cust;
        entry.inflowRev += rev;
      }
      if (metric === wiOutflowVal) {
        entry.outflow += val;
        entry.outflowCust += cust;
        entry.outflowRev += rev;
      }
      if (metric === wiBaseVal) {
        entry.base += val;
        entry.baseCust += cust;
        entry.baseRev += rev;
      }
      if (metric === wiRetentionVal) {
        entry.retention += val;
        entry.retentionCust += cust;
        entry.retentionRev += rev;
      }
    }
  });

  const aggregatedData = Array.from(timeMap.values())
    .filter(row => row.base > 0 || row.inflow > 0 || row.retention > 0)
    .sort((a, b) => a._parsedDate.getTime() - b._parsedDate.getTime());

  if (aggregatedData.length < 4) {
    return {
      error: 'Not enough valid data points to generate a forecast (need at least 4 months of data).',
    };
  }

  // Detect gaps in the aggregated series — same logic as calculateBaseForecast.
  const missingMonths: string[] = [];
  for (let i = 1; i < aggregatedData.length; i++) {
    let expected = addMonths(aggregatedData[i - 1]._parsedDate, 1);
    const actual = aggregatedData[i]._parsedDate;
    while (
      expected.getFullYear() < actual.getFullYear() ||
      (expected.getFullYear() === actual.getFullYear() && expected.getMonth() < actual.getMonth())
    ) {
      missingMonths.push(format(expected, 'yyyy-MM'));
      expected = addMonths(expected, 1);
    }
  }

  // Resolve model and confidence parameters from config, falling back to safe defaults.
  const model: ForecastModel = config.forecastModel ?? 'Holt Linear';
  const preUnc  = config.preHorizonUncertainty   ?? 1;
  const postExp = config.postHorizonExpansionRate ?? 1;
  const confHz  = config.confidenceHorizon        ?? 3;

  // Calendar month (0=Jan…11=Dec) of the first aggregated observation.
  // Required so that the Holt-Winters path aligns seasonal indices to calendar months.
  const calStartMonth = aggregatedData[0]._parsedDate.getMonth();

  // Forecast Inflow, Outflow, and Retention independently using the selected model.
  // Base is NEVER forecast directly — it is derived as Base[t] = Base[t-1] + Inflow[t] - Outflow[t].
  const lastDate = aggregatedData[aggregatedData.length - 1]._parsedDate;

  const toRowArray = (result: ReturnType<typeof fitAndBuildBands>) => {
    if (!result) return null;
    return result.bands.map((band, idx) => ({
      _parsedDate: addMonths(lastDate, idx + 1),
      'Mean (Base)': band.mean,
      Optimistic: band.optimistic,
      Pessimistic: band.pessimistic,
      Type: 'Forecast',
    }));
  };

  let inflowForecastData   = toRowArray(fitAndBuildBands(aggregatedData.map(r => r.inflow),    model, length, preUnc, postExp, confHz, 1, calStartMonth));
  let outflowForecastData  = toRowArray(fitAndBuildBands(aggregatedData.map(r => r.outflow),   model, length, preUnc, postExp, confHz, 1, calStartMonth));
  let retentionForecastData = toRowArray(fitAndBuildBands(aggregatedData.map(r => r.retention), model, length, preUnc, postExp, confHz, 1, calStartMonth));

  const getMeanArpu = (metricKey: string, revKey: string) => {
    const lastPoints = aggregatedData.slice(-3);
    const totalVol = lastPoints.reduce((a, b) => a + b[metricKey], 0);
    const totalRev = lastPoints.reduce((a, b) => a + b[revKey], 0);
    return totalVol > 0 ? totalRev / totalVol : 0;
  };

  const getMeanCustRatio = (metricKey: string, custKey: string) => {
    const lastPoints = aggregatedData.slice(-3);
    const totalVol = lastPoints.reduce((a, b) => a + b[metricKey], 0);
    const totalCust = lastPoints.reduce((a, b) => a + b[custKey], 0);
    return totalVol > 0 ? totalCust / totalVol : 0;
  };

  const inflowArpu = getMeanArpu('inflow', 'inflowRev');
  const baseArpu = getMeanArpu('base', 'baseRev');
  const retentionArpu = getMeanArpu('retention', 'retentionRev');

  const inflowCustRatio = getMeanCustRatio('inflow', 'inflowCust');
  const baseCustRatio = getMeanCustRatio('base', 'baseCust');
  const retentionCustRatio = getMeanCustRatio('retention', 'retentionCust');

  if (!inflowForecastData || !outflowForecastData || !retentionForecastData) {
    const lastInflows = aggregatedData.slice(-3).map(r => r.inflow);
    const meanInflow = lastInflows.reduce((a, b) => a + b, 0) / lastInflows.length;

    const lastOutflows = aggregatedData.slice(-3).map(r => r.outflow);
    const meanOutflow = lastOutflows.reduce((a, b) => a + b, 0) / lastOutflows.length;

    const lastRets = aggregatedData.slice(-3).map(r => r.retention);
    const meanRet = lastRets.reduce((a, b) => a + b, 0) / lastRets.length;

    // lastDate is already declared above
    inflowForecastData = [];
    outflowForecastData = [];
    retentionForecastData = [];

    for (let m = 1; m <= length; m++) {
      const d = addMonths(lastDate, m);
      const stub = { _parsedDate: d, Optimistic: 0, Pessimistic: 0, Type: 'Forecast' };
      inflowForecastData.push({ ...stub, 'Mean (Base)': meanInflow });
      outflowForecastData.push({ ...stub, 'Mean (Base)': meanOutflow });
      retentionForecastData.push({ ...stub, 'Mean (Base)': meanRet });
    }
  }

  const combined = [];
  aggregatedData.forEach(row => {
    const totalSubs = row.base + row.inflow;
    const totalCust = row.baseCust + row.inflowCust;
    const totalRev = row.baseRev + row.inflowRev + row.retentionRev;
    const blendedArpu = totalSubs > 0 ? totalRev / totalSubs : 0;

    combined.push({
      date: row._parsedDate,
      [wiDateCol]: row._parsedDate,
      timestamp: row._parsedDate.getTime(),
      'Inflow Volume (Baseline)': Number(row.inflow.toFixed(2)),
      'Inflow Volume (Uplifted)': Number(row.inflow.toFixed(2)),
      'Outflow Volume (Baseline)': Number(row.outflow.toFixed(2)),
      'Outflow Volume (Uplifted)': Number(row.outflow.toFixed(2)),
      'Retention Volume (Baseline)': Number(row.retention.toFixed(2)),
      'Retention Volume (Uplifted)': Number(row.retention.toFixed(2)),
      'Base Volume (Baseline)': Number(row.base.toFixed(2)),
      'Base Volume (Uplifted)': Number(row.base.toFixed(2)),
      'Customer Volume (Baseline)': Number(totalCust.toFixed(2)),
      'Customer Volume (Uplifted)': Number(totalCust.toFixed(2)),
      'Total Subscribers (Baseline)': Number(totalSubs.toFixed(2)),
      'Total Subscribers (Uplifted)': Number(totalSubs.toFixed(2)),
      'Total Revenue (Baseline)': Number(totalRev.toFixed(2)),
      'Total Revenue (Uplifted)': Number(totalRev.toFixed(2)),
      'Blended ARPU (Baseline)': Number(blendedArpu.toFixed(2)),
      'Blended ARPU (Uplifted)': Number(blendedArpu.toFixed(2)),
      Type: 'Historical',
    });
  });

  let lastBaseBaseline = aggregatedData[aggregatedData.length - 1].base;
  let lastBaseUplifted = lastBaseBaseline;

  // Lagged base derivation: Base[t] = Base[t-1] + Inflow[t-1] - Outflow[t-1].
  // Seed with the last historical month's actuals so the first forecast month
  // picks up the correct T-1 inflow/outflow.
  let prevInBase = aggregatedData[aggregatedData.length - 1].inflow;
  let prevOutBase = aggregatedData[aggregatedData.length - 1].outflow;
  let prevInUp = prevInBase;
  let prevOutUp = prevOutBase;

  let runningRevBaseline = lastBaseBaseline * baseArpu;
  let runningRevUp = lastBaseUplifted * baseArpu;

  let runningCustBaseline = lastBaseBaseline * baseCustRatio;
  let runningCustUp = lastBaseUplifted * baseCustRatio;

  let totalBaseBaseline = 0;
  let totalBaseUplifted = 0;
  let totalRevBaselineSum = 0;
  let totalRevUpliftedSum = 0;
  let cumulativeArpuImpact = 0;

  for (let i = 0; i < length; i++) {
    const d = new Date(inflowForecastData[i]['_parsedDate']);
    const dateKey = format(d, 'yyyy-MM');
    const monthEvents = relevantEvents.filter(e => e.date === dateKey);

    const inBase = Math.max(0, inflowForecastData[i]['Mean (Base)']);
    const inUpNatural = i >= inLag ? inBase * (1 + inUplift / 100) : inBase;

    let inUpEventSubs = 0;
    let inUpEventRev = 0;
    let inUpEventCust = 0;

    monthEvents
      .filter(e => e.scenario === 'Inflow')
      .forEach(e => {
        inUpEventSubs += e.subscriberVolume || 0;
        inUpEventRev +=
          e.revenue !== undefined && e.revenue !== 0
            ? e.revenue
            : (e.subscriberVolume || 0) * inflowArpu;
        inUpEventCust +=
          e.customerVolume !== undefined && e.customerVolume !== 0
            ? e.customerVolume
            : (e.subscriberVolume || 0) * inflowCustRatio;
      });

    const inUp = inUpNatural + inUpEventSubs;
    const revInUpTotal = inUpNatural * inflowArpu + inUpEventRev;
    const custInUpTotal = inUpNatural * inflowCustRatio + inUpEventCust;

    const outBaseForecast = Math.max(0, outflowForecastData[i]['Mean (Base)']);
    const retBaseForecast = Math.max(0, retentionForecastData[i]['Mean (Base)']);
    const retBase = Math.min(retBaseForecast, lastBaseBaseline);

    const retUpNatural = i >= retLag ? retBase * (1 + retUplift / 100) : retBase;

    let retUpEventSubs = 0;
    let retUpEventRev = 0;
    let retUpEventCust = 0;

    let outUpEventSubs = 0;
    let outUpEventRev = 0;
    let outUpEventCust = 0;

    const blendedArpu = lastBaseUplifted > 0 ? runningRevUp / lastBaseUplifted : baseArpu;
    const blendedCustRatio =
      lastBaseUplifted > 0 ? runningCustUp / lastBaseUplifted : baseCustRatio;

    // Retention events reduce Outflow (not Base directly) — consistent with IBRO stock formula.
    monthEvents
      .filter(e => e.scenario === 'Retention')
      .forEach(e => {
        retUpEventSubs += e.subscriberVolume || 0;
        retUpEventRev +=
          e.revenue !== undefined && e.revenue !== 0
            ? e.revenue
            : (e.subscriberVolume || 0) * blendedArpu;
        retUpEventCust +=
          e.customerVolume !== undefined && e.customerVolume !== 0
            ? e.customerVolume
            : (e.subscriberVolume || 0) * blendedCustRatio;
      });

    monthEvents
      .filter(e => e.scenario === 'Outflow')
      .forEach(e => {
        outUpEventSubs += e.subscriberVolume || 0;
        outUpEventRev +=
          e.revenue !== undefined && e.revenue !== 0
            ? e.revenue
            : (e.subscriberVolume || 0) * blendedArpu;
        outUpEventCust +=
          e.customerVolume !== undefined && e.customerVolume !== 0
            ? e.customerVolume
            : (e.subscriberVolume || 0) * blendedCustRatio;
      });

    let retUp = retUpNatural + retUpEventSubs - outUpEventSubs;
    retUp = Math.max(0, retUp);
    retUp = Math.min(retUp, lastBaseUplifted);

    const retDelta = retUp - retBase;

    let outBase = outBaseForecast;
    outBase = Math.min(outBase, lastBaseBaseline + inBase);

    // Retention uplift reduces Outflow — retention events lower the outflow path
    let outUp = Math.max(0, outBaseForecast - retDelta);
    outUp = Math.min(outUp, lastBaseUplifted + inUp);

    const naturalOutflowSubs = Math.max(0, outUp - outUpEventSubs + retUpEventSubs);
    const revOutUpTotal = naturalOutflowSubs * blendedArpu + outUpEventRev - retUpEventRev;
    const custOutUpTotal = naturalOutflowSubs * blendedCustRatio + outUpEventCust - retUpEventCust;

    // Derive Base using lagged stock formula: Base[t] = Base[t-1] + Inflow[t-1] - Outflow[t-1].
    // Inflow in month T contributes to Base in month T+1, not T.
    const newBaseBaseline = Math.max(0, lastBaseBaseline + prevInBase - prevOutBase);
    const newBaseUplifted = Math.max(0, lastBaseUplifted + prevInUp - prevOutUp);

    const newRevBaseline = Math.max(
      0,
      runningRevBaseline + inBase * inflowArpu - outBase * baseArpu,
    );
    const newRevUp = Math.max(0, runningRevUp + revInUpTotal - revOutUpTotal);

    const newCustBaseline = Math.max(
      0,
      runningCustBaseline + inBase * inflowCustRatio - outBase * baseCustRatio,
    );
    const newCustUp = Math.max(0, runningCustUp + custInUpTotal - custOutUpTotal);

    monthEvents
      .filter(e => e.scenario === 'ARPU')
      .forEach(e => {
        cumulativeArpuImpact += e.arpu || 0;
      });

    const revInBase = inBase * inflowArpu;
    const revInUp = revInUpTotal * (1 + arpuUplift / 100) + inUp * cumulativeArpuImpact;

    const revBaseBase = newRevBaseline;
    const revBaseUp =
      newRevUp * (1 + arpuUplift / 100) + newBaseUplifted * cumulativeArpuImpact;

    const revRetBase = retBase * retentionArpu;
    const revRetUp = retUp * blendedArpu * (1 + arpuUplift / 100) + retUp * cumulativeArpuImpact;
    void revRetBase; // referenced for parity, used in display below if needed

    const custInBase = inBase * inflowCustRatio;
    const custInUp = custInUpTotal;
    const custBaseBase = newCustBaseline;
    const custBaseUp = newCustUp;

    const totalSubsBase = newBaseBaseline + inBase;
    const totalSubsUp = newBaseUplifted + inUp;

    const totalCustBase = custBaseBase + custInBase;
    const totalCustUp = custBaseUp + custInUp;

    const totalRevBase = revBaseBase + revInBase;
    const totalRevUp = revBaseUp + revInUp;

    const blendedArpuBase = totalSubsBase > 0 ? totalRevBase / totalSubsBase : 0;
    const blendedArpuUp = totalSubsUp > 0 ? totalRevUp / totalSubsUp : 0;

    totalBaseBaseline += newBaseBaseline;
    totalBaseUplifted += newBaseUplifted;
    totalRevBaselineSum += totalRevBase;
    totalRevUpliftedSum += totalRevUp;

    // Advance lagged inflow/outflow for next iteration
    prevInBase = inBase;
    prevOutBase = outBase;
    prevInUp = inUp;
    prevOutUp = outUp;

    lastBaseBaseline = newBaseBaseline;
    lastBaseUplifted = newBaseUplifted;
    runningRevBaseline = newRevBaseline;
    runningRevUp = newRevUp;
    runningCustBaseline = newCustBaseline;
    runningCustUp = newCustUp;

    combined.push({
      date: d,
      [wiDateCol]: d,
      timestamp: d.getTime(),
      'Inflow Volume (Baseline)': Number(inBase.toFixed(2)),
      'Inflow Volume (Uplifted)': Number(inUp.toFixed(2)),
      'Outflow Volume (Baseline)': Number(outBase.toFixed(2)),
      'Outflow Volume (Uplifted)': Number(outUp.toFixed(2)),
      'Retention Volume (Baseline)': Number(retBase.toFixed(2)),
      'Retention Volume (Uplifted)': Number(retUp.toFixed(2)),
      'Base Volume (Baseline)': Number(newBaseBaseline.toFixed(2)),
      'Base Volume (Uplifted)': Number(newBaseUplifted.toFixed(2)),
      'Customer Volume (Baseline)': Number(totalCustBase.toFixed(2)),
      'Customer Volume (Uplifted)': Number(totalCustUp.toFixed(2)),
      'Total Subscribers (Baseline)': Number(totalSubsBase.toFixed(2)),
      'Total Subscribers (Uplifted)': Number(totalSubsUp.toFixed(2)),
      'Total Revenue (Baseline)': Number(totalRevBase.toFixed(2)),
      'Total Revenue (Uplifted)': Number(totalRevUp.toFixed(2)),
      'Blended ARPU (Baseline)': Number(blendedArpuBase.toFixed(2)),
      'Blended ARPU (Uplifted)': Number(blendedArpuUp.toFixed(2)),
      Type: 'Forecast',
    });
  }

  const combinedWithTrace = combined.map(r => ({
    ...r,
    'Inflow Uplift %': inUplift,
    'Retention Uplift %': retUplift,
    'ARPU Uplift %': arpuUplift,
  }));

  return {
    combined: combinedWithTrace,
    totalBaseBaseline,
    totalBaseUplifted,
    totalRevBaselineSum,
    totalRevUpliftedSum,
    ...(missingMonths.length > 0 ? { missingMonths } : {}),
  };
}

export interface ModelRecommendation {
  recommendedModel: ForecastModel;
  reason: string;
  confidence: 'Low' | 'Medium' | 'High';
  metrics: {
    historyLength: number;
    trendStrengthLabel: string;
    trendStabilityLabel: string;
    seasonalityLabel: string;
    volatilityLabel: string;
    bestModelByFit: string;
    fitMapeValues: {
      'Simple Exponential Smoothing': number;
      'Holt Linear': number;
      'Damped Trend': number;
      'Holt-Winters': number;
    };
  };
}

/**
 * High-quality model analysis and selection recommendation engine.
 * Computes trend strength, seasonality autocorrelation, detrended volatility,
 * and runs full grid-search optimization to backtest which model fits historical data best.
 */
export function analyzeAndRecommendModel(
  values: number[],
  calendarStartMonth = 0
): ModelRecommendation {
  const len = values.length;

  // Defaults for extremely short history
  if (len < 4) {
    return {
      recommendedModel: 'Simple Exponential Smoothing',
      reason: 'Extremely limited history (fewer than 4 observations) is available. A simple, level-only model is recommended to prevent over-fitting.',
      confidence: 'Low',
      metrics: {
        historyLength: len,
        trendStrengthLabel: 'No pattern detected (insufficient data)',
        trendStabilityLabel: 'Not stable (insufficient data)',
        seasonalityLabel: 'No pattern detected (insufficient data)',
        volatilityLabel: 'N/A',
        bestModelByFit: 'Simple Exponential Smoothing',
        fitMapeValues: {
          'Simple Exponential Smoothing': 0,
          'Holt Linear': 0,
          'Damped Trend': 0,
          'Holt-Winters': 0,
        },
      },
    };
  }

  // Calculate series stats
  const sumY = values.reduce((a, b) => a + b, 0);
  const mean = sumY / len;

  // 1. Trend detection via linear regression
  let trendStrength = 0;
  let clearTrend = false;
  let trendIsStable = true;
  let slopeSign = 0;

  let sumX = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < len; i++) {
    sumX += i;
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = len * sumXX - sumX * sumX;
  if (denom !== 0) {
    const slope = (len * sumXY - sumX * sumY) / denom;
    slopeSign = Math.sign(slope);
    const intercept = (sumY - slope * sumX) / len;

    let sst = 0, ssr = 0;
    for (let i = 0; i < len; i++) {
      const diffY = values[i] - mean;
      const pred = intercept + slope * i;
      const diffPred = values[i] - pred;
      sst += diffY * diffY;
      ssr += diffPred * diffPred;
    }
    
    // R^2 as trend strength
    trendStrength = sst > 0 ? 1 - (ssr / sst) : 0;
    if (trendStrength < 0) trendStrength = 0;

    const rangeChange = slope * (len - 1);
    const relativeChange = mean > 0 ? Math.abs(rangeChange) / mean : 0;

    // A clear trend exists if there's solid relative growth/decay and R^2 is decent
    if (trendStrength > 0.3 && relativeChange > 0.12 && len >= 6) {
      clearTrend = true;
      if (trendStrength < 0.55) {
        trendIsStable = false;
      }
    }
  }

  // 2. Seasonality detection (lag-12 autocorrelation)
  let seasonalityStrength = 0;
  let seasonalityDetected = false;
  if (len >= 12) {
    const lag = 12;
    const n = len - lag;
    if (n >= 2) {
      let sumProd = 0, sumX2 = 0, sumY2 = 0;
      const meanX = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
      const meanY = values.slice(lag, lag + n).reduce((a, b) => a + b, 0) / n;
      for (let i = 0; i < n; i++) {
        const dx = values[i] - meanX;
        const dy = values[i + lag] - meanY;
        sumProd += dx * dy;
        sumX2 += dx * dx;
        sumY2 += dy * dy;
      }
      const correlationDenom = Math.sqrt(sumX2 * sumY2);
      seasonalityStrength = correlationDenom > 0 ? sumProd / correlationDenom : 0;
      if (seasonalityStrength > 0.35) {
        seasonalityDetected = true;
      }
    }
  }

  // 3. Volatility (detrended residual standard deviation divided by mean)
  let detrendedSD = 0;
  if (denom !== 0) {
    const slope = (len * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / len;
    let sse = 0;
    for (let i = 0; i < len; i++) {
      const pred = intercept + slope * i;
      const err = values[i] - pred;
      sse += err * err;
    }
    detrendedSD = Math.sqrt(sse / Math.max(1, len - 1));
  } else {
    let varY = 0;
    for (let i = 0; i < len; i++) {
      const diffY = values[i] - mean;
      varY += diffY * diffY;
    }
    detrendedSD = Math.sqrt(varY / Math.max(1, len - 1));
  }
  const relVolatility = mean > 0 ? (detrendedSD / mean) : 0;

  // 4. Run grid-search optimization to backtest and check min MSE / relative error for fit
  const sesOpt = optimiseSES(values);
  const hlOpt = optimiseHW(values);
  const dtOpt = optimiseDampedTrend(values);

  const sesMape = mean > 0 ? (sesOpt.sigma / mean) * 100 : 0;
  const hlMape  = mean > 0 ? (hlOpt.sigma / mean) * 100 : 0;
  const dtMape  = mean > 0 ? (dtOpt.sigma / mean) * 100 : 0;

  let hwMape = Infinity;
  let hwOpt: FittedParams | null = null;
  if (len >= 24) {
    hwOpt = optimiseHWTriple(values, calendarStartMonth);
    hwMape = hwOpt.sigma * 100; // Multiplicative HW residual sigma is already relative
  }

  // Decide winner by fit
  let bestFitModel: ForecastModel = 'Simple Exponential Smoothing';
  let minMape = sesMape;
  if (hlMape < minMape) { minMape = hlMape; bestFitModel = 'Holt Linear'; }
  if (dtMape < minMape && dtMape < hlMape) { minMape = dtMape; bestFitModel = 'Damped Trend'; }
  if (hwMape < minMape && len >= 24) { minMape = hwMape; bestFitModel = 'Holt-Winters'; }

  // 5. Apply primary selection logic and construct recommendation
  let recommended: ForecastModel = 'Simple Exponential Smoothing';
  let reason = '';
  let confidence: 'Low' | 'Medium' | 'High' = 'High';

  if (len < 6) {
    recommended = 'Simple Exponential Smoothing';
    reason = `Short history of ${len} months detected. A simple level-only model is recommended to prevent over-fitting.`;
    confidence = 'Low';
  } else if (seasonalityDetected && len >= 12) {
    recommended = len >= 24 ? 'Holt-Winters' : 'Holt Linear';
    if (len >= 24) {
      reason = 'Recurring monthly peaks and seasonal cycles detected over a solid multi-year history. Holt-Winters triple exponential smoothing is ideal here.';
      confidence = 'High';
    } else {
      reason = 'Seasonal monthly peaks identified, but history is too brief for a full 24-month Holt-Winters cycle. Holt Linear is recommended as a robust alternative.';
      confidence = 'Medium';
    }
  } else if (clearTrend) {
    if (trendIsStable && hlOpt.mse <= dtOpt.mse) {
      recommended = 'Holt Linear';
      reason = `Clear growth pattern detected with a stable, consistent direction over the last ${len} months.`;
      confidence = 'High';
    } else {
      recommended = 'Damped Trend';
      reason = `Consistent growth pattern is visible, but exhibits standard fluctuations or potential flattening. Damped Trend will safely taper off over-projections.`;
      confidence = 'Medium';
    }
  } else {
    // Stable / level series
    recommended = 'Simple Exponential Smoothing';
    reason = 'Flat or highly stable series with no strong pattern detected over the available history.';
    confidence = 'High';
  }

  // 6. Backtesting refinement: If the backtesting winner's error is significantly lower, upgrade the recommendation
  if (len >= 6 && recommended !== bestFitModel) {
    const currentMape = recommended === 'Simple Exponential Smoothing' ? sesMape :
                         recommended === 'Holt Linear' ? hlMape :
                         recommended === 'Damped Trend' ? dtMape : hwMape;
    
    // If the backtesting model reduces the forecast error by over 15% relative
    if (minMape < currentMape * 0.85 && isFinite(minMape)) {
      const isHWAllowed = bestFitModel !== 'Holt-Winters' || len >= 24;
      if (isHWAllowed) {
        recommended = bestFitModel;
        reason = `Refined by historical backtesting: "${bestFitModel}" achieved the lowest fitted error of ${minMape.toFixed(1)}% (improving upon original heuristic error of ${currentMape.toFixed(1)}%).`;
        confidence = 'High';
      }
    }
  }

  // Labels for metrics panel
  const trendStrengthLabel = trendStrength > 0.65 ? 'Consistent' : trendStrength > 0.3 ? 'Moderate' : 'No clear trend';
  const trendStabilityLabel = trendIsStable ? 'Stable direction' : 'Expected to flatten or fluctuate';
  const seasonalityLabel = seasonalityDetected ? 'Recurring monthly peaks' : 'No strong pattern detected';
  const volatilityLabel = relVolatility > 0.25 ? 'High volatility' : relVolatility > 0.1 ? 'Moderate volatility' : 'Low volatility';

  return {
    recommendedModel: recommended,
    reason,
    confidence,
    metrics: {
      historyLength: len,
      trendStrengthLabel,
      trendStabilityLabel,
      seasonalityLabel,
      volatilityLabel,
      bestModelByFit: bestFitModel,
      fitMapeValues: {
        'Simple Exponential Smoothing': isFinite(sesMape) ? sesMape : 0,
        'Holt Linear': isFinite(hlMape) ? hlMape : 0,
        'Damped Trend': isFinite(dtMape) ? dtMape : 0,
        'Holt-Winters': isFinite(hwMape) ? hwMape : 0,
      }
    }
  };
}

export interface ConfidenceRecommendation {
  profile: 'Stable' | 'Balanced' | 'Cautious';
  preHorizonZ: number;
  postHorizonMultiplier: number;
  confidenceHorizon: number;
  reason: string;
  strength: 'Low' | 'Medium' | 'High';
}

/**
 * High-quality confidence settings recommendation engine.
 * Classifies the time series segment into a risk profile (Stable, Balanced, Cautious)
 * based on history length, relative volatility, average volume, and backtesting fit error.
 */
export function analyzeAndRecommendConfidence(
  values: number[],
  calendarStartMonth = 0
): ConfidenceRecommendation {
  const len = values.length;

  if (len < 4) {
    return {
      profile: 'Cautious',
      preHorizonZ: 1.96,
      postHorizonMultiplier: 2.0,
      confidenceHorizon: 2,
      reason: 'This segment has limited history and higher month-to-month movement, so a wider forecast range is recommended.',
      strength: 'Low',
    };
  }

  const sumY = values.reduce((a, b) => a + b, 0);
  const mean = sumY / len;

  // Linear regression to get detrended SD for volatility
  let sumX = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < len; i++) {
    sumX += i;
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = len * sumXX - sumX * sumX;
  let detrendedSD = 0;
  if (denom !== 0) {
    const slope = (len * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / len;
    let sse = 0;
    for (let i = 0; i < len; i++) {
      const pred = intercept + slope * i;
      const err = values[i] - pred;
      sse += err * err;
    }
    detrendedSD = Math.sqrt(sse / Math.max(1, len - 1));
  } else {
    let varY = 0;
    for (let i = 0; i < len; i++) {
      const diffY = values[i] - mean;
      varY += diffY * diffY;
    }
    detrendedSD = Math.sqrt(varY / Math.max(1, len - 1));
  }
  const relVolatility = mean > 0 ? (detrendedSD / mean) : 0;

  // Check for zeros or missing style irregularities
  const hasZeroOrNegative = values.some(v => v <= 0);

  // Compute best backtesting fitted error (min MAPE among the standard models)
  const sesOpt = optimiseSES(values);
  const hlOpt = optimiseHW(values);
  const dtOpt = optimiseDampedTrend(values);

  const sesMape = mean > 0 ? (sesOpt.sigma / mean) * 100 : 0;
  const hlMape  = mean > 0 ? (hlOpt.sigma / mean) * 100 : 0;
  const dtMape  = mean > 0 ? (dtOpt.sigma / mean) * 100 : 0;

  let hwMape = Infinity;
  if (len >= 24) {
    const hwOpt = optimiseHWTriple(values, calendarStartMonth);
    hwMape = hwOpt.sigma * 100;
  }

  const minMape = Math.min(
    isFinite(sesMape) ? sesMape : Infinity,
    isFinite(hlMape) ? hlMape : Infinity,
    isFinite(dtMape) ? dtMape : Infinity,
    isFinite(hwMape) ? hwMape : Infinity
  );

  // Define decision components
  const isHighVolatility = relVolatility > 0.28;
  const isLowVolatility = relVolatility < 0.12;
  const isHighError = minMape > 25;
  const isLowError = minMape < 12;
  const isLowVolume = mean < 50;

  // Primary profile classification rules
  let profile: 'Stable' | 'Balanced' | 'Cautious' = 'Balanced';
  let reason = '';
  let strength: 'Low' | 'Medium' | 'High' = 'Medium';

  if (len < 6) {
    profile = 'Cautious';
    reason = 'This segment has limited history and higher month-to-month movement, so a wider forecast range is recommended.';
    strength = 'High';
  } else if (len >= 6 && len < 12) {
    if (isLowVolatility) {
      profile = 'Balanced';
      reason = 'This segment has some usable history but moderate duration, and exhibits stable volatility. A balanced forecast range is recommended.';
      strength = 'Medium';
    } else {
      profile = 'Cautious';
      reason = 'This segment has limited history and higher month-to-month movement, so a wider forecast range is recommended.';
      strength = 'High';
    }
  } else if (isHighVolatility) {
    profile = 'Cautious';
    reason = 'This segment has limited history and higher month-to-month movement, so a wider forecast range is recommended.';
    strength = 'High';
  } else if (isLowVolume) {
    if (isHighVolatility || hasZeroOrNegative) {
      profile = 'Cautious';
      reason = 'This segment has limited history and higher month-to-month movement, so a wider forecast range is recommended.';
      strength = 'Medium';
    } else {
      profile = 'Balanced';
      reason = 'This segment has enough history, but some month-to-month movement is present. A balanced forecast range is recommended.';
      strength = 'Medium';
    }
  } else if (isHighError) {
    profile = 'Cautious';
    reason = 'Previous forecasts were less reliable for this segment, so the optimistic and pessimistic range should be wider.';
    strength = 'High';
  } else if (isLowError && isLowVolatility && len >= 12 && !hasZeroOrNegative) {
    profile = 'Stable';
    reason = 'This segment has a stable historical pattern and previous forecasts were close to actuals, so a narrower forecast range is suitable.';
    strength = 'High';
  } else {
    profile = 'Balanced';
    reason = 'This segment has enough history, but some month-to-month movement is present. A balanced forecast range is recommended.';
    strength = 'Medium';
  }

  // Choose settings based on profiles
  if (profile === 'Stable') {
    return {
      profile: 'Stable',
      preHorizonZ: 1.28,
      postHorizonMultiplier: 1.25,
      confidenceHorizon: 6,
      reason,
      strength,
    };
  } else if (profile === 'Cautious') {
    return {
      profile: 'Cautious',
      preHorizonZ: 1.96,
      postHorizonMultiplier: 2.0,
      confidenceHorizon: 2, // 1 to 3 months
      reason,
      strength,
    };
  } else {
    return {
      profile: 'Balanced',
      preHorizonZ: 1.64,
      postHorizonMultiplier: 1.5,
      confidenceHorizon: 3,
      reason,
      strength,
    };
  }
}


