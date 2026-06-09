# retire-inv — 退休投資規劃系統

純前端（單頁）退休 / FIRE 試算工具。用瀏覽器開啟 `index.html` 即可使用，無需後端。

## 功能
- 規劃試算、退休試算（FIRE 計算機，支援 Regular / Lean / Fat / Barista / Coast FIRE 切換）
- 目標反推（可輸入退休年份 / 退休年齡）
- 進階退休分析：滑行（Coast）達標檢測、長照壓力測試、蒙地卡羅模擬（與上方試算參數共用）
- 資產配置、即時行情、資產曲線
- 可選接 Supabase 雲端資料

## 使用
直接用瀏覽器開啟 `index.html`，或部署到 GitHub Pages。
`index.html` 會載入同目錄的 `index.app.js`，其餘函式庫（React、Chart.js 等）以 CDN 載入。

## 隱私 / 設定
- Supabase URL / Key、Twelve Data API key 皆於 App 內「設定」頁輸入，存在瀏覽器 localStorage，**不包含在原始碼中**。
- `index.html` 內 `SEED = null`，不含任何個人財務資料。

## 免責
本工具僅供個人財務規劃參考，不構成投資、稅務或保險建議。投資有風險，過去績效不代表未來表現。
