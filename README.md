# 無限井字遊戲 (Infinite Tic-Tac-Toe)

一款基於 Web 技術與 Firebase Realtime Database 開發的即時多人連線對戰遊戲。透過引入「動態印記消除 (FIFO)」機制，徹底解決了傳統井字棋極易產生平局的痛點，為經典遊戲賦予了全新的深度與長期策略性。

## 🌟 核心特色 (Features)

* **無限規則 (FIFO 機制)**
    * 每位玩家在棋盤上最多只能保留 **3** 個印記。
    * 當放置第 4 個印記時，系統會自動消除該玩家最舊的第 1 個印記，確保戰局永遠處於動態變化中，消除絕對平手的可能性。
    * **視覺預警系統**：每個印記旁附有順序數字 Badge，幫助玩家直觀判斷下一個即將消失的符號。
* **即時多人連線 (Cloud-Based Sync)**
    * 底層採用 **Firebase Realtime Database (RTDB)**。
    * 利用 WebSocket 達成事件驅動 (Event-Driven) 的毫秒級狀態同步，取代傳統高延遲的 HTTP 輪詢。
* **安全防衝突的配對大廳**
    * 使用 Firebase `runTransaction` 實作原子化配對邏輯，完美解決多名玩家同時加入房間時產生的競爭危害 (Race Condition)。
* **伺服器端生命週期管理 (人走房毀)**
    * 高度整合 Firebase `onDisconnect` 觸發器。若玩家在大廳意外斷線或關閉網頁，伺服器將自動清除節點，防止「幽靈房間」佔用資源。
* **雲端悔棋機制 (Undo Mechanism)**
    * 系統內建狀態回溯功能。透過雲端 `movesHistory` 陣列保存歷史紀錄，玩家可在次數限制內精準還原上一步的二維棋盤與 FIFO 佇列。

## 🛠️ 技術架構 (Tech Stack)

* **前端介面**: HTML5, CSS3 (Flexbox & CSS Grid)
* **核心邏輯**: JavaScript (ES6+ Modules, DOM 操作)
* **後端與資料庫**: Firebase Realtime Database (Serverless Architecture)
* **狀態傳遞**: Web Storage API (`sessionStorage`)

## 📂 專案結構 (Project Structure)

專案在前端架構上將大廳配對與遊戲本體解耦，透過 `sessionStorage` 進行輕量級的狀態傳遞。

```text
├── lobby.html       # 遊戲大廳頁面（配對與等待介面）
├── lobby.css        # 大廳樣式表
├── lobby.js         # 處理 runTransaction 配對與斷線炸彈邏輯
├── main.html        # 遊戲本體頁面（棋盤與 UI 渲染）
├── style.css        # 遊戲本體樣式表（CSS Grid 棋盤、Badge 標籤）
└── script.js        # 核心遊戲邏輯（FIFO 佇列、勝負判定、悔棋與時間同步）
