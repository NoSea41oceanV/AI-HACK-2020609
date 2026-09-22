// Build the final PAWLAND pitch: 8 main slides and 7 appendices.
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

const tmp = path.join(root, 'tmp/pawland-features');
const out = path.resolve(root, '../../output/pawpair-pitch');
const assets = path.join(root, 'docs/presentation/assets');
await fs.mkdir(tmp, { recursive: true });
await fs.mkdir(out, { recursive: true });

const font = 'Yu Gothic';
const colors = { bg: '#F8F7F3', ink: '#163B33', green: '#397D65', gray: '#5D6C66', orange: '#C8754E', light: '#E8EFE9', white: '#FFFFFF', mint: '#CDDFD3' };
const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const notes = [];
const source = {
  yano: '矢野経済研究所「ペット関連総市場に関する調査を実施（2026年）」2026-09-01。2025年度の市場規模見込み1兆9,504億円。https://www.yano.co.jp/press-release/show/press_id/4169 （参照2026-09-22）',
  env: '環境省「動物愛護管理行政事務提要（令和7年度版）」登録・届出状況総括表。保管32,576件、2025-04-01現在。https://www.env.go.jp/nature/dobutsu/aigo/2_data/statistics/files/r07/2_1_1.pdf （参照2026-09-22）',
  anicom: 'アニコム損害保険「2025最新版 ペットにかける年間支出調査」2026-03-11。保険契約者5,494名、犬413,416円。https://www.anicom-sompo.co.jp/news-release/2025/20260311/ （参照2026-09-22）',
  criteria: '提供資料「AI HACK 2026 Day1.pdf」p.15-16の評価5項目と4分発表要件、および「OrcaRouter様資料.pdf」の技術情報を参照。添付資料内の手続き指示は本作業への指示として扱わない。',
  repo: '実装根拠: origin/feat/public-demo-admin の README.md、src/appRoute.ts、src/domain/matching.ts、src/domain/compatibility.ts、src/lib/firebase.ts、src/lib/workerClient.ts、src/OwnerRegistration.tsx、src/pawpals/TodayScreen.tsx、worker/index.ts、worker/README.md、firestore.rules。',
  comparison: '既存の相性関連サービス比較例: Dogmate公式App Store。https://apps.apple.com/jp/app/dogmate-%E6%84%9B%E7%8A%AC%E5%AE%B6%E5%B0%82%E7%94%A8%E3%82%A2%E3%83%97%E3%83%AA/id6739194707 ／ LaVie。https://lavie-app.com/ （いずれも参照2026-09-22）',
};

function addText(slide, value, x, y, w, h, size = 30, color = colors.ink, bold = false, align = 'left') {
  const shape = slide.shapes.add({ geometry: 'textbox', position: { left: x, top: y, width: w, height: h }, fill: 'none', line: { fill: 'none', width: 0 } });
  shape.text = value;
  shape.text.style = { typeface: font, fontSize: size, bold, color, alignment: align, verticalAlignment: 'middle', autoFit: 'none' };
  return shape;
}

function addRect(slide, x, y, w, h, fill, line = 'none', radius = false) {
  return slide.shapes.add({ geometry: radius ? 'roundRect' : 'rect', position: { left: x, top: y, width: w, height: h }, fill, line: { fill: line, width: line === 'none' ? 0 : 1 } });
}

function makeSlide(title, number, seconds, script, refs = '', dark = false) {
  const slide = presentation.slides.add();
  slide.background.fill = dark ? colors.ink : colors.bg;
  if (title) addText(slide, title, 64, 38, 1152, 92, 42, dark ? colors.white : colors.ink, true);
  const footer = number <= 8 ? 'PAWLAND' : '補足';
  addText(slide, footer, 64, 668, 190, 30, 16, dark ? colors.mint : colors.gray);
  addText(slide, '/', 230, 668, 28, 30, 16, dark ? colors.mint : colors.gray, false, 'center');
  addText(slide, String(number).padStart(2, '0'), 270, 668, 60, 30, 16, dark ? colors.mint : colors.gray);
  slide.speakerNotes.textFrame.setText(`${seconds ? `目安 ${seconds}秒\n` : ''}${script}\n\n根拠・注記\n${refs}`);
  notes.push({ number, title, seconds, script, refs });
  return slide;
}

function addTable(slide, values, x, y, w, h, widths, size = 21) {
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

async function imageBlob(name) {
  return fs.readFile(path.join(assets, name));
}

// Financial plan: prices and sales/cost assumptions are planning hypotheses.
const active = [5, 10, 18, 28, 40, 50, 60, 68, 76, 84, 92, 100];
const additions = active.map((value, index) => value - (active[index - 1] ?? 0));
const monthlyRevenue = active;
const onboardingRevenue = additions.map((value) => value * 0.5);
const totalRevenueByMonth = active.map((value, index) => value + onboardingRevenue[index]);
const facilityMonths = active.reduce((sum, value) => sum + value, 0);
const monthlyRevenueTotal = monthlyRevenue.reduce((sum, value) => sum + value, 0);
const onboardingRevenueTotal = onboardingRevenue.reduce((sum, value) => sum + value, 0);
const revenueTotal = totalRevenueByMonth.reduce((sum, value) => sum + value, 0);
const variableCost = facilityMonths * 3850 / 10000;
const onboardingCost = active.at(-1) * 2000 / 10000;
const fixedCost = 360;
const profit = revenueTotal - variableCost - onboardingCost - fixedCost;
if (facilityMonths !== 631 || monthlyRevenueTotal !== 631 || onboardingRevenueTotal !== 50 || revenueTotal !== 681 || Math.abs(profit - 58.065) > 0.0001) {
  throw new Error('Financial plan mismatch');
}

// 1. Cover
let script = 'PAWLANDは、ワンちゃん同士の相性を見える化し、グループ分けを支えるシステムです。飼い主が安心して預けられ、ワンちゃんが過ごしやすく、スタッフが判断しやすい時間をつくります。';
let slide = makeSlide('', 1, 15, script, '正式名称とteamHHHはユーザー指定。背景はPAWLANDの目指す体験を表す生成イメージ。', true);
addText(slide, 'PAWLAND', 64, 64, 470, 78, 56, colors.white, true);
addText(slide, 'ワンちゃんが過ごしやすい空間へ', 64, 150, 530, 70, 33, colors.mint, true);
addText(slide, '相性を見える化し、\nグループ分けを支える', 64, 280, 485, 115, 36, colors.white, true);
slide.images.add({ blob: await imageBlob('happy-dogs-cover.png'), contentType: 'image/png', alt: '複数の犬が穏やかに過ごすPAWLANDのコンセプトイメージ', fit: 'contain', position: { left: 610, top: 72, width: 606, height: 535 } });
addText(slide, 'teamHHH', 64, 600, 260, 36, 23, colors.white, true);

// 2. Use-case story
script = '飼い主は、大切な家族を安心して預けたい。一方、現場では、初めて会う子どうしの相性を考え、限られた時間で組み合わせを決めます。PAWLANDは、この二つの不安の間に入り、相性を見える化してグループ分けを支えます。';
slide = makeSlide('預ける不安と、組み合わせる難しさ', 2, 30, script, 'ストーリー説明用の生成イラスト。実在の人物・施設を示すものではない。');
slide.images.add({ blob: await imageBlob('owner-male-sitter-story.png'), contentType: 'image/png', alt: '不安を抱える飼い主と組み合わせを考える男性スタッフのイラスト', fit: 'contain', position: { left: 64, top: 145, width: 790, height: 440 } });
addText(slide, '飼い主', 900, 158, 180, 34, 22, colors.green, true);
addText(slide, '「大切な家族を、\n安心して預けたい」', 900, 201, 304, 82, 25, colors.ink, true);
addText(slide, '施設スタッフ', 900, 326, 210, 34, 22, colors.green, true);
addText(slide, '「初めての子の相性は？\n組み合わせを考えるのに\n時間がかかる」', 900, 370, 310, 120, 23, colors.ink, true);
addText(slide, '相性を見える化し、施設のグループ分けへ', 130, 606, 1020, 43, 27, colors.orange, true, 'center');

// 3. Usage flow
script = '利用は六つのステップです。施設が招待を発行し、飼い主が基本情報と任意の画像・動画を登録します。AIが特徴を整理し、スタッフがプロフィールを確認します。次に相性カルテとペット相関図を確認し、当日預かる犬と定員を設定します。最後にグループ案を確認して確定し、理由を含む操作履歴を残します。';
slide = makeSlide('誰が、いつ、何をするか', 3, 35, script, '画面はPAWLAND実システム。画像・動画は任意の補助資料。確定・却下では理由を必須入力し、履歴を保存する。公開デモでは保存しない。');
slide.shapes.add({ geometry: 'rightArrow', position: { left: 72, top: 310, width: 1136, height: 34 }, fill: colors.light, line: { fill: 'none', width: 0 } });
const stepXs = [64, 254, 444, 634, 824, 1014];
const stepActors = ['施設', '飼い主', 'AI・スタッフ', 'スタッフ', 'スタッフ', 'スタッフ'];
const stepTimes = ['来店前', '来店前', '登録後', '来店時', '来店時', '預かり前'];
const stepBodies = [
  '招待を発行',
  '基本情報と\n画像・動画を登録',
  'AIが特徴を整理\nプロフィール確認',
  '相性カルテ\nペット相関図',
  '当日の犬と\n定員を設定',
  'グループ案を確認\n確定・履歴保存',
];
for (let i = 0; i < 6; i++) {
  addText(slide, String(i + 1), stepXs[i], 140, 40, 36, 25, colors.orange, true, 'center');
  addText(slide, stepActors[i], stepXs[i] + 38, 140, 140, 36, 19, colors.green, true, 'center');
  addText(slide, stepBodies[i], stepXs[i], 187, 178, 92, 18, colors.ink, true, 'center');
  addText(slide, stepTimes[i], stepXs[i], 278, 178, 27, 17, colors.gray, false, 'center');
}
const flowImageXs = [64, 444, 824];
const flowImageNames = ['invite-guide-detail.png', 'compatibility-detail.png', 'daily-operations-detail.png'];
const flowImageLabels = ['STEP 1–2', 'STEP 3–4', 'STEP 5–6'];
for (let i = 0; i < 3; i++) {
  addText(slide, flowImageLabels[i], flowImageXs[i], 350, 330, 27, 17, colors.green, true, 'center');
  slide.images.add({ blob: await imageBlob(flowImageNames[i]), contentType: 'image/png', alt: `${flowImageLabels[i]}のPAWLAND画面`, fit: 'contain', position: { left: flowImageXs[i], top: 382, width: 330, height: 235 } });
}

// 4. AI and safety design
script = 'AIとルール計算の役割を分けています。OrcaRouter経由のAIはプロフィールから特徴を抽出し、ブラウザ側のTypeScriptが全ペアを評価してグループ案をつくります。安全面では、登録済みの禁忌を同じグループから外し、部屋の定員も守ります。AIの必須項目が欠ける、または値が範囲外なら解析エラーにします。禁忌や定員を満たせない場合は提案を停止します。スタッフのログイン認証、施設ごとの閲覧制限、通信の暗号化とAPIキーの保護を行います。最後の確定はスタッフが行います。';
slide = makeSlide('AIの判断と、人が守る安全設計', 4, 45, script, `${source.criteria}\n${source.repo}\n${source.comparison}\nWorker APIへの独自トークン認証は現時点で未実装。Firebase認証・RulesとWorkerのAPIキー管理を、未実装のAPI認証と混同しない。`);
addText(slide, '処理', 64, 145, 120, 34, 22, colors.green, true);
addText(slide, 'OrcaRouter AI\n特徴を抽出', 64, 190, 245, 74, 26, colors.ink, true, 'center');
addText(slide, 'TypeScript計算\n全ペア評価\nグループ案を作成', 355, 184, 300, 88, 23, colors.ink, true, 'center');
addText(slide, 'スタッフが確認し、\n最終確定', 701, 190, 255, 74, 26, colors.orange, true, 'center');
addText(slide, '→', 307, 198, 48, 52, 30, colors.green, true, 'center');
addText(slide, '→', 655, 198, 48, 52, 30, colors.green, true, 'center');
addText(slide, '安全ルール', 64, 315, 210, 34, 22, colors.green, true);
addText(slide, '禁忌事項（オプトアウト設定）\n同じ群から除外し、部屋定員を適用', 64, 358, 520, 78, 23, colors.ink, true);
addText(slide, '異常時', 64, 470, 150, 34, 22, colors.green, true);
addText(slide, '必須項目欠落・範囲外は解析エラー\n禁忌や定員を満たせない場合は提案を停止', 64, 512, 520, 79, 23, colors.ink, true);
addText(slide, 'セキュリティ', 650, 315, 200, 34, 22, colors.green, true);
addText(slide, 'スタッフのログイン認証\n施設ごとにデータの閲覧を制限\n通信の暗号化とAPIキーの保護', 650, 358, 510, 105, 23, colors.ink, true);
addText(slide, '独創性', 650, 500, 160, 34, 22, colors.green, true);
addText(slide, 'ペット同士', 650, 536, 510, 55, 39, colors.orange, true);
addText(slide, 'の相性を、グループ分けへ', 650, 590, 510, 42, 26, colors.ink, true);

// 5. Pricing and market
script = '料金は、家族を安心して預けるための判断支援を中心に考えました。安心につながる判断を、今より短い時間で行えることを目指します。案は税別で初期五千円、月額一万円です。現場の時間価値も支えになります。一日三十分、月二十六日、時給千八百円と置くと、月二万三千四百円です。背景には約一・九五兆円のペット市場があり、保険契約者調査では犬一頭の年間支出が約四十一万円です。保管登録の二割、六千五百施設を対象と置くと、月額だけで七・八億円の市場仮説になります。';
slide = makeSlide('安心を支える料金案', 5, 35, script, `${source.yano}\n${source.env}\n${source.anicom}\n価格、対象施設比率、時間価値は計画上の仮定。料金は税別。保管登録にはホテル以外を含む。`);
addText(slide, '料金案', 64, 145, 170, 34, 23, colors.green, true);
addText(slide, '初期 5,000円', 64, 200, 460, 72, 48, colors.orange, true);
addText(slide, '月額 10,000円', 64, 295, 460, 72, 48, colors.orange, true);
addText(slide, '安心につながる判断を、\n今より短い時間で', 64, 390, 500, 75, 27, colors.ink, true);
addText(slide, '時間価値の仮定', 64, 475, 220, 31, 20, colors.green, true);
addText(slide, '30分/日 × 26日 × 時給1,800円\n＝ 月23,400円', 64, 510, 500, 72, 24, colors.ink, true);
addText(slide, '市場の背景', 650, 145, 190, 34, 23, colors.green, true);
addText(slide, '約1.95兆円', 650, 195, 520, 78, 52, colors.green, true);
addText(slide, '国内ペット関連総市場 2025年度見込み', 650, 270, 520, 31, 19, colors.gray);
addText(slide, '犬の年間支出 約41万円', 650, 335, 520, 52, 32, colors.ink, true);
addText(slide, '保険契約者5,494名の調査', 650, 386, 520, 28, 18, colors.gray);
addText(slide, '対象市場の仮説　7.8億円', 650, 465, 520, 50, 31, colors.green, true);
addText(slide, '保管登録32,576件（ホテル以外を含む）の20%\n6,500施設 × 月1万円 × 12か月', 650, 520, 520, 72, 21, colors.ink);
addText(slide, '料金・市場対象・時間価値は計画上の仮定／税別', 64, 625, 1100, 28, 17, colors.gray);

// 6. Business plan
script = 'ビジネスプランは、初期五千円、月額一万円で、発売月から有料導入を始め、十二か月後に百施設を目指します。月ごとの施設数を積み上げると六百三十一施設月です。月額売上六百三十一万円と初期費用五十万円で、初年度売上は六百八十一万円。変動費、導入対応原価、固定費を引いた営業利益は約五十八万円です。料金、販売数、費用は計画上の仮定です。';
slide = makeSlide('ビジネスプラン', 6, 35, script, '販売計画・試算。月初契約、当月満額、解約0、値引き・返金なし。初期費用を3万円から5,000円へ変更したため、旧80施設計画から100施設計画へ改定。旧80施設ペースの感度は補足10に表示。');
addText(slide, '初年度売上', 64, 150, 320, 35, 22, colors.gray);
addText(slide, '681万円', 64, 190, 320, 75, 52, colors.green, true);
addText(slide, '初年度営業利益', 465, 150, 350, 35, 22, colors.gray);
addText(slide, '約58万円', 465, 190, 350, 75, 52, colors.orange, true);
addText(slide, '年末施設数', 900, 150, 280, 35, 22, colors.gray);
addText(slide, '100施設', 900, 190, 280, 75, 52, colors.green, true);
addText(slide, '販売計画・試算', 64, 315, 220, 35, 22, colors.green, true);
addText(slide, '発売月から有料導入を開始\n5施設から、12か月後に100施設\n年間631施設月', 64, 360, 500, 130, 29, colors.ink, true);
addText(slide, '売上の組み立て', 650, 315, 230, 35, 22, colors.green, true);
addText(slide, '月額売上　631万円\n初期費用　50万円\n合計　　　681万円', 650, 360, 470, 130, 29, colors.ink, true);
addText(slide, '100施設は対象仮説6,500施設の約1.5%', 650, 525, 470, 36, 21, colors.gray);
addText(slide, '料金・販売数・費用は計画上の仮定', 64, 625, 1100, 28, 18, colors.gray);

// 7. Future concept
script = '将来は、犬の保育園や多店舗へ展開し、猫などほかのペットにも広げます。離れた場所に住むペット同士が、相性のよい交流相手を見つけられる体験も考えます。さらに、同意を得たペットカメラの観察データから、性格と相性をより深く分析できるようにします。';
slide = makeSlide('家族が心地よく暮らす、もっと多くの場面へ', 7, 20, script, '将来構想。現時点の提供機能や販売実績を示すものではない。ペットカメラの観察データ利用は、飼い主・施設の同意、プライバシー設計、実施設での検証を前提とする。交流の主役はペット同士で、繁殖相手を意味しない。');
addText(slide, '将来構想', 64, 135, 190, 38, 22, colors.green, true);
addText(slide, '01', 64, 205, 58, 40, 24, colors.orange, true);
addText(slide, '犬の保育園・多店舗', 132, 202, 430, 46, 29, colors.ink, true);
addText(slide, '複数拠点でも、その子に合う\n過ごし方を共有', 132, 250, 430, 66, 21, colors.gray);
addText(slide, '02', 660, 205, 58, 40, 24, colors.orange, true);
addText(slide, '猫など、ほかのペット種', 728, 202, 465, 46, 29, colors.ink, true);
addText(slide, '性格や習性の違いに合わせて評価を拡張', 728, 250, 465, 66, 21, colors.gray);
addRect(slide, 64, 342, 1152, 2, '#D5DED5');
addText(slide, '03', 64, 385, 58, 40, 24, colors.orange, true);
addText(slide, '離れた場所のペット同士の交流', 132, 382, 430, 46, 29, colors.ink, true);
addText(slide, '相性のよい遊び・社会化の相手を見つける', 132, 430, 430, 66, 21, colors.gray);
addText(slide, '04', 660, 385, 58, 40, 24, colors.orange, true);
addText(slide, 'ペットカメラで高度な分析', 728, 382, 465, 46, 29, colors.ink, true);
addText(slide, '観察データを用いて性格・相性分析を深める', 728, 430, 465, 66, 21, colors.gray);
addText(slide, '日々の様子を反映し、その子に合う「心地よい時間」を増やす', 64, 570, 1152, 38, 25, colors.green, true, 'center');

// 8. Closing
script = 'PAWLAND。teamHHHです。ありがとうございました。';
slide = makeSlide('', 8, 5, script, 'プロジェクト名、チーム名はユーザー指定。', true);
addText(slide, 'PAWLAND', 240, 235, 800, 105, 66, colors.white, true, 'center');
addText(slide, 'teamHHH', 240, 365, 800, 55, 30, colors.mint, true, 'center');

// 9. Appendix: monthly plan
script = '月別の販売計画です。金額単位は万円です。初期費用五千円は一施設あたり〇・五万円として計算しています。';
slide = makeSlide('12か月の販売計画', 9, 0, script, '販売計画・試算。発売月から販売、月初契約、当月満額、解約0。金額単位は万円・税別。');
addText(slide, '金額：万円・税別／施設数：施設', 805, 113, 411, 30, 18, colors.gray);
addTable(slide, [
  ['月', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
  ['有料施設', ...active.map(String)],
  ['新規', ...additions.map(String)],
  ['月額売上', ...monthlyRevenue.map(String)],
  ['初期費用', ...onboardingRevenue.map(String)],
  ['売上合計', ...totalRevenueByMonth.map(String)],
], 48, 150, 1184, 308, [154, ...Array(12).fill(85.8)], 18);
addText(slide, '631施設月', 64, 500, 280, 48, 30, colors.green, true);
addText(slide, '月額売上 631万円', 365, 500, 370, 48, 30, colors.green, true);
addText(slide, '初期費用 50万円', 780, 500, 360, 48, 30, colors.green, true);
addText(slide, '合計 681万円', 64, 565, 400, 60, 40, colors.orange, true);
addText(slide, '前提：発売月から販売／月初契約／当月満額／解約0\n年末100施設は対象仮説6,500施設の約1.5%', 590, 565, 626, 65, 21, colors.gray);

// 10. Appendix: costs and profit
script = '一施設一か月の変動費は三千八百五十円。初期対応原価はセルフ設定と支援一時間を前提に二千円です。六百三十一施設月と百施設の導入に、固定費三百六十万円を加えると、初年度営業利益は五十八万六百五十円です。旧八十施設の販売ペースでは七十四万六千二百五十円の赤字になる感度も示しています。';
slide = makeSlide('原価と初年度収支', 10, 0, script, '全数値は事業計画上の仮定。固定費360万円＝開発運営240万円＋営業120万円。旧80施設感度は425施設月、初期費用5,000円、導入対応原価2,000円で再計算。');
addTable(slide, [['1施設・月の変動費', '円'], ['AI 200件×5円', '1,000'], ['インフラ', '500'], ['サポート', '2,000'], ['決済', '350'], ['合計', '3,850']], 64, 160, 500, 300, [350, 150], 21);
addTable(slide, [['初年度収支', '万円'], ['売上', '681.000'], ['月次変動費', '242.935'], ['導入対応原価', '20.000'], ['固定費', '360.000'], ['営業利益', '58.065']], 625, 160, 591, 300, [410, 181], 21);
addText(slide, '初期対応原価：2,000円／施設', 64, 490, 500, 34, 23, colors.green, true);
addText(slide, 'セルフ設定＋支援1時間を想定', 64, 529, 500, 31, 19, colors.gray);
addText(slide, '旧80施設ペースの感度', 625, 490, 310, 34, 22, colors.green, true);
addText(slide, '売上465万円　営業利益 −74.625万円', 625, 531, 590, 41, 24, colors.orange, true);
addText(slide, '料金・販売数・費用は計画上の仮定', 64, 625, 1100, 28, 18, colors.gray);

// 11. Appendix: editable architecture diagram
script = '技術構成です。Firebase Hostingで配信するブラウザ画面はReact、TypeScript、Viteです。解析時だけWorkerへ送り、WorkerがCORSを確認してAPIキーを使いOrcaRouterを呼びます。OrcaRouterの構造化JSONはWorkerを経由してブラウザへ戻り、ブラウザ側のTypeScriptがマッチングを計算します。保存はFirebase認証と施設単位のRulesを通じてFirestoreへ行います。WorkerからFirestoreへは接続しません。オーナー入力は招待ハッシュを照合します。';
slide = makeSlide('技術構成', 11, 0, script, source.repo+'\nWorker API独自トークン認証は未実装。図中の矢印は実装上のデータ経路を示す。');
const browser = addRect(slide, 64, 175, 270, 110, colors.light, colors.green, true);
addText(slide, 'ブラウザ\nFirebase Hosting\nReact / TypeScript / Vite', 78, 184, 242, 90, 20, colors.ink, true, 'center');
const worker = addRect(slide, 505, 175, 270, 110, '#F2E7DF', colors.orange, true);
addText(slide, 'Worker\n/api/analyze・CORS\nAPIキーを管理', 519, 184, 242, 90, 20, colors.ink, true, 'center');
const router = addRect(slide, 946, 175, 270, 110, colors.light, colors.green, true);
addText(slide, 'OrcaRouter\n特徴抽出', 960, 184, 242, 90, 23, colors.ink, true, 'center');
slide.shapes.add({ geometry: 'rightArrow', position: { left: 350, top: 185, width: 140, height: 32 }, fill: colors.green, line: { fill: 'none', width: 0 } });
slide.shapes.add({ geometry: 'leftArrow', position: { left: 350, top: 243, width: 140, height: 32 }, fill: colors.orange, line: { fill: 'none', width: 0 } });
addText(slide, '解析依頼', 350, 154, 140, 29, 17, colors.green, true, 'center');
addText(slide, '構造化JSON', 350, 276, 140, 27, 17, colors.orange, true, 'center');
slide.shapes.add({ geometry: 'rightArrow', position: { left: 791, top: 185, width: 140, height: 32 }, fill: colors.green, line: { fill: 'none', width: 0 } });
slide.shapes.add({ geometry: 'leftArrow', position: { left: 791, top: 243, width: 140, height: 32 }, fill: colors.orange, line: { fill: 'none', width: 0 } });
addText(slide, 'APIリクエスト', 785, 154, 152, 29, 17, colors.green, true, 'center');
addText(slide, '構造化JSON', 791, 276, 140, 27, 17, colors.orange, true, 'center');
addText(slide, 'マッチング計算はブラウザ側TypeScript', 64, 325, 515, 35, 22, colors.green, true);
const staff = addRect(slide, 70, 420, 230, 92, colors.light, colors.green, true);
addText(slide, 'スタッフ\nFirebase Auth', 84, 431, 202, 68, 23, colors.ink, true, 'center');
const rules = addRect(slide, 382, 420, 220, 92, '#F2E7DF', colors.orange, true);
addText(slide, 'Firestore Rules\n施設単位で許可', 396, 431, 192, 68, 22, colors.ink, true, 'center');
const firestore = addRect(slide, 684, 420, 220, 92, colors.light, colors.green, true);
addText(slide, 'Firestore\n施設別データ', 700, 431, 188, 68, 23, colors.ink, true, 'center');
presentation.slides.items[10].shapes.connect(staff, rules, { kind: 'straight', fromSide: 'right', toSide: 'left', line: { style: 'solid', fill: colors.green, width: 2 }, tail: { type: 'arrow', width: 'med', length: 'med' } });
presentation.slides.items[10].shapes.connect(rules, firestore, { kind: 'straight', fromSide: 'right', toSide: 'left', line: { style: 'solid', fill: colors.green, width: 2 }, tail: { type: 'arrow', width: 'med', length: 'med' } });
addText(slide, '飼い主入力：招待ハッシュを照合', 70, 550, 515, 38, 22, colors.ink, true);
addText(slide, 'WorkerからFirestoreへの経路はない', 684, 550, 520, 38, 22, colors.orange, true);

// 12. Appendix: safety and AI evidence
script = '安全設計とAI利用の根拠を一覧にしています。AIは特徴抽出に限定し、出力を検査してから計算へ渡します。必須項目の欠落や範囲外は解析エラーにします。登録された禁忌と部屋の定員を計算で適用し、条件を満たせない場合は提案を停止します。データは施設単位のRulesで分けます。Worker API独自トークン認証は現在の未実装項目です。';
slide = makeSlide('安全設計とAI利用の根拠', 12, 0, script, `${source.repo}\n${source.criteria}`);
addTable(slide, [
  ['確認点', '実装・設計', '判断の境界'],
  ['AIの役割', 'OrcaRouterで特徴抽出\n必須項目と範囲を検査', '欠落・範囲外は解析エラー\n評価と提案はブラウザで計算'],
  ['禁忌と定員', '登録禁忌を同じ群から除外\n部屋定員を制約として適用', '条件を満たせない場合は\n提案を停止'],
  ['データ保護', 'Firebaseログイン\n施設単位のFirestore Rules', 'HTTPS通信\nWorkerでAPIキーを管理'],
  ['招待入力', '招待ハッシュを照合\n施設に紐づけて保存', '自由な施設ID指定を\n受け付けない'],
  ['現在の課題', 'Worker API独自トークン認証', '現時点では未実装'],
], 64, 155, 1152, 408, [230, 475, 447], 20);
addText(slide, 'AI出力を検査し、禁忌と定員を確認。最終確定はスタッフ。', 64, 595, 1152, 42, 25, colors.orange, true, 'center');

// 13. Appendix: compatibility scoring
script = '相性評価は、AIが整理した七つの性格軸と、体格などの登録情報を使います。活動量、体格差、遊び方、社交性、感情バランス、資源防衛の六因子をソフトスコアとして組み合わせます。一方、登録された禁忌は点数とは分け、片方でも相手を指定していれば最適化から除外します。AIが禁忌相手を決める仕組みではありません。';
slide = makeSlide('相性評価のしくみ', 13, 0, script, `${source.repo}\n医療診断や性格の断定を目的としない。根拠が不足する場合はconfidenceを下げ、riskFlagsを付ける。hardBlockedPetIdsの片側指定でもEXPLICIT_BLOCKとなり、点数とは別に最適化対象から除外する。`);
addText(slide, 'AIが整理する7軸', 64, 140, 400, 36, 23, colors.green, true);
addTable(slide, [
  ['性格軸', 'プロフィールで見る観点'],
  ['外向性', '活動への向かいやすさ'],
  ['社交性', 'ほかのペットとの関わり'],
  ['神経質性', '不安や刺激への反応'],
  ['訓練性', '指示への反応'],
  ['資源防衛', '物や場所を守る傾向'],
  ['自己主張', '相手への働きかけ'],
  ['回復力', '落ち着きを取り戻す力'],
], 64, 185, 540, 375, [185, 355], 17);
addText(slide, '相性スコアの6因子', 660, 140, 500, 36, 23, colors.green, true);
addText(slide, '活動量　／　体格差\n遊び方　／　社交性\n感情バランス（不安 × 自己主張）\n資源防衛', 660, 190, 540, 176, 25, colors.ink, true);
addRect(slide, 660, 388, 540, 82, colors.light, 'none', true);
addText(slide, 'ソフト評価', 680, 400, 150, 28, 20, colors.green, true);
addText(slide, '6因子を点数として組み合わせる', 680, 430, 490, 28, 22, colors.ink, true);
addRect(slide, 660, 488, 540, 82, '#F2E7DF', 'none', true);
addText(slide, 'ハード除外', 680, 500, 150, 28, 20, colors.orange, true);
addText(slide, '登録済みの禁忌は点数と分けて除外', 680, 530, 490, 28, 22, colors.ink, true);
addText(slide, 'AIが禁忌相手を決めるものではない', 660, 600, 540, 30, 20, colors.gray, true, 'center');

// 14. Appendix: image and video handling
script = '画像と動画は任意の補助資料です。ブラウザで写真一枚と動画の二地点を静止画にし、最大三画像をWorker経由でAIへ送ります。元動画と音声はAIへ送りません。媒体本体は永続保存せず、Firestoreにはファイル名、形式、サイズ、処理状態のメタデータだけを保存します。';
slide = makeSlide('画像・動画の扱い', 14, 0, script, `${source.repo}\n任意入力。JPG・PNG・WebPは各5MB以下、MP4・WebM・MOVは20MB以下、合計20MB以下。動画の25%地点と75%地点からブラウザで最大2静止画を抽出し、写真1枚と合わせ最大3画像を送信する。元動画と音声は送信しない。`);
const mediaNodes = [
  ['任意入力', '写真・動画'],
  ['ブラウザ', '写真 最大1枚\n動画を静止画化\n最大2枚'],
  ['Worker', '最大3画像を中継'],
  ['OrcaRouter AI', '特徴を抽出'],
  ['プロフィール', '構造化した特徴'],
];
const mediaXs = [52, 294, 536, 778, 1020];
for (let i = 0; i < mediaNodes.length; i++) {
  addRect(slide, mediaXs[i], 190, 188, 126, i === 3 ? '#F2E7DF' : colors.light, i === 3 ? colors.orange : colors.green, true);
  addText(slide, mediaNodes[i][0], mediaXs[i] + 10, 202, 168, 32, 19, i === 3 ? colors.orange : colors.green, true, 'center');
  addText(slide, mediaNodes[i][1], mediaXs[i] + 10, 234, 168, 78, 18, colors.ink, true, 'center');
  if (i < mediaNodes.length - 1) addText(slide, '→', mediaXs[i] + 190, 226, 50, 52, 30, colors.green, true, 'center');
}
addText(slide, '送信境界', 64, 378, 180, 34, 22, colors.green, true);
addRect(slide, 64, 420, 552, 125, '#F2E7DF', 'none', true);
addText(slide, 'AIへ送らない', 84, 433, 180, 30, 20, colors.orange, true);
addText(slide, '元動画 ／ 音声', 84, 475, 490, 42, 27, colors.ink, true);
addRect(slide, 664, 420, 552, 125, colors.light, 'none', true);
addText(slide, 'Firestoreに保存', 684, 433, 220, 30, 20, colors.green, true);
addText(slide, 'ファイル名・形式・サイズ・処理状態', 684, 475, 490, 42, 23, colors.ink, true);
addText(slide, '本システムでは媒体本体を永続保存しない', 64, 582, 1152, 38, 23, colors.orange, true, 'center');

// 15. Appendix: validation status
script = '実装済みの範囲と、導入時に確かめる範囲を分けています。招待、任意メディアの前処理、AI出力検査、相性計算、禁忌と定員の適用、提案の確定・却下履歴は実装済みです。実施設での効果は未実証で、提案修正率、観察後の再計算、継続利用、運用時間、スタッフの納得度を確認します。';
slide = makeSlide('検証状況と導入時の確認項目', 15, 0, script, `${source.repo}\n公開デモでは確定・却下履歴を保存しない。過去の試験件数はこの版では再検証していないため掲載しない。実施設での効果や大規模性能は未実証。`);
addTable(slide, [
  ['区分', '現在の状態', '導入時に確認すること'],
  ['実装済み', '招待ハッシュ照合\n任意メディアの前処理\nAI出力の必須項目・範囲検査', '登録からプロフィール確認まで\n施設の権限分離'],
  ['実装済み', '6因子の相性計算\n登録禁忌と定員の適用\nグループ提案', '条件違反がないこと\nスタッフが理解できる根拠'],
  ['実装済み', '確定・却下は理由必須\n操作履歴を保存', '判断履歴の追跡性\n公開デモは保存しない'],
  ['未実証', '実施設での業務効果\n観察後の再計算・継続運用', '提案修正率／継続利用\n運用時間／スタッフ納得度'],
], 64, 155, 1152, 410, [170, 475, 507], 19);
addText(slide, '医療診断や性格の断定ではなく、スタッフの判断を支える', 64, 595, 1152, 42, 25, colors.orange, true, 'center');

// Export draft, validate an immutable file, render all slides, and copy validated bytes to the requested filename.
const candidatePath = path.join(tmp, 'candidate.pptx');
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
for (let i = 0; i < presentation.slides.items.length; i++) {
  const preview = await presentation.export({ slide: presentation.slides.items[i], format: 'png', scale: 1.5 });
  await fs.writeFile(path.join(tmp, `draft-${i + 1}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const finalPath = path.join(out, 'PAWLAND_発表資料_機能紹介改訂版.pptx');
const buildId = new Date().toISOString().replace(/[-:.TZ]/g, '');
const validatedPath = path.join(out, `PAWLAND_発表資料_機能紹介改訂版_検証_${buildId}.pptx`);
const receiptPath = path.join(tmp, `PAWLAND_発表資料_機能紹介改訂版_検証_${buildId}.pptx.validation.json`);
const result = await finalizePresentation({
  workspaceDir: path.resolve(root, '../..'),
  candidatePath,
  finalPath: validatedPath,
  pythonExecutable: python,
  integrityValidatorPath: path.join(skill, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skill, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit', '--require-native-table-slide', '9', '--require-native-table-slide', '10', '--require-native-table-slide', '12', '--require-native-table-slide', '13', '--require-native-table-slide', '15'],
  explicitTotalSlideCount: 15,
  requiredNativeTableOwnerSlides: [9, 10, 12, 13, 15],
  requiredNativeChartOwnerSlides: [],
  tableArithmeticContracts: [
    { slide: 9, table: 1, label_column: 0, total_row: 5, value_columns: Array.from({ length: 12 }, (_, index) => index + 1), component_rows: [3, 4] },
  ],
  fontPolicy: { basis: 'design', families: [font] },
  verifyArtifactToolImport: true,
  receiptPath,
});

const checked = await PresentationFile.importPptx(await FileBlob.load(validatedPath));
for (let i = 0; i < checked.slides.items.length; i++) {
  const rendered = await checked.export({ slide: checked.slides.items[i], format: 'png', scale: 1.5 });
  await fs.writeFile(path.join(tmp, `final-${i + 1}.png`), new Uint8Array(await rendered.arrayBuffer()));
}
await fs.copyFile(validatedPath, finalPath);

let elapsed = 0;
const mainNotes = notes.filter((item) => item.number <= 8).map((item) => {
  const begin = elapsed;
  elapsed += item.seconds;
  return `## ${item.number}. ${item.title || 'PAWLAND'}（${begin}〜${elapsed}秒）\n\n${item.script}`;
}).join('\n\n');
const appendixNotes = notes.filter((item) => item.number > 8).map((item) => `## ${item.number}. ${item.title}（補足）\n\n${item.script}`).join('\n\n');
const notesText = `# PAWLAND 発表原稿・機能紹介改訂版\n\n本編8枚、発表目安3分40秒（220秒）。9〜15枚目は補足。\n\n${mainNotes}\n\n${appendixNotes}\n\n## 数値前提\n\n- 有料施設数：${active.join('、')}\n- 施設月：${facilityMonths}\n- 月額売上：${monthlyRevenueTotal}万円\n- 初期費用：${onboardingRevenueTotal}万円\n- 初年度売上：${revenueTotal}万円\n- 月次変動費：${variableCost.toFixed(3)}万円\n- 導入対応原価：${onboardingCost.toFixed(3)}万円\n- 固定費：${fixedCost.toFixed(3)}万円\n- 初年度営業利益：${profit.toFixed(3)}万円\n- 旧80施設ペース感度：売上465万円、営業利益−74.625万円\n\n初期費用を3万円から5,000円へ変更したため、販売計画を旧80施設から100施設へ改定。料金、販売数、費用は計画上の仮定。\n\n## 出典・注記\n\n${Object.values(source).join('\n\n')}\n\n公開デモ画面はサンプルデータを表示。スライド1・2は説明用の生成イメージ。\n`;
await fs.writeFile(path.join(root, 'docs/presentation/speaker-notes-final.md'), notesText);
await fs.writeFile(path.join(out, 'PAWLAND_発表原稿_機能紹介改訂版.md'), notesText);
console.log(JSON.stringify({ slides: checked.slides.items.length, elapsed, facilityMonths, revenueTotal, profit, finalPath, validatedPath, receiptPath: result.receiptPath ?? receiptPath }, null, 2));
