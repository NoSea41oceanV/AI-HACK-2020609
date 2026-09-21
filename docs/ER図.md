# PAWPAIR ER図とデータ境界

## 目標データモデル

~~~mermaid
erDiagram
    OWNER_INTAKE ||--o| AI_ANALYSIS : analyzed_as
    AI_ANALYSIS ||--|| PET_PROFILE : produces
    PET_PROFILE }o--o{ PAIR_RESULT : scored_with
    PAIR_RESULT }o--|| MATCHING_SNAPSHOT : included_in
    MATCHING_SNAPSHOT ||--o{ ROOM_ASSIGNMENT : proposes

    OWNER_INTAKE {
      string id PK
      string ownerName "Firestore only; never AI payload"
      string ownerContact "Firestore only; never AI payload"
      string petData
      string submittedAt
      string status
    }
    AI_ANALYSIS {
      string id PK
      string intakeId FK
      string summary
      array observations
      array evidenceTraits
      array riskFlags
      number confidence
      string model
      string analyzedAt
    }
    PET_PROFILE {
      string id PK
      string intakeId FK
      string petName
      number energyLevel
      number sociability
      number anxietyLevel
      number assertiveness
      number resourceGuarding
      array playStyles
      array hardBlockedPetIds
    }
    PAIR_RESULT {
      string pairKey PK
      string petAId FK
      string petBId FK
      number score
      boolean allowed
      array hardConstraintCodes
    }
    MATCHING_SNAPSHOT {
      string id PK
      array petIds
      string status
      number objectiveScore
      string createdAt
    }
    ROOM_ASSIGNMENT {
      string id PK
      string snapshotId FK
      string roomId
      array petIds
    }
~~~

## データ取扱い

- 飼い主名・連絡先はFirebase受付レコードに必要な場合だけ保存し、Worker/OrcaRouterの入力、ログ、分析結果には含めない。
- AI分析の入力写真は処理時だけ一時利用する。動画はブラウザで最大2枚のJPEGフレームへ変換し、元動画と動画内音声をWorkerへ送らない。Firestoreにはファイル名・種類・サイズのメタデータだけを保存し、バイナリ、data URL、R2オブジェクトは残さない。
- 分析結果と性格パラメータはFirebaseへ保存する。エラー時はAI成功結果を捏造せず、状態とエラーコードを残す。
- PairResultは全n(n-1)/2ペア分を用意してから部屋最適化へ渡す。
- MatchingSnapshotは提案/確定を区別し、確定者と時刻を記録する。

## 現状実装との差

現在のコードには `demoIntakes`, `demoPets`, `demoMatchingSnapshots`, `demoObservations` 用RepositoryとRulesがあり、AppはAI解析後の分析結果を含む受付をcreateし、プロフィールとマッチングを保存する。Firestore受付はcreate-onlyで、AI処理が先に完了する保存順で構成される。Firebase有効時のOwnerIntakeはlocalStorageへミラーしない。Firebase Hosting / Rules実配備とread-backは未確認である。

OwnerFormからWorker分析へのコード接続があり、配備済みWorkerとOrcaRouterの実構造化応答を確認済みである。Worker payloadは性格・遊び方・注意事項と画像だけを許可し、写真または動画由来JPEGフレームを一時data URLとして扱う。`/api/media` は410、raw動画・音声は415で拒否し、永続メディア領域を持たない。

現在コードとRulesの実装概略：

~~~text
demoIntakes/{intakeId}             # owner情報を含む受付。Firestore設定時create
demoPets/{petId}                   # マッチング用プロフィール
demoMatchingSnapshots/{snapshotId} # 提案/確定
demoObservations/{observationId}   # サンプル観測
~~~

これらはコードに定義されているコレクション名であり、実Firestore上に作成・保存済みであることを示さない。現Rulesは認証を省いたハッカソン限定の公開書込みを許すため、第三者による無料枠消費リスクがあり、本番用のアクセス制御ではない。
