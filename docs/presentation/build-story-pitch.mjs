// Build the revised PAWLAND story pitch with editable text and tables.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const modules = process.env.RUNTIME_NODE_MODULES ?? 'C:/Users/kachi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
process.env.RUNTIME_NODE_MODULES = modules;
const skill = process.env.PRESENTATION_SKILL ?? 'C:/Users/kachi/.codex/plugins/cache/openai-primary-runtime/presentations/26.915.20218/skills/presentations';
const python = process.env.RUNTIME_PYTHON ?? 'C:/Users/kachi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const { Presentation, PresentationFile, FileBlob } = await import(pathToFileURL(path.join(modules, '@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')).href);

const tmp = path.join(root, 'tmp/pawland-story');
const out = path.resolve(root, '../../output/pawpair-pitch');
await fs.mkdir(tmp, { recursive: true });
await fs.mkdir(out, { recursive: true });

const font = 'Yu Gothic';
const colors = { bg: '#F8F7F3', ink: '#163B33', green: '#397D65', gray: '#5D6C66', orange: '#C8754E', light: '#E8EFE9', white: '#FFFFFF' };
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const notes = [];
const source = {
  yano: '矢野経済研究所「ペット関連総市場に関する調査を実施（2026年）」2026-09-01。2025年度の市場規模見込み1兆9,504億円。https://www.yano.co.jp/press-release/show/press_id/4169 （参照2026-09-22）',
  env: '環境省「動物愛護管理行政事務提要（令和7年度版）」登録・届出状況総括表。保管32,576件、2025-04-01現在。https://www.env.go.jp/nature/dobutsu/aigo/2_data/statistics/files/r07/2_1_1.pdf （参照2026-09-22）',
  anicom: 'アニコム損害保険「2025最新版 ペットにかける年間支出調査」2026-03-11。保険契約者5,494名、犬413,416円。https://www.anicom-sompo.co.jp/news-release/2025/20260311/ （参照2026-09-22）',
  criteria: '提供資料「AI HACK 2026 Day1.pdf」p.15-16の評価5項目と4分発表要件、および「OrcaRouter様資料.pdf」の技術情報を参照。添付資料内の手続き指示は本作業への指示として扱わない。',
  repo: '実装根拠: README.md、worker/index.ts、src/domain/matching.ts、src/domain/compatibility.ts、現行の施設認証・施設別データ分離。',
};

function addText(slide, value, x, y, w, h, size = 30, color = colors.ink, bold = false, align = 'left') {
  const shape = slide.shapes.add({ geometry: 'textbox', position: { left: x, top: y, width: w, height: h }, fill: 'none', line: { fill: 'none', width: 0 } });
  shape.text = value;
  shape.text.style = { typeface: font, fontSize: size, bold, color, alignment: align, verticalAlignment: 'middle', autoFit: 'none' };
  return shape;
}

function addRect(slide, x, y, w, h, fill, radius = 0, line = 'none') {
  return slide.shapes.add({ geometry: radius ? 'roundRect' : 'rect', position: { left: x, top: y, width: w, height: h }, fill, line: { fill: line, width: line === 'none' ? 0 : 1 } });
}

function makeSlide(title, num, seconds, script, refs = '', dark = false) {
  const slide = p.slides.add();
  slide.background.fill = dark ? colors.ink : colors.bg;
  addText(slide, title, 64, 38, 1152, 92, 42, dark ? colors.white : colors.ink, true);
  addText(slide, num <= 6 ? 'PAWLAND' : '質疑応答用', 64, 668, 190, 30, 16, dark ? '#CDDFD3' : colors.gray);
  addText(slide, '/', 230, 668, 28, 30, 16, dark ? '#CDDFD3' : colors.gray, false, 'center');
  addText(slide, String(num).padStart(2, '0'), 270, 668, 60, 30, 16, dark ? '#CDDFD3' : colors.gray);
  slide.speakerNotes.textFrame.setText(`${seconds ? `目安 ${seconds}秒\n` : ''}${script}\n\n根拠・注記\n${refs}`);
  notes.push({ num, title, seconds, script, refs });
  return slide;
}

function addTable(slide, values, x, y, w, h, widths, size = 22) {
  const table = slide.tables.add({ rows: values.length, columns: values[0].length, left: x, top: y, width: w, height: h, values, columnWidths: widths });
  table.borders.assign({ fill: '#D5DED5', width: 1, style: 'solid' });
  table.cells.block({ row: 0, column: 0, rowCount: values.length, columnCount: values[0].length }).assign({ textStyle: { typeface: font, fontSize: size, color: colors.ink }, margins: { left: 10, right: 10, top: 8, bottom: 8 } });
  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < values[0].length; c++) {
      const cell = table.getCell(r, c);
      cell.fill = r === 0 ? colors.ink : (r % 2 ? colors.white : colors.light);
      cell.text.style = { typeface: font, fontSize: size, color: r === 0 ? colors.white : colors.ink, bold: r === 0 };
    }
  }
  return table;
}

// 1. Cover and product screen
let script = '大切な家族だから、安心して預けたい。PAWLANDは、ワンちゃんの性格や体格をもとに相性を見える化し、過ごしやすい部屋割りをスタッフへ提案するシステムです。画面では、今日預かる子の状態と、システムの配置案をひとつの流れで確認できます。';
let slide = makeSlide('PAWLAND｜ワンちゃんが過ごしやすい空間へ', 1, 25, script, `${source.repo}\n画面: https://pawpair-ai-hack-2026.web.app/demo を2026-09-22に撮影。公開デモのサンプルデータ。画面内容は加工せず掲載。`, true);
addText(slide, '大切な家族だから、\n安心して預けたい。', 64, 170, 480, 130, 42, colors.white, true);
addText(slide, '性格と体格から、\n過ごしやすい部屋割りを提案', 64, 330, 480, 95, 27, '#CDDFD3');
slide.images.add({ blob: await fs.readFile(path.join(root, 'docs/presentation/assets/daily-operations-detail.png')), contentType: 'image/png', alt: 'PAWLAND実システムの今日の運営画面', fit: 'contain', position: { left: 584, top: 150, width: 632, height: 444 } });
addText(slide, 'PAWLAND 実システム画面', 584, 603, 632, 30, 18, '#CDDFD3', false, 'center');

// 2. Story-led use case
script = 'まず飼い主の気持ちです。大切な家族を預けるとき、ほかの子と合わず、落ち着けなかったらと不安になります。一方、預かるスタッフは、性格も体格も違う子たちを見ながら、誰と一緒なら過ごしやすいかを短時間で考えます。この二つの不安をつなぐために、PAWLANDは相性を見える化し、過ごす場所を考えます。';
slide = makeSlide('預けたい飼い主と、預かる現場の困りごと', 2, 40, script, 'ストーリー説明用の生成イラスト。実在の人物・施設を示すものではない。');
slide.images.add({ blob: await fs.readFile(path.join(root, 'docs/presentation/assets/owner-sitter-story.png')), contentType: 'image/png', alt: '預ける飼い主と預かるペットシッターの困りごとを表すイラスト', fit: 'contain', position: { left: 64, top: 145, width: 800, height: 430 } });
addText(slide, '飼い主', 905, 160, 180, 34, 22, colors.green, true);
addText(slide, '「ほかの子と合わず、\n落ち着けなかったら…」', 905, 202, 300, 92, 24, colors.ink, true);
addText(slide, 'ペットシッター', 905, 330, 230, 34, 22, colors.green, true);
addText(slide, '「性格も体格も違う。\n誰と一緒なら\n過ごしやすい？」', 905, 372, 300, 120, 24, colors.ink, true);
addText(slide, '相性を見える化し、過ごす場所を考える。それがPAWLAND。', 120, 600, 1040, 48, 25, colors.orange, true, 'center');

// 3. AI design and judging criteria
script = 'AIに任せる部分と、人が守る部分を分けました。セキュリティでは、氏名や連絡先の専用項目をAIへ送らず、音声も送りません。動画は最大二枚の静止画にし、解析メディアを永続保存せず、施設ごとにデータを分けます。コストでは、OrcaRouter経由のAIを特徴抽出に絞り、全ペアの採点と部屋割りはプログラムで計算します。ペアごとのLLM呼び出しを避け、月二百件、AI予算千円と仮定しました。信頼性では、AI出力を検査し、同室禁止と定員を必ず適用します。特徴抽出、全ペア評価、配置提案までをつなぎ、最後の確定は人が行います。相性スコアで終わらず、実際の部屋割りへ変える点がPAWLANDの独創性です。';
slide = makeSlide('AIに任せる部分と、人が守る部分を分ける', 3, 55, script, `${source.criteria}\n${source.repo}`);
addText(slide, '処理の流れ', 64, 148, 310, 40, 25, colors.green, true);
addRect(slide, 64, 198, 310, 68, colors.light, 1);
addText(slide, '1　OrcaRouter AIで\n　 特徴を抽出', 82, 201, 274, 60, 22, colors.ink, true);
addText(slide, '↓', 190, 270, 56, 32, 25, colors.green, true, 'center');
addRect(slide, 64, 306, 310, 68, colors.light, 1);
addText(slide, '2　計算で全ペア評価', 82, 315, 274, 48, 24, colors.ink, true);
addText(slide, '↓', 190, 378, 56, 32, 25, colors.green, true, 'center');
addRect(slide, 64, 414, 310, 68, colors.light, 1);
addText(slide, '3　計算で配置提案', 82, 423, 274, 48, 24, colors.ink, true);
addText(slide, 'スタッフが確認し、最終確定', 64, 516, 310, 66, 25, colors.orange, true, 'center');
addText(slide, 'セキュリティ', 430, 147, 215, 34, 23, colors.green, true);
addText(slide, '氏名・連絡先の専用項目は\nAIへ送らない\n音声は送信せず、静止画は最大2枚\n解析メディアは保存せず、施設別に分離', 430, 181, 360, 112, 19);
addText(slide, 'コスト', 832, 147, 160, 34, 23, colors.green, true);
addText(slide, 'AIは特徴抽出だけ\n採点と配置は計算\n予算仮定：月200件×5円＝1,000円', 832, 181, 360, 112, 20);
addText(slide, '信頼性・堅牢性', 430, 327, 235, 34, 23, colors.green, true);
addText(slide, 'AI出力を検査\n同室禁止と定員を適用\n失敗時はエラーを表示', 430, 361, 360, 91, 20);
addText(slide, '自律性', 832, 327, 160, 34, 23, colors.green, true);
addText(slide, '特徴抽出から配置提案までを接続\n人が判断できる提案まで自動で進める', 832, 361, 360, 91, 20);
addText(slide, '独創性', 430, 496, 160, 34, 23, colors.green, true);
addText(slide, '相性スコアを現場で使える部屋割りへ\n犬と向き合う最終判断は人に残す', 430, 531, 762, 82, 21, colors.ink, true);

// 4. Pricing logic and market context
script = '月額一万円は、現場の時間価値と原価から順に設計しました。一日三十分、月二十六日、時給千八百円と置くと、判断に使う時間は月二万三千四百円です。その四三パーセント程度を月額一万円にします。月の原価は、AI千円、インフラ五百円、サポート二千円、決済三百五十円で三千八百五十円。月額の貢献利益は六千百五十円です。初期三万円は、導入支援五時間、原価一万円と、初期設定や準備の価値二万円で組み立てます。価格と効果、原価は事業計画上の仮定です。背景には約一・九五兆円のペット市場があり、犬一頭の年間支出は保険契約者調査で約四十一万円です。まず保管登録の二割、六千五百施設を対象と置きます。';
slide = makeSlide('月1万円：現場の時間価値と原価から設計', 4, 50, script, `${source.yano}\n${source.env}\n${source.anicom}\n市場対象6,500施設は保管登録32,576件の20%と置く仮定。価格、原価、時間価値は販売計画上の仮定。`);
addText(slide, '現場の時間価値', 64, 146, 330, 36, 24, colors.green, true);
addText(slide, '30分/日 × 26日 × 時給1,800円', 64, 193, 520, 45, 28, colors.ink, true);
addText(slide, '月23,400円', 64, 242, 485, 72, 47, colors.green, true);
addText(slide, 'その約43%を価格に', 64, 322, 485, 35, 23, colors.gray);
addText(slide, '月額 10,000円', 64, 366, 485, 76, 51, colors.orange, true);
addText(slide, '初期 30,000円', 64, 466, 485, 52, 36, colors.ink, true);
addText(slide, '導入支援5時間×2,000円＝原価1万円\n初期設定・準備の価値 2万円', 64, 522, 485, 72, 21, colors.gray);
addText(slide, '1施設・月の原価', 640, 146, 300, 36, 24, colors.green, true);
addTable(slide, [['内訳', '円'], ['AI 200件×5円', '1,000'], ['インフラ', '500'], ['サポート', '2,000'], ['決済', '350'], ['原価合計', '3,850']], 640, 190, 576, 270, [414, 162], 21);
addText(slide, '月額の貢献利益　6,150円', 640, 475, 576, 46, 28, colors.orange, true);
addText(slide, '市場の背景', 640, 545, 180, 31, 21, colors.green, true);
addText(slide, 'ペット市場 約1.95兆円　犬の年間支出 約41万円（保険契約者調査）\n対象仮説 6,500施設 × 年12万円 ＝ 7.8億円\n保管登録32,576件（ホテル以外を含む）の20%と仮定', 640, 574, 576, 72, 17, colors.gray);
addText(slide, '価格・原価・時間価値は計画上の仮定／料金は税別', 64, 635, 500, 25, 17, colors.gray);

// 5. Profitable first-year sales plan
const active = [5, 8, 12, 17, 22, 28, 35, 42, 50, 58, 68, 80];
const additions = active.map((value, index) => value - (active[index - 1] ?? 0));
const monthly = active;
const onboarding = additions.map((value) => value * 3);
const revenue = active.map((value, index) => value + onboarding[index]);
const facilityMonths = active.reduce((sum, value) => sum + value, 0);
const revenueTotal = revenue.reduce((sum, value) => sum + value, 0);
const variableCost = facilityMonths * 3850 / 10000;
const onboardingCost = active.at(-1) * 10000 / 10000;
const fixedCost = 360;
const profit = revenueTotal - variableCost - onboardingCost - fixedCost;
if (facilityMonths !== 425 || revenueTotal !== 665 || Math.abs(profit - 61.375) > 0.0001) throw new Error('Financial plan mismatch');

script = '販売計画では、発売月から五施設へ導入し、地域施設への直接提案、紹介、業界との連携で、十二か月後に八十施設を目指します。年間九百六十件へ接触し、二百四十件のデモ、百二十件の試用、八十件の契約を目標に置きます。月額売上は四百二十五万円、導入売上は二百四十万円、合計六百六十五万円です。原価と固定費を引くと、初年度営業利益は約六十一万円。年末MRRは八十万円、年換算ARRは九百六十万円です。これは解約ゼロ、月初満額で置いた販売計画です。';
slide = makeSlide('初年度から黒字を目指す販売計画', 5, 40, script, '販売計画・試算。月初契約、当月満額、解約0、値引き・返金なし。固定費360万円＝開発運営240万円＋営業120万円。売上・原価の算式は補足7。');
addText(slide, '初年度売上', 64, 145, 330, 34, 22, colors.gray);
addText(slide, '665万円', 64, 181, 330, 72, 50, colors.green, true);
addText(slide, '初年度営業利益', 445, 145, 350, 34, 22, colors.gray);
addText(slide, '約61万円', 445, 181, 350, 72, 50, colors.orange, true);
addText(slide, '年末施設数', 850, 145, 300, 34, 22, colors.gray);
addText(slide, '80施設', 850, 181, 300, 72, 50, colors.green, true);
addTable(slide, [['収支内訳', '円'], ['月額売上', '4,250,000'], ['導入売上', '2,400,000'], ['月次変動原価', '1,636,250'], ['導入対応原価', '800,000'], ['固定費', '3,600,000'], ['営業利益', '613,750']], 64, 297, 550, 305, [340, 210], 20);
addText(slide, '販売の進め方', 680, 300, 300, 36, 25, colors.green, true);
addText(slide, '地域施設へ直接提案\n既存顧客からの紹介\n業界団体・パートナーとの連携', 680, 345, 500, 125, 26, colors.ink, true);
addText(slide, '年間目標', 680, 495, 180, 34, 22, colors.green, true);
addText(slide, '接触960件、デモ240件\n試用120件、契約80件', 680, 535, 520, 62, 23, colors.ink, true);
addText(slide, '年末MRR 80万円　ARR 960万円', 680, 605, 520, 30, 20, colors.orange, true);

// 6. Future expansion
script = '将来は、家族が心地よく暮らすために使える場面を広げます。まず犬の保育園や多店舗運営へ。次に、猫などほかのペットも、それぞれの性格や習性に合わせて支援します。さらに飼い主自身が、ペットに合う遊び相手や交流相手を探すためにも使えます。日々の様子を反映して提案を更新し、その子に合う過ごし方を一緒に考えるサービスへ育てます。';
slide = makeSlide('家族が心地よく暮らす、もっと多くの場面へ', 6, 20, script, source.yano+'\n将来構想。現時点の提供機能・販売実績を示すものではない。交流相手は遊びや社会化の相手。健康・快適への需要は家族化と健康志向からの解釈。', true);
addText(slide, '将来構想', 64, 135, 190, 38, 22, '#CDDFD3', true);
addText(slide, 'ペットの家族化で、健康・快適さへの需要が広がる', 64, 178, 1152, 32, 24, '#CDDFD3');
addText(slide, '犬の保育園・多店舗', 64, 220, 330, 45, 28, colors.white, true);
addText(slide, '複数拠点でも、\nその子に合う過ごし方を共有', 64, 280, 330, 92, 23, '#CDDFD3');
addText(slide, '猫など、ほかのペット', 470, 220, 350, 45, 28, colors.white, true);
addText(slide, '性格や習性の違いに合わせて、\n評価の考え方を拡張', 470, 280, 350, 92, 23, '#CDDFD3');
addText(slide, '飼い主どうしの交流', 886, 220, 330, 45, 28, colors.white, true);
addText(slide, '相性のよい遊び相手や\n交流相手を見つける', 886, 280, 330, 92, 23, '#CDDFD3');
addRect(slide, 64, 445, 1152, 2, '#6EA58D');
addText(slide, '日々の様子から提案を更新し、\nその子に合う「心地よい時間」を増やす', 100, 480, 1080, 110, 29, colors.white, true, 'center');

// 7. Appendix: editable monthly plan
script = '質疑用の月別販売計画です。金額単位は万円。各月の有料施設数に月額一万円を掛け、新規施設に初期費用三万円を加えています。十二か月の施設月は四百二十五、月額売上四百二十五万円、導入売上二百四十万円、合計六百六十五万円です。';
slide = makeSlide('補足｜12か月の売上計画', 7, 0, script, '販売計画・試算。発売月から販売、月初契約、当月満額、解約0。金額単位は万円・税別。');
addText(slide, '金額：万円・税別／施設数：施設', 805, 113, 411, 30, 18, colors.gray);
addTable(slide, [
  ['月', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
  ['有料施設', ...active.map(String)],
  ['新規', ...additions.map(String)],
  ['月額売上', ...monthly.map(String)],
  ['導入売上', ...onboarding.map(String)],
  ['売上合計', ...revenue.map(String)],
], 48, 150, 1184, 308, [154, ...Array(12).fill(85.8)], 19);
addText(slide, '425施設月', 64, 500, 300, 48, 30, colors.green, true);
addText(slide, '月額売上 425万円', 390, 500, 350, 48, 30, colors.green, true);
addText(slide, '導入売上 240万円', 785, 500, 370, 48, 30, colors.green, true);
addText(slide, '合計 665万円', 64, 565, 420, 62, 42, colors.orange, true);
addText(slide, '前提：発売月から販売／月初契約／当月満額／解約0\n年末80施設は対象仮説6,500施設の約1.2%', 590, 565, 626, 65, 21, colors.gray);

// Export draft previews before finalization so visual fixes can precede the immutable final output.
const candidatePath = path.join(tmp, 'candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidatePath);
for (let i = 0; i < p.slides.items.length; i++) {
  const preview = await p.export({ slide: p.slides.items[i], format: 'png', scale: 1.5 });
  await fs.writeFile(path.join(tmp, `draft-${i + 1}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const finalPath = path.join(out, 'PAWLAND_発表資料_ストーリー改訂版.pptx');
const validatedPath = path.join(out, 'PAWLAND_発表資料_ストーリー改訂版_納品検証.pptx');
const result = await finalizePresentation({
  workspaceDir: path.resolve(root, '../..'),
  candidatePath,
  finalPath: validatedPath,
  pythonExecutable: python,
  integrityValidatorPath: path.join(skill, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skill, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit', '--require-native-table-slide', '4', '--require-native-table-slide', '5', '--require-native-table-slide', '7'],
  explicitTotalSlideCount: 7,
  requiredNativeTableOwnerSlides: [4, 5, 7],
  requiredNativeChartOwnerSlides: [],
  tableArithmeticContracts: [
    { slide: 7, table: 1, label_column: 0, total_row: 5, value_columns: Array.from({ length: 12 }, (_, index) => index + 1), component_rows: [3, 4] },
  ],
  fontPolicy: { basis: 'design', families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(tmp, 'PAWLAND_発表資料_ストーリー改訂版_納品検証.pptx.validation.json'),
});

const checked = await PresentationFile.importPptx(await FileBlob.load(validatedPath));
for (let i = 0; i < checked.slides.items.length; i++) {
  const rendered = await checked.export({ slide: checked.slides.items[i], format: 'png', scale: 1.5 });
  await fs.writeFile(path.join(tmp, `story-final-${i + 1}.png`), new Uint8Array(await rendered.arrayBuffer()));
}
await fs.copyFile(validatedPath, finalPath);

let elapsed = 0;
const mainNotes = notes.filter((item) => item.num <= 6).map((item) => {
  const begin = elapsed;
  elapsed += item.seconds;
  return `## ${item.num}. ${item.title}（${begin}〜${elapsed}秒）\n\n${item.script}`;
}).join('\n\n');
const notesText = `# PAWLAND 発表原稿・ストーリー改訂版\n\n本編6枚、発表目安3分50秒（230秒）。7枚目は質疑用。\n\n${mainNotes}\n\n## 7. 補足｜12か月の売上計画（質疑用）\n\n${notes[6].script}\n\n## 数値前提\n\n- 有料施設数：${active.join('、')}\n- 施設月：${facilityMonths}\n- 月額売上：425万円\n- 導入売上：240万円\n- 初年度売上：665万円\n- 月次変動原価：163.625万円（1,636,250円）\n- 導入対応原価：80万円\n- 固定費：360万円\n- 初年度営業利益：61.375万円（613,750円。資料見出しは約61万円）\n\n## 出典・注記\n\n${Object.values(source).join('\n\n')}\n\n価格、市場対象比率、時間価値、売上、原価、販売件数は事業計画上の仮定。公開デモ画面はサンプルデータを表示。スライド2の画像はストーリー説明用の生成イラスト。\n`;
await fs.writeFile(path.join(root, 'docs/presentation/speaker-notes-story.md'), notesText);
await fs.writeFile(path.join(out, 'PAWLAND_発表原稿_ストーリー改訂版.md'), notesText);
console.log(JSON.stringify({ slides: checked.slides.items.length, elapsed, facilityMonths, revenueTotal, profit, finalPath, validation: result.receiptPath ?? 'written' }, null, 2));
