# 勤怠管理システム（FIT社向け）

入り口のiPadまたはスマホで打刻し、月次集計をExcel出力できる勤怠管理アプリ。

## 機能

### 打刻
- 氏名を選択 → 出勤 / 退勤 / 外出 / 戻りで打刻
- 時刻は自動記録（修正・追加モードあり）
- 共用iPad・個人スマホの両方で利用可能

### 今日の一覧
- 本日の打刻一覧を表示
- 誰が何時に出勤・退勤したかを確認

### 月次集計（`/admin`）
- 日付範囲を指定して集計
- 氏名ごとの出勤日数・総勤務時間を表示
- Excel出力（集計シート + 明細シート）で給与計算に活用
- 打刻明細の編集・削除、社員マスタ編集

## 技術スタック

- Next.js 16 + TypeScript
- Tailwind CSS
- **Supabase**（打刻・社員マスタ。アプリは Route Handler + `service_role` のみで接続）
- xlsx（Excel出力）

## セットアップ

1. [`.env.example`](.env.example) を `.env.local` にコピーし、`NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を設定する。
2. [supabase/fit_attendance.sql](supabase/fit_attendance.sql) を Supabase SQL Editor で実行する。
3. 依存関係を入れて起動する。

```bash
npm install
npm run dev
```

### 任意の環境変数

- **`ADMIN_BASIC_AUTH`**: `ユーザー名:パスワード` で設定すると `/admin` のみ Basic 認証。
- **`ATTENDANCE_API_KEY`** / **`NEXT_PUBLIC_ATTENDANCE_API_KEY`**: 同一の値を入れると、API 呼び出しに `x-attendance-api-key` が必要になる。

本番デプロイ手順は [docs/納品チェックリスト.md](docs/納品チェックリスト.md) を参照。

## 社員マスタ（初期シード）

鈴木・大竹・森田・深田・石橋・豊島（SQL で投入。打刻画面の並びと一致。`/admin` から変更可。**修理アプリのマスタとは別**）

## 今後の拡張（フェーズ2）

- 休憩時間の記録（ヒアリング後）
- 直接現場勤務時の運用強化
- 面談メモの未実装（時間帯別ボタン、休暇ブランク、厳密な認証など）
