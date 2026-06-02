const videoInput = document.getElementById("videoInput");
const videoPlayer = document.getElementById("videoPlayer");
const placeholder = document.getElementById("placeholder");
const videoTitle = document.getElementById("videoTitle");
const playButton = document.getElementById("playButton");
const playIcon = document.getElementById("playIcon");
const progressBar = document.getElementById("progressBar");
const timeDisplay = document.getElementById("timeDisplay");
const fullscreenButton = document.getElementById("fullscreenButton");
const voiceButton = document.getElementById("voiceButton");
const volumeWrapper = document.querySelector(".volume-wrapper");
const volumePanel = document.getElementById("volumePanel");
const volumeBar = document.getElementById("volumeBar");
const volumePercent = document.getElementById("volumePercent");
const cameraPreview = document.getElementById("cameraPreview");
const handLandmarkCanvas = document.getElementById("handLandmarkCanvas");
const cameraStatus = document.getElementById("cameraStatus");
const gestureStatus = document.getElementById("gestureStatus");
const gestureResult = document.getElementById("gestureResult");
const danmakuLayer = document.getElementById("danmakuLayer");
const danmakuToggleButton = document.getElementById("danmakuToggleButton");
const danmakuToggleIcon = document.getElementById("danmakuToggleIcon");
const danmakuSettingsIcon = document.getElementById("danmakuSettingsIcon");
const danmakuSettingsWrapper = document.querySelector(".danmaku-settings-wrapper");
const danmakuSettingsPanel = document.getElementById("danmakuSettingsPanel");
const danmakuAreaBar = document.getElementById("danmakuAreaBar");
const danmakuAreaValue = document.getElementById("danmakuAreaValue");
const danmakuOpacityBar = document.getElementById("danmakuOpacityBar");
const danmakuOpacityValue = document.getElementById("danmakuOpacityValue");
const danmakuFontSizeBar = document.getElementById("danmakuFontSizeBar");
const danmakuFontSizeValue = document.getElementById("danmakuFontSizeValue");
const danmakuSpeedBar = document.getElementById("danmakuSpeedBar");
const danmakuSpeedValue = document.getElementById("danmakuSpeedValue");
const danmakuForm = document.getElementById("danmakuForm");
const danmakuInput = document.getElementById("danmakuInput");
const danmakuSendButton = document.getElementById("danmakuSendButton");

const DANMAKU_API_URL = getDanmakuApiUrl();
const GESTURE_API_URL = getGestureApiUrl();
const GESTURE_TRIGGER_COOLDOWN = 2000;

let currentVideoUrl = null;
let selectedVideoFileName = "";
let isDanmakuEnabled = true;
let danmakuRecords = [];
let shownDanmakuIds = new Set();
let lastDanmakuCheckTime = 0;
let danmakuTracks = [];
let pendingUserDanmaku = [];
let gestureTimer = null;
let isGestureRequestRunning = false;
let lastGestureTriggerTime = 0;

/*
  更新视频标题文字。
  现在 Select Video 按钮和视频标题已经拆开了：
  - 左上角的小按钮只负责打开文件选择窗口。
  - 这里的 videoTitle 只负责显示文字。
  所以这个函数只改标题文本，不会影响选择按钮。
*/
function setVideoTitle(text) {
  videoTitle.textContent = text;
}

/*
  清空当前视频。
  当用户取消选择、选错文件、或者视频加载失败时，会调用这个函数。
  URL.revokeObjectURL 用来释放浏览器临时创建的视频地址，避免内存一直被占用。
*/
function clearVideo() {
  if (currentVideoUrl) {
    URL.revokeObjectURL(currentVideoUrl);
    currentVideoUrl = null;
  }

  videoPlayer.pause();
  videoPlayer.removeAttribute("src");
  videoPlayer.classList.remove("has-video");
  videoPlayer.load();
  placeholder.classList.remove("hidden");
  selectedVideoFileName = "";
  clearDanmakuPlaybackState();
  stopGestureRecognition();
  resetControls();
}

/*
  判断文件是不是视频。
  file.type 是浏览器告诉我们的文件类型。
  常见视频类型会以 "video/" 开头，例如 video/mp4、video/webm。
*/
function isVideoFile(file) {
  return file && file.type.startsWith("video/");
}

/*
  把秒数转换成人更容易看的时间格式。
  例如：
  65 秒会变成 01:05。
  3665 秒会变成 1:01:05。
*/
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "00:00";
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(remainingSeconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}

/*
  重置底部控制栏。
  没有视频时，播放按钮和进度条都应该不可用。
  这样用户不会误以为可以播放一个不存在的视频。
*/
function resetControls() {
  playIcon.src = "src/play.png";
  playButton.setAttribute("aria-label", "Play");
  playButton.disabled = true;
  progressBar.disabled = true;
  progressBar.value = 0;
  progressBar.style.setProperty("--progress-percent", "0%");
  updateVolumeDisplay();
  timeDisplay.textContent = "00:00 / 00:00";
  volumePanel.classList.add("hidden");
}

/*
  视频加载成功后启用控制栏。
  loadedmetadata 事件触发后，浏览器已经知道视频时长了，
  这时才能正确显示总时长，并允许用户拖动进度条。
*/
function enableControls() {
  playButton.disabled = false;
  progressBar.disabled = false;
  updateProgress();
}

/*
  根据当前播放状态修改播放按钮图片。
  如果视频暂停，按钮显示 play.png。
  如果视频正在播放，按钮显示 pause.png。
*/
function updatePlayButton() {
  if (videoPlayer.paused) {
    playIcon.src = "src/play.png";
    playButton.setAttribute("aria-label", "Play");
  } else {
    playIcon.src = "src/pause.png";
    playButton.setAttribute("aria-label", "Pause");
  }
}

function updateDanmakuAnimationState() {
  danmakuLayer.classList.toggle("paused", videoPlayer.paused);
}

/*
  同步进度条和当前时间。
  timeupdate 事件会在视频播放过程中不断触发，
  所以这里可以让进度条跟着视频播放位置移动。
*/
function updateProgress() {
  const current = formatTime(videoPlayer.currentTime);
  const duration = formatTime(videoPlayer.duration);
  timeDisplay.textContent = `${current} / ${duration}`;

  if (Number.isFinite(videoPlayer.duration) && videoPlayer.duration > 0) {
    const progressPercent = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    progressBar.value = progressPercent;
    progressBar.style.setProperty("--progress-percent", `${progressPercent}%`);
  }

  showScheduledDanmaku();
}

/*
  监听文件选择事件。
  当用户点击左上角 Select Video 并选中一个文件后，
  这里会拿到用户选中的文件，然后决定是否加载到 video 中。
*/
videoInput.addEventListener("change", () => {
  const selectedFile = videoInput.files[0];

  // 用户打开了文件窗口但没有选择任何文件时，恢复默认状态。
  if (!selectedFile) {
    clearVideo();
    setVideoTitle("Select Video");
    return;
  }

  // 如果用户选中的不是视频文件，就不要加载它，并在标题位置提示用户。
  if (!isVideoFile(selectedFile)) {
    clearVideo();
    setVideoTitle("Please select a video file");
    videoInput.value = "";
    return;
  }

  clearVideo();

  /*
    创建本地视频地址。
    这个地址只存在于当前浏览器页面里，不会把视频上传到任何服务器。
    videoPlayer.src 设置好以后，video 元素就知道要播放哪个文件了。
  */
  currentVideoUrl = URL.createObjectURL(selectedFile);
  selectedVideoFileName = selectedFile.name;
  videoPlayer.src = currentVideoUrl;
  videoPlayer.classList.add("has-video");
  placeholder.classList.add("hidden");
  const videoName = selectedFile.name.replace(/\.[^/.]+$/, "");
  setVideoTitle(videoName);
  loadDanmakuForVideo(selectedFile.name);

  videoPlayer.load();
});

/*
  点击底部 Play/Pause 按钮时，切换视频播放状态。
  如果当前是暂停，就调用 play()。
  如果当前正在播放，就调用 pause()。
*/
playButton.addEventListener("click", () => {
  if (!videoPlayer.src) {
    return;
  }

  if (videoPlayer.paused) {
    videoPlayer.play();
  } else {
    videoPlayer.pause();
  }
});

/*
  用户拖动进度条时，改变视频播放位置。
  进度条的值是 0 到 100，所以要换算成视频的真实秒数。
*/
progressBar.addEventListener("input", () => {
  if (!Number.isFinite(videoPlayer.duration) || videoPlayer.duration <= 0) {
    return;
  }

  const progressPercent = Number(progressBar.value);
  progressBar.style.setProperty("--progress-percent", `${progressPercent}%`);
  videoPlayer.currentTime = (progressPercent / 100) * videoPlayer.duration;
});

/*
  音量条控制 video.volume。
  volume 的范围是 0 到 1：
  0 表示静音，1 表示最大音量。
*/
volumeBar.addEventListener("input", () => {
  videoPlayer.volume = Number(volumeBar.value);
  updateVolumeDisplay();
});

/*
  点击全屏图标时，让整个播放器进入全屏。
  这里选择 player，而不是只选择 video，是因为这样控制栏也会一起进入全屏。
*/
fullscreenButton.addEventListener("click", () => {
  const player = document.querySelector(".player");

  if (!document.fullscreenElement) {
    player.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

/*
  鼠标移动到整个声音区域时，显示音量面板。
  这里监听的是 volume-wrapper，而不是只监听 voiceButton。
  原因是：voiceButton 和 volumePanel 应该被当作同一个交互区域。
*/
volumeWrapper.addEventListener("mouseenter", () => {
  volumePanel.classList.remove("hidden");
});

/*
  更新音量百分比和音量条颜色。
  volumeBar.value 的范围是 0 到 1，所以乘以 100 后就是百分比。
*/
function updateVolumeDisplay() {
  const percent = Math.round(Number(volumeBar.value) * 100);
  volumePercent.textContent = `${percent}%`;
  volumeBar.style.setProperty("--volume-percent", `${percent}%`);
}

function mapRange(value, inputMin, inputMax, outputMin, outputMax) {
  const ratio = (value - inputMin) / (inputMax - inputMin);
  return outputMin + ratio * (outputMax - outputMin);
}

function getDanmakuCssNumber(name, fallback) {
  const value = Number.parseFloat(getComputedStyle(danmakuLayer).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

function updateSettingBarDisplay(bar, valueElement) {
  const percent = Math.round(Number(bar.value));
  valueElement.textContent = `${percent}%`;
  bar.style.setProperty("--setting-percent", `${percent}%`);
}

function getPercentFromRange(value, outputMin, outputMax) {
  if (outputMax === outputMin) {
    return 0;
  }

  return ((value - outputMin) / (outputMax - outputMin)) * 100;
}

function initializeDanmakuSettingsFromCss() {
  const opacity = getDanmakuCssNumber("--danmaku-opacity", 0.8);
  const displayArea = getDanmakuCssNumber("--danmaku-display-area", 25);
  const fontSize = getDanmakuCssNumber("--danmaku-font-size", 16);
  const fontSizeMin = getDanmakuCssNumber("--danmaku-font-size-min", 10);
  const fontSizeMax = getDanmakuCssNumber("--danmaku-font-size-max", 22);
  const speed = getDanmakuCssNumber("--danmaku-speed", 90);
  const speedMin = getDanmakuCssNumber("--danmaku-speed-min", 60);
  const speedMax = getDanmakuCssNumber("--danmaku-speed-max", 140);

  danmakuAreaBar.value = String(displayArea);
  danmakuOpacityBar.value = String(opacity * 100);
  danmakuFontSizeBar.value = String(getPercentFromRange(fontSize, fontSizeMin, fontSizeMax));
  danmakuSpeedBar.value = String(getPercentFromRange(speed, speedMin, speedMax));

  updateSettingBarDisplay(danmakuAreaBar, danmakuAreaValue);
  updateSettingBarDisplay(danmakuOpacityBar, danmakuOpacityValue);
  updateSettingBarDisplay(danmakuFontSizeBar, danmakuFontSizeValue);
  updateSettingBarDisplay(danmakuSpeedBar, danmakuSpeedValue);
}

function updateDanmakuSettings() {
  const fontSize = mapRange(
    Number(danmakuFontSizeBar.value),
    0,
    100,
    getDanmakuCssNumber("--danmaku-font-size-min", 10),
    getDanmakuCssNumber("--danmaku-font-size-max", 22)
  );

  const speed = mapRange(
    Number(danmakuSpeedBar.value),
    0,
    100,
    getDanmakuCssNumber("--danmaku-speed-min", 60),
    getDanmakuCssNumber("--danmaku-speed-max", 140)
  );

  danmakuLayer.style.setProperty("--danmaku-display-area", danmakuAreaBar.value);
  danmakuLayer.style.setProperty("--danmaku-opacity", String(Number(danmakuOpacityBar.value) / 100));
  danmakuLayer.style.setProperty("--danmaku-font-size", `${fontSize}px`);
  danmakuLayer.style.setProperty("--danmaku-speed", String(speed));

  updateSettingBarDisplay(danmakuAreaBar, danmakuAreaValue);
  updateSettingBarDisplay(danmakuOpacityBar, danmakuOpacityValue);
  updateSettingBarDisplay(danmakuFontSizeBar, danmakuFontSizeValue);
  updateSettingBarDisplay(danmakuSpeedBar, danmakuSpeedValue);
}

function updateDanmakuSendButton() {
  danmakuSendButton.disabled = !isDanmakuEnabled || danmakuInput.value.trim() === "";
}

function clearDanmakuTracks() {
  danmakuTracks = [];
}

function getDanmakuTrackCount(itemHeight) {
  const layerHeight = danmakuLayer.clientHeight;
  const trackGap = getDanmakuCssNumber("--danmaku-track-gap", 8);
  const displayArea = getDanmakuCssNumber("--danmaku-display-area", 25);
  const visibleHeight = layerHeight * (displayArea / 100);
  const trackHeight = itemHeight + trackGap;
  return Math.max(1, Math.floor((visibleHeight + trackGap) / trackHeight));
}

function isDanmakuTrackFree(trackIndex) {
  const track = danmakuTracks[trackIndex];

  if (!track || !track.element.isConnected) {
    return true;
  }

  const layerRect = danmakuLayer.getBoundingClientRect();
  const itemRect = track.element.getBoundingClientRect();
  return itemRect.right <= layerRect.right - getDanmakuCssNumber("--danmaku-entry-gap", 24);
}

function chooseDanmakuTrack(itemHeight) {
  const trackCount = getDanmakuTrackCount(itemHeight);

  for (let index = 0; index < trackCount; index += 1) {
    if (isDanmakuTrackFree(index)) {
      return index;
    }
  }

  return -1;
}

/*
  新增：发送弹幕。
  这个函数会读取输入框文字，去掉前后空格。
  如果输入为空，就直接返回，不创建弹幕。
  发送成功后，会清空输入框。
*/
function sendDanmaku() {
  if (!isDanmakuEnabled) {
    return;
  }

  const text = danmakuInput.value.trim();

  if (!text) {
    return;
  }

  sendParticipantDanmakuText(text);
  danmakuInput.value = "";
  updateDanmakuSendButton();
}

function sendParticipantDanmakuText(text) {
  if (!selectedVideoFileName || !text) {
    return;
  }

  const record = {
    text,
    time: Number(videoPlayer.currentTime.toFixed(2)) || 0,
  };

  saveParticipantDanmaku(record);

  if (isDanmakuEnabled) {
    pendingUserDanmaku.push(record);
    showPendingUserDanmaku();
  }
}

/*
  新增：创建单条弹幕。
  每条弹幕都是一个动态创建的 div。
  它会被放进 danmakuLayer，所以只会出现在视频区域内部。
*/
function createDanmakuItem(record, options = {}) {
  const item = document.createElement("div");
  item.className = "danmaku-item";
  item.textContent = record.text;

  if (options.isUser) {
    item.classList.add("danmaku-item-user");
  }

  danmakuLayer.appendChild(item);

  const itemHeight = item.offsetHeight || 26;
  const itemWidth = item.offsetWidth || 0;
  const layerWidth = danmakuLayer.clientWidth;
  const travelDistance = layerWidth + itemWidth;
  const speed = getDanmakuCssNumber("--danmaku-speed", 90);
  item.style.setProperty("--danmaku-exit-distance", `${layerWidth}px`);
  item.style.setProperty("--danmaku-duration", `${travelDistance / speed}s`);

  const trackIndex = chooseDanmakuTrack(itemHeight);

  if (trackIndex === -1) {
    item.remove();
    return false;
  }

  const top = getDanmakuCssNumber("--danmaku-top-offset", 0)
    + trackIndex * (itemHeight + getDanmakuCssNumber("--danmaku-track-gap", 8));
  item.style.top = `${top}px`;
  danmakuTracks[trackIndex] = { element: item };

  item.addEventListener("animationend", () => {
    if (danmakuTracks[trackIndex]?.element === item) {
      danmakuTracks[trackIndex] = null;
    }

    item.remove();
    showPendingUserDanmaku();
  });

  return true;
}

function showPendingUserDanmaku() {
  if (!isDanmakuEnabled || videoPlayer.paused) {
    return;
  }

  while (pendingUserDanmaku.length > 0) {
    const didShow = createDanmakuItem(pendingUserDanmaku[0], { isUser: true });

    if (!didShow) {
      return;
    }

    pendingUserDanmaku.shift();
  }
}

/*
  新增：生成随机数。
  弹幕的垂直位置和移动速度都需要一点随机性，
  这样多条弹幕不会完全叠在同一条线上。
*/
function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

/* 新增：生成弹幕 id。优先用 Chrome 的 crypto.randomUUID，不可用时使用时间戳兜底。 */
function createDanmakuId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `danmaku-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/*
  新增：保存参与者发送的实验弹幕数据。
  注意：这部分数据不再混入预置弹幕 danmakuRecords。
  它只会被发送到 Python 后端，由后端写入 experiment_data 文件夹。
*/
async function saveParticipantDanmaku(record) {
  if (!selectedVideoFileName) {
    return;
  }

  try {
    await fetch(DANMAKU_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoName: selectedVideoFileName,
        item: record,
      }),
    });
  } catch (error) {
    console.warn("Failed to save participant danmaku:", error);
  }
}

/*
  新增：根据视频文件名推导弹幕 JSON 文件名。
  例如：
  2012年伦敦奥运会羽毛球男单决赛 林丹VS李宗伟.mp4
  会对应：
  2012年伦敦奥运会羽毛球男单决赛 林丹VS李宗伟.danmaku.json
*/
function getDanmakuFileName(videoFileName) {
  return `${videoFileName.replace(/\.[^/.]+$/, "")}_danmaku.json`;
}

/*
  新增：决定实验数据 POST 到哪里。
  如果页面由 Python 后端通过 http://localhost:8000 打开，就使用相对路径 /api/danmaku。
  如果你仍然用 file:// 直接打开，就尝试发到 http://localhost:8000/api/danmaku。
*/
function getDanmakuApiUrl() {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return "/api/danmaku";
  }

  return "http://localhost:8000/api/danmaku";
}

function getGestureApiUrl() {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return "/api/gesture";
  }

  return "http://localhost:8000/api/gesture";
}

/*
  新增：按视频文件名加载弹幕。
  每个视频都会尝试加载自己的“视频名.danmaku.json”文件。
  如果这个文件不存在，则说明这个视频目前没有初始弹幕文件。
*/
async function loadDanmakuForVideo(videoFileName) {
  clearDanmakuPlaybackState();
  danmakuRecords = [];

  await loadDanmakuDataFile(videoFileName);
}

/*
  新增：加载当前视频对应的“视频名.danmaku.json”中的预置弹幕。
  如果 JSON 文件里写了 videoName，就必须和当前视频文件名一致才会使用。
*/
async function loadDanmakuDataFile(videoFileName) {
  const danmakuFileName = getDanmakuFileName(videoFileName);

  try {
    const response = await fetch(encodeURI(danmakuFileName), {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.videoName && data.videoName !== videoFileName) {
      return;
    }

    const fileItems = Array.isArray(data.items) ? data.items : [];
    mergeDanmakuRecords(fileItems);
  } catch (error) {
    console.warn(`Failed to load ${danmakuFileName}:`, error);
  }
}

/*
  新增：合并弹幕数据，避免同一个 id 的弹幕重复进入列表。
*/
function mergeDanmakuRecords(records) {
  const existingIds = new Set(danmakuRecords.map((record) => record.id));

  records.forEach((record) => {
    if (!record.id || existingIds.has(record.id)) {
      return;
    }

    danmakuRecords.push(record);
    existingIds.add(record.id);
  });

  danmakuRecords.sort((first, second) => first.time - second.time);
}

/*
  新增：按照视频时间显示弹幕。
  逻辑是：
  - 每次 timeupdate 时检查视频从上一次时间走到了哪里；
  - 只显示 time 落在这段时间里的弹幕；
  - shownDanmakuIds 用来避免同一条弹幕重复显示。
*/
function showScheduledDanmaku() {
  if (!isDanmakuEnabled || videoPlayer.paused) {
    lastDanmakuCheckTime = videoPlayer.currentTime;
    return;
  }

  const currentTime = videoPlayer.currentTime;

  if (currentTime < lastDanmakuCheckTime) {
    shownDanmakuIds.clear();
    danmakuLayer.replaceChildren();
    clearDanmakuTracks();
  }

  showPendingUserDanmaku();

  danmakuRecords.forEach((record) => {
    if (shownDanmakuIds.has(record.id)) {
      return;
    }

    if (record.time > lastDanmakuCheckTime && record.time <= currentTime) {
      createDanmakuItem(record);
      shownDanmakuIds.add(record.id);
    }
  });

  lastDanmakuCheckTime = currentTime;
}

/*
  新增：用户拖动进度条或跳转视频时，重置弹幕调度窗口。
  这样不会在跳转后把所有旧弹幕瞬间刷出来。
*/
function resetDanmakuSchedule() {
  shownDanmakuIds.clear();
  danmakuLayer.replaceChildren();
  clearDanmakuTracks();
  lastDanmakuCheckTime = videoPlayer.currentTime;
}

/* 新增：清空当前视频的弹幕播放状态，但不改变弹幕开关按钮本身。 */
function clearDanmakuPlaybackState() {
  shownDanmakuIds.clear();
  danmakuLayer.replaceChildren();
  clearDanmakuTracks();
  pendingUserDanmaku = [];
  lastDanmakuCheckTime = 0;
}

/*
  新增：更新弹幕开关相关 UI。
  弹幕开：
  - 显示 Danmaku open
  - 显示 Danmaku Settings1
  - 显示 Danmaku Style
  - 输入光标从 Style 图标右边开始
  弹幕关：
  - 显示 Danmaku close
  - 显示 Danmaku Settings2
  - 隐藏 Danmaku Style
  - 输入光标回到输入框最左侧
*/
function updateDanmakuControls() {
  if (isDanmakuEnabled) {
    danmakuToggleIcon.src = "src/Danmaku open.png";
    danmakuSettingsIcon.src = "src/Danmaku Settings1.png";
    danmakuToggleButton.setAttribute("aria-label", "Danmaku on");
    danmakuForm.classList.add("danmaku-on");
    danmakuForm.classList.remove("danmaku-off");
    danmakuInput.disabled = false;
    danmakuInput.placeholder = "Comment on this moment";
    danmakuLayer.classList.remove("hidden");
  } else {
    danmakuToggleIcon.src = "src/Danmaku close.png";
    danmakuSettingsIcon.src = "src/Danmaku Settings2.png";
    danmakuToggleButton.setAttribute("aria-label", "Danmaku off");
    danmakuForm.classList.add("danmaku-off");
    danmakuForm.classList.remove("danmaku-on");
    danmakuInput.value = "";
    danmakuInput.disabled = true;
    danmakuSendButton.disabled = true;
    danmakuInput.placeholder = "Danmaku Closed";
    danmakuLayer.classList.add("hidden");
    danmakuLayer.replaceChildren();
    clearDanmakuTracks();
    pendingUserDanmaku = [];
    shownDanmakuIds.clear();
  }

  updateDanmakuSendButton();
}

/*
  启动右侧摄像头预览。
  navigator.mediaDevices.getUserMedia 是浏览器提供的摄像头接口。
  { video: true, audio: false } 的意思是：
  - 只请求摄像头画面；
  - 不请求麦克风声音。
  浏览器会弹出权限提示，用户允许后才能看到摄像头画面。
*/
async function startCameraPreview() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent = "Camera API is not supported. Try opening this page through localhost or HTTPS.";
    return;
  }

  try {
    cameraStatus.textContent = "Requesting camera...";

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    cameraPreview.srcObject = stream;
    await cameraPreview.play();
    cameraStatus.classList.add("hidden");
    updateGestureRecognitionState();
  } catch (error) {
    console.error("Camera error:", error);
    cameraStatus.textContent = getCameraErrorMessage(error);
  }
}

function startGestureRecognition() {
  if (gestureTimer) {
    return;
  }

  gestureStatus.classList.remove("hidden");
  gestureTimer = window.setInterval(detectGestureFromCamera, 600);
}

function stopGestureRecognition() {
  if (gestureTimer) {
    window.clearInterval(gestureTimer);
    gestureTimer = null;
  }

  gestureStatus.classList.add("hidden");
  gestureResult.classList.add("hidden");
  clearHandLandmarks();
}

function shouldRecognizeGestures() {
  return Boolean(selectedVideoFileName)
    && !videoPlayer.paused
    && !videoPlayer.ended
    && cameraPreview.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}

function updateGestureRecognitionState() {
  if (shouldRecognizeGestures()) {
    startGestureRecognition();
    return;
  }

  stopGestureRecognition();
}

async function detectGestureFromCamera() {
  if (isGestureRequestRunning || !shouldRecognizeGestures()) {
    updateGestureRecognitionState();
    return;
  }

  isGestureRequestRunning = true;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;

    const context = canvas.getContext("2d");
    context.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);

    const response = await fetch(GESTURE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: canvas.toDataURL("image/jpeg", 0.7),
      }),
    });

    const result = await response.json();

    if (!shouldRecognizeGestures()) {
      stopGestureRecognition();
      return;
    }

    updateGestureResult(result);
    drawHandLandmarks(result.landmarks || [], result.connections || []);
    sendGestureDanmaku(result);
  } catch (error) {
    console.warn("Gesture recognition failed:", error);
    gestureResult.classList.add("hidden");
    clearHandLandmarks();
  } finally {
    isGestureRequestRunning = false;
  }
}

function sendGestureDanmaku(result) {
  if (!shouldRecognizeGestures()) {
    return;
  }

  if (!result.ok || !result.success || !result.gesture) {
    return;
  }

  const text = result.danmakuText;

  if (!text) {
    return;
  }

  const now = Date.now();

  if (now - lastGestureTriggerTime < GESTURE_TRIGGER_COOLDOWN) {
    return;
  }

  lastGestureTriggerTime = now;
  sendParticipantDanmakuText(text);
}

function updateGestureResult(result) {
  if (result.ok && result.success) {
    gestureResult.textContent = result.message || `成功发送弹幕：${result.danmakuText}`;
    gestureResult.classList.remove("hidden");
    return;
  }

  gestureResult.classList.add("hidden");
}

function drawHandLandmarks(landmarks, connections) {
  const rect = handLandmarkCanvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;

  handLandmarkCanvas.width = Math.round(rect.width * pixelRatio);
  handLandmarkCanvas.height = Math.round(rect.height * pixelRatio);

  const context = handLandmarkCanvas.getContext("2d");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);

  if (!landmarks.length) {
    return;
  }

  context.lineWidth = 2;
  context.strokeStyle = "#1E96FC";
  context.fillStyle = "#ffffff";

  connections.forEach(([startIndex, endIndex]) => {
    const start = landmarks[startIndex];
    const end = landmarks[endIndex];

    if (!start || !end) {
      return;
    }

    context.beginPath();
    context.moveTo(start.x * rect.width, start.y * rect.height);
    context.lineTo(end.x * rect.width, end.y * rect.height);
    context.stroke();
  });

  landmarks.forEach((landmark) => {
    context.beginPath();
    context.arc(landmark.x * rect.width, landmark.y * rect.height, 3.5, 0, Math.PI * 2);
    context.fill();
  });
}

function clearHandLandmarks() {
  const context = handLandmarkCanvas.getContext("2d");
  context.clearRect(0, 0, handLandmarkCanvas.width, handLandmarkCanvas.height);
}

/*
  把 Chrome 返回的摄像头错误翻译成更具体的提示。
  之前所有错误都显示同一句话，所以即使用户允许了权限，
  也无法知道是不是摄像头被占用、没有设备、或页面打开方式不支持。
*/
function getCameraErrorMessage(error) {
  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return "Camera blocked by browser permission or page security settings.";
  }

  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return "No camera device was found.";
  }

  if (error.name === "NotReadableError" || error.name === "TrackStartError") {
    return "Camera is already in use by another app or cannot be started.";
  }

  if (error.name === "OverconstrainedError" || error.name === "ConstraintNotSatisfiedError") {
    return "Camera does not support the requested size.";
  }

  if (error.name === "AbortError") {
    return "Camera start was interrupted. Please refresh and try again.";
  }

  return `Camera error: ${error.name || "UnknownError"}`;
}

/*
  鼠标离开整个声音区域后，立刻隐藏音量面板。
  这样可以修复一个 bug：
  如果用户只经过 voice 按钮但没有进入 panel，也会在离开声音区域时正确隐藏。
*/
volumeWrapper.addEventListener("mouseleave", () => {
  volumePanel.classList.add("hidden");
});

danmakuSettingsWrapper.addEventListener("mouseenter", () => {
  danmakuSettingsPanel.classList.remove("hidden");
});

danmakuSettingsWrapper.addEventListener("mouseleave", () => {
  danmakuSettingsPanel.classList.add("hidden");
});

[danmakuAreaBar, danmakuOpacityBar, danmakuFontSizeBar, danmakuSpeedBar].forEach((bar) => {
  bar.addEventListener("input", updateDanmakuSettings);
});

window.addEventListener("resize", updateDanmakuSettings);

// 新增：点击弹幕开关按钮时，切换是否显示弹幕。
danmakuToggleButton.addEventListener("click", () => {
  isDanmakuEnabled = !isDanmakuEnabled;
  updateDanmakuControls();
});

// 新增：在弹幕输入框里按 Enter 也可以发送弹幕。
danmakuInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendDanmaku();
  }
});

danmakuInput.addEventListener("input", updateDanmakuSendButton);

// 元数据加载完成后，启用控制栏并显示视频总时长。
videoPlayer.addEventListener("loadedmetadata", enableControls);

// 播放过程中持续同步进度条和当前时间。
videoPlayer.addEventListener("timeupdate", updateProgress);

// 这些事件负责让播放按钮文字保持正确。
videoPlayer.addEventListener("play", updatePlayButton);
videoPlayer.addEventListener("pause", updatePlayButton);
videoPlayer.addEventListener("ended", updatePlayButton);
videoPlayer.addEventListener("seeked", resetDanmakuSchedule);
videoPlayer.addEventListener("play", updateDanmakuAnimationState);
videoPlayer.addEventListener("play", showPendingUserDanmaku);
videoPlayer.addEventListener("pause", updateDanmakuAnimationState);
videoPlayer.addEventListener("ended", updateDanmakuAnimationState);
videoPlayer.addEventListener("play", updateGestureRecognitionState);
videoPlayer.addEventListener("pause", updateGestureRecognitionState);
videoPlayer.addEventListener("ended", updateGestureRecognitionState);

// 点击 Send 按钮时，发送输入框里的弹幕。
danmakuSendButton.addEventListener("click", sendDanmaku);

/*
  有些文件虽然是视频文件，但浏览器不一定支持它的编码。
  如果加载失败，就清空播放器，并在标题位置显示失败提示。
*/
videoPlayer.addEventListener("error", () => {
  clearVideo();
  setVideoTitle("Video cannot be loaded");
});

// 页面刚打开时没有视频，所以先把控制栏设置为不可用状态。
resetControls();
updateDanmakuControls();
initializeDanmakuSettingsFromCss();
updateDanmakuAnimationState();

// 页面打开后立即尝试启动右侧摄像头预览。
startCameraPreview();
