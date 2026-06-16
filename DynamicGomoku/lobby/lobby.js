// lobby.js - 終極無幽靈、人走房毀版
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction, onDisconnect } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

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

let seconds = 0;
let timerInterval = null;
let isRedirecting = false; 
const myClientId = "user_" + Math.random().toString(36).substr(2, 9);
let myDisconnectRef = null; // 💡 斷線炸彈引信

function startWaitingTimer() {
    const timerElement = document.getElementById('timer-text');
    if (!timerElement) return;
    timerInterval = setInterval(() => {
        seconds++;
        timerElement.innerText = `已等待：${seconds} 秒`;
    }, 1000);
}

function handleMatching() {
    startWaitingTimer();
    console.log("嘗試加入房間... 我的ID:", myClientId);
    sessionStorage.removeItem("myRole");

    const randomDelay = Math.floor(Math.random() * 300);

    setTimeout(() => {
        runTransaction(gameRef, (currentData) => {
            const now = Date.now();
            
            // 情況一：完全空房
            if (currentData === null || currentData.status === 'finished') {
                sessionStorage.setItem("myRole", "1");
                return {
                    status: 'waiting',
                    currentPlayer: 1,
                    turnCount: 0,
                    board: [[0,0,0],[0,0,0],[0,0,0]],
                    queues: { 1: [], 2: [] },
                    movesHistory: [],
                    undoCounts: { 1: 0, 2: 0 },
                    lastActive: now,
                    hostId: myClientId
                };
            } 
            // 情況二：有人在等
            else if (currentData.status === 'waiting') {
                if (currentData.hostId === myClientId) return currentData; // 防自己配對自己
                sessionStorage.setItem("myRole", "2");
                currentData.status = 'playing';
                currentData.lastActive = now;
                return currentData;
            }
            // 情況三：有人在玩，判斷是否為死房 (超過10秒沒動靜)
            else if (currentData.status === 'playing') {
                const isRoomAbandoned = (!currentData.lastActive || (now - currentData.lastActive > 10000));
                if (isRoomAbandoned) {
                    sessionStorage.setItem("myRole", "1");
                    return {
                        status: 'waiting',
                        currentPlayer: 1,
                        turnCount: 0,
                        board: [[0,0,0],[0,0,0],[0,0,0]],
                        queues: { 1: [], 2: [] },
                        movesHistory: [],
                        undoCounts: { 1: 0, 2: 0 },
                        lastActive: now,
                        hostId: myClientId
                    };
                }
            }
            return;
        }).then((result) => {
            // 💡 如果我成功變成了 Player 1 (房主)，我就綁上斷線炸彈
            // 只要我在大廳等得不耐煩關掉網頁，房間就直接刪除！
            if (result.committed) {
                const data = result.snapshot.val();
                if (data && data.status === 'waiting' && data.hostId === myClientId) {
                    myDisconnectRef = onDisconnect(gameRef);
                    myDisconnectRef.remove(); 
                }
            }
        });
    }, randomDelay);

    const unsubscribe = onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        
        if (data && data.status === 'playing' && !isRedirecting) {
            isRedirecting = true;
            
            // 💡 關鍵：準備跳轉遊戲前，必須把大廳的斷線炸彈「拆除」，否則一跳轉房間就會被誤刪！
            if (myDisconnectRef) {
                myDisconnectRef.cancel();
            }
            
            if (timerInterval) clearInterval(timerInterval);
            unsubscribe(); 
            window.location.href = "../main/main.html";
        }
    });
}

handleMatching();