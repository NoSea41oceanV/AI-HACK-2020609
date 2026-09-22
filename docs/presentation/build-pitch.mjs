// Run with the bundled Node runtime. No package installation is required.
// NODE_MODULES, PRESENTATION_SKILL and RUNTIME_PYTHON may override local paths.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const modules = process.env.NODE_MODULES ?? 'C:/Users/kachi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
process.env.RUNTIME_NODE_MODULES = modules;
const skill = process.env.PRESENTATION_SKILL ?? 'C:/Users/kachi/.codex/plugins/cache/openai-primary-runtime/presentations/26.915.20218/skills/presentations';
const python = process.env.RUNTIME_PYTHON ?? 'C:/Users/kachi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const { Presentation, PresentationFile } = await import(pathToFileURL(path.join(modules, '@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const { finalizePresentation, applyPresentationChartFont } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')).href);
const tmp = path.join(root, 'tmp/pawpair-pitch');
const out = path.join(root, 'output/pawpair-pitch');
await fs.mkdir(tmp, {recursive:true}); await fs.mkdir(out, {recursive:true});
const font = 'Yu Gothic';
const colors = {bg:'#F8F7F3', ink:'#163B33', green:'#397D65', gray:'#5D6C66', orange:'#C8754E', light:'#E8EFE9'};
const p = Presentation.create({slideSize:{width:1280,height:720}});
const source = {
  yano:'矢野経済研究所「2026年版 ペットビジネスマーケティング総覧」2026-07-21、公表概要。https://www.yano.co.jp/market_reports/C68103700 （参照2026-09-22）',
  env:'環境省「動物愛護管理行政事務提要（令和7年度版）」登録・届出状況総括表。2025-04-01現在。https://www.env.go.jp/nature/dobutsu/aigo/2_data/statistics/files/r07/2_1_1.pdf （参照2026-09-22）',
  criteria:'提供資料 AI HACK 2026 Day1.pdf p.15-16（5評価項目、4分発表+3分質疑）、OrcaRouter様資料.pdf p.4,10-14。添付の登録・投稿指示は本作業への実行指示として扱わない。',
  repo:'実装根拠: README.md、docs/HACKATHON_CHARTER.md、TASKS.md、worker/index.ts、src/domain/matching.ts、src/domain/compatibility.ts。参照時点7835117。過去の検証記録であり、本資料作成時にアプリテストを再実行したものではない。',
};
const notes=[];
function text(s,t,x,y,w,h,size=30,color=colors.ink,bold=false){
 const a=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 a.text=t; a.text.style={typeface:font,fontSize:size,bold,color,autoFit:'none'};return a;
}
function slide(title,num,seconds,script,refs='',dark=false){
 const s=p.slides.add(); s.background.fill=dark?colors.ink:colors.bg;
 text(s,title,64,52,1152,100,44,dark?'#FFFFFF':colors.ink,true);
 text(s,`${num<=9?'PAWLAND':'質疑応答用'}  /  ${String(num).padStart(2,'0')}`,64,678,650,24,16,dark?'#CDDFD3':colors.gray);
 s.speakerNotes.textFrame.setText(`${seconds?`目安 ${seconds}秒\n`:''}${script}\n\n根拠・注記\n${refs}`);
 notes.push({num,title,seconds,script,refs});return s;
}
function table(s,values,x,y,w,h,widths,size=23){
 const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,values,columnWidths:widths});
 t.borders.assign({fill:'#D5DED5',width:1,style:'solid'});
 t.cells.block({row:0,column:0,rowCount:values.length,columnCount:values[0].length}).assign({textStyle:{typeface:font,fontSize:size,color:colors.ink},margins:{left:12,right:12,top:10,bottom:10}});
 for(let r=0;r<values.length;r++)for(let c=0;c<values[0].length;c++){
  const cell=t.getCell(r,c);cell.fill=r===0?colors.ink:(r%2?'#FFFFFF':colors.light);
  cell.text.style={typeface:font,fontSize:size,color:r===0?'#FFFFFF':colors.ink,bold:r===0};
 }return t;
}

let s=slide('PAWLAND',1,20,'「この子たち、同じ部屋で大丈夫？」ペットホテルでは、性格も、その日の様子も違う犬たちの組み合わせを考えます。PAWLANDは、その判断を支える相性評価・部屋割り支援です。スタッフが犬と向き合う時間を増やすことを目指します。',source.repo,true);
text(s,'「この子たち、\n同じ部屋で大丈夫？」',64,205,1120,190,64,'#FFFFFF',true);
text(s,'ペットホテルの相性評価・部屋割りを支えるAI',64,455,1130,65,34,'#CDDFD3');
text(s,'AI HACK 2026  /  業務を自律化するAIエージェント',64,580,1130,40,22,'#CDDFD3');

s=slide('受付情報から、部屋割りの提案まで',2,30,'飼い主が性格や遊び方を入力すると、OrcaRouter経由のAIが特徴を整理します。全てのペアを採点し、同室禁止と定員を守って部屋割りを提案。当日の観測を反映して再計算し、最後はスタッフが確定します。架空の二頭で、実際のAIと保存先を通した一連の動作を確認しています。',`${source.repo}\n画面: docs/qa/staff-dashboard.png。6頭のサンプル画面であり、公開E2Eの実証規模（2頭）とは異なる。`);
text(s,'01  飼い主の情報を受付\n\n02  AIが犬の特徴を整理\n\n03  全ペア評価・部屋割り\n\n04  観測で再計算、人が確定',64,190,540,400,30,colors.ink,true);
s.images.add({blob:new Uint8Array(await fs.readFile(path.join(root,'docs/qa/staff-dashboard.png'))),contentType:'image/png',alt:'PAWLANDの6頭サンプル画面。全ペアと部屋割りの表示',fit:'contain',crop:{left:0,top:0,right:0,bottom:0.28},position:{left:620,top:165,width:596,height:430}});
text(s,'画面は6頭のサンプル。実サービスでの一連の動作確認は架空2頭・1ペア・1部屋。',64,619,1152,36,19,colors.gray);

s=slide('任せるために、守る境界を決める',3,30,'セキュリティでは、氏名・連絡先の専用項目と音声をAIへ送りません。動画も最大二枚の静止画にし、原本は保存しません。信頼性では、AI出力の形式を検査し、同室禁止を数値評価とは別に適用します。失敗を成功に見せません。ただし現在はハッカソン用の公開構成です。販売前に認証と施設分離を必須にします。',`${source.criteria}\n${source.repo}\n自由記述や画像への個人情報混入を完全防止するという意味ではない。専用項目の送信除外。`);
text(s,'① セキュリティ',64,190,540,55,33,colors.green,true);
text(s,'氏名・連絡先の項目をAI送信から除外\n音声・原動画を送らない\n解析用メディアを永続保存しない',64,270,548,195,27);
text(s,'③ 信頼性・堅牢性',668,190,548,55,33,colors.green,true);
text(s,'AI出力の形式と値を検査\n同室禁止・定員をルールで制約\nAI失敗時はエラーを明示',668,270,548,195,27);
text(s,'販売前の必須対応：認証・施設別データ分離・入力への個人情報混入対策',64,544,1152,90,27,colors.orange,true);

s=slide('AIは読み取りに使い、採点は計算する',4,25,'コストパフォーマンスの工夫は、AIを使う場所を絞ったことです。性格の読み取りをAIに任せ、組み合わせの採点と最適化はプログラムで行います。動画入力も最大二枚です。OrcaRouterを実際に接続していますが、費用の削減率はまだ実測していません。次は一件あたりの請求額と分析品質を同時に測ります。',`${source.criteria}\n${source.repo}\n既定モデルはgoogle/gemini-2.5-flash。Named Router、自動モデル選択、フェイルオーバーを本製品の実装済み機能として主張しない。`);
text(s,'② コストパフォーマンス',64,176,1100,54,33,colors.green,true);
text(s,'AI推論',64,284,350,66,48,colors.ink,true);
text(s,'文章・画像から\n犬の特徴を構造化',64,380,480,120,32);
text(s,'決定ロジック',654,284,550,66,48,colors.ink,true);
text(s,'全ペアの採点・安全制約・最適化\nペアごとのLLM呼び出しは不要',654,380,562,120,30);
text(s,'動画は最大2フレームに制限。AI原価・時間短縮・削減率は今後の実測項目。',64,590,1152,55,24,colors.gray);

s=slide('犬の変化を、今日の部屋割りに反映する',5,20,'自律性は、入力から特徴の整理、評価、部屋割りへと処理をつなぐ点です。当日の観測を取り込んで再提案できます。独創性は、犬の相性を単なるスコアで終わらせず、施設の部屋割りという行動案にすること。今はスタッフが操作する半自律型で、安全に関わる最終判断は人に残します。',`${source.criteria}\n${source.repo}\n自由なツール選択、常時自動監視、完全自律実行は未実装。観測入力・再計算・確定はスタッフ操作を含む。`);
text(s,'④ 自律性',64,197,1100,50,32,colors.green,true);
text(s,'情報の整理 → 全ペア評価 → 制約付きの部屋割り',64,265,1152,80,36,colors.ink,true);
text(s,'⑤ アイデア・独創性',64,395,1100,50,32,colors.green,true);
text(s,'相性を説明するだけでなく、配置案まで出す',64,464,1152,75,36,colors.ink,true);
text(s,'現在は半自律型。観測の入力・再計算・最終確定はスタッフが操作。',64,599,1152,48,24,colors.gray);

s=slide('最初の顧客は、複数頭を預かる施設',6,25,'国内のペット関連市場は約一・九五兆円。ただし、これをそのまま私たちの市場とはしません。保管業の登録は約三・三万件で、サロンも含みます。その約二割、六千五百施設が対象になると仮定すると、月額一万円で年間七・八億円の市場です。まず複数頭を預かる施設に絞って需要を確かめます。',`${source.yano}\n${source.env}\n全体市場は2025年度推計の小売・末端金額で、SaaS市場ではない。保管32,576はホテル専業数ではない。対象20%は調査未実施の仮説。32,576×20%を約6,500施設へ丸め、6,500×10,000円×12=780,000,000円。`);
text(s,'背景：国内ペット関連総市場 約1.95兆円',64,172,1152,60,32);
text(s,'32,576',64,282,530,115,80,colors.green,true);
text(s,'保管業の登録数（2025年4月）\n※ホテル以外のサロン等も含む',64,404,530,90,26);
text(s,'7.8億円 / 年',678,282,550,115,68,colors.green,true);
text(s,'対象6,500施設 × 年12万円\n保管業の約20%が適合する仮説',678,404,538,90,26);
text(s,'出典：矢野経済研究所（2026年版、2025年度推計）／環境省（令和7年度版）\n7.8億円は当方の対象施設数・提案価格による試算であり、公表市場統計ではない。',64,568,1152,78,19,colors.gray);

s=slide('月1万円で、現場の判断準備を支援する',7,25,'価格案は一施設あたり月一万円、初期導入三万円です。月二百件の分析を想定します。仮に一日三十分、月二十六日の作業を減らし、時間単価を千八百円と置くと、月二万三千四百円分の時間に相当します。まだ効果は未実証です。実証施設で、削減時間とこの価格への支払い意思を検証します。','価格・利用枠・ROIは提案仮説。税別。月額課金/利用枠制御は未実装。30分÷60×26日×1,800円=23,400円。月額回収の時間閾値は10,000÷1,800÷26×60=12.82分/日。初期導入費の回収は別途。現金支出の削減保証ではない。');
text(s,'10,000円',64,198,760,130,86,colors.green,true);
text(s,'/ 月・施設（税別・価格案）',64,332,900,58,30);
text(s,'初期導入 30,000円  /  月200件のAI分析を想定',64,423,1152,70,32,colors.ink,true);
text(s,'価値仮説：30分/日 × 26日 × 時給1,800円 ＝ 月23,400円の時間価値',64,531,1152,66,27);
text(s,'料金・利用枠は未実装。超過は追加承認制を予定。時間短縮・支払い意思は実証前。',64,621,1152,36,19,colors.gray);

const active=[0,0,3,5,8,12,17,22,28,35,42,50];
const newN=active.map((v,i)=>v-(active[i-1]??0));
const revenue=active.map((v,i)=>v+newN[i]*3);
if(active.reduce((a,b)=>a+b)!==222||revenue.reduce((a,b)=>a+b)!==372)throw Error('Revenue arithmetic');
s=slide('初年度の売上計画は372万円',8,25,'初年度は二か月の実証後、三施設から始め、年度末に五十施設へ。月ごとの契約増加を積み上げると、月額売上が二百二十二万円、導入費が百五十万円、合計三百七十二万円です。売上実績ではなく、解約ゼロの計画です。開発・営業費まで含めると約百二十三万円の赤字を見込み、まず継続利用の検証に投資します。','事業化着手から12か月の計画。稼働施設[0,0,3,5,8,12,17,22,28,35,42,50]。月初開始、当月全額、解約・値引き・返金なし。222施設月×1万円+50施設×3万円=372万円。変動費85.47万円+導入原価50万円+固定費360万円=495.47万円、損益-123.47万円。実績なし。補足11参照。');
text(s,'372万円',64,168,510,115,76,colors.green,true);
text(s,'月額売上 222万円\n初期導入 150万円',64,300,510,125,32);
text(s,'年末 50施設\n月額売上 50万円',64,457,510,100,30,colors.ink,true);
const ch=s.charts.add('bar',{position:{left:605,top:196,width:611,height:346},categories:['M3','M6','M9','M12'],series:[{name:'有料稼働施設数',values:[3,12,28,50],fill:colors.green}],barOptions:{direction:'column',grouping:'clustered',gapWidth:110},hasLegend:false,xAxis:{textStyle:{fontSize:23,fill:colors.gray}},yAxis:{min:0,max:60,majorUnit:20,numberFormatCode:'0',textStyle:{fontSize:20,fill:colors.gray},majorGridlines:{fill:'#D7DFD7',width:1}},dataLabels:{showValue:true,position:'outEnd',textStyle:{fontSize:26,fill:colors.ink,bold:true}}});
applyPresentationChartFont(ch,{fontFamily:font});text(s,'有料稼働施設数（計画）',638,550,570,40,22,colors.gray);
text(s,'仮定：M1〜2無償実証、月初契約・解約0。初年度営業損益は約 −123万円。',64,617,1152,39,21,colors.gray);

s=slide('まず3施設で、「毎日使える」を証明する',9,20,'次の一歩は三施設での実証です。本番の認証と施設分離を整え、判断にかかる時間、提案の修正率、継続利用を測ります。その後、地域のホテルへの直接提案と紹介で広げます。将来は犬の保育園や多店舗運営へ。犬の安全を人が見守りながら、判断の準備をAIに任せる。それがPAWLANDです。','将来計画。3施設の実証先は未合意。獲得仮説600施設接触→150デモ→75試用→50契約。認証・施設分離、課金、継続率計測、保育園/多店舗展開は未実装。',true);
text(s,'0〜2か月',64,188,290,62,35,'#CDDFD3',true);
text(s,'認証・施設分離を整備し、3施設で実証\n判断時間・提案修正率・AI原価を測定',390,188,826,116,32,'#FFFFFF');
text(s,'3〜12か月',64,357,290,62,35,'#CDDFD3',true);
text(s,'地域ホテルへ直接提案 → 導入先からの紹介\n継続利用を確認し、年末50施設を目指す',390,357,826,116,32,'#FFFFFF');
text(s,'その先',64,526,290,62,35,'#CDDFD3',true);
text(s,'犬の保育園・多店舗運営へ展開',390,526,826,75,32,'#FFFFFF');

s=slide('補足｜売上の月次積み上げ',10,0,'本編は9枚・合計220秒（3分40秒）を目安とする。このページ以降は質疑応答用。売上の単位は万円、金額はすべて税別。', '各月の月額売上＝有料稼働施設数×1万円。導入費＝新規施設数×3万円。契約開始を月初、解約0と仮定。MRR50万円は12か月目の月額売上、ARR600万円はその年換算であり初年度実売上ではない。');
table(s,[['期間','M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12'],['有料稼働',...active.map(String)],['新規',...newN.map(String)],['月額売上',...active.map(String)],['導入売上',...newN.map(v=>String(v*3))],['売上合計',...revenue.map(String)]],64,184,1152,355,[156,...Array(12).fill(83)],21);
text(s,'222施設月 × 1万円 ＋ 50施設 × 3万円 ＝ 372万円',64,575,1152,50,30,colors.green,true);
text(s,'金額単位：万円。期末MRR 50万円、年換算ARR 600万円。ARRは初年度売上ではない。',64,632,1152,32,18,colors.gray);

s=slide('補足｜原価と、初年度の損益',11,0,'原価は測定値ではなく事業計画の予算仮定です。無料インフラが永続的に使えることには依存しません。AI単価、解析頻度、サポート負担を実証で更新します。','月次変動費仮定: AI200件×5円=1,000円、インフラ500円、サポート1時間×2,000円=2,000円、決済350円。合計3,850円、月額10,000円との差6,150円、61.5%。導入原価1万円/施設。固定費360万円/年=開発運営240万円+営業120万円。税金、資金調達、金利は含めない。初期料金を除く定常損益分岐は3,600,000÷12÷6,150=48.78で約49施設。');
table(s,[['1施設・月あたり（予算）','円'],['AI 200件 × 5円','1,000'],['インフラ','500'],['サポート 1時間','2,000'],['決済','350'],['変動費合計','3,850']],64,180,540,345,[386,154],23);
table(s,[['初年度（万円）','計画'],['売上','372.00'],['月次変動費（222施設月）','85.47'],['導入対応原価（50施設）','50.00'],['固定費（開発運営・営業）','360.00'],['営業損益','−123.47']],650,180,566,345,[412,154],23);
text(s,'継続課金の貢献利益率 61.5%  /  定常損益分岐 約49施設',64,566,1152,65,31,colors.green,true);
text(s,'全て仮定。定常損益分岐は月固定費30万円÷6,150円、導入売上・原価は除く。',64,631,1152,35,19,colors.gray);

s=slide('補足｜売上の幅と、顧客獲得の仮説',12,0,'基本計画の獲得目標は検証前であり、既存顧客数ではありません。弱気は89施設月・期末20施設、基本222施設月・50施設、強気444施設月・100施設。同じ単価、初期料金、解約ゼロを仮定。','弱気稼働[0,0,1,2,3,5,7,9,11,14,17,20]の合計89。売上89+20×3=149万円。強気は基本の各月を2倍、444+100×3=744万円。対象市場の上限参考は32,576×12万円=39.0912億円。ただし全ての保管施設に需要があるとは限らない。対象6,500施設の仮説に対する50施設は0.77%。');
table(s,[['シナリオ','期末施設','施設月','初年度売上'],['弱気','20','89','149万円'],['基本','50','222','372万円'],['強気','100','444','744万円']],64,181,1152,240,[348,248,248,308],27);
text(s,'600施設に接触 → 150デモ → 75試用 → 50契約',64,470,1152,69,34,colors.green,true);
text(s,'販売10か月で平均60施設/月へ接触する仮説。地域ホテルへの直接提案と紹介。\n成約率・継続率・時間短縮を検証し、未達なら獲得ペースと費用計画を見直す。',64,561,1152,90,24);

s=slide('補足｜評価5項目と、提示できる証拠',13,0,'この表は自己採点ではありません。資料作成時点で確認できる実装・過去の検証記録と、今後の検証を分けています。',`${source.criteria}\n${source.repo}\n過去の検証記録はアプリ34/34、Worker15/15。実サービスE2Eは2026-09-22・架空2頭。安全性向上、事故率低下、大規模最適化性能は未実証。`);
table(s,[['評価項目','今、説明できる根拠','次に検証・整備すること'],['セキュリティ','送信項目制限・メディア非保存','認証・施設分離・個人情報混入対策'],['コストパフォーマンス','最大2フレーム・採点は決定ロジック','実請求額と分析品質の比較'],['信頼性・堅牢性','出力検査・同室禁止・失敗の明示','実施設の妥当性・多数頭の処理性能'],['自律性','分析→評価→提案、観測後の再計算','再計画トリガーと停止条件の拡張'],['アイデア・独創性','性格・当日観測を部屋割りへ反映','実務での修正率・継続利用']],64,175,1152,398,[244,432,476],23);
text(s,'過去の記録：アプリ34件・Worker15件成功。実サービスの公開E2Eは架空2頭。\n実顧客での効果・大規模性能・事故率の低減を示すものではない。',64,601,1152,62,20,colors.gray);

await (await PresentationFile.exportPptx(p)).save(path.join(tmp,'candidate.pptx'));
for(let i=0;i<p.slides.items.length;i++){
 const blob=await p.export({slide:p.slides.items[i],format:'png',scale:1.5});
 await fs.writeFile(path.join(tmp,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await blob.arrayBuffer()));
}
const finalName=process.env.PITCH_FILENAME??'PAWLAND_発表資料.pptx';
const result=await finalizePresentation({workspaceDir:root,candidatePath:path.join(tmp,'candidate.pptx'),finalPath:path.join(out,finalName),pythonExecutable:python,integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...[10,11,12,13].flatMap(n=>['--require-native-table-slide',String(n)])],explicitTotalSlideCount:13,requiredNativeTableOwnerSlides:[10,11,12,13],requiredNativeChartOwnerSlides:[8],materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(tmp,finalName+'.validation.json')});
console.log(JSON.stringify(result));
let elapsed=0;
const script='# PAWLAND 発表原稿\n\n本編9枚、目安3分40秒（220秒）。補足4枚は質疑応答用。実演操作を含めない静止画ピッチ。\n\n読み上げ速度は個人差があるため、1回リハーサルして4分以内に調整する。数値は2026年9月22日時点で調査。価格・販売・効果・費用は提案仮説。\n\n'+notes.filter(n=>n.num<=9).map(n=>{let a=elapsed;elapsed+=n.seconds;return `## ${n.num}. ${n.title}（${a}〜${elapsed}秒）\n\n${n.script}\n`;}).join('\n')+'\n## 出典と実装の範囲\n\n'+Object.values(source).map(v=>'- '+v).join('\n')+'\n\n各スライドのノートに根拠と計算前提を記載。UI画面は6頭サンプル、実サービスE2E確認は架空2頭。認証・施設分離・課金・販売計画は今後。資料中の過去のテスト結果は既存記録の引用で、本作業での再実行ではない。\n';
await fs.writeFile(path.join(root,'docs/presentation/speaker-notes.md'),script);
await fs.writeFile(path.join(out,'発表原稿.md'),script);
