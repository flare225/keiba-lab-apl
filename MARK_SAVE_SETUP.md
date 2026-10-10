# KEIBA LABO 印のDB保存 — 管理者向け設定

## この改修でできること
- 公式枠番・馬番を照合した「枠順後」と「最終印」に限ってDB保存する
- 保存前に馬場想定（最終印は必須）、馬名、馬番、印の重複を検査する
- ブラウザ内に個人用の日時付き控えを保存する（正式DB記録とは区別）
- 管理キーを入力して「正式DBへ保存して照合」を押すと、DB側へ `confirm=SAVE` を送信
- 保存応答の `revisionId` に加え `GET /v1/lab/user-marks` の再読込で **保存したレース・段階・印・馬番・馬場** を一致照合して初めて「DB保存」を表示する
- 認証キーはパスワード欄で一度だけ取得し、ブラウザの保存領域に書き込まない

## 必須：Cloudflare Worker 側の保存許可
Worker `keiba-lab-api` のシークレット `USER_MARK_WRITE_TOKEN` を管理者が設定する。

- Cloudflare 管理画面で Worker の Secrets に十分強いランダム値を登録する
- 同じ値を KEIBA LABO の印画面で**保存時だけ**入力する
- 管理キーは共有しない。ネットケイバのログイン情報とは無関係
- Vercel や GitHub の公開コード・ブラウザ localStorage・スクショ・ブログ記事には記載しない

シークレット未設定の場合、Worker は HTTP 503
`user-mark writes disabled until USER_MARK_WRITE_TOKEN configured`
を返す。このときDB保存はできない。勝手な匿名書き込みを許すようには変更しない。

保存操作は同一オリジンの
`POST /v1/lab/user-marks/save`（Vercel内部からCloudflareへ中継）で行う。
GET `/v1/lab/user-marks?...&phase=final` は書き込みと独立した監査用。

## レース開催後について
保存日時を過去に変更してはいけない。レース後の最終印の保存は**事後記録**であり、レース前の事前LOCKやブラインド予想の証拠として扱わない。

## 本番チェック
- /health の `authenticated-mark-save` と `verified-mark-revision-status` を確認
- 認証なし POST /v1/lab/user-marks/save が HTTP 401 で拒否されること
- サウジRC 2026-10-10 東京11R の GET `phase=final` で現在の改訂版・頭数を確認
- 管理者の実際のキーを使った保存は**ユーザー操作時に実施**。テストジョブで勝手に最終印を作成しない
