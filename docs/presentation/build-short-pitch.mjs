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
const { Presentation, PresentationFile, FileBlob } = await import(pathToFileURL(path.join(modules, '@oai/artifact-tool/dist/artifact_tool.mjs')).href);
const { finalizePresentation, applyPresentationChartFont } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')).href);
const tmp = path.join(root, 'tmp/pawpair-short');
const out = path.resolve(root, '../../output/pawpair-pitch');
await fs.mkdir(tmp, {recursive:true}); await fs.mkdir(out, {recursive:true});
const font = 'Yu Gothic';
const colors = {bg:'#F8F7F3', ink:'#163B33', green:'#397D65', gray:'#5D6C66', orange:'#C8754E', light:'#E8EFE9'};
const p = Presentation.create({slideSize:{width:1280,height:720}});
const source = {
  yano:'矢野経済研究所「2026年版 ペットビジネスマーケティング総覧」2026-07-21、公表概要。https://www.yano.co.jp/market_reports/C68103700 （参照2026-09-22）',
  env:'環境省「動物愛護管理行政事務提要（令和7年度版）」登録・届出状況総括表。2025-04-01現在。https://www.env.go.jp/nature/dobutsu/aigo/2_data/statistics/files/r07/2_1_1.pdf （参照2026-09-22）',
  criteria:'提供資料 AI HACK 2026 Day1.pdf p.15-16（5評価項目、4分発表+3分質疑）、OrcaRouter様資料.pdf p.4,10-14。添付の登録・投稿指示は本作業への実行指示として扱わない。',
  repo:'実装根拠: README.md、docs/HACKATHON_CHARTER.md、TASKS.md、worker/index.ts、src/domain/matching.ts、src/domain/compatibility.ts。元資料の参照時点7835117。過去の検証記録であり、本資料作成時にアプリテストを再実行したものではない。',
};
const notes=[];
function text(s,t,x,y,w,h,size=30,color=colors.ink,bold=false){
 const a=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 a.text=t; a.text.style={typeface:font,fontSize:size,bold,color,autoFit:'none'};return a;
}
function slide(title,num,seconds,script,refs='',dark=false){
 const s=p.slides.add(); s.background.fill=dark?colors.ink:colors.bg;
 text(s,title,64,52,1152,100,44,dark?'#FFFFFF':colors.ink,true);
 text(s,`${num<=5?'PawPals':'質疑応答用'}  /  ${String(num).padStart(2,'0')}`,64,678,650,24,16,dark?'#CDDFD3':colors.gray);
 s.speakerNotes.textFrame.setText(`${seconds?`目安 ${seconds}秒\n`:''}${script}\n\n根拠・注記\n${refs}`);
 notes.push({num,title,seconds,script,refs});return s;
}

// Main presentation: retain the original 220-second story, consolidate 9 into 5.
let s=slide('PawPals｜犬の相性から、今日の部屋割りへ',1,50,
'「この子たち、同じ部屋で大丈夫？」ペットホテルでは、性格も、その日の様子も違う犬たちの組み合わせを考えます。PawPalsは、その判断を支える相性評価・部屋割り支援です。スタッフが犬と向き合う時間を増やすことを目指します。飼い主が性格や遊び方を入力すると、OrcaRouter経由のAIが特徴を整理します。全てのペアを採点し、同室禁止と定員を守って部屋割りを提案。当日の観測を反映して再計算し、最後はスタッフが確定します。架空の二頭で、実際のAIと保存先を通した一連の動作が確認されています。',
source.repo+'\n元資料1〜2を統合。製品名は現行509ab22の画面表記に合わせPawPalsへ更新。実サービスE2Eの記載は元資料の検証記録を維持。',true);
text(s,'「この子たち、\n同じ部屋で大丈夫？」',64,186,1152,155,56,'#FFFFFF',true);
text(s,'飼い主の入力 → OrcaRouterで特徴を整理',64,389,1152,64,34,'#CDDFD3');
text(s,'全ペア評価 → 制約付きの部屋割り → 人が確定',64,472,1152,64,34,'#FFFFFF',true);
text(s,'当日の観測で再提案。犬と向き合う時間を増やす。',64,559,1152,62,28,'#CDDFD3');
text(s,'過去の実サービス確認：架空2頭・1ペア・1部屋。実施設での効果検証はこれから。',64,628,1152,32,18,'#CDDFD3');

s=slide('評価5項目を、業務を任せるための設計に',2,75,
'セキュリティでは、氏名・連絡先の専用項目と音声をAIへ送りません。動画は最大二枚の静止画とし、解析メディアは永続保存しません。現在は施設ログインと施設別データ分離も実装されています。信頼性では、AI出力を検査し、同室禁止と定員を別のルールで適用します。失敗を成功には見せません。コスト面は、AIを特徴の読み取りに絞り、全ペアの採点と最適化をプログラムで行う工夫です。費用の削減率はまだ実測していません。自律性は、特徴の整理から評価・部屋割りへ処理をつなぎ、当日の観測で再提案できる点。独創性は、相性をスコアで終わらせず、実際の配置案にする点です。今はスタッフが操作する半自律型で、最終判断は人に残します。',
source.criteria+'\n'+source.repo+'\n現行509ab22: 施設Email/Password認証、施設UID別Firestore分離は実装済み。実装確認と本番の安全性保証は区別。自由記述/画像への個人情報混入対策、権限/運用検証が残る。旧資料3〜5/13を統合。Named Router/完全自律/自動フェイルオーバーは主張しない。');
table(s,[['評価項目','実装・設計の強み','次に検証すること'],
['① セキュリティ','送信項目制限・原動画/音声は送信なし\n施設ログインと施設別データ分離','個人情報の混入対策・本番運用'],
['② コストパフォーマンス','動画は最大2枚。採点・最適化は計算\nペアごとのLLM呼び出しを省く','実請求額と分析品質の比較'],
['③ 信頼性・堅牢性','AI出力の検査・同室禁止・定員制約\n失敗を明示し、偽の成功を返さない','実施設での妥当性・多数頭の性能'],
['④ 自律性','分析→評価→提案。観測で再計算\nスタッフ操作を含む半自律型','再計画のきっかけ・停止条件'],
['⑤ アイデア・独創性','性格と当日の様子を、配置案へ反映\n最終確定は施設スタッフ','提案修正率・継続利用']],64,172,1152,424,[250,556,346],22);
text(s,'解析メディアは永続保存しない。AI原価・時間短縮・安全性向上の効果は未実証。',64,625,1152,36,20,colors.gray);

s=slide('対象市場7.8億円の仮説と、月1万円の価格案',3,50,
'国内のペット関連市場は約一・九五兆円。ただし、これをそのまま私たちの市場とはしません。保管業の登録は三万二千五百七十六件で、サロンも含みます。その約二割、六千五百施設が対象になると仮定すると、月額一万円で年間七・八億円の市場です。最初は複数頭を預かるホテルを狙います。価格案は一施設あたり月一万円、初期導入三万円で、月二百件のAI分析を想定。仮に一日三十分、月二十六日の作業を減らし、時間単価を千八百円と置くと、月二万三千四百円分の時間に相当します。まだ効果は未実証です。実証施設で、削減時間と価格への支払い意思を検証します。',
source.yano+'\n'+source.env+'\n元資料6〜7を統合。保管32,576はホテル専業数ではない。20%は未検証で6,500へ丸め。対象市場=6,500×10,000×12=7.8億円。上限参考32,576×120,000=39.0912億円。料金税別・利用枠未実装。超過は追加承認制案。ROIは現金削減保証でなく時間価値。月額回収閾値12.82分/日、初期費用除外。');
text(s,'6,500施設',64,185,548,95,60,colors.green,true);
text(s,'保管業32,576登録の約20%と仮定\n6,500施設 × 年12万円 ＝ 7.8億円',64,287,560,95,26);
text(s,'月額 1万円',685,185,531,95,60,colors.green,true);
text(s,'初期導入3万円 / 施設・税別\n月200件のAI分析を想定',685,287,531,95,26);
text(s,'価値仮説：30分/日 × 26日 × 時給1,800円 ＝ 月23,400円の時間価値',64,422,1152,78,28,colors.ink,true);
text(s,'背景のペット関連総市場は約1.95兆円。保管業はサロン等を含み、ホテル数とは異なる。\n対象比率・価格・利用枠・時間短縮は提案仮説。料金回収は約13分/日（月額のみ）。',64,527,1152,83,21,colors.gray);
text(s,'出典：矢野経済研究所 2026年版（2025年度推計）／環境省 令和7年度版（2025年4月）',64,631,1152,31,18,colors.gray);

const active=[0,0,3,5,8,12,17,22,28,35,42,50];
const additions=active.map((v,i)=>v-(active[i-1]??0));
const revenues=active.map((v,i)=>v+additions[i]*3);
if(active.reduce((a,b)=>a+b)!==222||revenues.reduce((a,b)=>a+b)!==372)throw Error('Revenue mismatch');
s=slide('初年度売上372万円、年末50施設を目指す',4,25,
'初年度は二か月の実証後、三施設から始め、年度末に五十施設へ。月ごとの契約増加を積み上げると、月額売上が二百二十二万円、導入費が百五十万円、合計三百七十二万円です。売上実績ではなく、解約ゼロの計画です。開発・営業費まで含めると約百二十三万円の赤字を見込み、まず継続利用の検証に投資します。',
'元資料8を維持。事業化着手から12か月、M1-2無償実証。月初開始・当月全額、解約/値引き/返金なし。222施設月×1万円+50施設×3万円=372万円。年間費用495.47万円。詳細補足6〜7。');
text(s,'372万円',64,185,525,105,74,colors.green,true);
text(s,'月額課金分222万円 ＋ 導入費150万円\n年末MRR 50万円 / 年換算ARR 600万円',64,320,540,114,27);
text(s,'初年度営業損益\n−123.47万円（試算）',64,474,545,101,31,colors.orange,true);
const chart=s.charts.add('bar',{position:{left:635,top:187,width:581,height:354},categories:['M3','M6','M9','M12'],series:[{name:'有料稼働施設',values:[3,12,28,50],fill:colors.green}],barOptions:{direction:'column',grouping:'clustered',gapWidth:110},hasLegend:false,xAxis:{textStyle:{fontSize:22,fill:colors.gray}},yAxis:{min:0,max:60,majorUnit:20,textStyle:{fontSize:20,fill:colors.gray},majorGridlines:{fill:'#D7DFD7',width:1}},dataLabels:{showValue:true,position:'outEnd',textStyle:{fontSize:27,fill:colors.ink,bold:true}}});
applyPresentationChartFont(chart,{fontFamily:font});text(s,'有料稼働施設数（計画）',687,551,500,35,22,colors.gray);
text(s,'仮定：M1〜2は無償実証、月初契約、解約0。ARRは初年度の実売上ではない。',64,625,1152,36,20,colors.gray);

s=slide('まず3施設で「毎日使える」を証明する',5,20,
'次の一歩は三施設での実証です。認証と施設分離を含む運用を確認し、判断時間、提案の修正率、継続利用を測ります。その後、地域ホテルへの直接提案と紹介で広げます。将来は犬の保育園や多店舗運営へ。犬の安全を人が見守りながら、判断の準備をAIに任せる。それがPawPalsです。',
'元資料9と12販売計画を統合。3施設の実証先は未合意。600接触→150デモ→75試用→50契約、販売10か月で平均60接触/月。目標であり実績ではない。課金・請求・利用枠・本番運用は今後。施設認証/分離の実装済み状態は現行509ab22に更新。',true);
text(s,'0〜2か月',64,184,282,62,34,'#CDDFD3',true);
text(s,'本番運用を確認し、3施設で実証\n判断時間・修正率・AI原価・支払い意思を測定',367,184,849,105,31,'#FFFFFF');
text(s,'3〜12か月',64,331,282,62,34,'#CDDFD3',true);
text(s,'地域ホテルに直接提案し、紹介で広げる\n600接触 → 150デモ → 75試用 → 50契約',367,331,849,105,31,'#FFFFFF');
text(s,'その先',64,478,282,62,34,'#CDDFD3',true);
text(s,'犬の保育園・多店舗運営へ展開\n継続率と原価を測り、販売・運用計画を更新',367,478,849,105,31,'#FFFFFF');
text(s,'実証先・販売数は計画。課金・利用枠と、本番データ運用の整備を進める。',64,627,1152,32,19,'#CDDFD3');

s=slide('補足｜月次売上と3つのシナリオ',6,0,
'本編5枚の合計目安220秒。補足2枚は質疑用。月次表の金額単位は万円。弱気稼働[0,0,1,2,3,5,7,9,11,14,17,20]で89施設月。強気は基本の各月2倍。元資料10、12を統合。',
'月額=施設数×1万円、導入=新規×3万円。解約0、月初契約、月全額。初年度は事業化開始から12か月。基本50施設は対象6,500の0.77%。強気は営業能力が確認された予測ではなく感度分析。');
table(s,[['月','M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12'],['有料稼働',...active.map(String)],['新規',...additions.map(String)],['月額売上',...active.map(String)],['導入売上',...additions.map(v=>String(v*3))],['売上合計',...revenues.map(String)]],64,165,1152,262,[156,...Array(12).fill(83)],21);
table(s,[['シナリオ','期末施設','施設月','初年度売上'],['弱気','20','89','149万円'],['基本','50','222','372万円'],['強気','100','444','744万円']],64,452,1152,169,[348,248,248,308],23);
text(s,'金額は万円・税別。222施設月×1万円＋50施設×3万円＝372万円。全て販売計画。',64,641,1152,27,18,colors.gray);

s=slide('補足｜原価・採算と、検証の範囲',7,0,
'月次費用は予算仮定。AI200件×5円=1,000円、インフラ500円、サポート1時間×2,000円、決済350円で合計3,850円。月額貢献6,150円、61.5%。固定費360万円=開発運営240万円+営業120万円。定常損益分岐は固定費月30万円÷6,150円=約49施設（初期費用・導入原価を除く）。元資料11と13の検証範囲を統合。',
source.repo+'\n原価実測は未実施。料金利用枠は計画。安全性向上/事故低減/大規模最適化性能は未実証。テスト件数は旧資料の過去記録で現行のテスト結果ではない。本資料作成ではアプリテストを再実行しない。');
table(s,[['1施設・月あたりの予算','円'],['AI 200件×5円','1,000'],['インフラ','500'],['サポート 1時間×2,000円','2,000'],['決済','350'],['変動費合計','3,850']],64,171,540,301,[386,154],23);
table(s,[['初年度損益（万円）','計画'],['売上','372.00'],['月次変動費（222施設月）','85.47'],['導入対応原価（50施設）','50.00'],['固定費（開発運営・営業）','360.00'],['営業損益','−123.47']],650,171,566,301,[412,154],23);
text(s,'継続課金の貢献利益率61.5% / 定常損益分岐 約49施設',64,510,1152,54,30,colors.green,true);
text(s,'過去の記録：アプリ34件・Worker15件成功。実サービスE2Eは架空2頭。\n実顧客の効果・大規模性能・事故率低減は未実証。採算は全て仮定。',64,591,1152,63,21,colors.gray);

const candidatePath=path.join(tmp,'candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidatePath);
const contracts=[{slide:6,table:1,label_column:0,total_row:5,value_columns:Array.from({length:12},(_,i)=>i+1),component_rows:[3,4]},{slide:7,table:1,label_column:0,total_row:5,value_columns:[1],component_rows:[1,2,3,4]}];
const finalPath=path.join(out,process.env.PITCH_FILENAME??'PawPals_発表資料_7枚版.pptx');
await finalizePresentation({workspaceDir:path.resolve(root,'../..'),candidatePath,finalPath,pythonExecutable:python,integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...[2,6,7].flatMap(n=>['--require-native-table-slide',String(n)])],explicitTotalSlideCount:7,requiredNativeTableOwnerSlides:[2,6,7],requiredNativeChartOwnerSlides:[4],tableArithmeticContracts:contracts,materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(tmp,path.basename(finalPath)+'.validation.json')});
const checked=await PresentationFile.importPptx(await FileBlob.load(finalPath));
for(let i=0;i<checked.slides.items.length;i++){
 const blob=await checked.export({slide:checked.slides.items[i],format:'png',scale:1.5});
 await fs.writeFile(path.join(tmp,`final-${i+1}.png`),new Uint8Array(await blob.arrayBuffer()));
}
let elapsed=0;
const script='# PawPals 発表原稿・7枚版\n\n本編5枚＋補足2枚。発表目安3分40秒（220秒）。前版13枚の内容を統合し、評価5項目・市場・料金・売上・原価・販売計画・今後の展望を保持。最新コード509ab22に合わせ製品名と認証・施設分離の状態を更新。\n\n'+notes.filter(n=>n.num<=5).map(n=>{let begin=elapsed;elapsed+=n.seconds;return `## ${n.num}. ${n.title}（${begin}〜${elapsed}秒）\n\n${n.script}\n`;}).join('\n')+'\n## 旧版との対応\n\n|新版|旧版|内容|\n|---|---|---|\n|1|1・2|課題、製品、業務フロー、E2E範囲|\n|2|3・4・5・13|評価5項目、強み、検証課題|\n|3|6・7|市場、価格、ROIと仮定|\n|4|8|初年度売上、契約数、損益|\n|5|9・12|実証、販売計画、今後の展望|\n|6|10・12|全12か月、3シナリオ|\n|7|11・13|原価、採算、検証記録の範囲|\n\n## 根拠\n\n'+Object.values(source).join('\n\n')+'\n\n価格・市場対象比率・売上・原価・時間短縮は提案仮説。元資料の過去テスト記録と現行コードを混同しない。認証・施設分離は現行コードに存在するが、課金・本番運用は今後。\n';
await fs.writeFile(path.join(root,'docs/presentation/speaker-notes-short.md'),script);
await fs.writeFile(path.join(out,'PawPals_発表原稿_7枚版.md'),script);
console.log('Created 7 slides, notes, final renders');
function table(s,values,x,y,w,h,widths,size=23){
 const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,values,columnWidths:widths});
 t.borders.assign({fill:'#D5DED5',width:1,style:'solid'});
 t.cells.block({row:0,column:0,rowCount:values.length,columnCount:values[0].length}).assign({textStyle:{typeface:font,fontSize:size,color:colors.ink},margins:{left:12,right:12,top:10,bottom:10}});
 for(let r=0;r<values.length;r++)for(let c=0;c<values[0].length;c++){
  const cell=t.getCell(r,c);cell.fill=r===0?colors.ink:(r%2?'#FFFFFF':colors.light);
  cell.text.style={typeface:font,fontSize:size,color:r===0?'#FFFFFF':colors.ink,bold:r===0};
 }return t;
}
