# PawPals / PAWPAIR ER図と保存契約

更新日: 2026-09-22。設計基点 `6609e68` と、backend統合 `d12a381` / `3350193` / `373f39e` の保存契約を示す。UI/App統合と公開配備は別に判定する。
受入条件は [証拠対応表](integration/pawpals-acceptance.md)、業務仕様は [確定設計書](ペットホテル自律AIエージェント_設計書_v4.md)。

## 基点の実保存先

| パス | 内容・境界 |
|---|---|
| `facilities/{facilityId}` | Firebase Auth UIDに対応する有効施設 |
| `facilities/{facilityId}/staffProfiles/{staffId}` | 施設スタッフ。選択候補 |
| `registrationInvites/{inviteHash}` | 公開取得用のactive / facilityId。list不可 |
| `facilities/{facilityId}/registrationInvites/{inviteHash}` | 発行者staffId、createdAt。施設内限定 |
| `facilities/{facilityId}/demoIntakes/{intakeId}` | 招待と結びつく受付。飼い主情報、AI結果、媒体メタデータ。create-only |
| `facilities/{facilityId}/demoPets/{petId}` | マッチング用5軸プロフィール。施設側でcreate/update |
| `facilities/{facilityId}/demoMatchingSnapshots/{snapshotId}` | 提案・確定、petIds、全ペア、部屋、目的値、作成日時。基点はcreate-only |
| `facilities/{facilityId}/demoObservations/{observationId}` | 手動観測記録。基点はcreate-only |

根拠: `src/data/firestore*Repository.ts`、`firestoreFacilityScope.ts`、`firestore.rules`。
旧トップレベル `demoPets` 等を現在の施設スコープ保存先として記載しない。

## 今回の論理ER（backend実装・検証済み、App統合待ち）

以下は要件上の関連を示す。実collectionとの対応は後述の先行確定契約を参照する。AI_ANALYSISは基点では受付内に埋め込まれ、独立collectionではない。

~~~mermaid
erDiagram
    FACILITY ||--o{ STAFF : has
    FACILITY ||--o{ INVITE : issues
    STAFF ||--o{ INVITE : issued_by
    INVITE ||--o| OWNER_INTAKE : accepted_once
    OWNER_INTAKE ||--o| AI_ANALYSIS : embeds
    OWNER_INTAKE ||--o| PET_PROFILE : produces
    FACILITY ||--o{ DAILY_TARGET : selects_by_date
    DAILY_TARGET }o--o{ PET_PROFILE : selected_pets
    FACILITY ||--o| ROOM_SETTINGS : stores_current
    DAILY_TARGET ||--o{ MATCHING_SNAPSHOT : calculated_for
    ROOM_SETTINGS ||--o{ MATCHING_SNAPSHOT : used_by
    MATCHING_SNAPSHOT ||--o{ PAIR_RESULT : embeds
    MATCHING_SNAPSHOT ||--o{ ROOM_ASSIGNMENT : embeds
    MATCHING_SNAPSHOT o|--o{ OPERATION_AUDIT : optional_target
    FACILITY ||--o{ OPERATION_AUDIT : records
    STAFF ||--o{ OPERATION_AUDIT : actor
    MATCHING_SNAPSHOT o|--o{ MATCHING_SNAPSHOT : original_proposal
    FACILITY ||--o{ OBSERVATION_RECORD : stores
~~~

## 追加契約と受入条件

| 論理モデル | 必要な契約 | 状態 |
|---|---|---|
| 受付構造化項目 | 去勢/ヒート、健康、社会化、行動6問。フォーム・保存・AI・Rules・validation・同意が一致し、自由記述互換を維持 | 18キーと同意契約受領、実装検証待ち |
| 7軸分析 | 外向性/社交性/神経質性/訓練性/資源防衛/自己主張/回復力。根拠・信頼度と欠損を扱う | 整数0〜100、旧5軸互換、同値伝搬の契約受領 |
| DAILY_TARGET | 施設・日付・明示選択したpetIdsを保存。対象外を計算に混入させない | 先行契約受領、実装検証待ち |
| ROOM_SETTINGS | 施設別部屋設定を永続化し、計算に使用する | 先行契約受領、実装検証待ち |
| MATCHING_SNAPSHOT | proposed/confirmed/rejected/superseded、当日対象、元案参照、最新案との整合性 | operationPlans・revision/transaction契約受領 |
| OPERATION_AUDIT | staffId、いつ・何を・どの案へ・理由・元案を記録。承認/却下/再計算を追跡 | operationAudit append-only契約受領 |
| OBSERVATION_RECORD | 実在する手動観測の入力・保存・再計算経路 | 基点の型あり。今回拡張・統合検証待ち |
| 将来ingestion IF | 入力源・operation event/observation型・adapter境界・契約テスト | 永続カメラログや稼働中監視は今回対象外 |

最新未確定案のみ承認でき、再計算時の旧proposedはsupersededとなること。状態・監査・新案保存が部分的に失敗した際の整合性を、確定したRepository/Rulesで検証する。基点の2状態・create-only Rulesをそのまま拡張済みとは記載しない。

## データの意味と表示

- 全ペア結果は当日選択n頭の全 `n(n-1)/2` 件であり、部屋内のペアだけではない。
- 待ち件数は最新未確定案に基づき、履歴件数の合計ではない。
- 既存5軸をモック7軸へ名前だけ変更しない。モック固定値を補完値にしない。
- 保存済み観測・snapshotsを表示する。severity、alert ack、交流実績を仮の永続データで埋めない。
- 写真/動画は媒体メタデータだけ保存し、バイナリ・data URLを永続化しない。飼い主情報とAI分析入力の境界を維持する。

## backend確定契約と実装証拠

次の追加パスはすべて `facilities/{facilityId}/` 配下。backendは `3048cc6` / `48e0e02` / `d6431c9` で実装・検証され、統合branchへ `d12a381` / `3350193` / `373f39e` として取り込まれた。Firestore indexesも追加済み。公開配備済みとは記載しない。

| パス | フィールド |
|---|---|
| `dailyOperations/{YYYY-MM-DD}` | facilityId, date, selectedPetIds, revision, latestPlanId, lastAuditId, updatedAt, updatedBy |
| `settings/rooms` | facilityId, rooms, revision, lastAuditId, updatedAt, updatedBy |
| `operationPlans/{id}` | id, facilityId, date, status, petIds, rooms（RoomDefinition[]）, roomsRevision, dayRevision, result（MatchingSuccess）, sourcePlanId, createdAt, updatedAt, staffId, reason, lastAuditId |
| `operationAudit/{id}` | id, facilityId, date（nullまたはstring）, action, staffId, reason, sourcePlanId, planId, createdAt, dayRevision, roomsRevision |

actionは `day_saved / rooms_saved / recalculated / confirmed / rejected`。revisionは新規0。変更はtransaction+audit。operationPlansは旧demoMatchingSnapshotsと別collectionであり、日付なしlegacy履歴を当日件数へ混ぜない。提案内の部屋定義とday/roomsのrevisionを保存し、古い構成の案を承認しない。

手動観測は既存 `demoObservations/{id}` へappend-onlyで保存し、source/staffId/petIds/operationDateを追加する。sourceとscenarioIdはRepositoryがmanualへ固定。同ID同内容の再送は冪等、別内容は拒否。有効スタッフと施設所属犬を検証。legacyのread互換を保ち、demoシナリオを実観測へ変換しない。

`OwnerIntake.pet.structured?` は18キー、追加受付は `consent` 必須。7軸は `aiAnalysis.personalityAxes` と `matchingProfile.personalityAxes` に同値保存し、`PetProfile.personalityAxes?` へ伝搬する。軸キーは [受入表](integration/pawpals-acceptance.md) を参照。型/Rules/Repositoryがこの契約を実装した証拠は別途記録する。
