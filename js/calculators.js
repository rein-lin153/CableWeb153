/**
 * B·W CABLE — 工程计算器逻辑 (内嵌主页 #calculators)
 * 13 个计算器：电力、土木、装饰三大类。
 * 主色：琥珀 amber (#f59e0b / #d97706)，副色 emerald。
 * 计算 结果写入对应 `#xxx-result` 区。
 *
 * 设计原则：
 *  - 每个计算器独立 IIFE / 函数，互不污染全局。
 *  - 输入校验：缺失或非法 → 在结果区给出提示，不抛错。
 *  - 结果文案：中文为主，关键数值高亮（amber-700 加粗，与主页琥珀主色统一）。
 */
(function () {
    'use strict';

    // ===================== i18n 快捷方式 =====================
    const t = (key, fb) => window.__I18N__ ? window.__I18N__.t(key, fb) : (fb || key);

    // ===================== 计算器默认配置（来自 /api/calc-config） =====================
    // admin 后台可配置；公开页读取作为默认值。铜重计算器允许用户在页面临时覆盖铜价。
    const CALC_CONFIG = {
        copperPriceUsdPerKg: 9,
        edcCommercialRate: 920,
        edcUsdRielRate: 4100,
        edcNotes: 'EDC 阶梯近似值，请管理员后台更新为最新电价',
        edcTiers: [
            { upTo: 50, rate: 610 }, { upTo: 100, rate: 770 }, { upTo: 200, rate: 920 },
            { upTo: 300, rate: 1090 }, { upTo: 400, rate: 1280 }, { upTo: 99999, rate: 1480 }
        ]
    };
    async function loadCalcConfig() {
        try {
            const res = await fetch('/api/calc-config');
            if (res.ok) {
                const data = await res.json();
                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    Object.assign(CALC_CONFIG, data);
                }
            }
        } catch (e) { /* 静默：保持内置默认 */ }
        // 把默认铜价填入铜重卡片的输入框（若已渲染且未填）
        const cuInput = $('cu-price');
        if (cuInput && (cuInput.value === '' || cuInput.value === undefined)) {
            cuInput.value = CALC_CONFIG.copperPriceUsdPerKg;
        }
    }

    // ===================== 通用工具 =====================
    const $ = (id) => document.getElementById(id);

    /** 读取数字输入，空/非法返回 null */
    function num(id) {
        const el = $(id);
        if (!el) return null;
        const v = parseFloat(el.value);
        return (el.value === '' || isNaN(v)) ? null : v;
    }

    /** 读取下拉/隐藏域字符串值 */
    function val(id) {
        const el = $(id);
        return el ? el.value : '';
    }

    /** 结果块写入 HTML（带动画） */
    function setResult(id, html) {
        const el = $(id);
        if (!el) return;
        el.innerHTML = html;
        el.classList.remove('result-animate');
        // 触发重排以重启动画
        void el.offsetWidth;
        el.classList.add('result-animate');
    }

    /** 高亮数值 */
    function hl(v, unit) {
        return `<strong class="text-amber-700">${v}${unit || ''}</strong>`;
    }

    /** 空值提示 */
    function needAll(names) {
        return `<div class="text-red-500"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${t('calc.result.need_all','请填写：')}${names.join('、')}</div>`;
    }

    // ===================== 1. 缆线载流量与电压降 =====================
    // 基准载流量表 (A) — 环境温度 30℃ / 空气中敷设 / 各绝缘类型
    // (IEC 60502-5 / IEC 60364-5-52 近似估算)
    // pvc  = 现有基准；xlpe ≈ PVC ×1.30；rubber ≈ PVC ×1.15
    const STANDARD_SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
    const _CU_PVC = { 1.5: 19, 2.5: 27, 4: 36, 6: 46, 10: 63, 16: 85, 25: 112, 35: 138, 50: 168, 70: 213, 95: 258, 120: 299, 150: 344, 185: 395, 240: 460 };
    const _AL_PVC = { 2.5: 21, 4: 28, 6: 36, 10: 49, 16: 67, 25: 88, 35: 110, 50: 134, 70: 171, 95: 207, 120: 239, 150: 276, 185: 316, 240: 370 };
    // XLPE / Rubber 按 ×1.30 / ×1.15 近似生成（保留两位）
    const _scale = (tbl, f) => Object.fromEntries(STANDARD_SIZES.map(s => [s, Math.round((tbl[s] || 0) * f)]));
    const AMPACITY_BASE = {
        pvc:    { copper: _CU_PVC,                       aluminum: _AL_PVC },
        xlpe:   { copper: _scale(_CU_PVC, 1.30),         aluminum: _scale(_AL_PVC, 1.30) },
        rubber: { copper: _scale(_CU_PVC, 1.15),         aluminum: _scale(_AL_PVC, 1.15) }
    };
    // 保留旧名（仅向下兼容外部可能引用；计算逻辑已迁移到 AMPACITY_BASE）
    const CU_AMP = AMPACITY_BASE.pvc.copper;
    const AL_AMP = AMPACITY_BASE.pvc.aluminum;
    // 敷设方式修正系数（相对 30℃ 空气中基准）
    const DERATING_INSTALL = { air: 1.0, buried: 1.1, tray: 0.95 };
    // 环境温度修正系数（基准 30℃）
    const DERATING_TEMP = { 30: 1.0, 40: 0.91, 50: 0.82, 60: 0.71 };

    function ampacityBase(material, insulation) {
        const ins = AMPACITY_BASE[insulation] ? insulation : 'pvc';
        return AMPACITY_BASE[ins][material === 'aluminum' ? 'aluminum' : 'copper'];
    }
    // 旧 API 保留：ampacityTable(material) 返回 pvc 基准表
    function ampacityTable(material) { return ampacityBase(material, 'pvc'); }

    /** 综合修正系数：敷设 × 温度 */
    function deratingFactor(opts) {
        opts = opts || {};
        const install = DERATING_INSTALL[opts.install] != null ? opts.install : 'air';
        const ambient = DERATING_TEMP[opts.ambient] != null ? opts.ambient : 30;
        return DERATING_INSTALL[install] * DERATING_TEMP[ambient];
    }

    /** 按需电流查推荐截面积；opts 可选 {insulation, install, ambient}，默认 pvc/air/30 与旧版一致 */
    function recommendSize(current, material, opts) {
        const tbl = ampacityBase(material, (opts && opts.insulation) || 'pvc');
        const factor = deratingFactor(opts);
        for (const s of STANDARD_SIZES) {
            if (tbl[s] * factor >= current) return s;
        }
        return 240;
    }

    function calcCableSize() {
        const phase = val('cable-phase');
        const material = val('cable-material');
        const insulation = val('cable-insulation') || 'pvc';
        const install = val('cable-install') || 'air';
        const ambient = parseInt(val('cable-ambient'), 10) || 30;
        const power = num('cable-power');   // kW
        const length = num('cable-length'); // m

        if (power === null || length === null) {
            setResult('cable-result', needAll(['功率 (kW)', '距离 (m)']));
            return;
        }

        const pf = 0.85;
        const voltage = phase === 'three' ? 400 : 230;
        const root3 = Math.sqrt(3);
        // 计算电流 I = P / (√3·V·pf) 三相 ; P/(V·pf) 单相
        const current = phase === 'three' ? (power * 1000) / (root3 * voltage * pf) : (power * 1000) / (voltage * pf);
        const cableOpts = { insulation, install, ambient };
        const area = recommendSize(current, material, cableOpts);
        const tbl = ampacityBase(material, insulation);
        const factor = deratingFactor(cableOpts);
        const baseA = tbl[area];           // 基准载流量（30℃ 空气中）
        const allowA = Math.round(baseA * factor); // 修正后载流量
        const rho = material === 'aluminum' ? 0.0282 : 0.0175; // Ω·mm²/m
        // 电压降 ΔU = 2·ρ·L·I / A 单相 ; √3·ρ·L·I / A 三相
        const dV = phase === 'three' ? (root3 * rho * length * current) / area : (2 * rho * length * current) / area;
        const dVPct = (dV / voltage) * 100;

        const matName = material === 'aluminum' ? t('calc.card1.option.aluminum','铝 Aluminum') : t('calc.card1.option.copper','铜 Copper');
        const insName = { pvc: 'PVC', xlpe: 'XLPE', rubber: t('calc.card1.option.insulation.rubber','橡胶') }[insulation] || 'PVC';
        const pass = dVPct <= 5;
        const phaseName = phase === 'three' ? t('calc.card1.option.three','三相 400V') : t('calc.card1.option.single','单相 230V');

        setResult('cable-result', `
            <div class="space-y-1.5">
                <div>${t('calc.result.system','系统：')}${hl(phaseName)} ｜ ${t('calc.result.material','材质：')}${matName} ｜ ${t('calc.card1.label.insulation','绝缘')}${hl(insName)}</div>
                <div>${t('calc.result.calc_current','计算电流：')}${hl(current.toFixed(1), ' A')}（PF=0.85）</div>
                <div>${t('calc.result.recommend_wire','推荐线径：')}${hl(area, ' mm²')} ｜ ${t('calc.result.ampacity','该规格载流量')} ${hl(baseA, ' A')} → ${t('calc.result.adjusted_ampacity','修正后')}${hl(allowA, ' A')}</div>
                <div>${t('calc.result.voltage_drop','电压降：')}${hl(dV.toFixed(2), ' V')} (${hl(dVPct.toFixed(2), '%')})</div>
                <div class="text-xs ${pass ? 'text-emerald-600' : 'text-red-500'} font-bold mt-1">
                    <i class="fa-solid ${pass ? 'fa-circle-check' : 'fa-triangle-exclamation'} mr-1"></i>
                    ${pass ? t('calc.result.pass','合格（电压降 ≤ 5%）') : t('calc.result.fail','不合格，电压降 > 5%，建议增大线径或缩短距离')}
                </div>
            </div>
        `);
    }

    // ===================== 2. 铜重估价 =====================
    function calcCopperWeight() {
        const area = num('cu-area');   // mm²
        const cores = parseInt(val('cu-cores'), 10);
        const lengthM = num('cu-length'); // m
        if (area === null || lengthM === null) {
            setResult('copper-result', needAll(['截面积 mm²', '总长度 m']));
            return;
        }
        const density = 8.96; // g/cm³
        // 体积 = 面积(mm²) × 长度(m) × 芯数 → cm³ : 1 mm²·m = 1 cm³
        const volumeCm3 = area * lengthM * cores;
        const massKg = (volumeCm3 * density) / 1000; // g→kg
        // 铜价：优先读页面输入框（可临时覆盖），空则用 admin 配置默认值
        const pricePerKg = num('cu-price') !== null ? num('cu-price') : CALC_CONFIG.copperPriceUsdPerKg;
        const valueUsd = massKg * pricePerKg;

        setResult('copper-result', `
            <div class="space-y-1.5">
                <div>${t('calc.result.spec','规格：')}${hl(area, ' mm²')} × ${cores} 芯 × ${hl(lengthM, ' m')}</div>
                <div>${t('calc.result.copper_weight','纯铜重量：')}${hl(massKg.toFixed(2), ' kg')}</div>
                <div>${t('calc.result.est_value','估算市值（按 $')}${pricePerKg}/kg）：${hl('$' + valueUsd.toFixed(2), '')}</div>
                <div class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>${t('calc.result.copper_note','铜价随市场波动，以上为近似参考')}</div>
            </div>
        `);
    }

    // ===================== 3. 配电负荷 =====================
    const DEVICE_COUNTER = { n: 0 };
    function renderDeviceList() {
        const list = $('device-list');
        if (!list) return;
        if (list.children.length === 0) addDevice(); // 至少一行
    }
    function addDevice() {
        const list = $('device-list');
        if (!list) return;
        DEVICE_COUNTER.n++;
        const id = DEVICE_COUNTER.n;
        const row = document.createElement('div');
        row.className = 'flex flex-wrap gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200';
        row.innerHTML = `
            <span class="text-xs font-bold text-slate-500 w-6">#${id}</span>
            <input type="text" class="device-name flex-1 min-w-[120px] bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-sm font-bold placeholder-slate-400 focus:border-amber-500 outline-none" placeholder="${t('calc.result.device_name_placeholder','设备名称')}">
            <input type="number" class="device-kw w-24 bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-sm font-bold placeholder-slate-400 focus:border-amber-500 outline-none" placeholder="kW" step="0.1">
            <input type="number" class="device-kf w-20 bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-sm font-bold placeholder-slate-400 focus:border-amber-500 outline-none" placeholder="kf" value="0.8" step="0.05" min="0" max="1">
            <button type="button" class="device-del px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-sm font-bold transition"><i class="fa-solid fa-trash"></i></button>
        `;
        row.querySelector('.device-del').addEventListener('click', () => row.remove());
        list.appendChild(row);
    }
    function calcDistribution() {
        const rows = document.querySelectorAll('#device-list > div');
        let totalKw = 0;
        let detail = [];
        rows.forEach((r, i) => {
            const name = (r.querySelector('.device-name').value || `${t('calc.result.device_default','设备')}${i + 1}`).trim();
            const kw = parseFloat(r.querySelector('.device-kw').value);
            const kf = parseFloat(r.querySelector('.device-kf').value);
            if (!isNaN(kw) && !isNaN(kf)) {
                const eff = kw * kf;
                totalKw += eff;
                detail.push(`<div class="text-xs">${name}: ${(kw).toFixed(1)}kW × kf ${(kf).toFixed(2)} = <strong>${eff.toFixed(1)}kW</strong></div>`);
            }
        });
        if (rows.length === 0 || totalKw === 0) {
            setResult('distribution-result', needAll(['至少一行有效设备 (kW + kf)']));
            return;
        }
        // 总电流（三相 400V，pf=0.85）
        const I = (totalKw * 1000) / (Math.sqrt(3) * 400 * 0.85);
        // 选 breaker 额定（按 I × 1.25 余量向上取标）
        const BREAKERS = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250];
        const targetBreaker = I * 1.25;
        let breaker = BREAKERS[BREAKERS.length - 1];
        for (const b of BREAKERS) { if (b >= targetBreaker) { breaker = b; break; } }
        const cableSize = recommendSize(I * 1.25, 'copper');

        setResult('distribution-result', `
            <div class="space-y-1.5">
                <div>${t('calc.result.valid_load','有效总负荷：')}${hl(totalKw.toFixed(1), ' kW')}</div>
                <div>${detail.join('')}</div>
                <div class="border-t border-slate-200 mt-1 pt-1">${t('calc.result.total_current','总电流（三相400V，pf=0.85）：')}${hl(I.toFixed(1), ' A')}</div>
                <div>${t('calc.result.recommend_breaker','推荐主断路器：')}${hl(breaker, ' A')}（按 I×1.25 选标）</div>
                <div>${t('calc.result.recommend_cable','推荐主电缆：铜')} ${hl(cableSize, ' mm²')}</div>
                <div class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>${t('calc.result.kf_note','kf 为利用系数/需用系数，家用 0.6~0.8、商用 0.7~0.9')}</div>
            </div>
        `);
    }

    // ===================== 4. P/I/V/PF 转换器 =====================
    function calcPowerConv() {
        const phase = val('pc-phase');
        const unknown = val('pc-unknown');
        const p = num('pc-p');   // kW
        const v = num('pc-v');   // V
        const i = num('pc-i');   // A
        const pf = num('pc-pf');
        const root3 = Math.sqrt(3);
        const factor = phase === 'three' ? root3 : 1;
        let result = '';
        try {
            if (unknown === 'p') {
                if (v === null || i === null) return setResult('power-conv-result', needAll([t('calc.card4.option.unknown_v','电压 V'), t('calc.card4.option.unknown_i','电流 I')]));
                const usePf = pf === null ? 0.85 : pf;
                const pKw = (factor * v * i * usePf) / 1000;
                result = `<div>${t('calc.result.power_p','功率 P = ')}${hl((phase === 'three' ? '√3' : '1') + '·V·I·PF')} / 1000</div><div>P = ${hl(pKw.toFixed(3), ' kW')}${pf === null ? t('calc.result.pf_default','（PF 默认 0.85）') : ''}</div>`;
            } else if (unknown === 'i') {
                if (p === null || v === null) return setResult('power-conv-result', needAll([t('calc.card4.option.unknown_p','功率 P'), t('calc.card4.option.unknown_v','电压 V')]));
                const usePf = pf === null ? 0.85 : pf;
                const cur = (p * 1000) / (factor * v * usePf);
                result = `<div>${t('calc.result.current_i','电流 I = P×1000 / (')}${phase === 'three' ? '√3·' : ''}V·PF)</div><div>I = ${hl(cur.toFixed(2), ' A')}${pf === null ? t('calc.result.pf_default','（PF 默认 0.85）') : ''}</div>`;
            } else if (unknown === 'v') {
                if (p === null || i === null) return setResult('power-conv-result', needAll([t('calc.card4.option.unknown_p','功率 P'), t('calc.card4.option.unknown_i','电流 I')]));
                const usePf = pf === null ? 0.85 : pf;
                const vol = (p * 1000) / (factor * i * usePf);
                result = `<div>${t('calc.result.voltage_v','电压 V = P×1000 / (')}${phase === 'three' ? '√3·' : ''}I·PF)</div><div>V = ${hl(vol.toFixed(2), ' V')}${pf === null ? t('calc.result.pf_default','（PF 默认 0.85）') : ''}</div>`;
            } else if (unknown === 'pf') {
                if (p === null || v === null || i === null) return setResult('power-conv-result', needAll([t('calc.card4.option.unknown_p','功率 P'), t('calc.card4.option.unknown_v','电压 V'), t('calc.card4.option.unknown_i','电流 I')]));
                const powerFactor = (p * 1000) / (factor * v * i);
                result = `<div>${t('calc.result.pf','功率因数 PF = P×1000 / (')}${phase === 'three' ? '√3·' : ''}V·I)</div><div>PF = ${hl(powerFactor.toFixed(3), '')} ${t('calc.result.pf_need_le1',' (需 ≤ 1)')}</div>${powerFactor > 1 ? `<div class="text-xs text-red-500">${t('calc.result.pf_warning','⚠ 计算结果 > 1，输入数据可能不一致')}</div>` : ''}`;
            }
        } catch (e) {
            result = `<div class="text-red-500">${t('calc.result.calc_error','计算错误')}</div>`;
        }
        setResult('power-conv-result', `<div class="space-y-1.5">${result}<div class="text-xs text-slate-500">${t('calc.result.system','系统：')}${phase === 'three' ? t('calc.result.phase_three','三相') : t('calc.result.phase_single','单相')}</div></div>`);
    }

    // ===================== 5. 变压器电流 =====================
    function calcTransformer() {
        const s = num('xfmr-kva'); // kVA
        if (s === null) return setResult('transformer-result', needAll(['容量 kVA']));
        const root3 = Math.sqrt(3);
        const v1 = num('xfmr-v1') !== null ? num('xfmr-v1') : 22;  // kV
        const v2 = num('xfmr-v2') !== null ? num('xfmr-v2') : 0.4; // kV
        const i1 = (s * 1000) / (root3 * v1 * 1000); // 一次侧 A
        const i2 = (s * 1000) / (root3 * v2 * 1000); // 二次侧 A
        setResult('transformer-result', `
            <div class="space-y-1.5">
                <div>${t('calc.result.capacity','容量：')}${hl(s, ' kVA')}</div>
                <div>${t('calc.result.primary_side','一次侧')}${hl(v1, ' kV')}：${hl(i1.toFixed(2), ' A')}</div>
                <div>${t('calc.result.secondary_side','二次侧')}${hl(v2, ' kV')}：${hl(i2.toFixed(2), ' A')}</div>
                <div class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>${t('calc.result.transformer_note','I = S / (√3 · V)；默认 22kV/0.4kV 为柬埔寨电网标称，可在上方修改电压等级')}</div>
            </div>
        `);
    }

    // ===================== 6. AC vs DC =====================
    function calcAcDc() {
        const power = num('acdc-power'); // kW
        const voltage = num('acdc-voltage'); // V
        const pf = num('acdc-pf');
        if (power === null || voltage === null) return setResult('acdc-result', needAll(['功率 kW', '电压 V']));
        const usePf = (pf === null || pf === 0) ? 0.85 : pf;
        const root3 = Math.sqrt(3);
        const acI = (power * 1000) / (root3 * voltage * usePf);
        const dcI = (power * 1000) / voltage;
        setResult('acdc-result', `
            <div class="space-y-1.5">
                <div>${t('calc.result.ac_current','AC 三相电流：I = P / (√3·V·PF) = ')}${hl(acI.toFixed(2), ' A')}</div>
                <div>${t('calc.result.dc_current','DC 直流电流：I = P / V = ')}${hl(dcI.toFixed(2), ' A')}</div>
                <div>${t('calc.result.current_ratio','电流比 DC/AC = ')}${hl((dcI / acI).toFixed(2), '×')}</div>
                <div class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>${t('calc.result.acdc_note','DC 无功率因数与无功损耗，电流通常更大；AC 适合远距离、DC 适合储能/光伏')}</div>
            </div>
        `);
    }

    // ===================== 7. EDC 电费 =====================
    // 柬埔寨 EDC 阶梯电价（近似，៛/kWh）—— admin 后台可配置；空时用内置默认
    function calcEdc() {
        const type = val('edc-type');
        const kwh = num('edc-kwh');
        if (kwh === null) return setResult('edc-result', needAll(['月用电量 kWh']));
        let riel = 0;
        let detail = '';
        if (type === 'residential') {
            // admin 配置的住宅阶梯；upTo >= 99999 视为无上限
            const tiers = (Array.isArray(CALC_CONFIG.edcTiers) && CALC_CONFIG.edcTiers.length)
                ? CALC_CONFIG.edcTiers
                : [{ upTo: 50, rate: 610 }, { upTo: 100, rate: 770 }, { upTo: 200, rate: 920 }, { upTo: 300, rate: 1090 }, { upTo: 400, rate: 1280 }, { upTo: 99999, rate: 1480 }];
            let remain = kwh, prev = 0;
            const segs = [];
            for (const tier of tiers) {
                if (remain <= 0) break;
                const cap = tier.upTo >= 99999 ? Infinity : tier.upTo;
                const used = Math.min(remain, cap - prev);
                riel += used * tier.rate;
                const upper = tier.upTo >= 99999 ? kwh : Math.min(kwh, tier.upTo);
                segs.push(`${prev + 1}-${upper}kWh × ${tier.rate}៛`);
                prev = tier.upTo >= 99999 ? prev + used : tier.upTo;
                remain -= used;
            }
            detail = `<div class="text-xs space-y-0.5">${segs.map(s => `<div>${s}</div>`).join('')}</div>`;
        } else {
            // 商业单一价（admin 可配置）
            const rate = (typeof CALC_CONFIG.edcCommercialRate === 'number' && CALC_CONFIG.edcCommercialRate) ? CALC_CONFIG.edcCommercialRate : 920;
            riel = kwh * rate;
            detail = `<div class="text-xs">${t('calc.result.full_rate','全量 ')}${hl(rate, ' ៛/kWh')}</div>`;
        }
        const usd = riel / (CALC_CONFIG.edcUsdRielRate || 4100); // 1 USD ≈ 4100 ៛
        const typeName = type === 'residential' ? t('calc.card7.option.residential','住宅 Residential') : t('calc.card7.option.commercial','商业 Commercial');
        setResult('edc-result', `
            <div class="space-y-1.5">
                <div>${t('calc.result.type','类型：')}${hl(typeName)} ｜ ${t('calc.result.usage','用量：')}${hl(kwh, ' kWh')}</div>
                ${detail}
                <div class="border-t border-slate-200 mt-1 pt-1">${t('calc.result.electricity_fee','电费：')}${hl(riel.toLocaleString(), ' ៛')} ≈ ${hl('$' + usd.toFixed(2), '')}</div>
                <div class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>${t('calc.result.edc_note','阶梯电价近似值，实际以 EDC 账单为准（1 USD ≈ 4100 ៛）')}</div>
            </div>
        `);
    }

    // ===================== 8. 照度计算 =====================
    function calcLighting() {
        const L = num('light-room-l');
        const W = num('light-room-w');
        const H = num('light-room-h');
        const lux = parseInt(val('light-lux'), 10);
        const ledW = num('light-led-w');
        if (L === null || W === null || ledW === null) return setResult('lighting-result', needAll(['长度 m', '宽度 m', 'LED功率 W']));
        const area = L * W;
        // LED ~100 lm/W 维修系数 0.8 利用系数 0.7 → 综合系数 0.56
        const lumens = ledW * 100;
        const uf = 0.7, mf = 0.8;
        const fixtures = Math.ceil((lux * area) / (lumens * uf * mf));
        const totalW = fixtures * ledW;
        setResult('lighting-result', `
            <div class="space-y-1.5">
                <div>${t('calc.result.room_area','房间面积：')}${hl(area.toFixed(1), ' m²')}（${L}×${W}×高${H || '-' }）</div>
                <div>${t('calc.result.target_lux','目标照度：')}${hl(lux, ' lux')}</div>
                <div>${t('calc.result.lumens_per_lamp','单灯流明：')}${hl(lumens, ' lm')}（${ledW}W × 100 lm/W）</div>
                <div>${t('calc.result.cu_mf','利用系数 CU=0.7 维护系数 MF=0.8')}</div>
                <div class="border-t border-slate-200 mt-1 pt-1">${t('calc.result.need_fixtures','需要灯具数：')}${hl(fixtures, ' 盏')}</div>
                <div>${t('calc.result.total_power','总功率：')}${hl(totalW, ' W')}</div>
                <div class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>N = E·A / (Φ·CU·MF)</div>
            </div>
        `);
    }

    // ===================== 9. 弯曲半径与穿线管 =====================
    function calcConduit() {
        const d = num('conduit-d');     // 电缆外径 mm
        const count = num('conduit-count');
        const type = val('conduit-type');
        if (d === null || count === null) return setResult('conduit-result', needAll(['外径 mm', '电缆数量']));
        const fillRatio = type === 'armored' ? 0.60 : 0.40;
        // 穿线管内截面积需 ≥ N × π(d/2)² / fillRatio → 反求内径
        const cableArea = count * Math.PI * (d / 2) ** 2;
        const pipeArea = cableArea / fillRatio;
        const pipeInner = Math.sqrt(pipeArea / Math.PI) * 2;
        // 标准管径 16/20/25/32/40/50/63
        const PIPE_SIZES = [16, 20, 25, 32, 40, 50, 63];
        let pipe = PIPE_SIZES[PIPE_SIZES.length - 1];
        for (const p of PIPE_SIZES) { if (p >= pipeInner) { pipe = p; break; } }
        // 弯曲半径
        const bendRatio = type === 'armored' ? 10 : 6;
        const bendR = d * bendRatio;
        setResult('conduit-result', `
            <div class="space-y-1.5">
                <div>${t('calc.result.cable_info','电缆：外径')} ${d}mm × ${count} ${t('calc.result.roots','根')}（${type === 'armored' ? t('calc.card9.option.armored','铠装') : t('calc.card9.option.general','普通')}）</div>
                <div>${t('calc.result.fill_rate','填充率标准：')}${hl((fillRatio * 100).toFixed(0), '%')}</div>
                <div>${t('calc.result.need_inner_dia','需管内径 ≥ ')}${hl(pipeInner.toFixed(1), ' mm')} → ${t('calc.result.recommend_pipe','推荐')}${hl(pipe, ' mm')} PVC/GI 管</div>
                <div>${t('calc.result.min_bend_radius','最小弯曲半径：')}${hl(bendR.toFixed(0), ' mm')}（${bendRatio}×D）</div>
                <div class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>${t('calc.result.conduit_note','普通电缆填充 ≤ 40%，铠装 ≤ 60%；弯曲半径普通 ≥ 6D，铠装 ≥ 10D')}</div>
            </div>
        `);
    }

    // ===================== 10. 砖块与水泥砂浆 =====================
    function calcBrick() {
        const L = num('brick-length');   // 墙体 m
        const H = num('brick-height');
        if (L === null || H === null) return setResult('brick-result', needAll(['墙体长度 m', '墙体高度 m']));
        // 柬埔寨标准红砖 4×8×18cm，墙厚按 18cm 计；每砖含灰缝净面积 0.08×0.18=0.0144 m²
        const wallArea = L * H;
        const brickFace = 0.08 * 0.18;
        const bricks = Math.ceil(wallArea / brickFace);
        // 砂浆用量 ~0.03 m³/m²（双面抹灰另计）
        const mortarM3 = wallArea * 0.03;
        // 水泥 ~350kg/m³ 砂浆 → 50kg 袋
        const cementBags = Math.ceil((mortarM3 * 350) / 50);
        const sandM3 = mortarM3 * 1.0;
        setResult('brick-result', `
            <div class="space-y-1.5">
                <div>${t('calc.result.wall_area','墙面积：')}${hl(wallArea.toFixed(2), ' m²')}（${L}×${H}，厚 18cm 墙）</div>
                <div>${t('calc.result.brick_count','红砖数量：')}${hl(bricks.toLocaleString(), ' 块')}（柬埔寨 4×8×18cm）</div>
                <div>${t('calc.result.mortar','砌筑砂浆：')}${hl(mortarM3.toFixed(2), ' m³')}</div>
                <div>${t('calc.result.cement','水泥：')}${hl(cementBags, ' 袋')}（50kg/袋）</div>
                <div>${t('calc.result.sand','砂子：')}${hl(sandM3.toFixed(2), ' m³')}</div>
                <div class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>${t('calc.result.brick_note','未含抹灰面积；双面抹灰需另计砂浆与水泥')}</div>
            </div>
        `);
    }

    // ===================== 11. 钢筋重量 =====================
    function calcRebar() {
        const d = parseFloat(val('rebar-d'));
        const L = num('rebar-length');
        if (isNaN(d) || L === null) return setResult('rebar-result', needAll(['钢筋直径 mm', '总长度 m']));
        // ρ = 7.85 g/cm³ ; 截面积 mm² = π(d/2)² ; 长度 m → 体积 cm³ = mm²·100·cm ... 简化
        // m(kg) = π·(d/2)²·L·7.85 / 1000000 · 1000 ; 标准公式 m = 0.00617·d²·L
        const weight = 0.00617 * d * d * L;
        setResult('rebar-result', `
            <div class="space-y-1.5">
                <div>${t('calc.result.spec','规格：')}${hl(d, ' mm')} 直径 × ${hl(L, ' m')}</div>
                <div>${t('calc.result.rebar_weight','钢筋重量：')}${hl(weight.toFixed(2), ' kg')}</div>
                <div class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>m = 0.00617 × d² × L（ρ=7.85 g/cm³）</div>
            </div>
        `);
    }

    // ===================== 12. 瓷砖与胶泥 =====================
    function calcTile() {
        const L = num('tile-length');
        const W = num('tile-width');
        const size = parseInt(val('tile-size'), 10); // cm 边长
        if (L === null || W === null) return setResult('tile-result', needAll(['房间长度 m', '房间宽度 m']));
        const area = L * W;
        const waste = 1.05;
        // 一块砖面积 m² = size² / 10000；一箱通常 1.44 m²（60砖 4块/箱）或按块数算
        const tileArea = (size * size) / 10000;
        const tilesNeeded = Math.ceil((area * waste) / tileArea);
        // 一箱块数：60×60 一箱 3 块(1.08 m²)，30×30 一箱 12 块(1.08 m²)
        const perBox = size === 60 ? 3 : 12;
        const boxes = Math.ceil(tilesNeeded / perBox);
        // 胶泥 ~5 kg/m²，20kg/袋
        const glueKg = area * 5;
        const glueBags = Math.ceil(glueKg / 20);
        setResult('tile-result', `
            <div class="space-y-1.5">
                <div>${t('calc.result.room_area','房间面积：')}${hl(area.toFixed(2), ' m²')}（含 5% 损耗 ${(area * waste).toFixed(2)} m²）</div>
                <div>${t('calc.result.tile_area','瓷砖规格：')}${size}×${size}cm（单块 ${tileArea.toFixed(2)} m²）</div>
                <div>${t('calc.result.need_tiles','需瓷砖：')}${hl(tilesNeeded.toLocaleString(), ' 块')} ｜ 约 ${hl(boxes, ' 箱')}/${perBox}块/箱</div>
                <div>${t('calc.result.tile_glue','瓷砖胶泥：')}${hl(glueBags, ' 袋')}（20kg/袋，~5kg/m²）</div>
            </div>
        `);
    }

    // ===================== 13. 油漆 =====================
    function calcPaint() {
        const area = num('paint-area');
        if (area === null) return setResult('paint-result', needAll(['墙面总面积 m²']));
        // 一桶 18L，覆盖 ~10 m²/L（两遍） → 一桶约 180 m²（两遍）
        const coverage = 10;
        const coats = 2;
        const liters = (area * coats) / coverage;
        const buckets = Math.ceil(liters / 18);
        // 底漆一遍，~12 m²/L → 单桶 12L 通常足够
        const primerL = area / 12;
        const primerBuckets = Math.ceil(primerL / 12);
        setResult('paint-result', `
            <div class="space-y-1.5">
                <div>${t('calc.result.paint_area','刷漆面积：')}${hl(area.toFixed(1), ' m²')}（两遍）</div>
                <div>${t('calc.result.paint_topcoat','面漆用量：')}${hl(liters.toFixed(1), ' L')} → ${hl(buckets, ' 桶')}/18L（覆盖 ~10 m²/L/遍）</div>
                <div>${t('calc.result.paint_primer','底漆建议：')}${hl(primerBuckets, ' 桶')}/12L（一遍，~12 m²/L）</div>
            </div>
        `);
    }

    // ===================== 绑定 =====================
    function bind(id, fn) {
        const el = $(id);
        if (el) el.addEventListener('click', fn);
    }

    function init() {
        // 电力类
        bind('btn-cable-size', calcCableSize);
        bind('btn-copper-weight', calcCopperWeight);
        bind('btn-add-device', addDevice);
        bind('btn-distribution', calcDistribution);
        bind('btn-power-conv', calcPowerConv);
        bind('btn-transformer', calcTransformer);
        bind('btn-acdc', calcAcDc);
        bind('btn-edc', calcEdc);
        bind('btn-lighting', calcLighting);
        bind('btn-conduit', calcConduit);
        // 土木
        bind('btn-brick', calcBrick);
        bind('btn-rebar', calcRebar);
        // 装饰
        bind('btn-tile', calcTile);
        bind('btn-paint', calcPaint);

        // 瓷砖尺寸按钮切换
        document.querySelectorAll('.tile-size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tile-size-btn').forEach(b => {
                    b.classList.remove('border-amber-600', 'bg-amber-50', 'text-amber-700');
                    b.classList.add('border-transparent');
                });
                btn.classList.add('border-amber-600', 'bg-amber-50', 'text-amber-700');
                btn.classList.remove('border-transparent');
                $('tile-size').value = btn.dataset.tile;
            });
        });
        // 默认选中 60
        const def = document.querySelector('.tile-size-btn[data-tile="60"]');
        if (def) { def.classList.add('border-amber-600', 'bg-amber-50', 'text-amber-700'); def.classList.remove('border-transparent'); }

        // 配电列表初始一行
        renderDeviceList();

        // 拉取 admin 配置（铜价/电价/汇率默认值），异步不阻塞绑定
        loadCalcConfig();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
