/**
 * Layout probe — measures REAL components in REAL grid classes.
 *
 * WHY THIS EXISTS
 * ---------------
 * Three consecutive hand-written repros of HierarchicalDropdown each agreed
 * with themselves and each disagreed with the running app. A reconstruction of
 * a component is a reimplementation: it can only confirm the reconstruction.
 * The month input clipped to "ugust 2026" on three of four cards while a repro
 * reported "no starved track and no spill at any width".
 *
 * So: import the actual component, mount it, measure the DOM it produces.
 *
 * The grid class string below is the one the cards use. It is asserted
 * identical to the source by `npm run spec:cards`, so this probe cannot drift
 * away from what the app renders without that check failing.
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/i18n';
import '../../src/index.css';
import { HierarchicalDropdown, type HierarchicalSelection } from '../../src/components/HierarchicalDropdown';

/** Must match the band grid in WhatIfTab.tsx — spec:cards asserts it does. */
const BAND_GRID = 'grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4 items-start';

/** A tree whose labels are as long as the ones in the screenshots. */
const CHANNEL_TREE = new Map<string, string[]>([
  ['Direct', ['Call Centre / Tele-sales', 'Retail Store', 'Web Self-Serve']],
  ['Indirect', ['Partner Reseller', 'Distributor']],
]);
const PRODUCT_TREE = new Map<string, string[]>([
  ['Mobile Voice', ['High Value', 'Medium Value', 'Low Value']],
  ['IoT Connectivity', ['Managed', 'Unmanaged']],
]);

function Cell({ label, children }: { label: string; children: React.ReactNode; key?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Band({ n, sel }: { n: number; sel: HierarchicalSelection }) {
  const [v, setV] = useState<HierarchicalSelection>(sel);
  React.useEffect(() => setV(sel), [sel.l1, sel.l2]);

  // Band 1 as the cards build it: a stream select, Segment, Product, Channel,
  // optionally Tariff, then Month last.
  const cells: React.ReactNode[] = [];
  cells.push(
    <Cell key="ibro" label="IBRO Type">
      <select className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none">
        <option>Inflow</option>
      </select>
    </Cell>,
  );
  if (n >= 5) {
    cells.push(
      <Cell key="seg" label="Segment">
        <select className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none">
          <option>All Segments</option>
        </select>
      </Cell>,
    );
  }
  cells.push(
    <Cell key="prod" label="Product">
      <HierarchicalDropdown label="" tree={PRODUCT_TREE}
        value={{ l1: 'Mobile Voice', l2: 'High Value' }} onChange={() => {}}
        variant="light" className="w-full" />
    </Cell>,
  );
  cells.push(
    <Cell key="chan" label="Channel">
      <HierarchicalDropdown label="" tree={CHANNEL_TREE} value={v} onChange={setV}
        variant="light" className="w-full" />
    </Cell>,
  );
  if (n >= 6) {
    cells.push(
      <Cell key="tar" label="Tariff">
        <HierarchicalDropdown label="" tree={PRODUCT_TREE} value={{ l1: 'Mobile Voice', l2: null }}
          onChange={() => {}} variant="light" className="w-full" />
      </Cell>,
    );
  }
  cells.push(
    <Cell key="month" label="Month">
      <input id="probe-month" type="month" defaultValue="2026-08"
        className="w-full text-sm border border-slate-200 rounded-lg p-2 bg-white outline-none" />
    </Cell>,
  );
  return <div className={BAND_GRID} id="probe-band">{cells}</div>;
}

function Probe() {
  const [width, setWidth] = useState(973);
  const [n, setN] = useState(5);
  const [sel, setSel] = useState<HierarchicalSelection>({ l1: 'Direct', l2: 'Call Centre / Tele-sales' });

  (window as any).__probe = (w: number, count: number, long = true) => {
    setWidth(w); setN(count);
    setSel(long ? { l1: 'Direct', l2: 'Call Centre / Tele-sales' } : { l1: null, l2: null });
  };

  return (
    <div className="p-8 bg-slate-50">
      <div id="probe-container" className="bg-white rounded-2xl p-6" style={{ width }}>
        <Band n={n} sel={sel} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('probe-root')!).render(<Probe />);
