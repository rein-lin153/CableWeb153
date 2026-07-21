// ============================================================
// GCC Cable — គណនាករអ្នកដំបងអគ្គិសនី 9 合 1 (电工计算器套件)
// All math & DOM interaction logic separated from HTML
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    initCableSizeCalculator();
    initCopperWeightCalculator();
    initDistributionCalculator();
    initPowerConverter();
    initTransformerCalculator();
    initACDCCalculator();
    initEDCCalculator();
    initLightingCalculator();
    initConduitCalculator();
});

/* ---------- Utility helpers ---------- */
function val(id) {
    const el = document.getElementById(id);
    if (!el) return NaN;
    const v = parseFloat(el.value);
    return isNaN(v) ? NaN : v;
}

function showResult(id, html, type = 'neutral') {
    const el = document.getElementById(id);
    if (!el) return;
    const colors = {
        neutral: 'bg-slate-800 border-slate-700 text-slate-200',
        success: 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300',
        warning: 'bg-yellow-950/40 border-yellow-600/50 text-yellow-300',
        danger: 'bg-rose-950/40 border-rose-600/50 text-rose-300',
        info: 'bg-cyan-950/40 border-cyan-600/50 text-cyan-300'
    };
    el.className = `mt-3 p-3 rounded-lg border text-sm font-semibold ${colors[type] || colors.neutral}`;
    el.innerHTML = html;
}

function safetyBar(pct) {
    let cls, label, khmer;
    if (pct < 3) { cls = 'bg-emerald-500'; label = pct.toFixed(2) + '%'; khmer = '✅ ល្អ (安全)'; }
    else if (pct < 5) { cls = 'bg-yellow-500'; label = pct.toFixed(2) + '%'; khmer = '⚠️ ប្រុងប្រយ័ត្ន (注意)'; }
    else { cls = 'bg-rose-500'; label = pct.toFixed(2) + '%'; khmer = '❌ ហានិភ័យ (危险)'; }
    const w = Math.min(pct / 10 * 100, 100);
    return `<div class="flex items-center gap-3"><div class="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden"><div class="h-full ${cls} transition-all" style="width:${w}%"></div></div><span class="text-xs whitespace-nowrap">${label} — ${khmer}</span></div>`;
}

/* Standard cable sizes (mm²) */
const CABLE_SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

// ---------- 1. Cable Size & Voltage Drop ----------
function initCableSizeCalculator() {
    document.getElementById('btn-cable-size')?.addEventListener('click', () => {
        const phase = document.getElementById('cable-phase')?.value;
        const material = document.getElementById('cable-material')?.value;
        const powerKW = val('cable-power');
        const lengthM = val('cable-length');
        const voltage = phase === 'single' ? 220 : 380;

        if (isNaN(powerKW) || isNaN(lengthM) || powerKW <= 0 || lengthM < 0) {
            showResult('cable-result', 'សូមបញ្ចូលថាមពល និងចម្ងាយ (请输入功率和长度)');
            return;
        }

        const pf = 0.85;
        const current = phase === 'single'
            ? (powerKW * 1000) / (voltage * pf)
            : (powerKW * 1000) / (Math.sqrt(3) * voltage * pf);

        const conductivity = material === 'copper' ? 56 : 35; // m/(Ω·mm²)
        let recommended = CABLE_SIZES[CABLE_SIZES.length - 1];
        let voltageDropPct = 0;

        for (const size of CABLE_SIZES) {
            // R_phase = L / (σ × S) — single conductor resistance per meter
            const r = lengthM / (conductivity * size);
            // 1φ: V_drop = 2 × I × R (round trip); 3φ: V_drop = √3 × I × R (line-to-line)
            const vdrop = phase === 'single' ? 2 * current * r : Math.sqrt(3) * current * r;
            const vdropPct = (vdrop / voltage) * 100;
            if (vdropPct <= 3) {
                recommended = size;
                voltageDropPct = vdropPct;
                break;
            }
        }

        // If none meets <3%, use largest and report actual drop
        if (voltageDropPct === 0) {
            const size = CABLE_SIZES[CABLE_SIZES.length - 1];
            const r = lengthM / (conductivity * size);
            voltageDropPct = phase === 'single'
                ? (2 * current * r / voltage) * 100
                : (Math.sqrt(3) * current * r / voltage) * 100;
            recommended = size;
        }

        const barHtml = safetyBar(voltageDropPct);
        showResult('cable-result',
            `电流 (Current): <b>${current.toFixed(2)} A</b><br>` +
            `推荐线径 (Recommended): <b class="text-amber-400">${recommended} mm²</b><br>` +
            `电压降 (Voltage Drop): ${barHtml}`,
            voltageDropPct < 3 ? 'success' : voltageDropPct < 5 ? 'warning' : 'danger'
        );
    });
}

// ---------- 2. Copper Weight & Cost ----------
function initCopperWeightCalculator() {
    document.getElementById('btn-copper-weight')?.addEventListener('click', () => {
        const area = val('cu-area');
        const cores = parseInt(document.getElementById('cu-cores')?.value) || 1;
        const length = val('cu-length');
        if (isNaN(area) || isNaN(length) || area <= 0 || length <= 0) {
            showResult('copper-result', 'សូមបញ្ចូល截面积 និងប្រវែង (请输入截面积和长度)');
            return;
        }

        const density = 0.00889; // kg/m per mm²
        const pureWeight = area * cores * length * density;
        const lmePrice = 9.8; // USD/kg
        const totalCost = pureWeight * lmePrice;

        showResult('copper-result',
            `纯铜重量 (Pure Copper Weight): <b class="text-emerald-400">${pureWeight.toFixed(2)} kg</b><br>` +
            `LME 铜价估算 (Estimated Cost @ $${lmePrice}/kg): <b class="text-amber-400">$${totalCost.toFixed(2)}</b>`,
            'success'
        );
    });
}

// ---------- 3. Distribution System Design ----------
function initDistributionCalculator() {
    const addBtn = document.getElementById('btn-add-device');
    const listEl = document.getElementById('device-list');

    let deviceCount = 0;
    function addDeviceRow(p = '', name = '') {
        deviceCount++;
        const row = document.createElement('div');
        row.id = `device-row-${deviceCount}`;
        row.className = 'grid grid-cols-[1fr_100px_80px_36px] gap-2 items-center mb-2';
        row.innerHTML = `
            <input type="text" placeholder="ឈ្មោះ (设备名)" value="${name}" class="device-name bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 outline-none">
            <input type="number" placeholder="kW" class="device-kw bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-500 outline-none" value="${p}">
            <select class="device-pf bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm text-white focus:border-amber-500 outline-none">
                <option value="0.8">0.8</option>
                <option value="0.85" selected>0.85</option>
                <option value="0.9">0.9</option>
            </select>
            <button type="button" class="btn-remove-device bg-rose-600 hover:bg-rose-500 text-white rounded px-2 py-2 text-sm" onclick="this.closest('div[id^=device-row]').remove()">×</button>
        `;
        listEl.appendChild(row);
    }

    addBtn?.addEventListener('click', () => addDeviceRow());

    document.getElementById('btn-distribution')?.addEventListener('click', () => {
        const rows = listEl.querySelectorAll('[id^=device-row]');
        if (rows.length === 0) { showResult('distribution-result', 'សូមបន្ថែមឧបករណ៍ (请添加设备)'); return; }

        let totalKW = 0;
        let totalKVA = 0;
        rows.forEach(row => {
            const kw = parseFloat(row.querySelector('.device-kw')?.value) || 0;
            const pf = parseFloat(row.querySelector('.device-pf')?.value) || 0.85;
            totalKW += kw;
            totalKVA += kw / pf;
        });

        const demandFactor = 0.75;
        const calcKVA = totalKVA * demandFactor;
        const calcKW = calcKVA * 0.85;
        const voltage = 400;
        const current = calcKW * 1000 / (Math.sqrt(3) * voltage * 0.85);

        // Recommend breaker size (standard: 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400)
        // Breaker rated ≥ 1.25 × calculated current (per IEC standard safety margin)
        const breakers = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400];
        let recommendedBreaker = breakers[breakers.length - 1];
        for (const b of breakers) {
            if (b >= current * 1.25) { recommendedBreaker = b; break; }
        }

        showResult('distribution-result',
            `总功率 (Total Power): <b>${totalKW.toFixed(1)} kW</b><br>` +
            `需要系数 (Demand Factor ×${demandFactor}): <b class="text-amber-400">${calcKW.toFixed(1)} kW / ${calcKVA.toFixed(1)} kVA</b><br>` +
            `计算电流 (Calculated Current): <b>${current.toFixed(1)} A</b><br>` +
            `主断路器推荐 (Main Breaker @1.25×): <b class="text-emerald-400">${recommendedBreaker} A</b>`,
            'info'
        );
    });

    // Add one default row on load
    addDeviceRow();
}

// ---------- 4. P/I/V/PF Converter ----------
function initPowerConverter() {
    document.getElementById('btn-power-conv')?.addEventListener('click', () => {
        const phase = document.getElementById('pc-phase')?.value;
        const unknown = document.getElementById('pc-unknown')?.value;
        const sqrt3 = Math.sqrt(3);

        if (unknown === 'i') {
            const p = val('pc-p'); const v = val('pc-v'); const pf = val('pc-pf');
            if (isNaN(p) || isNaN(v) || isNaN(pf) || !p || !v || !pf) {
                showResult('power-conv-result', 'សូមបញ្ចូលថាមពល, វ៉ុល, PF (请输入功率、电压、功率因数)');
                return;
            }
            // P is in kW, convert to W for current calculation
            const i = phase === 'single'
                ? (p * 1000) / (v * pf)
                : (p * 1000) / (sqrt3 * v * pf);
            showResult('power-conv-result', `电流 (Current): <b class="text-amber-400">${i.toFixed(2)} A</b>`, 'success');
        } else if (unknown === 'v') {
            const p = val('pc-p'); const i = val('pc-i'); const pf = val('pc-pf');
            if (isNaN(p) || isNaN(i) || isNaN(pf) || !p || !i || !pf) {
                showResult('power-conv-result', 'សូមបញ្ចូលថាមពល, 电流, PF (请输入功率、电流、功率因数)');
                return;
            }
            // P is in kW, convert to W
            const v = phase === 'single'
                ? (p * 1000) / (i * pf)
                : (p * 1000) / (sqrt3 * i * pf);
            showResult('power-conv-result', `电压 (Voltage): <b class="text-amber-400">${v.toFixed(2)} V</b>`, 'success');
        } else if (unknown === 'pf') {
            const p = val('pc-p'); const v = val('pc-v'); const i = val('pc-i');
            if (isNaN(p) || isNaN(v) || isNaN(i) || !p || !v || !i) {
                showResult('power-conv-result', 'សូមបញ្ចូលថាមពល, 电压, 电流 (请输入功率、电压、电流)');
                return;
            }
            // P is in kW, convert to W
            const pf = phase === 'single'
                ? (p * 1000) / (v * i)
                : (p * 1000) / (sqrt3 * v * i);
            showResult('power-conv-result', `功率因数 (Power Factor): <b class="text-amber-400">${pf.toFixed(3)}</b>`, 'success');
        } else {
            const v = val('pc-v'); const i = val('pc-i'); const pf = val('pc-pf');
            if (isNaN(v) || isNaN(i) || !v || !i) {
                showResult('power-conv-result', 'សូមបញ្ចូលវ៉ុល និង电流 (请输入电压和电流)');
                return;
            }
            // Output in W then convert to kW for display
            const pW = phase === 'single' ? v * i * (pf || 1) : sqrt3 * v * i * (pf || 1);
            showResult('power-conv-result',
                `功率 (Power): <b class="text-amber-400">${pW.toFixed(2)} W (${(pW / 1000).toFixed(3)} kW)</b>`,
                'success');
        }
    });
}

// ---------- 5. Transformer Primary/Secondary Current ----------
function initTransformerCalculator() {
    document.getElementById('btn-transformer')?.addEventListener('click', () => {
        const kva = val('xfmr-kva');
        if (isNaN(kva) || !kva) {
            showResult('transformer-result', 'សូមបញ្ចូល容量 kVA (请输入变压器容量)');
            return;
        }

        const vp = 22; // kV primary
        const vs = 0.4; // kV secondary (400V)
        // I = S(kVA) / (√3 × V(kV)) → result in Amperes
        const ip = kva / (Math.sqrt(3) * vp); // A at 22kV
        const isec = kva / (Math.sqrt(3) * vs); // A at 400V

        showResult('transformer-result',
            `高压侧电流 (Primary @ 22kV): <b class="text-amber-400">${ip.toFixed(2)} A</b><br>` +
            `低压侧电流 (Secondary @ 400V): <b class="text-emerald-400">${isec.toFixed(2)} A</b>`,
            'info'
        );
    });
}

// ---------- 6. AC vs DC Current Comparison ----------
function initACDCCalculator() {
    document.getElementById('btn-acdc')?.addEventListener('click', () => {
        const powerKW = val('acdc-power');
        const voltage = val('acdc-voltage');
        const pf = val('acdc-pf');
        if (isNaN(powerKW) || isNaN(voltage) || !powerKW || !voltage) {
            showResult('acdc-result', 'សូមបញ្ចូល功率 និង电压 (请输入功率和电压)');
            return;
        }

        const pW = powerKW * 1000;
        const acI = voltage >= 1000
            ? pW / (Math.sqrt(3) * voltage * pf)
            : pW / (voltage * pf);
        const dcI = pW / voltage;
        // Approx line resistance per meter for comparison (assume same cable)
        const acLoss = (acI * acI * 0.001); // relative loss factor
        const dcLoss = (dcI * dcI * 0.001);

        showResult('acdc-result',
            `AC 电流 (AC Current @ PF=${pf}): <b class="text-amber-400">${acI.toFixed(2)} A</b><br>` +
            `DC 电流 (DC Current): <b class="text-emerald-400">${dcI.toFixed(2)} A</b><br>` +
            `差异 (Difference): <b>${((acI - dcI) / dcI * 100).toFixed(1)}%</b> | AC 线损相对更高 (Higher line loss)`
        );
    });
}

// ---------- 7. EDC Electricity Bill Calculator ----------
function initEDCCalculator() {
    document.getElementById('btn-edc')?.addEventListener('click', () => {
        const kWh = val('edc-kwh');
        if (isNaN(kWh) || !kWh) {
            showResult('edc-result', 'សូមបញ្ចូល月用电量 kWh (请输入月用电量)');
            return;
        }

        // Cambodia EDC tier pricing (approximate commercial/residential 2024-2026)
        // Tier 1: 0-200 kWh @ 450 KHR/kWh (residential subsidy)
        // Tier 2: 201-790 kWh @ 610 KHR/kWh
        // Tier 3: 791-1500 kWh @ 790 KHR/kWh
        // Tier 4: >1500 kWh @ 900 KHR/kWh
        // Commercial flat: ~750 KHR/kWh
        const isCommercial = document.getElementById('edc-type')?.value === 'commercial';
        const rate = isCommercial ? 750 : null;

        let totalKHR = 0;
        let breakdown = '';

        if (isCommercial) {
            totalKHR = kWh * rate;
            breakdown = `商业电价 (Commercial Rate): ${rate} KHR/kWh`;
        } else {
            const tiers = [
                { max: 200, rate: 450, label: '0–200 kWh' },
                { max: 790, rate: 610, label: '201–790 kWh' },
                { max: 1500, rate: 790, label: '791–1500 kWh' },
                { max: Infinity, rate: 900, label: '>1500 kWh' }
            ];
            let remaining = kWh;
            let prevMax = 0;
            for (const t of tiers) {
                if (remaining <= 0) break;
                const qty = Math.min(remaining, t.max - prevMax);
                totalKHR += qty * t.rate;
                breakdown += `${t.label}: ${qty.toFixed(0)} kWh × ${t.rate} KHR<br>`;
                remaining -= qty;
                prevMax = t.max;
            }
        }

        const usdRate = 25700; // approximate KHR/USD
        const totalUSD = totalKHR / usdRate;

        showResult('edc-result',
            `${breakdown}<br>` +
            `总计 (Total): <b class="text-amber-400">${totalKHR.toLocaleString()} KHR</b><br>` +
            `约等于 (≈ USD): <b class="text-emerald-400">$${totalUSD.toFixed(2)}</b>`,
            'info'
        );
    });
}

// ---------- 8. Lighting Lux & Fixture Count ----------
function initLightingCalculator() {
    document.getElementById('btn-lighting')?.addEventListener('click', () => {
        const roomL = val('light-room-l');
        const roomW = val('light-room-w');
        const roomH = val('light-room-h');
        const luxTarget = val('light-lux');
        const ledWatt = val('light-led-w');

        if (isNaN(roomL) || isNaN(roomW) || isNaN(luxTarget) || !roomL || !roomW || !luxTarget) {
            showResult('lighting-result', 'សូមបញ្ចូលទំហំបន្ទប់ និង Lux 目标 (请输入房间尺寸和照度目标)');
            return;
        }

        const area = roomL * roomW;
        // Height factor: higher ceiling → more light loss → multiply numerator (need more fixtures)
        // Base factor 1.0 at 3m; increases linearly above 3m
        const heightFactor = roomH > 0 ? Math.max(1 + (roomH - 3) * 0.1, 1) : 1.1;
        // Typical LED fixture: 40W, ~4000 lumens (100 lm/W estimate)
        const lumensPerFixture = ledWatt > 0 ? ledWatt * 100 : 4000;
        const utilization = 0.6; // room-dependent
        const maintenance = 0.8;
        const fixtures = Math.ceil((luxTarget * area * heightFactor) / (lumensPerFixture * utilization * maintenance));

        showResult('lighting-result',
            `房间面积 (Area): <b>${area.toFixed(1)} m²</b><br>` +
            `目标照度 (Target Lux): <b>${luxTarget} lux</b><br>` +
            `高度系数 (Height Factor): <b>${heightFactor.toFixed(2)}</b><br>` +
            `所需灯具数量 (Fixtures Needed): <b class="text-amber-400">${fixtures} 盏</b><br>` +
            `总功率 (Total Power): <b>${(fixtures * (ledWatt || 40)).toLocaleString()} W</b>`,
            'success'
        );
    });
}

// ---------- 9. Cable Bending Radius & Conduit ----------
function initConduitCalculator() {
    document.getElementById('btn-conduit')?.addEventListener('click', () => {
        const outerD = val('conduit-d');
        const cables = parseInt(document.getElementById('conduit-count')?.value) || 1;
        const conduitType = document.getElementById('conduit-type')?.value || 'general';
        if (isNaN(outerD) || !outerD) {
            showResult('conduit-result', 'សូមបញ្ចូល电线外径 mm (请输入电线外径)');
            return;
        }

        // IEC standard: min bending radius = 4× outer diameter (general), 6× for armored
        const bendMultiplier = conduitType === 'armored' ? 6 : 4;
        const minRadius = outerD * bendMultiplier;

        // Conduit fill: max 40% fill per IEC 61386
        const cableArea = Math.PI * Math.pow(outerD / 2, 2);
        const conduitArea = cableArea / 0.4 * cables;
        const minConduitD = Math.sqrt(conduitArea / Math.PI) * 2;

        // Standard PVC/GI sizes
        const stdSizes = [16, 20, 25, 32, 40, 50, 63, 75, 90, 100, 125, 150];
        let recommended = stdSizes[stdSizes.length - 1];
        for (const s of stdSizes) {
            if (s >= minConduitD) { recommended = s; break; }
        }

        showResult('conduit-result',
            `最小弯曲半径 (Min Bending Radius): <b class="text-amber-400">${minRadius.toFixed(0)} mm</b> (${bendMultiplier}× 外径)<br>` +
            `推荐穿线管 (Recommended Conduit): <b class="text-emerald-400">${recommended} mm (PVC/GI)</b><br>` +
            `计算依据 (Basis): IEC 61386, 填充率 ≤40%, ${conduitType === 'armored' ? '铠装 Armored' : '普通 General'}`,
            'info'
        );
    });
}
