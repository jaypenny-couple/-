/* =========================================================
 * 染劑濃度資料庫
 * 數值單位：%（依各廠總表原始數值）
 * 資料整理：2026-10-22
 *
 * 修改資料只需要編輯這個檔案。
 * c     ：中間體分項，例如 { TDS: 0.48, '4A3MP': 0.14 }
 * sheet ：總表「濃度」欄數值（只在與分項加總不符時填寫）
 * notes ：待確認事項
 * ========================================================= */
(function () {
  const N = {
    SHEET: '成分欄只列中間體名稱、未填數值，濃度取自總表濃度欄',
    NOTYPE: '原表未標示中間體種類，濃度取自總表濃度欄',
    STAR: '原表色號標有＊（意義待確認）',
    ALIGN: 'PDF 轉檔後濃度欄對齊存疑，待原始檔確認',
    DUP: '與 TCC 同色號數值相同，待確認是否為同一支',
    RECHECK: '原表註記：需要再查一次',
    NODATA: '原表無數值',
    BLANK: '總表濃度欄空白',
  };

  /* ---------------- Goldwell ---------------- */
  const goldwell = [];
  const G = (line, group) => (code, c, o = {}) =>
    goldwell.push(Object.assign({ line, group, code, c }, o));
  let g;

  g = G('TCC', 'N 基色');
  g('2N', { TDS: 3.2 });
  g('3N', { TDS: 2.88 }, { notes: [N.SHEET] });
  g('4N', { '未標示': 2.1 }, { notes: [N.NOTYPE] });
  g('5N', { TDS: 1.28 });
  g('5NA', { TDS: 1.5 });
  g('6N', { TDS: 0.73 });
  g('6NN', { TDS: 0.86 });
  g('6NA', { TDS: 0.78 });
  g('7N', { TDS: 0.54 });
  g('7NA', { TDS: 0.56 });
  g('9NA', { TDS: 0.23 });
  g('6NBB', { TDS: 0.68, PAP: 0.18 });
  g('6NVB', { TDS: 0.62, PAP: 0.02 }, { sheet: 0.71 });
  g('5NBB', { TDS: 1.5, PAP: 0.21 });

  g = G('TCC', 'B・BG');
  g('4B', { TDS: 1.27 });
  g('5B', { TDS: 0.71 });
  g('6B', { TDS: 0.78 });
  g('7B', { TDS: 0.59 });
  g('8B', { TDS: 0.29 });
  g('7BN', { TDS: 0.75 });
  g('6BM', { TDS: 0.415 });
  g('5BG', { TDS: 0.87 });
  g('7BG', { TDS: 0.48, '4A3MP': 0.14 });

  g = G('TCC', 'G・GB');
  g('6G', { TDS: 0.63 });
  g('7G', { TDS: 0.68 });
  g('5GB', { TDS: 1.2 });
  g('6GB', { TDS: 1.0 });
  g('7GB', { TDS: 0.57 });
  g('8GB', { TDS: 0.4 });

  g = G('TCC', 'K・KG・KR');
  g('6KG', { TDS: 0.6, '4A3MP': 1.05 });
  g('7KG', { TDS: 0.16, '4A3MP': 0.4 }, { sheet: 0.41 });
  g('8KG', { TDS: 0.08, '4A3MP': 0.26 });
  g('5K', { TDS: 0.7, '4A3MP': 0.45 });
  g('6K', { TDS: 0.28, PAP: 0.5, '4A3MP': 0.2 });
  g('7K', { TDS: 0.25, '4A3MP': 0.64 });
  g('8K', { TDS: 0.3, '4A3MP': 0.18 });
  g('6KR', { PAP: 0.63, TDS: 0.51 });
  g('7KR', { '4A3MP': 0.76 }, { sheet: 0.84 });
  g('8KN', { TDS: 0.48 });
  g('7OO MAX', { AHP: 0.63 });

  g = G('TCC', 'R・RB・VA');
  g('4R', { TDS: 1.2, '4A3MP': 0.66 }, { sheet: 0.76, notes: [N.STAR] });
  g('6R', { TDS: 0.58, '4A3MP': 1.0 }, { sheet: 0.2, notes: [N.STAR] });
  g('5RB', { TDS: 0.8 }, { notes: [N.STAR] });
  g('6RB', { TDS: 0.71 });
  g('7RB', { TDS: 0.52 });
  g('5RR MAX', { AHP: 2.85 });
  g('6RR MAX', { AHP: 1.61 });
  g('7RR MAX', { AHP: 0.98 });
  g('7RO MAX', { AHP: 1.52 });
  g('5VA', { TDS: 1.0 }, { notes: [N.SHEET] });

  g = G('TCC', 'A・MB');
  g('2A', { TDS: 3.0 });
  g('5A', { TDS: 0.89 });
  g('6A', { TDS: 0.67 });
  g('7A', { TDS: 0.45 });
  g('8A', { TDS: 0.34 });
  g('9A', { TDS: 0.12 });
  g('5MB', { TDS: 1.0 });
  g('6MB', { TDS: 1.0 });
  g('7MB', { TDS: 0.7 });

  g = G('TCC', 'BP・SB');
  g('4BP', { TDS: 1.5 });
  g('5BP', { TDS: 0.81 });
  g('6BP', { TDS: 0.44 });
  g('6SB', { TDS: 0.47 });
  g('7SB', { TDS: 0.32 });
  g('8SB', { TDS: 0.26 });

  g = G('TCC', '複光染 @');
  g('4B@RR', { TDS: 1.5, AHP: 0.5 });
  g('5BG@KK', { TDS: 0.62, AHP: 0.08, '4A3MP': 0.4 });
  g('5B@BK', { TDS: 0.84, PAP: 0.1 });
  g('6NN@CV', { TDS: 0.81 });
  g('6KK@KK', { TDS: 0.36, '4A3MP': 0.28, PAP: 0.44 });
  g('7OO@GK', { AHP: 0.63 });
  g('6RR@PK', { AHP: 2.29 }, { notes: [N.BLANK + '；CAC 表同色號寫 2.48'] });
  g('7RR@RR', { AHP: 0.98 });
  g('6VV@PK', { TDS: 0.12, AHP: 0.4 });
  g('7SB@BL', { TDS: 0.28 });
  g('7AK@PK', { TDS: 0.6 });
  g('7BP@PK', { TDS: 0.28 });
  g('8SB@PK', { TDS: 0.24, AHP: 0.05 });
  g('8CA@PB', { TDS: 0.4 });
  g('9N@PK', { TDS: 0.23 });

  g = G('TCC', 'P・V');
  g('10P', { TDS: 0.08 });
  g('10V', { TDS: 0.09 }, { sheet: 0.12, notes: [N.ALIGN] });
  g('3VV MAX', { TDS: 0.58, AHP: 0.6 }, { sheet: 0.28 });
  g('5VV MAX', { AHP: 1.83 });
  g('6VV MAX', null, { notes: [N.NODATA] });

  g = G('TCC', 'C');
  g('8CA', { TDS: 0.13 });
  g('8CV', { TDS: 0.08 });
  g('8CM', { TDS: 0.28 });
  g('10CA', { TDS: 0.06 });
  g('10CV', { TDS: 0.06 });
  g('10CM', { TDS: 0.17 });

  g = G('TCC', '加強色・MIX');
  g('V-C', { TDS: 0.8 });
  g('BL-C', { TDS: 1.2 }, { notes: [N.SHEET] });
  g('P MIX', { TDS: 0.25 });
  g('A MIX', { TDS: 0.35 });
  g('VV MIX', { TDS: 1.4, PAP: 0.03 });
  g('MM MIX', { TDS: 0.32 });
  g('KK MIX', { '未標示': 1.6 }, { notes: [N.NOTYPE] });

  g = G('TCC', '功能性染膏');
  g('11P', { TDS: 0.06 });
  g('11V', { TDS: 0.13 }, { sheet: 0.19, notes: [N.ALIGN] });
  g('11A', { TDS: 0.16 });
  g('12P', { TDS: 0.1 });
  g('12M', { TDS: 0.12 }, { sheet: 0.21, notes: [N.ALIGN + '（可能為數字對調）'] });
  g('12A', { TDS: 0.1 });
  g('11CM', { TDS: 0.12 });
  g('11VV', { TDS: 0.13 }, { sheet: 0.19, notes: [N.ALIGN] });
  g('11SV', { TDS: 0.12 });
  g('11VA', { TDS: 0.29 });
  g('11MA', { TDS: 0.47 });
  g('11SN', { TDS: 0.07 });
  g('11AA', { TDS: 0.22 });
  g('12BS', { TDS: 0.06 });
  g('13BC', { TDS: 0.005 });
  g('13BCA', { TDS: 0.05 });
  g('13BCM', { TDS: 0.1 });
  g('14LT', null, { notes: [N.NODATA] });
  g('Violet Ash', { TDS: 0.29 });
  g('Ash Ash', { TDS: 0.22 });

  /* ---- 日系染膏 ---- */
  g = G('日系', 'RVB');
  g('6RVB', { TDS: 1.56, PAP: 0.14 }, { notes: ['第 6 頁濃度欄寫 1.56（未含 PAP），第 8 頁寫 1.70'] });
  g('7RVB', { TDS: 1.08, PAP: 0.1 }, { notes: ['第 6 頁標為 AHP 0.1、濃度欄寫 11.8（小數點錯位）；此處採第 8 頁的 PAP'] });
  g('8RVB', { TDS: 0.94, PAP: 0.1 }, { notes: ['第 6 頁標為 AHP 0.1、濃度欄寫 10.4（小數點錯位）；此處採第 8 頁的 PAP'] });

  g = G('日系', 'BG・GB');
  g('7BG', { TDS: 0.48, '4A3MP': 0.14 }, { notes: [N.DUP] });
  g('5GB', { TDS: 1.2 }, { notes: [N.DUP] });
  g('6GB', { TDS: 1.0 }, { notes: [N.DUP] });
  g('7GB', { TDS: 0.57 }, { notes: [N.DUP] });
  g('8GB', { TDS: 0.4 }, { notes: [N.DUP] });

  g = G('日系', 'MA・AS');
  g('6MA', { TDS: 0.16 }, { sheet: 0.34 });
  g('8MA', { TDS: 0.15 });
  g('10MA', { TDS: 0.07 }, { sheet: 0.09 });
  g('12MA', { TDS: 0.082 });
  g('8AS', { TDS: 0.16 });
  g('10AS', { TDS: 0.08 });
  g('12AS', { TDS: 0.17 });

  g = G('日系', 'MaB・BLAS・AsB');
  g('6MaB', { TDS: 1.95 });
  g('7MaB', { TDS: 1.41 });
  g('8MaB', { TDS: 1.05 });
  g('6BLAS', { TDS: 0.24 });
  g('8BLAS', { TDS: 0.17 });
  g('10BLAS', { TDS: 0.09 });
  g('12BLAS', { TDS: 0.07 });
  g('6AsB', { TDS: 1.34, PAP: 0.25 });
  g('7AsB', { TDS: 1.15, PAP: 0.05 });
  g('8AsB', { TDS: 0.91, PAP: 0.025 });

  g = G('日系', 'PiB・PiV・BlV');
  g('6PiB', { TDS: 2.6 });
  g('7PiB', { TDS: 1.02 });
  g('8PiB', { TDS: 0.76, PAP: 0.05 }, { sheet: 0.76 });
  g('8PiV', { TDS: 0.4 });
  g('10PiV', { TDS: 0.2 });
  g('14PiV', { TDS: 0.19 });
  g('8BlV', { TDS: 0.17 });
  g('10BlV', { TDS: 0.13 }, { notes: [N.RECHECK] });
  g('12BlV', { TDS: 0.08 }, { notes: [N.RECHECK] });
  g('14BlV', { TDS: 0.087 }, { notes: [N.RECHECK] });

  g = G('日系', 'ORB・PeB・GR');
  g('6ORB', { TDS: 1.01, PAP: 0.27 }, { notes: [N.STAR, N.BLANK] });
  g('7ORB', { TDS: 1.72, PAP: 0.37 }, { notes: [N.STAR, N.BLANK] });
  g('8OrB', { TDS: 1.56, PAP: 0.44 }, { notes: [N.STAR] });
  g('6PeB', { TDS: 1.65 });
  g('7PeB', { TDS: 1.37 });
  g('8PeB', { TDS: 0.99 });
  g('6GR', { TDS: 0.5 });
  g('8GR', { TDS: 0.36 });
  g('10GR', { TDS: 0.22 });
  g('12GR', { PPD: 0.18 }, { notes: [N.SHEET, '同系列其他色號皆為 TDS，12GR 標 PPD 待確認'] });

  const WB_NOTE = 'WB 系列 6／8 號標 PPD、7／9 號標 PAP，待確認';
  g = G('日系', 'WB・CB');
  g('6WB', { TDS: 1.96, PPD: 0.27 }, { notes: [WB_NOTE] });
  g('7WB', { TDS: 1.77, PAP: 0.25 }, { sheet: 2.36, notes: [WB_NOTE] });
  g('8WB', { TDS: 1.45, PPD: 0.2 }, { notes: [WB_NOTE] });
  g('9WB', { TDS: 1.17, PAP: 0.2 }, { notes: [WB_NOTE] });
  g('6CB', { TDS: 1.89 });
  g('7CB', { TDS: 1.36 }, { notes: [N.BLANK] });
  g('8CB', { TDS: 1.21, PAP: 0.02 });

  g = G('日系', 'NB・NeB・GoB・GO・REB');
  g('6NB', { TDS: 2.0 });
  g('8NB', { TDS: 1.2, PAP: 0.03 });
  g('6NeB', { TDS: 1.63, PAP: 0.04 });
  g('8NeB', { TDS: 0.84 });
  g('10NeB', { TDS: 0.5, PAP: 0.024 }, { sheet: 0.48 });
  g('6GoB', { TDS: 1.84, PAP: 0.11 });
  g('7GoB', { TDS: 1.73, PAP: 0.11 });
  g('8GoB', { TDS: 1.08, PAP: 0.31 });
  g('8GO', { TDS: 0.58 });
  g('10GO', { TDS: 0.21 });
  g('6REB', { TDS: 1.93, PAP: 0.18 });
  g('7REB', { TDS: 1.65, PAP: 0.15 });
  g('8REB', { TDS: 0.94, PAP: 0.13 });

  /* ---- CAC ---- */
  g = G('CAC', 'N・NN・NA');
  g('3N', { TDS: 2.8 }, { notes: [N.SHEET] });
  g('4N', { TDS: 2.5 }, { notes: [N.SHEET] });
  g('5N', { TDS: 1.4, '4A3MP': 0.075 }, { sheet: 1.4 });
  g('6N', { TDS: 1.0 }, { notes: [N.SHEET] });
  g('7N', { TDS: 0.35 });
  g('4NN', { TDS: 2.5 });
  g('5NN', { TDS: 1.66 });
  g('5NA', { TDS: 1.538 });
  g('7NA', { TDS: 0.42 });
  g('9NA', { TDS: 0.07 });

  g = G('CAC', 'A・B・BP・SB・MB');
  g('2A', { TDS: 1.6 });
  g('6A', { TDS: 0.2 });
  g('9BA', { TDS: 0.12 }, { notes: [N.SHEET] });
  g('5B', { TDS: 0.68 }, { notes: [N.SHEET] });
  g('6B', { TDS: 0.61 }, { notes: [N.SHEET] });
  g('7B', { TDS: 0.48 }, { notes: [N.SHEET] });
  g('10BB', { TDS: 0.04 }, { notes: [N.SHEET] });
  g('4BP', { TDS: 1.8 });
  g('5BP', { TDS: 0.8 });
  g('6BP', { TDS: 0.3 });
  g('8BP', { TDS: 0.34 }, { notes: ['8BP 0.34 高於 6BP 0.30，請確認'] });
  g('6SB', { TDS: 0.56 });
  g('8SB', { TDS: 0.2 });
  g('5MB', { TDS: 1.1 }, { notes: [N.SHEET] });
  g('7MB', { TDS: 0.4 });

  g = G('CAC', 'K・R・G・VA');
  g('6K', { TDS: 0.35 }, { notes: [N.SHEET] });
  g('8K', { TDS: 0.14 }, { notes: [N.SHEET] });
  g('PLUS 5K', { TDS: 0.52 }, { notes: [N.SHEET] });
  g('4R', { TDS: 0.46 }, { notes: [N.SHEET, '以 4 度而言偏低，請確認'] });
  g('8GB', { TDS: 0.13 }, { notes: [N.SHEET, 'TCC 8GB 為 0.4'] });
  g('5VA', { TDS: 1.0 }, { notes: [N.SHEET] });

  g = G('CAC', 'P・V・BV');
  g('10P', { TDS: 0.013 }, { notes: ['TCC 10P 為 0.08，CAC 僅 0.013，請確認'] });
  g('10V', { TDS: 0.01 }, { notes: [N.SHEET, '數值極低，請確認'] });
  g('8BV', null, { notes: [N.NODATA] });
  g('10BV', null, { notes: [N.NODATA] });

  g = G('CAC', 'MAX・複光染');
  g('6VV MAX', { AHP: 1.2 }, { notes: [N.SHEET] });
  g('7RR MAX', { AHP: 1.5 }, { notes: [N.SHEET] });
  g('7OO@GK', { AHP: 0.81 }, { notes: [N.SHEET] });
  g('6RR@PK', { AHP: 2.48 }, { notes: [N.SHEET] });
  g('4R@VR', { AHP: 2.5 }, { notes: [N.SHEET] });
  g('6VV@PK', { AHP: 0.58 }, { notes: [N.SHEET] });
  g('8CA@PB', { TDS: 0.52 }, { notes: [N.SHEET] });
  g('8SB@PK', { TDS: 0.24 }, { notes: [N.SHEET] });
  g('7AK@PK', { TDS: 0.58 }, { notes: [N.SHEET] });

  g = G('CAC', 'Pastel・MIX');
  g('Pastel Lavender', { AHP: 0.14 }, { tone: '薰衣草粉紫', notes: [N.SHEET] });
  g('Pastel Indigo', { TDS: 0.1 }, { tone: '天空粉藍', notes: [N.SHEET] });
  g('Pastel Peach', { AHP: 0.1 }, { tone: '蜜桃粉橘', notes: [N.SHEET] });
  g('Pastel Rose', { AHP: 0.2 }, { tone: '玫瑰粉紅', alias: 'ROSW', notes: [N.SHEET, '原表拼為 ROSW'] });
  g('Pastel Mint', { TDS: 0.046 }, { tone: '薄荷粉綠', notes: [N.SHEET] });
  g('P MIX', { TDS: 0.08 }, { notes: [N.SHEET] });

  /* ---- ZERO ---- */
  g = G('ZERO', 'ZERO');
  g('2N', { TDS: 3.21 });
  g('5NA', { '未標示': 1.5 }, { notes: [N.NOTYPE] });
  g('7N', { TDS: 0.85 }, { notes: ['高於 7NA 0.56 與 8N 0.55，請確認'] });
  g('7NA', { '未標示': 0.56 }, { notes: [N.NOTYPE] });
  g('8N', { TDS: 0.55 });
  g('5B', { TDS: 0.79 });
  g('8AP', { '未標示': 0.35 }, { notes: [N.NOTYPE, N.ALIGN] });
  g('6G', { TDS: 0.71 });
  g('6VA', { TDS: 0.35 });

  /* ---------------- Fiole（採 V1） ---------------- */
  const fiole = [];
  const F = (group, tone) => (code, c, v1, o = {}) =>
    fiole.push(Object.assign({ line: 'Fiole', group, tone, code, c, v1 }, o));
  const tb = v => ({ 'TDS/BHP': v });
  const pp = v => ({ PPD: v });
  let f;

  f = F('MTB', '灰藍');
  f('5MTB', { PPD: 0.47, 'TDS/BHP': 0.42 }, 0.89);
  f('6MTB', { PPD: 0.40, 'TDS/BHP': 0.32 }, 0.72);
  f('7MTB', { PPD: 0.36, 'TDS/BHP': 0.22 }, 0.58);
  f('8MTB', { PPD: 0.24, 'TDS/BHP': 0.16 }, 0.40);
  f('9MTB', { PPD: 0.18, 'TDS/BHP': 0.12 }, 0.30);
  f('10MTB', { PPD: 0.15, 'TDS/BHP': 0.10 }, 0.25);

  f = F('MT', '灰');
  [['3MT', 1.10], ['4MT', 0.82], ['5MT', 0.63], ['6MT', 0.48], ['7MT', 0.32], ['8MT', 0.24], ['10MT', 0.14], ['12MT', 0.09]]
    .forEach(([k, v]) => f(k, tb(v), v));

  f = F('NB', '冷棕');
  f('3NB', { PPD: 1.20, 'TDS/BHP': 0, PAP: 0.05 }, 1.20, { notes: ['V1 1.20 低於 4NB 的 1.70，且 TDS/BHP 欄為 0.00，請確認'] });
  f('4NB', { PPD: 0.90, 'TDS/BHP': 0.80, PAP: 0.12 }, 1.70);
  f('5NB', { PPD: 0.78, 'TDS/BHP': 0.65, PAP: 0.10 }, 1.43);
  f('6NB', { PPD: 0.66, 'TDS/BHP': 0.45, PAP: 0.08 }, 1.11);
  f('7NB', { PPD: 0.57, 'TDS/BHP': 0.30, PAP: 0.07 }, 0.87);
  f('8NB', { PPD: 0.35, 'TDS/BHP': 0.15, PAP: 0.05 }, 0.50);
  f('9NB', { PPD: 0.30, 'TDS/BHP': 0.12, PAP: 0.05 }, 0.42);
  f('10NB', { PPD: 0.26, 'TDS/BHP': 0.10, PAP: 0.04 }, 0.36);

  f = F('NN', '冷棕');
  [['2NN', 1.20], ['3NN', 0.95], ['4NN', 0.48], ['5NN', 0.36], ['6NN', 0.17], ['8NN', 0.12], ['9NN', 0.07], ['10NN', 0.03]]
    .forEach(([k, v]) => f(k, pp(v), v));
  f('7NN', pp(0.18), 0.18, { notes: ['0.18 略高於 6NN 的 0.17'] });

  f = F('WB', '暖咖');
  [['5WB', 0.85, 0.13], ['6WB', 0.78, 0.11], ['7WB', 0.66, 0.08], ['8WB', 0.36, 0.06], ['9WB', 0.30, 0.05], ['10WB', 0.26, 0.04]]
    .forEach(([k, a, p]) => f(k, { PPD: a, PAP: p }, a));

  f = F('RB', '暖咖微紅');
  [['5RB', 0.75, 0.12], ['6RB', 0.63, 0.11], ['7RB', 0.54, 0.09], ['8RB', 0.30, 0.07], ['9RB', 0.28, 0.06], ['10RB', 0.24, 0.05]]
    .forEach(([k, a, p]) => f(k, { PPD: a, PAP: p }, a));

  f = F('GN', '冷咖');
  [['4GN', 0.72], ['6GN', 0.50], ['7GN', 0.36], ['8GN', 0.21], ['10GN', 0.09]]
    .forEach(([k, v]) => f(k, pp(v), v));
  f('5GN', pp(0.06), 0.06, { notes: ['4GN 0.72、6GN 0.50，5GN 僅 0.06，推測應為 0.60'] });

  f = F('GA', '藍紫灰');
  f('4GA', { PPD: 0.34, 'TDS/BHP': 0.05 }, 0.39);
  f('5GA', { PPD: 0.27, 'TDS/BHP': 0.04 }, 0.31);
  f('6GA', { PPD: 0.21, 'TDS/BHP': 0.03 }, 0.24);
  f('7GA', { PPD: 0.14, 'TDS/BHP': 0.03 }, 0.17);
  f('8GA', { PPD: 0.21, 'TDS/BHP': 0.03 }, 0.24, { notes: ['與 6GA 數值完全相同且高於 7GA，疑似複製錯誤'] });
  f('10GA', { PPD: 0.03, 'TDS/BHP': 0.08 }, 0.11);

  f = F('GP', '暖咖');
  [['4GP', 0.76], ['5GP', 0.53], ['6GP', 0.36], ['7GP', 0.22], ['8GP', 0.11], ['10GP', 0.05], ['12GP', 0.02]]
    .forEach(([k, v]) => f(k, pp(v), v));

  f = F('GB', '咖啡');
  [['4GB', 1.10], ['5GB', 0.90], ['6GB', 0.62], ['7GB', 0.43], ['8GB', 0.22], ['10GB', 0.09], ['12GB', 0.03]]
    .forEach(([k, v]) => f(k, pp(v), v));

  f = F('GNB', '');
  [['4GNB', 1.00, 0.07], ['5GNB', 0.85, 0.06], ['6GNB', 0.65, 0.06], ['7GNB', 0.47, 0.05], ['8GNB', 0.30, 0.05], ['10GNB', 0.09, 0.03], ['12GNB', 0.03, 0.02]]
    .forEach(([k, a, p]) => f(k, { PPD: a, PAP: p }, a));

  f = F('BB', '');
  [['5BB', 1.00, 0.20], ['7BB', 0.70, 0.12], ['8BB', 0.43, 0.12], ['9BB', 0.36, 0.12], ['10BB', 0.31, 0.11]]
    .forEach(([k, a, p]) => f(k, { PPD: a, PAP: p }, a));
  f('6BB', { PPD: 0.12, PAP: 0.16 }, 0.12, { notes: ['5BB 1.00、7BB 0.70，6BB 僅 0.12，明顯偏低'] });

  f = F('B', '藍灰');
  f('B6', tb(0.50), 0.50);
  f('B8', { PPD: 0.01, 'TDS/BHP': 0.27 }, 0.28);
  f('B10', tb(0.15), 0.15);

  f = F('MB', '藍綠');
  f('MB6', tb(0.15), 0.15, { notes: ['6 號 0.15 低於 8 號 0.23，順序顛倒待確認'] });
  f('MB8', tb(0.23), 0.23, { notes: ['8 號 0.23 高於 6 號 0.15，順序顛倒待確認'] });
  f('MB10', tb(0.01), 0.01);

  f = F('YM', '咖綠');
  [['YM6', 0.60], ['YM8', 0.45], ['YM10', 0.29]].forEach(([k, v]) => f(k, tb(v), v));

  f = F('RV', '紅紫咖');
  [['RV6', 0.32, 0.03], ['RV8', 0.21, 0.03], ['RV10', 0.10, 0.02]]
    .forEach(([k, a, p]) => f(k, { PPD: a, PAP: p }, a));

  f = F('V', '灰藍紫');
  [['V4', 0.63], ['V6', 0.50], ['V8', 0.24], ['V10', 0.11]].forEach(([k, v]) => f(k, tb(v), v));

  f = F('BV', '藍紫灰');
  f('BV6', { PPD: 0.02, 'TDS/BHP': 0.15 }, 0.17);
  f('BV8', tb(0.16), 0.16);
  f('BV10', tb(0.12), 0.12);

  f = F('PINK BEIGE', '胭脂粉');
  [['PINKBEIGE5', 0.35, 0.11], ['PINKBEIGE7', 0.23, 0.07], ['PINKBEIGE9', 0.10, 0.04], ['PINKBEIGE11', 0.06, 0.02], ['PINKBEIGE13', 0.04, 0.02]]
    .forEach(([k, a, p]) => f(k, { PPD: a, PAP: p }, a));

  f = F('SAND BEIGE', '奶霜灰／沙漠灰');
  [['SANDBEIGE5', 0.38, 0.27, 0.11, 0.65], ['SANDBEIGE7', 0.24, 0.17, 0.07, 0.41], ['SANDBEIGE9', 0.11, 0.08, 0.03, 0.19],
   ['SANDBEIGE11', 0.07, 0.05, 0.02, 0.12], ['SANDBEIGE13', 0.05, 0.04, 0.01, 0.09]]
    .forEach(([k, a, t, p, v1]) => f(k, { PPD: a, 'TDS/BHP': t, PAP: p }, v1));

  f = F('GLAY', '清水灰');
  [['GLAY5', 0.63], ['GLAY7', 0.42], ['GLAY9', 0.22], ['GLAY11', 0.15], ['GLAY13', 0.10]]
    .forEach(([k, v]) => f(k, tb(v), v, { alias: 'GRAY' }));

  f = F('其它系列', '');
  f('DEEPPURPLE5', tb(0.60), 0.60);
  f('ULTRAVIOLET5', { PPD: 0.12, 'TDS/BHP': 0.07 }, 0.19, { alias: 'UTRLAVIOLET', notes: ['原表拼為 UTRLAVIOLET', 'V2 不符 PPD×1.5 規則，欄位歸屬待確認'] });
  f('ULTRAVIOLET6', { '未確認': 0.40 }, 0.40, { alias: 'UTRLAVIOLET', notes: ['原表 V2（0.20）小於 V1，欄位歸屬無法判定', '濃度高於 5 號（0.19），請確認'] });
  f('CORALPINK6', { PPD: 0.13, PAP: 0.05 }, 0.13);
  f('G6', tb(0.20), 0.20);
  f('PINK6', { PPD: 0.20, PAP: 0.01 }, 0.20);
  f('AQUABLUE7', { '未確認': 0.45 }, 0.45, { notes: ['原表 V2（0.23）小於 V1，欄位歸屬無法判定'] });
  f('CARDINALRED7', { PAP: 1.25 }, 0, { notes: ['V1 = 0：唯一成分不計入 V1（推定為 PAP）'] });
  f('O7', pp(0.01), 0.01);
  f('R7', pp(0.11), 0.11);
  f('RED7', { PPD: 0.24, 'TDS/BHP': 0.10, PAP: 0.35 }, 0.34);
  f('C8', pp(0.13), 0.13);
  f('P8', pp(0.16), 0.16);
  f('C10', pp(0.08), 0.08);
  f('CORALPINK10', { PPD: 0.05, PAP: 0.02 }, 0.05);
  f('ORANGE10', { PPD: 0.08, PAP: 0.70 }, 0.08);
  f('P10', pp(0.08), 0.08);
  f('BEIGE14', { PPD: 0.08, PAP: 0.24 }, 0.08);
  f('LAVENDER14', { PPD: 0.01, 'TDS/BHP': 0.08 }, 0.09);
  f('SILVERASH14', pp(0.03), 0.03);

  f = F('其它', '');
  f('NavyBlue5', { PPD: 0.01, 'TDS/BHP': 0.25 }, 0.26);
  f('ASH', { PPD: 0.12, 'TDS/BHP': 0.10 }, 0.22);
  f('Black', pp(1.20), 1.20);
  f('BlackBooster', { PPD: 1.00, 'TDS/BHP': 0.80 }, 1.80, { notes: ['原表重複列出兩次'] });
  f('Blue', tb(0.40), 0.40);
  f('Brown', pp(0.51), 0.51);
  f('BrownBooster', tb(2.10), 2.10);
  f('CoolBrown', tb(0.45), 0.45);
  f('CopperOrange', pp(0.10), 0.10);
  f('DarkGray', pp(0.75), 0.75);
  f('MAT', tb(0.25), 0.25);
  f('Red', pp(0.20), 0.20);
  f('Violet', { PPD: 0.15, 'TDS/BHP': 0.02 }, 0.17);
  f('WarmBrown', pp(0.15), 0.15);
  f('Yellow', pp(0.05), 0.05);

  /* ---------------- Milbon ---------------- */
  const milbon = [];
  const M = group => (code, total, types, tone, o = {}) => {
    let c = o.c || null;
    if (!c && types.length === 1) c = { [types[0]]: total };
    milbon.push({ line: 'Milbon', group, code, total, types, tone, c, notes: o.notes, alias: o.alias });
  };
  let m;
  const T = ['TDS'], P = ['PPD'], TP = ['TDS', 'PPD'];

  m = M('寶石色名');
  m('3 Amethyst', 0.78, T, '紫咖・高耦');
  m('5 Amethyst', 0.4, T, '紫咖・高耦');
  m('7 Amethyst', 0.2, T, '紫咖・高耦');
  m('9 Amethyst', 0.24, T, '藍紫灰・高耦', { notes: ['濃度高於 7 號（0.20），色調也不同'] });
  m('13 Amethyst', 0.1, T, '紫咖');
  m('3 Silver', 0.8, T, '灰紫', { alias: 'Sliver' });
  m('5 Silver', 0.5, T, '灰紫', { alias: 'Sliver' });
  m('7 Silver', 0.27, T, '灰紫', { alias: 'Sliver' });
  m('9 Silver', 0.24, T, '灰紫', { alias: 'Sliver', notes: ['9 號與 13 號同為 0.24'] });
  m('13 Silver', 0.24, T, '灰紫', { alias: 'Sliver', notes: ['9 號與 13 號同為 0.24'] });
  m('3 Emerald', 1.46, T, '冷咖綠');
  m('7 Emerald', 0.75, T, '冷咖綠');
  m('9 Emerald', 0.45, T, '冷咖綠');
  m('13 Emerald', 0.36, T, '冷咖綠');
  m('3 Sapphire', 0.3, T, '藍灰');
  m('5 Sapphire', 0.27, T, '藍灰');
  m('7 Sapphire', 0.2, T, '藍灰');
  m('9 Sapphire', 0.14, T, '藍灰');
  m('13 Sapphire', 0.1, T, '藍灰');
  m('3 Gray Pearl', 1.1, T, '灰');
  m('5 Gray Pearl', 0.75, T, '灰');
  m('9 Gray Pearl', 0.25, T, '灰');
  m('13 Gray Pearl', 0.24, T, '灰');
  m('3 S-Topaz', 1.9, T, '冷咖');
  m('5 S-Topaz', 1.25, T, '冷咖');
  m('9 S-Topaz', 0.83, T, '冷咖');
  m('13 S-Topaz', 0.5, T, '冷咖');
  m('3 Cobalt-B', 0.7, ['TDS', 'BHP'], '藍灰');
  m('5 Cobalt-B', 0.5, ['TDS', 'BHP'], '藍灰');
  m('7 Cobalt-B', 0.36, ['TDS', 'BHP'], '藍灰');
  m('9 Cobalt-B', 0.29, ['TDS', 'BHP'], '藍灰');
  m('13 Cobalt-B', 0.17, ['TDS', 'BHP'], '藍灰');
  m('5 LA-Pearl', 0.7, T, '灰藍紫');
  m('9 LA-Pearl', 0.3, T, '灰藍紫');
  m('5 B-Pearl', 0.5, T, '灰藍紫');
  m('9 B-Pearl', 0.24, T, '灰藍紫');
  m('9 LE-Pearl', 0.26, ['TDS', 'BHP'], '綠咖');
  m('13 P-Garnet', 0.4, T, '紫咖・高耦');

  m = M('b 字頭');
  m('b7-PB', 0.43, P, '紫咖', { notes: ['b7 與 b9 同為 0.43'] });
  m('b9-PB', 0.43, P, '紫咖', { notes: ['b7 與 b9 同為 0.43'] });
  m('b5-SB', 0.95, P, '冷咖');
  m('b6-SB', 0.8, P, '冷咖');
  m('b7-SB', 0.7, P, '冷咖');
  m('b9-SB', 0.32, P, '冷咖');
  m('b6-MB', 0.58, P, '暖咖');
  m('b6-BB', 1.1, TP, '暖咖');
  m('b7-BB', 0.9, TP, '暖咖');
  m('b9-OB', 0.3, P, '冷咖');
  m('b7-AB', 0.44, P, '灰紫');
  m('b9-AB', 0.3, P, '灰紫');
  m('b4-CB', 1.2, ['PPD', 'TDS'], '咖');
  m('b6-CB', 1.23, ['PPD', 'TDS'], '咖', { c: { PPD: 0.55, TDS: 0.68 } });
  m('b8-CB', 0.67, ['PPD', 'TDS'], '咖', { c: { PPD: 0.4, TDS: 0.27 } });
  m('b9-CB', 0.65, ['PPD', 'TDS'], '咖', { c: { PPD: 0.55, TDS: 0.1 }, notes: ['PPD 0.55 高於 b8-CB 的 0.40'] });
  [['b2-NB', 1.2], ['b4-NB', 1.15], ['b5-NB', 1.0], ['b6-NB', 0.9], ['b7-NB', 0.7], ['b8-NB', 0.46], ['b9-NB', 0.38]]
    .forEach(([k, v]) => m(k, v, ['PPD', 'PAP'], '暖咖'));
  m('b12-NB', 0, [], '無色料', { notes: ['無色料，鹼度 2.5'] });

  m = M('NB・CB');
  m('3-NB', 1.5, P, '冷咖', { notes: ['另含耦合劑 DPE 0.1'] });
  m('5-NB', 0.6, P, '咖');
  m('6-NB', 0.36, P, '暖咖');
  m('7-NB', 0.25, P, '暖咖');
  m('13-NB', 0.04, P, '咖');
  m('5-CB', 0.67, P, '咖');

  m = M('f 字頭');
  const FPK = ['PPD', 'TDS', 'CPPDS'];
  m('6 fPK', 0.7, FPK, '紅紫咖');
  m('7 fPK', 0.6, FPK, '紅紫咖');
  m('8 fPK', 0.4, FPK, '紅紫咖');
  m('9 fPK', 0.3, FPK, '紅紫咖');
  m('11 fPK', 0.5, FPK, '紅紫咖・高耦', { notes: ['濃度高於 9 號（0.30）'] });
  m('13 fPK', 0.39, FPK, '紅紫咖・高耦');
  m('6 fMA', 0.7, T, '咖紫');
  m('7 fMA', 0.5, T, '咖紫');
  m('13 fMA', 0.1, T, '咖紫');
  m('7 fSA', 0.4, T, '冷咖綠');
  m('8 fSA', 0.35, T, '冷咖綠');
  m('9 fSA', 0.26, T, '冷咖綠');
  m('13 fSA', 0.14, T, '冷咖綠');
  [['6 fAP', 0.55], ['7 fAP', 0.33], ['8 fAP', 0.27], ['9 fAP', 0.25], ['11 fAP', 0.14], ['13 fAP', 0.1]]
    .forEach(([k, v]) => m(k, v, T, '紫咖'));

  m = M('n 字頭');
  m('6 nKH', 0.8, TP, '冷咖綠');
  m('9 nKH', 0.4, TP, '冷咖綠');
  m('13 nKH', 0.14, TP, '冷咖綠');
  m('9 nGR', 0.31, TP, '灰（微藍紫）');
  m('13 nGR', 0.15, TP, '灰（微藍紫）');
  m('9-nPL', 0.23, ['PPD', 'PAP'], '紫咖・高耦');

  m = M('Lu 字頭');
  [['6 LuSP', 0.46], ['7 LuSP', 0.3], ['8 LuSP', 0.16], ['9 LuSP', 0.12], ['11 LuSP', 0.08], ['13 LuSP', 0.08]]
    .forEach(([k, v]) => m(k, v, ['PPD', 'BHP'], '冷咖'));
  [['7 LuRS', 0.28], ['8 LuRS', 0.14], ['9 LuRS', 0.12], ['11 LuRS', 0.08], ['13 LuRS', 0.08]]
    .forEach(([k, v]) => m(k, v, P, '咖紅'));
  m('6 LuMI', 0.6, TP, '灰綠');
  m('9 LuMI', 0.27, TP, '灰綠');

  m = M('g 字頭');
  [['6 gLIR', 0.3], ['8 gLIR', 0.18], ['9 gLIR', 0.15]].forEach(([k, v]) => m(k, v, TP, '藍灰'));
  [['6 gLAP', 0.5], ['7 gLAP', 0.27], ['9 gLAP', 0.1], ['11 gLAP', 0.06]].forEach(([k, v]) => m(k, v, ['PAP', 'TDS', 'PPD'], '橘咖'));
  [['6 gLVI', 0.6], ['7 gLVI', 0.5], ['9 gLVI', 0.27], ['11 gLVI', 0.2]].forEach(([k, v]) => m(k, v, TP, '紫咖'));
  [['7 gLCa', 0.52], ['8 gLCa', 0.37], ['9 gLCa', 0.27], ['11 gLCa', 0.16]].forEach(([k, v]) => m(k, v, ['PPD', 'PAP'], '咖'));

  m = M('c 字頭');
  [['6 cLA', 0.4], ['7 cLA', 0.3], ['9 cLA', 0.19], ['13 cLA', 0.07]].forEach(([k, v]) => m(k, v, TP, '藍紫灰'));
  [['6 cBL', 0.23], ['7 cBL', 0.17], ['11 cBL', 0.06], ['13 cBL', 0.06]].forEach(([k, v]) => m(k, v, TP, '藍灰（紫）'));

  m = M('m 字頭');
  [['8 mMN', 0.2], ['9 mMN', 0.1], ['11 mMN', 0.1]].forEach(([k, v]) => m(k, v, T, '藍灰'));
  m('7-mCH', 0.25, P, '咖');
  [['7-mML', 0.36], ['8-mML', 0.26], ['9-mML', 0.17]].forEach(([k, v]) => m(k, v, ['PPD', 'PAP'], '橘咖'));
  m('6-mNV', 0.29, T, '藍紫灰');
  m('9-mNV', 0.16, ['TDS', 'CPPDS'], '藍紫灰');
  m('11-mNV', 0.1, ['TDS', 'CPPDS'], '藍紫灰');

  m = M('h 字頭');
  [['6-hHZ', 0.5], ['8-hHZ', 0.32], ['9-hHZ', 0.32], ['11-hHZ', 0.11], ['13-hHZ', 0.11]].forEach(([k, v]) => m(k, v, TP, '咖（濁）'));
  [['6-hCN', 0.6], ['7-hCN', 0.27], ['9-hCN', 0.173], ['13-hCN', 0.11]].forEach(([k, v]) => m(k, v, TP, '冷咖'));

  m = M('L 字頭');
  [['8-LCH', 0.36], ['9-LCH', 0.31], ['11-LCH', 0.2], ['13-LCH', 0.1]].forEach(([k, v]) => m(k, v, T, '咖'));
  [['6-LBR', 0.8], ['8-LBR', 0.45], ['9-LBR', 0.43], ['11-LBR', 0.24], ['13-LBR', 0.2]].forEach(([k, v]) => m(k, v, TP, '咖（濁）'));

  m = M('C 字頭');
  m('C6-MT', 0.5, T, '灰');
  m('C8-MT', 0.24, T, '灰');
  m('C8-BL', 0.13, T, '藍灰');
  m('C8-RV', 0.45, ['PPD', 'TDS'], '紅紫・高耦');
  m('C13 CL', 0, [], '無色料', { notes: ['無色料，鹼度 2.4'] });
  m('C13 CL+', 0, [], '無色料', { notes: ['無色料，鹼度 5'] });

  m = M('S 字頭・其他單品');
  m('7-SAS', 0.3, T, '灰（紫）');
  m('8-SAS', 0.22, T, '灰（紫）');
  m('13-SAS', 0.1, T, '灰（紫）');
  m('9-SAQ', 0.14, T, '藍灰');
  m('11-sIG', 0.14, T, '灰藍紫');
  m('11-srMP', 0.09, ['CPPDS', 'TDS', 'PPD'], '紅紫咖');
  [['6 iPT', 0.6], ['7 iPT', 0.3], ['11 iPT', 0.13], ['13 iPT', 0.08]].forEach(([k, v]) => m(k, v, T, '灰'));
  m('13-wAS', 0.025, ['PPD', 'TDS'], '灰藍', { notes: ['原表註記 (dpe)；DPE 為耦合劑'] });
  m('5-10', 0.45, P, '灰藍紫');
  m('9-10', 0.14, T, '灰紫');

  m = M('純色・加強色');
  m('BLUE', 0.5, ['BHP'], '藍');
  m('Green', 0.16, ['BHP'], '藍綠');
  m('RED', 0.46, ['Basic Red'], '紅', { notes: ['鹽基性直接染料，非氧化型中間體，不適用中間體濃度明度表'] });
  m('Yellow', 0.1, ['Basic Yellow'], '黃', { notes: ['鹽基性直接染料，非氧化型中間體，不適用中間體濃度明度表'] });
  m('Brown', 1.0, T, '咖');
  m('RedViolet', 1.5, ['AHP'], '紅紫');
  m('Orange', 1.87, ['AHP'], '橘');
  m('Violet', 0.6, P, '紫咖');
  m('deeppurple', 0.55, TP, '藍紫灰');
  m('deepblue', 0.6, TP, '藍灰');
  m('deepsilver', 0.78, ['PPD', 'TDS'], '灰', { c: { PPD: 0.44, TDS: 0.34 }, alias: 'deepsliver', notes: ['原表寫 deepsliver、PPD+TDD，判定 TDD 為 TDS'] });

  m = M('Naked');
  m('5-NakedSand', 1.15, T, '冷咖');
  m('7-NakedSand', 0.8, T, '冷咖');
  m('9-NakedSand', 0.5, T, '冷咖');
  m('7-NakedCoral', 0.4, T, '咖紅');
  m('9-NakedCoral', 0.27, T, '咖紅');
  m('13-NakedCoral', 0.24, T, '咖紅');
  m('7-NakedWarm', 0.3, ['PAP', 'TDS'], '暖咖');
  m('9-NakedWarm', 0.2, ['PAP', 'TDS'], '暖咖');
  m('13-NakedWarm', 0.18, ['PAP', 'TDS'], '暖咖');

  m = M('Pale');
  m('Pale-Violet', 0.4, ['TDS', 'PAP'], '紫咖・高耦');
  m('Pale-Pink', 0.4, ['PPD', 'PAP'], '紅咖・高耦');
  m('Pale-Beige', 0.58, T, '冷咖（黃）');
  m('Pale-Khaki', 0.26, T, '冷咖綠');
  m('Pale-Silver', 0.3, T, '灰（紫）', { alias: 'Pale-Sliver' });
  m('Pale-Blue', 0.06, T, '藍灰');
  m('Pale-Orange', 0.5, ['PAP'], '橘');

  m = M('re 系列');
  const RE_NOTE = '原表未標示中間體種類';
  [['6rebl', 0.7], ['7rebl', 0.4], ['8rebl', 0.25], ['9rebl', 0.15], ['11rebl', 0.07]]
    .forEach(([k, v]) => m(k, v, ['未標示'], '紅紫咖', { notes: [RE_NOTE] }));
  m('13rebl', 0.1, ['未標示'], '紅紫咖', { notes: [RE_NOTE, '13 號高於 11 號（0.07）'] });
  [['6rell', 0.6], ['7rell', 0.4], ['8rell', 0.3], ['9rell', 0.25], ['11rell', 0.15]]
    .forEach(([k, v]) => m(k, v, ['未標示'], '灰藍紫', { notes: [RE_NOTE] }));
  m('13rell', 0.2, ['未標示'], '灰藍紫', { notes: [RE_NOTE, '13 號高於 11 號（0.15）'] });
  [['6reel', 0.8], ['7reel', 0.6], ['8reel', 0.4], ['9reel', 0.3], ['11reel', 0.1]]
    .forEach(([k, v]) => m(k, v, ['未標示'], '米棕', { notes: [RE_NOTE] }));
  m('13reel', 0.15, ['未標示'], '米棕', { notes: [RE_NOTE, '13 號高於 11 號（0.10）'] });

  /* ---------------- 匯出 ---------------- */
  window.DYE_DATA = {
    updated: '2026-10-22',
    vendors: [
      {
        id: 'goldwell', name: 'Goldwell', items: goldwell,
        valueLabel: '中間體合計',
        note: '濃度＝原表中間體分項加總（TDS、PAP、4A3MP、AHP 等）。與總表「濃度」欄不符的色號會另外標示。耦合劑資料因 PDF 欄位錯位，尚未納入。',
      },
      {
        id: 'fiole', name: 'Fiole', items: fiole,
        valueLabel: 'V1（不含 PAP）',
        note: '濃度＝V1（PPD + TDS/BHP，不含 PAP）。PAP 會列出，但不計入 V1。原表 TDS 與 BHP 欄位在 PDF 中無法區分，暫標為「TDS/BHP」。',
      },
      {
        id: 'milbon', name: 'Milbon', items: milbon,
        valueLabel: '總濃度',
        note: '濃度＝原表總濃度。含多種中間體的色號，原表多數只提供總量、沒有分項。',
      },
    ],
  };
})();
