// 低效用地自动归类规则（后端与浏览器端共用，不依赖任何运行环境）
// 类型代码：gwy 供而未用 / ywj 用而未尽 / jjyb 金角银边（单独管理）/ qydx 企业低效

export const CLASS_NAMES = { gwy: '供而未用', ywj: '用而未尽', jjyb: '金角银边', qydx: '企业低效' };

// 默认阈值：会议未给出具体数值，以下为初始值，需业务部门确认后在“数据管理 › 规则与重算”中调整
export const DEFAULT_RULES = {
  ywjRatio: 0.67,        // 已建 / 应建 低于该比例判为用而未尽（会议口径：建了约三分之二）
  qydxMuTax: 5,          // 亩均税收阈值（万元/亩）
  qydxFar: 0.5,          // 实际容积率阈值
  qydxMode: 'and',       // and：两项都低于阈值；or：任一项低于阈值
  qydxZeroTaxAsLow: true // 亩均税收为 0 是否视为低于阈值
};

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// 计算单个地块的指标与归类；row 为地块记录（props 为原始属性对象）
export function evaluate(row, rules = DEFAULT_RULES) {
  const p = row.props;
  const area = num(p.GYMJ) || num(p.SJYDMJ);                 // 用地面积 m²
  const plannedFar = row.planned_far ?? (num(p.GHRJL) || null);
  const built = row.built_floor ?? num(p.SJJZMJ);
  const planned = plannedFar && area ? plannedFar * area : null;  // 应建建筑面积
  const far = row.built_floor != null && area ? built / area : num(p.SJRJL);
  const muTax = num(p['亩均税']);
  const supplied = p.SFGD === '是';
  const started = !!row.started;

  let cls = null;
  const reasons = [];
  if (supplied && !started) {
    cls = 'gwy';
    reasons.push('已供应，开工标记为未开工');
  } else if (started && planned && built < planned * rules.ywjRatio) {
    cls = 'ywj';
    reasons.push(`已建 ${Math.round(built)} m² 低于应建 ${Math.round(planned)} m² 的 ${Math.round(rules.ywjRatio * 100)}%`);
  } else {
    const taxLow = muTax > 0 ? muTax < rules.qydxMuTax : rules.qydxZeroTaxAsLow;
    const farLow = far < rules.qydxFar;
    const low = rules.qydxMode === 'or' ? taxLow || farLow : taxLow && farLow;
    if (low) {
      cls = 'qydx';
      if (taxLow) reasons.push(muTax > 0 ? `亩均税收 ${muTax.toFixed(2)} 万元/亩 低于 ${rules.qydxMuTax}` : '亩均税收为 0');
      if (farLow) reasons.push(`实际容积率 ${far.toFixed(2)} 低于 ${rules.qydxFar}`);
    }
  }

  return {
    cls, reasons, area, areaMu: area / 666.67, plannedFar, planned, built,
    remaining: planned ? Math.max(planned - built, 0) : null, far, muTax, supplied, started
  };
}

// 由 shapefile 原始属性生成初始地块记录（导入与静态数据共用）
const cleanDate = (v) => (v instanceof Date && v.getFullYear() > 1900 ? v.toISOString().slice(0, 10) : null);
export function initialParcel(feature) {
  const p = { ...feature.properties };
  for (const k of Object.keys(p)) if (p[k] instanceof Date) p[k] = cleanDate(p[k]);
  // 初始开工标记：有实际开工 / 竣工时间，或已有建筑面积，视为已开工
  let started = 0;
  let basis = null;
  if (p.SJKGSJ) { started = 1; basis = '原始数据：实际开工时间'; }
  else if (p.SJJGSJ) { started = 1; basis = '原始数据：实际竣工时间'; }
  else if (p.SJJZMJ > 0) { started = 1; basis = '原始数据：已有建筑面积'; }
  // 土地权利人与使用权利人不一致 → 疑似厂中厂，待核实
  const user = p['权利人'];
  const suspect = !!(user && p.TDQLR && user.trim() !== p.TDQLR.trim());
  return {
    id: p.OBJECTID, code: p.DKSYH, props: p, geom: feature.geometry,
    started, start_date: p.SJKGSJ || null, start_basis: basis,
    planned_far: null, built_floor: null,
    ccc: suspect ? 2 : 0, landlord: suspect ? p.TDQLR : null,
    tenants: suspect ? [{ name: user, area: null, use: null }] : [],
    updated_at: null
  };
}
