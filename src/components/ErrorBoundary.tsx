import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../i18n';

/**
 * Translate WITHOUT the useTranslation hook.
 *
 * This is a class component, so the hook is unavailable — but the deeper reason
 * is that this component is the last line of defence and must not depend on the
 * app runtime it is catching for. `i18n.t` returns the key (or the supplied
 * fallback) when lookup fails rather than throwing, so a broken i18n state
 * degrades to English here instead of throwing inside the error screen.
 */
const tr = (key: string, fallback: string): string => {
  try { return i18n.t(key, { defaultValue: fallback }) as string; }
  catch { return fallback; }
};

/**
 * Top-level error boundary.
 *
 * A React render throw unmounts the whole tree and leaves a blank white page —
 * no message, no stack, nothing to report. That is the worst possible failure
 * presentation, and this crash class provably exists: Jon's A5 walk blanked the
 * app on a cohort whose null resolution is correct and spec-proven.
 *
 * This does not prevent crashes. It converts them from a blank page into
 * something a user can report and a developer can act on.
 *
 * DEV shows the full message and both stacks, because the person looking at it
 * can fix it. PROD shows a plain apology and a reload, because a stack trace is
 * not useful to a UAT tester and an unexplained blank screen is not either.
 *
 * Deliberately a class: `getDerivedStateFromError` / `componentDidCatch` have
 * no hook equivalent. This is the one place a class component is required.
 */
interface Props {
  children: ReactNode;
  /**
   * Show the full message and stacks. Defaults to the Vite dev flag.
   *
   * Explicit rather than only read from the environment, because
   * `import.meta.env` exists only in a Vite build — under the spec runner it is
   * undefined, so without this the verbose branch could never be exercised and
   * the half of this component that matters most to a developer would ship
   * untested.
   */
  dev?: boolean;
}
interface State { error: Error | null; info: ErrorInfo | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    // Keep the console record too: the on-screen copy is for the person who hit
    // it, the console copy is what gets pasted into a bug report.
    console.error('[PROSPECT] Uncaught render error:', error, info.componentStack);
  }

  private reset = () => {
    // A full reload, not a state reset. Whatever produced the throw is still in
    // the app's state, so re-rendering the same tree would throw again — and a
    // button that appears to do nothing is worse than no button.
    window.location.reload();
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    // Vite replaces import.meta.env.DEV at build time, so the production bundle
    // does not carry the dev branch.
    //
    // Cast because this project has no `vite/client` type reference anywhere,
    // so `import.meta.env` is untyped. Adding one is the tidier fix and would
    // ripple type changes through a branch already under gate; that belongs in
    // its own change, not this one.
    const isDev = this.props.dev ?? Boolean((import.meta as any).env?.DEV);

    return (
      <div className="min-h-screen bg-slate-50 flex items-start justify-center p-8 overflow-auto">
        <div className="max-w-3xl w-full space-y-4">
          <h1 className="text-xl font-semibold text-slate-900">
            {isDev ? tr('errorboundary_dev_title', 'Render error') : tr('errorboundary_prod_title', 'Something went wrong')}
          </h1>

          {isDev ? (
            <>
              <p className="text-sm text-slate-600">
                {tr('errorboundary_dev_body', 'The app stopped rendering. Full detail below — this panel is shown in development only.')}
              </p>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="font-mono text-sm font-semibold text-red-800 break-words">
                  {error.name}: {error.message}
                </p>
                {error.stack && (
                  <pre className="text-[11px] leading-relaxed text-red-900 whitespace-pre-wrap break-words max-h-72 overflow-auto">
                    {error.stack}
                  </pre>
                )}
                {info?.componentStack && (
                  <details open>
                    <summary className="text-xs font-semibold text-red-800 cursor-pointer">
                      {tr('errorboundary_component_stack', 'Component stack')}
                    </summary>
                    <pre className="mt-2 text-[11px] leading-relaxed text-red-900 whitespace-pre-wrap break-words max-h-72 overflow-auto">
                      {info.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              {tr('errorboundary_prod_body', 'PROSPECT hit an unexpected problem and could not finish drawing this screen. Your uploaded data has not been changed. Reloading usually clears it; if it happens again, please report what you were doing.')}
            </p>
          )}

          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#e60000] text-white rounded-lg text-sm font-semibold hover:bg-[#cc0000] transition-colors"
          >
            {tr('errorboundary_reload', 'Reload PROSPECT')}
          </button>
        </div>
      </div>
    );
  }
}
