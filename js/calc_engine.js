/**
 * B·W CABLE — Electrician Calculator Engine
 * Formulas:
 *   I = P(kW)*1000 / (V * PF * √3) [3φ]  or  I = P(kW)*1000 / (V * PF) [1φ]
 *   V_drop% = (k * I * L * ρ) / S / V * 100
 *     k=2 [1φ], k=√3 [3φ], ρ=0.01786 Ω·mm²/m (Cu @ 20°C, IEC 60287)
 *   Cu weight = cores * S(mm²) * L(m) * 0.00889 kg
 */

/* ── IEC standard wire sizes (mm²) ────────────────────── */
const IEC_SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];

/* ── Approximate ampacity table (Cu, PVC, air/conduit) ─ */
const AMPACITY_CU = {
  1.5: 18, 2.5: 25, 4: 34, 6: 46,
  10: 63, 16: 85, 25: 115, 35: 138,
  50: 165, 70: 207, 95: 250, 120: 285
};

/* ── Material correction: Al ≈ 0.61× Cu ampacity ─────── */
function getAmpacityTable(material) {
  if (material === 'al') {
    const t = {};
    for (const [s, a] of Object.entries(AMPACITY_CU)) t[s] = Math.round(a * 0.61);
    return t;
  }
  return AMPACITY_CU;
}

/* ── Find smallest IEC size whose ampacity ≥ current ──── */
function pickWireSize(current, material) {
  const table = getAmpacityTable(material);
  for (const s of IEC_SIZES) {
    if (table[s] >= current) return s;
  }
  return null; // exceeds 120 mm²
}

/* ═══════════════════════════════════════════════════════
   1. Ampacity + Voltage Drop Calculator
   ═══════════════════════════════════════════════════════ */
function calculateAmpacity() {
  const phase   = document.getElementById('amp-phase')?.value || '3';
  const material = document.getElementById('amp-material')?.value || 'cu';
  const powerKW = parseFloat(document.getElementById('amp-power')?.value);
  const lengthM = parseFloat(document.getElementById('amp-length')?.value);

  /* Validate inputs */
  if (!phase || !material || isNaN(powerKW) || isNaN(lengthM) || powerKW <= 0 || lengthM < 0) {
    showResult('amp-current', '—');
    showResult('amp-wire', '—');
    showResult('amp-vdrop', '—');
    showResult('amp-warn', '');
    return;
  }

  const V = phase === '1' ? 230 : 400;
  const PF = 0.85;
  const sqrt3 = Math.sqrt(3);
  const denom = V * PF * (phase === '3' ? sqrt3 : 1);
  const currentA = (powerKW * 1000) / denom;

  const wireS = pickWireSize(currentA, material);

  /* Voltage drop: V_drop% = (k * I * L * ρ) / S / V * 100
   * k=2 [1φ round-trip], k=√3 [3φ line-to-line] */
  let vDropPct = null;
  if (wireS !== null) {
    const k = phase === '1' ? 2 : sqrt3;
    const rho = 0.01786; // Ω·mm²/m at ~20°C (Cu, IEC 60287)
    vDropPct = (k * currentA * lengthM * rho) / wireS / V * 100;
  }

  /* Update DOM */
  showResult('amp-current', currentA.toFixed(1) + ' A');
  showResult('amp-wire', wireS ? wireS + ' mm²' : '≥150 mm²');
  showResult('amp-vdrop', vDropPct !== null ? vDropPct.toFixed(2) + '%' : '—');

  /* Warning if >3% */
  const warnEl = document.getElementById('amp-warn');
  if (vDropPct !== null && vDropPct > 3) {
    warnEl.textContent = '⚠️ 压降超过 3%，建议增大线径或缩短距离';
    warnEl.className = 'text-amber-400 text-xs mt-2';
  } else if (vDropPct !== null) {
    warnEl.textContent = '';
  } else {
    warnEl.textContent = '电流超出 120 mm² 承载范围，请选用更大规格电缆';
    warnEl.className = 'text-rose-400 text-xs mt-2';
  }
}

/* ═══════════════════════════════════════════════════════
   2. Copper Weight + Cost Estimator
   ═══════════════════════════════════════════════════════ */
function calculateCopper() {
  const size     = parseFloat(document.getElementById('cop-size')?.value);
  const cores    = parseInt(document.getElementById('cop-cores')?.value);
  const lengthM  = parseFloat(document.getElementById('cop-length')?.value);

  if (isNaN(size) || isNaN(cores) || isNaN(lengthM) || size <= 0 || cores <= 0 || lengthM <= 0) {
    showResult('cop-weight', '—');
    showResult('cop-value', '—');
    return;
  }

  const weightKg = cores * size * lengthM * 0.00889;
  const valueUSD = weightKg * 9.80;

  showResult('cop-weight', weightKg.toFixed(1) + ' kg');
  showResult('cop-value', '$' + valueUSD.toFixed(2));
}

/* ═══════════════════════════════════════════════════════
   3. Tab Switcher
   ═══════════════════════════════════════════════════════ */
function switchCalcTab(name) {
  /* Deactivate all tab buttons */
  document.querySelectorAll('.calc-tab-btn').forEach(btn => {
    btn.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold');
    btn.classList.add('bg-slate-200', 'text-slate-700');
  });

  /* Activate clicked tab button */
  const activeBtn = document.querySelector(`[data-calc-tab="${name}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-slate-200', 'text-slate-700');
    activeBtn.classList.add('bg-amber-500', 'text-slate-950', 'font-bold');
  }

  /* Show/hide panels */
  ['ampacity-panel', 'copper-panel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== name + '-panel');
  });
}

/* ── Helper: safely set textContent ───────────────────── */
function showResult(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ═══════════════════════════════════════════════════════
   Auto-calculate on any input change
   ═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const ampInputs = ['amp-phase', 'amp-material', 'amp-power', 'amp-length'];
  const copInputs = ['cop-size', 'cop-cores', 'cop-length'];

  [...ampInputs, ...copInputs].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        calculateAmpacity();
        calculateCopper();
      });
      el.addEventListener('change', () => {
        calculateAmpacity();
        calculateCopper();
      });
    }
  });

  /* Initial calc */
  calculateAmpacity();
  calculateCopper();
});
