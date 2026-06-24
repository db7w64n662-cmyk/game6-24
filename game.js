/* ==========================================================================
   《心跳的二重奏》 GALGAME 引擎核心邏輯
   ========================================================================== */

// 遊戲狀態變數
let currentRoute = "";
let dialogueIndex = 0;
let isTyping = false;
let typeTimer = null;
let textToType = "";
let historyLog = [];

let autoPlay = false;
let autoTimer = null;
const AUTO_DELAY = 2200; // 自動播放延遲 (毫秒)

let skipMode = false;
let skipTimer = null;
const SKIP_DELAY = 100; // 跳過模式延遲 (毫秒)

let saveloadAction = "save"; // "save" 或 "load"

// DOM 元素綁定
const elTitleScreen = document.getElementById("title-screen");
const elAdventureScreen = document.getElementById("adventure-screen");
const elDialogueText = document.getElementById("dialogue-text");
const elNameBox = document.getElementById("name-box");
const elDialogueBox = document.getElementById("dialogue-box");
const elChapterTitle = document.getElementById("chapter-title");

// 角色舞台
const elCharNijika = document.getElementById("char-nijika");
const elImgNijika = document.getElementById("img-nijika");
const elCharKotone = document.getElementById("char-kotone");
const elImgKotone = document.getElementById("img-kotone");

// 覆蓋面板
const elChoicesOverlay = document.getElementById("choices-overlay");
const elChoiceQuestion = document.getElementById("choice-question");
const elChoicesList = document.getElementById("choices-list");

const elLogOverlay = document.getElementById("log-overlay");
const elLogContent = document.getElementById("log-content");
const elSaveLoadOverlay = document.getElementById("saveload-overlay");
const elSaveLoadTitle = document.getElementById("saveload-title");

// 音訊 placeholder (未來開發者可放入音訊)
let bgmAudio = null;

/* ==========================================================================
   一、初始化與主選單控制
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // 綁定主選單按鈕
  document.getElementById("btn-start-nijika").addEventListener("click", () => startGame("nijika_1"));
  document.getElementById("btn-start-kotone").addEventListener("click", () => startGame("kotone_1"));
  document.getElementById("btn-start-extra").addEventListener("click", () => startGame("extra_chapter"));
  document.getElementById("btn-title-load").addEventListener("click", () => openSaveLoad("load"));

  // 遊戲內快選選單
  document.getElementById("btn-quick-log").addEventListener("click", openLog);
  document.getElementById("btn-quick-save").addEventListener("click", () => openSaveLoad("save"));
  document.getElementById("btn-quick-load").addEventListener("click", () => openSaveLoad("load"));
  document.getElementById("btn-back-main").addEventListener("click", backToTitle);

  // 對話框底部控制欄
  document.getElementById("ctrl-auto").addEventListener("click", toggleAuto);
  document.getElementById("ctrl-skip").addEventListener("click", toggleSkip);
  document.getElementById("ctrl-log").addEventListener("click", openLog);
  document.getElementById("ctrl-save").addEventListener("click", () => openSaveLoad("save"));
  document.getElementById("ctrl-load").addEventListener("click", () => openSaveLoad("load"));

  // 關閉 Overlays
  document.getElementById("btn-close-log").addEventListener("click", () => elLogOverlay.classList.remove("active"));
  document.getElementById("btn-close-slots").addEventListener("click", () => elSaveLoadOverlay.classList.remove("active"));

  // 對話框點擊推進
  elDialogueBox.addEventListener("click", handleDialogueClick);

  // 監聽立繪圖片加載狀態，以動態切換 placeholder 顯示
  setupSpriteImageListeners();

  // 綁定存檔槽按鈕
  setupSaveSlots();
});

// 開始遊戲
function startGame(startNode) {
  elTitleScreen.classList.remove("active");
  elAdventureScreen.classList.add("active");
  
  // 重設遊戲狀態
  currentRoute = startNode;
  dialogueIndex = 0;
  historyLog = [];
  autoPlay = false;
  skipMode = false;
  stopAuto();
  stopSkip();

  // 推進第一句
  renderDialogue();
}

// 返回主選單
function backToTitle() {
  if (confirm("確定要返回主選單嗎？未存檔的進度將會遺失。")) {
    stopAuto();
    stopSkip();
    elAdventureScreen.classList.remove("active");
    elTitleScreen.classList.add("active");
  }
}

/* ==========================================================================
   二、對話渲染與推進系統
   ========================================================================== */

// 點擊對話框處理
function handleDialogueClick() {
  if (isTyping) {
    // 如果正在打字，直接跳過打字機效果，顯示整句
    completeTyping();
  } else {
    // 否則，前進下一句
    advanceGame();
  }
}

// 推進遊戲劇情
function advanceGame() {
  const node = gameScript[currentRoute];
  if (!node) return;

  // 檢查是否是結局
  if (node.isEnd && dialogueIndex >= node.dialogues.length - 1) {
    alert("故事到這裡就結束了。感謝您的遊玩！");
    backToTitle();
    return;
  }

  // 判斷當前節點的對話是否全部播放完畢
  if (dialogueIndex >= node.dialogues.length - 1) {
    // 如果有分支選項，彈出分支選擇
    if (node.choices) {
      showChoices(node.choices);
    } 
    // 沒有選項但有下一節點，跳轉
    else if (node.next) {
      currentRoute = node.next;
      dialogueIndex = 0;
      renderDialogue();
    }
  } else {
    // 播放下一句
    dialogueIndex++;
    renderDialogue();
  }
}

// 渲染當前對話
function renderDialogue() {
  const node = gameScript[currentRoute];
  if (!node) return;

  // 設定頂部章節標題與背景
  elChapterTitle.innerText = node.title || "心跳的二重奏";
  if (node.background) {
    document.getElementById("game-container").style.backgroundImage = `url('${node.background}')`;
  }

  const dialogue = node.dialogues[dialogueIndex];
  if (!dialogue) return;

  // 1. 設定發言者名字
  elNameBox.innerText = dialogue.speaker;
  if (dialogue.speaker === "旁白") {
    elNameBox.style.display = "none";
    elDialogueText.classList.add("narrator-text");
  } else {
    elNameBox.style.display = "flex";
    elDialogueText.classList.remove("narrator-text");
  }

  // 2. 處理角色立繪
  updateStageSprites(dialogue);

  // 3. 歷史 Log 紀錄
  pushToHistoryLog(dialogue.speaker, dialogue.text);

  // 4. 文字打字機效果
  startTyping(dialogue.text);
}

// 啟動打字機效果
function startTyping(text) {
  // 清理先前的定時器
  if (typeTimer) clearInterval(typeTimer);
  
  isTyping = true;
  textToType = text;
  elDialogueText.innerText = "";
  
  let index = 0;
  const speed = skipMode ? 0 : 25; // Skip模式下速度最快，普通25ms

  if (speed === 0) {
    completeTyping();
    return;
  }

  typeTimer = setInterval(() => {
    elDialogueText.innerText += textToType.charAt(index);
    index++;
    if (index >= textToType.length) {
      completeTyping();
    }
  }, speed);
}

// 完成打字機文字顯示
function completeTyping() {
  if (typeTimer) clearInterval(typeTimer);
  elDialogueText.innerText = textToType;
  isTyping = false;

  // 若處於自動播放模式，排程下一步
  if (autoPlay && !skipMode) {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      // 確保沒有選項彈出時才推進
      if (elChoicesOverlay.style.display !== "flex") {
        advanceGame();
      }
    }, AUTO_DELAY);
  }
  
  // 若處於 Skip 模式，以最快速度直接跳下個對話
  if (skipMode) {
    if (skipTimer) clearTimeout(skipTimer);
    skipTimer = setTimeout(() => {
      if (elChoicesOverlay.style.display !== "flex") {
        advanceGame();
      }
    }, SKIP_DELAY);
  }
}

/* ==========================================================================
   三、立繪與表情控制系統 (無圖 Placeholder 完美過渡)
   ========================================================================== */

function setupSpriteImageListeners() {
  const checkImage = (img, parent) => {
    const placeholder = parent.querySelector(".placeholder-sprite");
    img.onload = () => {
      img.style.display = "block";
      if (placeholder) placeholder.style.display = "none";
    };
    img.onerror = () => {
      img.style.display = "none";
      if (placeholder) {
        placeholder.style.display = "flex";
        // 根據路徑動態替換 Placeholder 文字
        const parts = img.src.split('/');
        const filename = parts[parts.length - 1];
        placeholder.innerHTML = `角色立繪<br><span style="font-size:0.75rem;color:#ff7597;">${filename}</span><br>(待放入)`;
      }
    };
  };

  checkImage(elImgNijika, elCharNijika);
  checkImage(elImgKotone, elCharKotone);
}

// 根據劇本動態調整舞台上的立繪
function updateStageSprites(dialogue) {
  const speaker = dialogue.speaker;
  const expression = dialogue.expression;

  // 對話中含有驚訝、吃醋等動作時，觸發立繪震動動畫
  const shouldBounce = dialogue.text.includes("（大哭）") || 
                       dialogue.text.includes("（驚訝）") || 
                       dialogue.text.includes("（推開") ||
                       dialogue.text.includes("（猛地") ||
                       dialogue.text.includes("（撲進") ||
                       dialogue.text.includes("（推");

  // 1. 虹夏立繪處理
  if (speaker === "虹夏" || currentRoute.startsWith("nijika_") || currentRoute === "final_15" || currentRoute === "end_nijika") {
    elCharNijika.classList.add("active");
    if (speaker === "虹夏") {
      elCharNijika.style.filter = "brightness(1)";
      elCharNijika.style.transform = "scale(1.05)";
      if (shouldBounce) triggerSpriteBounce(elCharNijika);
      
      // 更新表情圖片 (虹夏女主全部固定使用 nijika_normal.png)
      elImgNijika.src = `assets/characters/nijika/nijika_normal.png`;
    } else {
      // 另一個人在說話，將虹夏稍微變暗/縮小以示聚焦
      elCharNijika.style.filter = "brightness(0.7)";
      elCharNijika.style.transform = "scale(1)";
    }
  } else {
    // 非虹夏線或沒有虹夏參與的對話，隱藏立繪
    elCharNijika.classList.remove("active");
  }

  // 2. 琴音立繪處理
  if (speaker === "琴音" || currentRoute.startsWith("kotone_") || currentRoute === "final_15" || currentRoute === "end_kotone") {
    elCharKotone.classList.add("active");
    if (speaker === "琴音") {
      elCharKotone.style.filter = "brightness(1)";
      elCharKotone.style.transform = "scale(1.05)";
      if (shouldBounce) triggerSpriteBounce(elCharKotone);

      // 更新表情圖片 (琴音全部固定使用 kotone_normal.png)
      elImgKotone.src = `assets/characters/kotone/kotone_normal.png`;
    } else {
      // 另一個人在說話，將琴音稍微變暗/縮小以示聚焦
      elCharKotone.style.filter = "brightness(0.7)";
      elCharKotone.style.transform = "scale(1)";
    }
  } else {
    elCharKotone.classList.remove("active");
  }

  // 特殊幕處理 (例如第 15 幕最終對質，兩人都在場且都亮起)
  if (currentRoute === "final_15") {
    elCharNijika.classList.add("active");
    elCharKotone.classList.add("active");
    // 發言者高亮，另一位略微變暗
    if (speaker === "虹夏") {
      elCharNijika.style.filter = "brightness(1)";
      elCharKotone.style.filter = "brightness(0.6)";
    } else if (speaker === "琴音") {
      elCharKotone.style.filter = "brightness(1)";
      elCharNijika.style.filter = "brightness(0.6)";
    } else {
      elCharNijika.style.filter = "brightness(0.85)";
      elCharKotone.style.filter = "brightness(0.85)";
    }
  }
}

// 觸發立繪震動
function triggerSpriteBounce(element) {
  element.classList.remove("bounce");
  void element.offsetWidth; // 觸發重繪 (CSS Reflow)
  element.classList.add("bounce");
}

/* ==========================================================================
   四、分支選項系統 (Branchless Choice)
   ========================================================================== */
function showChoices(choicesData) {
  // 顯示遮罩層
  elChoicesOverlay.style.display = "flex";
  elChoiceQuestion.innerText = choicesData.text;
  
  // 清除舊選項
  elChoicesList.innerHTML = "";

  // 暫停自動/跳過
  const wasAuto = autoPlay;
  const wasSkip = skipMode;
  stopAuto();
  stopSkip();

  // 動態添加按鈕
  choicesData.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.innerText = opt.text;
    btn.addEventListener("click", () => {
      // 關閉選項遮罩層
      elChoicesOverlay.style.display = "none";
      
      // 轉跳到對應分支，重設對話索引
      currentRoute = opt.target;
      dialogueIndex = 0;
      
      // 寫入選擇歷史至 Log
      pushToHistoryLog("選擇分支", `【選擇了：${opt.text}】`);

      // 渲染新劇情
      renderDialogue();

      // 恢復自動或跳過模式
      if (wasAuto) toggleAuto();
      if (wasSkip) toggleSkip();
    });
    elChoicesList.appendChild(btn);
  });
}

/* ==========================================================================
   五、AUTO / SKIP 控制面板
   ========================================================================== */
function toggleAuto() {
  if (autoPlay) {
    stopAuto();
  } else {
    stopSkip(); // 互斥
    autoPlay = true;
    document.getElementById("ctrl-auto").classList.add("active");
    // 如果此時文字已經打完，立刻排程前進
    if (!isTyping) {
      autoTimer = setTimeout(advanceGame, AUTO_DELAY);
    }
  }
}

function stopAuto() {
  autoPlay = false;
  document.getElementById("ctrl-auto").classList.remove("active");
  if (autoTimer) clearTimeout(autoTimer);
}

function toggleSkip() {
  if (skipMode) {
    stopSkip();
  } else {
    stopAuto(); // 互斥
    skipMode = true;
    document.getElementById("ctrl-skip").classList.add("active");
    // 立刻前進
    completeTyping();
  }
}

function stopSkip() {
  skipMode = false;
  document.getElementById("ctrl-skip").classList.remove("active");
  if (skipTimer) clearTimeout(skipTimer);
}

/* ==========================================================================
   六、歷史 Log 系統
   ========================================================================== */
function pushToHistoryLog(speaker, text) {
  historyLog.push({ speaker, text });
}

function openLog() {
  elLogOverlay.classList.add("active");
  elLogContent.innerHTML = "";

  // 渲染所有歷史紀錄
  historyLog.forEach(log => {
    const item = document.createElement("div");
    let speakerClass = "";
    if (log.speaker === "宇恩") speakerClass = "player";
    else if (log.speaker === "虹夏" || log.speaker === "琴音") speakerClass = "heroine";

    item.className = `log-bubble ${speakerClass}`;
    
    // 如果是玩家的選擇分支
    if (log.speaker === "選擇分支") {
      item.innerHTML = `<div class="log-text" style="color:var(--color-primary); font-weight:700;">${log.text}</div>`;
    } else {
      item.innerHTML = `
        <div class="log-speaker" style="color:${log.speaker === '宇恩' ? 'var(--color-accent)' : (log.speaker === '虹夏' ? 'var(--color-primary)' : 'var(--color-secondary)')}">${log.speaker}</div>
        <div class="log-text">${log.text}</div>
      `;
    }
    elLogContent.appendChild(item);
  });

  // 滾動到底部
  setTimeout(() => {
    elLogContent.scrollTop = elLogContent.scrollHeight;
  }, 50);
}

/* ==========================================================================
   七、存讀檔系統 (Save / Load)
   ========================================================================== */
function openSaveLoad(action) {
  saveloadAction = action;
  elSaveLoadOverlay.classList.add("active");
  
  if (action === "save") {
    elSaveLoadTitle.innerText = "儲存進度 (Save Game)";
  } else {
    elSaveLoadTitle.innerText = "讀取進度 (Load Game)";
  }

  // 刷新所有存檔槽的顯示資訊
  refreshSaveSlotsUI();
}

// 綁定存檔插槽
function setupSaveSlots() {
  const slotItems = document.querySelectorAll(".slot-item");
  slotItems.forEach(item => {
    const slotId = item.getAttribute("data-slot");
    const actionBtn = item.querySelector(".btn-slot-action");
    
    actionBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleSlotAction(slotId);
    });
  });
}

// 刷新存檔槽 UI
function refreshSaveSlotsUI() {
  const slotItems = document.querySelectorAll(".slot-item");
  slotItems.forEach(item => {
    const slotId = item.getAttribute("data-slot");
    const actionBtn = item.querySelector(".btn-slot-action");
    const chapterSpan = item.querySelector(".slot-chapter");
    const timeSpan = item.querySelector(".slot-time");
    
    // 自 localStorage 獲取存檔
    const saveData = localStorage.getItem(`heartbeat_duet_slot_${slotId}`);
    
    if (saveData) {
      const data = JSON.parse(saveData);
      const node = gameScript[data.currentRoute];
      chapterSpan.innerText = node ? node.title : "未知的章節";
      timeSpan.innerText = data.saveTime;
      actionBtn.innerText = saveloadAction === "save" ? "覆蓋存檔" : "載入進度";
      actionBtn.classList.remove("empty-slot");
    } else {
      chapterSpan.innerText = "空存檔";
      timeSpan.innerText = "-";
      actionBtn.innerText = saveloadAction === "save" ? "新存檔" : "無存檔";
      if (saveloadAction === "load") {
        actionBtn.innerText = "無存檔";
      }
    }
  });
}

// 處理存讀檔具體動作
function handleSlotAction(slotId) {
  if (saveloadAction === "save") {
    // 執行存檔
    const now = new Date();
    const timeString = `${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    
    const saveObj = {
      currentRoute: currentRoute,
      dialogueIndex: dialogueIndex,
      historyLog: historyLog,
      saveTime: timeString
    };
    
    localStorage.setItem(`heartbeat_duet_slot_${slotId}`, JSON.stringify(saveObj));
    alert(`存檔成功！已保存至槽位 ${slotId}`);
    refreshSaveSlotsUI();
  } else {
    // 執行讀檔
    const saveData = localStorage.getItem(`heartbeat_duet_slot_${slotId}`);
    if (!saveData) {
      alert("此插槽沒有存檔資料！");
      return;
    }
    
    if (confirm("載入此存檔會覆蓋當前遊戲進度，確定要繼續嗎？")) {
      const data = JSON.parse(saveData);
      currentRoute = data.currentRoute;
      dialogueIndex = data.dialogueIndex;
      historyLog = data.historyLog || [];
      
      // 關閉儲存卡，進入冒險畫面
      elSaveLoadOverlay.classList.remove("active");
      elTitleScreen.classList.remove("active");
      elAdventureScreen.classList.add("active");
      
      stopAuto();
      stopSkip();
      
      // 重新渲染當前節點對話
      renderDialogue();
      alert("讀檔成功！");
    }
  }
}
