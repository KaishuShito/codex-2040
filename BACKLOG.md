# Codex 2040 — Backlog

SPEC.md が製品仕様の唯一の正。ここは MVP 後の独立要件だけを置く。

## Implemented — Realtime Voice Command Mode

Implemented on `agent/realtime-voice-mode` for the game-only TIBO token reset slice. Feature proposals, region events, and 2029/2035 decisions remain future voice extensions.

音声会話で機能追加・地域イベント・重大選択を提案できるモード。プレイヤーが「世界中の学校へ無料の教育モードを展開して」と話すと、音声は既存の自由入力と同じ検証パイプラインへ入り、ローカル効果を即時適用した後、Realtime GM が音声とイベントカードで便益・副作用を返す。

### 体験

- 押して話す、または明示的に開始する音声会話。マイクは既定でオフ。
- 音声による機能追加、地域コミュニティイベント、2029/2035の選択。
- 割り込み可能なGM音声。重要な結果は必ず字幕とイベントカードにも残す。
- 音声が利用できない場合は現在のテキスト入力とスクリプトGMへ即座にフォールバック。

### アーキテクチャ境界

- ブラウザ音声は OpenAI Agents SDK の `RealtimeAgent` / `RealtimeSession` と Realtime API の WebRTC 経路を主経路として実装済み。
- 標準APIキーをブラウザへ渡さない。サーバーで短命なクライアントシークレットを発行する。
- Realtimeモデルは意図・フレーバー・会話だけを担当し、数値は触らない。
- 音声の文字起こし結果を既存の60字制限、NGフィルタ、ローカルキーワード判定、GMクランプへ通す。
- 数値と勝敗の正本は引き続き決定論エンジン。音声が落ちてもゲームは進行する。

### 完了条件

- 音声で教育モードを提案し、ローカル効果→GMの便益と児童データ統治課題まで確認できる。
- マイク拒否、ネット切断、Realtime障害でもテキスト操作へ復帰できる。
- 音声内容・GM返答の字幕、録音状態、停止操作が明確。
- APIキーがクライアントバンドル・ログ・リポジトリへ露出しない。
- テキスト入力と同一の決定論リプレイを作れる正規化アクションログを保存する。

### 公式資料

- https://developers.openai.com/api/docs/guides/voice-agents
- https://developers.openai.com/api/docs/guides/realtime-webrtc
