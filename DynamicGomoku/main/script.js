// script.js - 終極乾淨房毀版
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, onValue, update, set, onDisconnect } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCWONW55br_obW5symoO3G673l0kaBUdZw",
    authDomain: "aaaaa-cf9f0.firebaseapp.com",
    projectId: "aaaaa-cf9f0",
    storageBucket: "aaaaa-cf9f0.firebasestorage.app",
    messagingSenderId: "1085700377277",
    appId: "1:1085700377277:web:39fd62b67136321b44c5d4",
    measurementId: "G-PP3ZRZKZ49",
    databaseURL: "https://aaaaa-cf9f0-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const gameRef = ref(db, 'game');

const myRole = parseInt(sessionStorage.getItem("myRole") || "1");
const BOARD_SIZE = 3;
const MAX_MARKS = 3;
let board = [];
let currentPlayer = 1; 
let isGameOver = false;
let turnNumber = 0; 
let startTime = null;
let timerInterval = null;
let movesHistory = []; 
let undoCounts = { 1: 0, 2: 0 }; 
let queues = { 1: [], 2: [] };

const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const turnCountElement = document.getElementById('turnCount');
const timerElement = document.getElementById('timer');
const undoBtn = document.getElementById('undoBtn');

function initBoardStructure() {
    boardElement.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.addEventListener('click', handleCellClick);
            boardElement.appendChild(cell);
        }
    }
    
    // 💡 遊戲中只要任何人關掉網頁，不要再設為 waiting 了，直接把房間刪除！
    onDisconnect(gameRef).remove();
}

onValue(gameRef, (snapshot) => {
    const data = snapshot.val();
    
    // 💡 只要房間不見了 (變成 null)，代表對手跑了，或是按了重新開始
    // 留在這裡的人就立刻退回大廳
    if (!data) {
        if (timerInterval) clearInterval(timerInterval);
        window.location.href = '../lobby/lobby.html';
        return;
    }

    board = data.board || [];
    queues = data.queues || { 1: [], 2: [] };
    currentPlayer = data.currentPlayer;
    turnNumber = data.turnCount;
    movesHistory = data.movesHistory || [];
    undoCounts = data.undoCounts || { 1: 0, 2: 0 };
    isGameOver = (data.status === 'finished');

    if (data.startTime) {
        if (!startTime) {
            startTime = data.startTime;
            startTimer();
        }
    } else {
        startTime = null;
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        timerElement.innerText = '時間：00:00';
    }

    renderBoard();
    updateUI();

    if (data.status === 'finished' && data.winner) {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        statusElement.style.color = data.winner === 1 ? '#3498db' : '#e74c3c';
        const currentPlayerEl = document.getElementById('currentPlayer');
        if (currentPlayerEl) {
            const roleIndicator = myRole === 1 ? "【你是：藍方 O】" : "【你是：紅方 X】";
            currentPlayerEl.innerText = `遊戲結束！${data.winner === 1 ? '藍方 (O)' : '紅方 (X)'} 獲勝！ ${roleIndicator}`;
        }
    }
});

function handleCellClick(e) {
    if (isGameOver) return;
    if (currentPlayer !== myRole) return;
    
    const r = parseInt(e.target.dataset.r);
    const c = parseInt(e.target.dataset.c);
    if (board[r] && board[r][c] !== 0) return;

    let nextBoard = JSON.parse(JSON.stringify(board));
    let nextQueues = JSON.parse(JSON.stringify(queues));
    let nextHistory = JSON.parse(JSON.stringify(movesHistory));

    nextBoard[r][c] = myRole;
    if (!nextQueues[myRole]) nextQueues[myRole] = [];
    nextQueues[myRole].push({ r, c });

    let nextStatus = 'playing';
    let winner = null;

    if (checkWinLocal(nextBoard, myRole)) {
        nextHistory.push({ player: myRole, r, c, removed: null });
        nextStatus = 'finished';
        winner = myRole;
    } else {
        let removed = null;
        if (nextQueues[myRole].length > MAX_MARKS) {
            const oldestMark = nextQueues[myRole].shift();
            nextBoard[oldestMark.r][oldestMark.c] = 0;
            removed = { r: oldestMark.r, c: oldestMark.c };
        }
        nextHistory.push({ player: myRole, r, c, removed });
    }

    const nowTime = Date.now();
    let updateData = {
        board: nextBoard,
        queues: nextQueues,
        movesHistory: nextHistory,
        currentPlayer: myRole === 1 ? 2 : 1, 
        turnCount: turnNumber + 1,
        status: nextStatus,
        lastActive: nowTime 
    };

    if (winner) updateData.winner = winner;
    if (!startTime) updateData.startTime = nowTime;

    update(gameRef, updateData);
}

window.triggerUndo = function() {
    if (movesHistory.length === 0 || isGameOver) return;
    if (currentPlayer !== myRole) return;

    let nextHistory = JSON.parse(JSON.stringify(movesHistory));
    const last = nextHistory.pop();

    let nextBoard = JSON.parse(JSON.stringify(board));
    let nextQueues = JSON.parse(JSON.stringify(queues));
    let nextUndoCounts = JSON.parse(JSON.stringify(undoCounts));

    nextUndoCounts[last.player] = (nextUndoCounts[last.player] || 0) + 1;
    nextBoard[last.r][last.c] = 0;

    const q = nextQueues[last.player] || [];
    const idx = q.findIndex(p => p.r === last.r && p.c === last.c);
    if (idx !== -1) q.splice(idx, 1);

    if (last.removed) {
        nextBoard[last.removed.r][last.removed.c] = last.player;
        q.unshift({ r: last.removed.r, c: last.removed.c });
    }

    update(gameRef, {
        board: nextBoard,
        queues: nextQueues,
        movesHistory: nextHistory,
        undoCounts: nextUndoCounts,
        currentPlayer: last.player, 
        status: 'playing',
        turnCount: Math.max(0, turnNumber - 1),
        lastActive: Date.now() 
    });
};

window.triggerReset = function() {
    // 💡 重新開始不要囉唆，直接把資料庫炸掉！雙方就會自動滑回大廳重啟
    set(gameRef, null);
};

function renderBoard() {
    const cells = boardElement.children;
    for (let i = 0; i < cells.length; i++) {
        cells[i].innerHTML = '';
    }
    if (queues[1]) queues[1].forEach((pos, index) => drawMark(pos.r, pos.c, 1, index, queues[1].length));
    if (queues[2]) queues[2].forEach((pos, index) => drawMark(pos.r, pos.c, 2, index, queues[2].length));
}

function drawMark(r, c, player, index, currentQueueSize) {
    const cellIndex = r * BOARD_SIZE + c;
    const cell = boardElement.children[cellIndex];
    if (!cell) return;
    
    const mark = document.createElement('span');
    mark.innerText = player === 1 ? 'O' : 'X';
    mark.className = player === 1 ? 'player-O' : 'player-X';
    
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.innerText = index + 1;

    if (currentQueueSize === MAX_MARKS && index === 0) {
        mark.classList.add('fading');
        badge.classList.add('fading');
    }

    cell.appendChild(mark);
    cell.appendChild(badge);
}

function checkWinLocal(tempBoard, player) {
    for (let r = 0; r < BOARD_SIZE; r++) {
        if (tempBoard[r][0] === player && tempBoard[r][1] === player && tempBoard[r][2] === player) return true;
    }
    for (let c = 0; c < BOARD_SIZE; c++) {
        if (tempBoard[0][c] === player && tempBoard[1][c] === player && tempBoard[2][c] === player) return true;
    }
    if (tempBoard[0][0] === player && tempBoard[1][1] === player && tempBoard[2][2] === player) return true;
    if (tempBoard[0][2] === player && tempBoard[1][1] === player && tempBoard[2][0] === player) return true;
    return false;
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const totalSeconds = Math.floor(elapsed / 1000);
        const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const secs = String(totalSeconds % 60).padStart(2, '0');
        timerElement.innerText = `時間：${mins}:${secs}`;
    }, 1000);
}

function updateUI() {
    turnCountElement.innerText = String(turnNumber);
    const roleIndicator = myRole === 1 ? "【你是：藍方 O】" : "【你是：紅方 X】";
    
    if (!isGameOver) {
        const text = `目前回合：${currentPlayer === 1 ? '藍方 O' : '紅方 X'} ${roleIndicator}`;
        const currentPlayerEl = document.getElementById('currentPlayer');
        if (currentPlayerEl) currentPlayerEl.innerText = text;
        statusElement.style.color = currentPlayer === 1 ? '#3498db' : '#e74c3c';
    }
    
    const u1 = document.getElementById('undoCount1');
    const u2 = document.getElementById('undoCount2');
    if (u1) u1.innerText = String(undoCounts[1] || 0);
    if (u2) u2.innerText = String(undoCounts[2] || 0);
    
    undoBtn.disabled = (movesHistory.length === 0 || currentPlayer !== myRole || isGameOver);
}

initBoardStructure();