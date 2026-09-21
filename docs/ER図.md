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
- AI分析の入力写真・動画は処理時だけ一時利用し、解析後に永続保存しない。R2へ原本を残さない。音声ファイルと動画音声は扱わない。
- 分析結果と性格パラメータはFirebaseへ保存する。エラー時はAI成功結果を捏造せず、状態とエラーコードを残す。
- PairResultは全n(n-1)/2ペア分を用意してから部屋最適化へ渡す。
- MatchingSnapshotは提案/確定を区別し、確定者と時刻を記録する。

## 現状実装との差

現在のコードには `demoIntakes`, `demoPets`, `demoMatchingSnapshots`, `demoObservations` 用RepositoryとRulesがあり、AppはAI解析後の分析結果を含む受付をcreateし、プロフィールとマッチングを保存する。Firestore受付はcreate-onlyだが、AI処理が先に完了する保存順で構成される。Firebase実配備/read-backは未確認。OwnerFormからWorker分析へのコード接続は存在する一方、実Worker/OrcaRouter応答は未確認。現Workerの `/api/media` は永続保存を無効化し、解析用data URLを直接渡す。

現在コードとRulesの実装概略：

~~~text
demoIntakes/{intakeId}             # owner情報を含む受付。Firestore設定時create
demoPets/{petId}                   # マッチング用プロフィール
demoMatchingSnapshots/{snapshotId} # 提案/確定
demoObservations/{observationId}   # サンプル観測
~~~

これらはコードに定義されているコレクション名であり、実Firestore上に作成・保存済みであることを示さない。
