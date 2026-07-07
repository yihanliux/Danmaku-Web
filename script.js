/*
  前端主控制脚本。

  这个文件只负责浏览器端交互：
  - 加载用户选择的本地视频；
  - 根据视频文件名加载预置弹幕 JSON；
  - 播放、暂停、进度、音量、全屏等播放器控制；
  - 展示并保存参与者通过输入框或手势发送的弹幕；
  - 从摄像头抽帧，请求后端手势识别接口，并根据识别结果发送弹幕。

  命名约定：
  - 视频文件名保持用户选择时的完整文件名，例如 example.mp4；
  - 预置弹幕文件名为“视频文件名去掉扩展名 + _danmaku.json”；
  - 参与者弹幕由后端保存为“视频文件名去掉扩展名 + _participant_danmaku.jsonl”。
*/

const videoInput = document.getElementById("videoInput");
const videoPlayer = document.getElementById("videoPlayer");
const placeholder = document.getElementById("placeholder");
const videoTitle = document.getElementById("videoTitle");
const playButton = document.getElementById("playButton");
const playIcon = document.getElementById("playIcon");
const progressBar = document.getElementById("progressBar");
const timeDisplay = document.getElementById("timeDisplay");
const fullscreenButton = document.getElementById("fullscreenButton");
const volumeWrapper = document.querySelector(".volume-wrapper");
const volumePanel = document.getElementById("volumePanel");
const volumeBar = document.getElementById("volumeBar");
const volumePercent = document.getElementById("volumePercent");
const conditionButtons = Array.from(document.querySelectorAll(".condition-button"));
const cameraPreview = document.getElementById("cameraPreview");
const handLandmarkCanvas = document.getElementById("handLandmarkCanvas");
const cameraStatus = document.getElementById("cameraStatus");
const gestureStatus = document.getElementById("gestureStatus");
const gestureResult = document.getElementById("gestureResult");
const gestureDebugOverlay = document.getElementById("gestureDebugOverlay");
const gestureDebug = document.getElementById("gestureDebug");
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
const danmakuSendDefaultText = danmakuSendButton.querySelector(".typing-send-default");
const danmakuSendHoverText = danmakuSendButton.querySelector(".typing-send-hover-content span");
const shortcutsButtons = document.querySelector(".shortcuts-buttons");
const shortcutsPanel = document.querySelector(".shortcuts-panel");
const gesturePanel = document.querySelector(".gesture-panel");
const gestureContent = document.querySelector(".gesture-content");
const shortcutTitle = document.querySelector(".shortcuts-title");
const shortcutSetupHint = document.getElementById("shortcutSetupHint");
const gestureTitle = document.getElementById("gestureTitle");
const gestureSetupHint = document.getElementById("gestureSetupHint");
const shortcutConfirmButton = document.getElementById("shortcutConfirmButton");
const gestureConfirmButton = document.getElementById("gestureConfirmButton");
const shortcutLanguageButton = document.getElementById("shortcutLanguageButton");
const shortcutLanguageText = document.getElementById("shortcutLanguageText");
const shortcutDialog = document.getElementById("shortcutDialog");
const shortcutDialogForm = document.getElementById("shortcutDialogForm");
const shortcutDialogTitle = document.getElementById("shortcutDialogTitle");
const shortcutDialogInput = document.getElementById("shortcutDialogInput");
const shortcutDialogError = document.getElementById("shortcutDialogError");
const shortcutDialogCancel = document.getElementById("shortcutDialogCancel");

const DANMAKU_API_URL = getDanmakuApiUrl();
const GESTURE_API_URL = getGestureApiUrl();

const EXPERIMENT_CONDITIONS = [
  {
    id: "baseline",
  },
  {
    id: "on-device",
  },
  {
    id: "gesture-triggered",
  },
];

const SHORTCUT_GROUP_SEND_ICONS = {
  P: "src/Send_P.png",
  N: "src/Send_N.png",
  I: "src/Send_I.png",
};

const PLAYER_I18N = {
  zh: {
    danmakuInputPlaceholder: "发个友善的弹幕见证当下",
    danmakuSend: "发送",
  },
  en: {
    danmakuInputPlaceholder: "Comment on this moment",
    danmakuSend: "Send",
  },
};

const MAX_SELECTED_SHORTCUTS = 6;
const CLICK_SHORTCUT_COOLDOWN_SECONDS = 10;

const SHORTCUT_CONTEXTS = {
  得分: {
    en: "Point Scored",
    deleteAria: {
      zh: "删除得分情境",
      en: "Delete the Point Scored context",
    },
    customAria: {
      zh: "自定义得分弹幕",
      en: "Customize Danmaku for a Point Scored",
    },
  },
  失分: {
    en: "Point Lost",
    deleteAria: {
      zh: "删除失分情境",
      en: "Delete the Point Lost context",
    },
    customAria: {
      zh: "自定义失分弹幕",
      en: "Customize Danmaku for a Point Lost",
    },
  },
  嘲讽: {
    en: "Opponent Error",
    deleteAria: {
      zh: "删除嘲讽情境",
      en: "Delete the Opponent Error context",
    },
    customAria: {
      zh: "自定义嘲讽弹幕",
      en: "Customize Danmaku for an Opponent Error",
    },
  },
  质疑: {
    en: "Questionable Call",
    deleteAria: {
      zh: "删除质疑情境",
      en: "Delete the Questionable Call context",
    },
    customAria: {
      zh: "自定义质疑弹幕",
      en: "Customize Danmaku for a Questionable Call",
    },
  },
  等待: {
    en: "Waiting for Outcome",
    deleteAria: {
      zh: "删除等待情境",
      en: "Delete the Waiting for Outcome context",
    },
    customAria: {
      zh: "自定义等待弹幕",
      en: "Customize Danmaku While Waiting for the Outcome",
    },
  },
  疑惑: {
    en: "Confusing Moment",
    deleteAria: {
      zh: "删除疑惑情境",
      en: "Delete the Confusing Moment context",
    },
    customAria: {
      zh: "自定义疑惑弹幕",
      en: "Customize Danmaku for a Confusing Moment",
    },
  },
};

const SHORTCUT_DANMAKU_TRANSLATIONS = {
  精彩: "Nice shot!",
  牛逼: "Amazing!",
  太棒了: "Let’s go!",
  可惜了: "So close!",
  稳住: "You've got this!",
  问题不大: "It’s okay",
  差一点: "Unlucky",
  "就这？": "Bruh...",
  拉完了: "Booooo!",
  幽默: "Is that it?",
  "啊？": "Huh?",
  裁判拉完了: "No way!!!",
  离谱: "Rigged!",
  紧张: "I’m so nervous",
  窒息了: "I can’t breathe",
  加油: "Praying for you!",
  求求了: "BELIEVE!",
  什么情况: "What happened?",
  没看清: "Missed it",
  "?": "?",
};

const SHORTCUT_I18N = {
  zh: {
    languageLabel: "中文-简体",
    languageAria: "切换语言",
    setupTitle: "快捷弹幕设置",
    sendTitle: "弹幕一键发送",
    setupHint: "请选择最多 6 条偏好的弹幕，或自定义弹幕作为快捷弹幕。确认后即可一键发送。",
    sendHint: "视频已可播放。点击下方快捷弹幕，即可一键发送对应弹幕。",
    custom: "自定义",
    confirm: "确认",
    dialogDefaultTitle: "添加弹幕",
    dialogPlaceholder: "请输入新的弹幕",
    dialogCancel: "取消",
    dialogSubmit: "添加",
    emptyError: "请输入弹幕内容",
  },
  en: {
    languageLabel: "English",
    languageAria: "Switch language",
    setupTitle: "Quick Danmaku Setup",
    sendTitle: "One-click Danmaku",
    setupHint: "Select up to 6 favorite danmaku comments, or create your own quick danmaku comment. Confirm to enable one-click sending.",
    sendHint: "The video is ready to play. Click a quick danmaku comment below to send it instantly.",
    custom: "Custom",
    confirm: "Confirm",
    dialogDefaultTitle: "Add a Danmaku Comment",
    dialogPlaceholder: "Enter a new danmaku comment",
    dialogCancel: "Cancel",
    dialogSubmit: "Add",
    emptyError: "Please enter a danmaku comment",
  },
};

/*
  页面运行状态。
  danmakuRecords 保存预置弹幕；pendingUserDanmaku 保存刚发送但还在等待轨道显示的用户弹幕。
  手势相关变量用于避免并发请求、记录持续保持动作的时间，并控制同一动作的冷却间隔。
*/
let currentVideoUrl = null;
let selectedVideoFileName = "";
let isDanmakuEnabled = true;
let danmakuRecords = [];
let shownDanmakuIds = new Set();
let lastDanmakuCheckTime = 0;
let danmakuTracks = [];
let pendingUserDanmaku = [];
let currentConditionIndex = 0;
let currentCondition = EXPERIMENT_CONDITIONS[currentConditionIndex].id;
let cameraStream = null;
let gestureTimer = null;
let shortcutAddButton = null;
let isShortcutSetupMode = true;
let isGestureSetupMode = true;
let currentShortcutLanguage = "zh";
let isGestureRequestRunning = false;
let currentHeldGesture = null;
let currentHeldGestureStartedAt = 0;
let currentDetectedGesture = null;
let currentDetectedGestureStartedAt = 0;
const selectedGestureDanmakuByGesture = new Map();
const lastShortcutTriggerTimes = new Map();
const shortcutCooldownTimers = new Map();
const lastGestureTriggerTimes = new Map();
const gestureCooldownTimers = new Map();

function hideCameraStatusIfPreviewHasFrame() {
  if (!cameraPreview.srcObject || cameraPreview.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return false;
  }

  cameraStatus.classList.add("hidden");
  updateGestureRecognitionState();
  return true;
}

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

function isGestureTriggeredCondition() {
  return currentCondition === "gesture-triggered";
}

function isOnDeviceShortcutCondition() {
  return currentCondition === "on-device";
}

function updateConditionUi() {
  const condition = EXPERIMENT_CONDITIONS[currentConditionIndex];
  currentCondition = condition.id;
  document.body.dataset.condition = condition.id;
  conditionButtons.forEach((button) => {
    const isActive = button.dataset.conditionId === condition.id;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function applyExperimentCondition() {
  updateConditionUi();

  isDanmakuEnabled = true;

  updateDanmakuControls();
  updatePlaybackAvailability();

  if (!canStartVideoPlayback() && !videoPlayer.paused) {
    videoPlayer.pause();
  }

  if (isGestureTriggeredCondition()) {
    startCameraPreview();
    return;
  }

  stopGestureRecognition();
  stopCameraPreview();
}

function setExperimentCondition(conditionId) {
  const nextIndex = EXPERIMENT_CONDITIONS.findIndex((condition) => condition.id === conditionId);

  if (nextIndex === -1 || nextIndex === currentConditionIndex) {
    return;
  }

  currentConditionIndex = nextIndex;
  applyExperimentCondition();
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

function hasSelectedVideo() {
  return Boolean(videoPlayer.currentSrc || videoPlayer.src);
}

function canStartVideoPlayback() {
  return hasSelectedVideo()
    && (!isOnDeviceShortcutCondition() || !isShortcutSetupMode)
    && (!isGestureTriggeredCondition() || !isGestureSetupMode);
}

function updatePlaybackAvailability() {
  const canUsePlaybackControls = canStartVideoPlayback();
  playButton.disabled = !canUsePlaybackControls;
  progressBar.disabled = !canUsePlaybackControls;
}

/*
  视频加载成功后启用控制栏。
  loadedmetadata 事件触发后，浏览器已经知道视频时长了，
  这时才能正确显示总时长，并允许用户拖动进度条。
*/
function enableControls() {
  updatePlaybackAvailability();
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

/*
  同步弹幕动画状态。
  视频暂停时只暂停 CSS 动画，不删除已经显示在屏幕上的弹幕；
  视频继续播放时，弹幕会从暂停位置继续飞行。
*/
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
  if (!canStartVideoPlayback()) {
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

/*
  把一个数值从输入区间线性映射到输出区间。
  弹幕字体大小和速度滑块都是 0-100 的百分比，实际 CSS 值需要通过这个函数换算。
*/
function mapRange(value, inputMin, inputMax, outputMin, outputMax) {
  const ratio = (value - inputMin) / (inputMax - inputMin);
  return outputMin + ratio * (outputMax - outputMin);
}

/*
  从弹幕层 CSS 变量中读取数字。
  CSS 变量是弹幕设置的默认值来源；如果读取失败，就使用 fallback 保证控件仍可工作。
*/
function getDanmakuCssNumber(name, fallback) {
  const value = Number.parseFloat(getComputedStyle(danmakuLayer).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

/*
  更新设置滑块右侧显示值，以及滑块轨道上的蓝色进度比例。
  四个弹幕设置滑块复用这一个展示逻辑。
*/
function updateSettingBarDisplay(bar, valueElement) {
  const percent = Math.round(Number(bar.value));
  valueElement.textContent = `${percent}%`;
  bar.style.setProperty("--setting-percent", `${percent}%`);
}

/*
  把实际 CSS 值反算成 0-100 的滑块百分比。
  页面初始化时用它让滑块位置和当前 CSS 默认值保持一致。
*/
function getPercentFromRange(value, outputMin, outputMax) {
  if (outputMax === outputMin) {
    return 0;
  }

  return ((value - outputMin) / (outputMax - outputMin)) * 100;
}

/*
  从 CSS 变量初始化弹幕设置面板。
  这样默认样式只需要维护在 CSS 中，JavaScript 控件打开时会自动同步到对应位置。
*/
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

/*
  根据设置面板当前值更新弹幕显示效果。
  display-area 和 opacity 可以直接写入；font-size 和 speed 需要从百分比映射到 CSS 的实际范围。
*/
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

/*
  根据弹幕开关状态和输入框内容决定 Send 按钮是否可用。
  只要输入内容非空，就允许用户手动发送；弹幕开关只控制屏幕上是否显示弹幕。
*/
function updateDanmakuSendButton() {
  danmakuSendButton.disabled = danmakuInput.value.trim() === "";
}

/*
  清空轨道占用记录。
  轨道记录只用于当前屏幕上的弹幕排布，切换视频、跳转进度或关闭弹幕时都需要重置。
*/
function clearDanmakuTracks() {
  danmakuTracks = [];
}

/*
  根据弹幕层高度和“显示区域”设置计算可用轨道数量。
  显示区域越小，可放置的弹幕行数越少，弹幕越容易排队等待。
*/
function getDanmakuTrackCount(itemHeight) {
  const layerHeight = danmakuLayer.clientHeight;
  const trackGap = getDanmakuCssNumber("--danmaku-track-gap", 8);
  const displayArea = getDanmakuCssNumber("--danmaku-display-area", 25);
  const visibleHeight = layerHeight * (displayArea / 100);
  const trackHeight = itemHeight + trackGap;
  return Math.max(1, Math.floor((visibleHeight + trackGap) / trackHeight));
}

/*
  判断指定轨道是否已经空出入口。
  只有上一条弹幕的右侧离开入口安全距离后，新弹幕才可以进入同一轨道，避免开头重叠。
*/
function isDanmakuTrackFree(trackIndex) {
  const track = danmakuTracks[trackIndex];

  if (!track || !track.element.isConnected) {
    return true;
  }

  const layerRect = danmakuLayer.getBoundingClientRect();
  const itemRect = track.element.getBoundingClientRect();
  return itemRect.right <= layerRect.right - getDanmakuCssNumber("--danmaku-entry-gap", 24);
}

/*
  为即将显示的弹幕选择第一条可用轨道。
  如果所有轨道都被占用，返回 -1，让调用方决定是否延后显示或丢弃本次展示。
*/
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
  发送输入框中的手动弹幕。
  这个函数会读取输入框文字，去掉前后空格。
  如果输入为空，就直接返回，不创建弹幕。
  发送成功后会清空输入框，并重新计算 Send 按钮状态。
*/
function sendDanmaku() {
  const text = danmakuInput.value.trim();

  if (!text) {
    return;
  }

  sendParticipantDanmakuText(text, "type");
  danmakuInput.value = "";
  updateDanmakuSendButton();
}

/*
  统一发送参与者弹幕。
  手动输入和手势识别都会走这里，从而保证保存格式、出现时间和前端即时展示逻辑一致。
*/
function sendParticipantDanmakuText(text, sendMethod = "type") {
  if (!selectedVideoFileName || !text) {
    return false;
  }

  const record = {
    text,
    time: Number(videoPlayer.currentTime.toFixed(2)) || 0,
    sendMethod,
  };

  saveParticipantDanmaku(record);

  if (isDanmakuEnabled) {
    pendingUserDanmaku.push(record);
    showPendingUserDanmaku();
  }

  return true;
}

function sendShortcutDanmaku(event) {
  const button = event.currentTarget;
  const text = getDanmakuButtonText(button);

  if (!canSendShortcutDanmaku(text)) {
    showShortcutCooldown(text, getShortcutCooldownRemainingMilliseconds(text));
    return;
  }

  const wasSent = sendParticipantDanmakuText(text, "shortcut");

  if (!wasSent) {
    return;
  }

  lastShortcutTriggerTimes.set(text, Date.now());
  showShortcutCooldown(text, secondsToMilliseconds(CLICK_SHORTCUT_COOLDOWN_SECONDS));
}

function getShortcutCooldownRemainingMilliseconds(text) {
  const cooldownMilliseconds = secondsToMilliseconds(CLICK_SHORTCUT_COOLDOWN_SECONDS);
  const lastTriggerTime = lastShortcutTriggerTimes.get(text) || 0;
  return cooldownMilliseconds - (Date.now() - lastTriggerTime);
}

function canSendShortcutDanmaku(text) {
  return Boolean(text) && getShortcutCooldownRemainingMilliseconds(text) <= 0;
}

function showShortcutCooldown(text, milliseconds) {
  const duration = Number(milliseconds);

  if (!text || !Number.isFinite(duration) || duration <= 0) {
    return;
  }

  const buttons = Array.from(shortcutsButtons.querySelectorAll(".shortcut-button"))
    .filter((shortcutButton) => getDanmakuButtonText(shortcutButton) === text);
  const coolingTargets = new Set();

  buttons.forEach((shortcutButton) => {
    const row = shortcutButton.closest(".shortcut-context-row");
    const rowShortcutCount = row?.querySelectorAll(".shortcut-button").length || 0;
    coolingTargets.add(row && rowShortcutCount === 1 ? row : shortcutButton);
  });

  coolingTargets.forEach((target) => {
    target.classList.add("is-shortcut-cooling");
  });

  const previousTimer = shortcutCooldownTimers.get(text);

  if (previousTimer) {
    window.clearTimeout(previousTimer);
  }

  const timer = window.setTimeout(() => {
    coolingTargets.forEach((target) => {
      target.classList.remove("is-shortcut-cooling");
    });
    shortcutCooldownTimers.delete(text);
  }, duration);

  shortcutCooldownTimers.set(text, timer);
}

function getDanmakuButtonText(button) {
  return button?.dataset.danmakuText
    || button?.querySelector(".shortcut-default-text")?.textContent.trim()
    || button?.textContent.trim()
    || "";
}

function getShortcutRows() {
  return Array.from(shortcutsButtons.querySelectorAll(".shortcut-context-row"));
}

function getShortcutLocale() {
  return SHORTCUT_I18N[currentShortcutLanguage];
}

function getShortcutButtonOriginalText(button) {
  if (!button.dataset.shortcutOriginalText) {
    button.dataset.shortcutOriginalText = button.dataset.danmakuText || button.textContent.trim();
  }

  return button.dataset.shortcutOriginalText;
}

function updateShortcutButtonText(button, text) {
  button.dataset.danmakuText = text;
  button.querySelectorAll(".shortcut-default-text").forEach((element) => {
    element.textContent = text;
  });
  button.querySelectorAll(".shortcut-hover-content span").forEach((element) => {
    element.textContent = text;
  });
}

function getShortcutDialogTitle(addButton) {
  if (addButton) {
    return addButton.getAttribute("aria-label") || getShortcutLocale().dialogDefaultTitle;
  }

  return getShortcutLocale().dialogDefaultTitle;
}

function applyPlayerLanguage() {
  const locale = PLAYER_I18N[currentShortcutLanguage] || PLAYER_I18N.en;
  danmakuInput.placeholder = locale.danmakuInputPlaceholder;
  danmakuSendDefaultText.textContent = locale.danmakuSend;
  danmakuSendHoverText.textContent = locale.danmakuSend;
}

function applyShortcutLanguage() {
  const locale = getShortcutLocale();
  applyPlayerLanguage();
  shortcutLanguageText.textContent = locale.languageLabel;
  shortcutLanguageButton.setAttribute("aria-label", locale.languageAria);
  shortcutConfirmButton.textContent = locale.confirm;
  shortcutDialogTitle.textContent = getShortcutDialogTitle(shortcutAddButton);
  shortcutDialogInput.placeholder = locale.dialogPlaceholder;
  shortcutDialogCancel.textContent = locale.dialogCancel;
  document.querySelector(".shortcut-dialog-confirm").textContent = locale.dialogSubmit;

  getShortcutRows().forEach((row) => {
    const label = row.querySelector(".shortcut-context-label");
    const contextKey = label?.dataset.shortcutContext || label?.textContent.trim();
    const context = SHORTCUT_CONTEXTS[contextKey];

    if (label && context) {
      label.dataset.shortcutContext = contextKey;
      const icon = label.querySelector(".shortcut-context-icon");
      label.textContent = "";

      if (icon) {
        label.append(icon);
      }

      label.append(currentShortcutLanguage === "zh" ? contextKey : context.en);
      row.querySelector(".shortcut-card-delete-button")?.setAttribute(
        "aria-label",
        context.deleteAria[currentShortcutLanguage],
      );
      row.querySelector(".shortcut-add-button")?.setAttribute(
        "aria-label",
        context.customAria[currentShortcutLanguage],
      );
    }
  });

  shortcutsButtons.querySelectorAll(".shortcut-add-button span").forEach((element) => {
    element.textContent = locale.custom;
  });

  gestureContent?.querySelectorAll(".gesture-custom-button span").forEach((element) => {
    element.textContent = locale.custom;
  });

  shortcutsButtons.querySelectorAll(".shortcut-button").forEach((button) => {
    if (button.dataset.shortcutCustom === "true") {
      return;
    }

    const originalText = getShortcutButtonOriginalText(button);
    updateShortcutButtonText(
      button,
      currentShortcutLanguage === "zh"
        ? originalText
        : SHORTCUT_DANMAKU_TRANSLATIONS[originalText] || originalText,
    );
  });

  gestureContent?.querySelectorAll(".gesture-danmaku-button").forEach((button) => {
    if (button.dataset.shortcutCustom === "true") {
      return;
    }

    const originalText = getShortcutButtonOriginalText(button);
    updateShortcutButtonText(
      button,
      currentShortcutLanguage === "zh"
        ? originalText
        : SHORTCUT_DANMAKU_TRANSLATIONS[originalText] || originalText,
    );
  });

  updateShortcutSetupUi();
  updateGestureSetupUi();
}

function toggleShortcutLanguage() {
  currentShortcutLanguage = currentShortcutLanguage === "zh" ? "en" : "zh";
  applyShortcutLanguage();
}

function getSelectedShortcutCount() {
  return shortcutsButtons.querySelectorAll(".shortcut-button.is-shortcut-selected").length;
}

function updateShortcutSetupUi() {
  const locale = getShortcutLocale();
  shortcutsPanel.classList.toggle("is-shortcut-setup-mode", isShortcutSetupMode);
  shortcutsPanel.classList.toggle("is-shortcut-send-mode", !isShortcutSetupMode);
  shortcutTitle.textContent = isShortcutSetupMode ? locale.setupTitle : locale.sendTitle;
  shortcutSetupHint.textContent = isShortcutSetupMode ? locale.setupHint : locale.sendHint;
  shortcutSetupHint.classList.remove("hidden");
  shortcutConfirmButton.classList.toggle("hidden", !isShortcutSetupMode);

  if (!isShortcutSetupMode) {
    return;
  }

  const rows = getShortcutRows();
  const selectedCount = getSelectedShortcutCount();
  const isComplete = rows.length > 0 && selectedCount > 0 && selectedCount <= MAX_SELECTED_SHORTCUTS;
  shortcutConfirmButton.disabled = !isComplete;
}

function getGestureCards() {
  return Array.from(gestureContent?.querySelectorAll(".gesture-card") || []);
}

function getSelectedGestureCount() {
  return gestureContent?.querySelectorAll(".gesture-danmaku-button.is-shortcut-selected").length || 0;
}

function updateGestureSetupUi() {
  const locale = getShortcutLocale();
  gesturePanel?.classList.toggle("is-shortcut-setup-mode", isGestureSetupMode);
  gesturePanel?.classList.toggle("is-shortcut-send-mode", !isGestureSetupMode);

  if (gestureTitle) {
    gestureTitle.textContent = isGestureSetupMode ? locale.setupTitle : locale.sendTitle;
  }

  if (gestureSetupHint) {
    gestureSetupHint.textContent = isGestureSetupMode ? locale.setupHint : locale.sendHint;
    gestureSetupHint.classList.remove("hidden");
  }

  if (!gestureConfirmButton) {
    return;
  }

  gestureConfirmButton.textContent = locale.confirm;
  gestureConfirmButton.classList.toggle("hidden", !isGestureSetupMode);

  if (!isGestureSetupMode) {
    return;
  }

  const cards = getGestureCards();
  const selectedCount = getSelectedGestureCount();
  const isComplete = cards.length > 0 && selectedCount > 0 && selectedCount <= MAX_SELECTED_SHORTCUTS;
  gestureConfirmButton.disabled = !isComplete;
}

function selectShortcutButton(button) {
  if (!button) {
    return;
  }

  const isSelected = button.classList.contains("is-shortcut-selected");

  if (!isSelected && getSelectedShortcutCount() >= MAX_SELECTED_SHORTCUTS) {
    return;
  }

  button.classList.toggle("is-shortcut-selected", !isSelected);
  button.setAttribute("aria-pressed", String(!isSelected));

  updateShortcutSetupUi();
}

function selectGestureDanmakuButton(button) {
  if (!button || !isGestureSetupMode) {
    return;
  }

  const card = button.closest(".gesture-card");
  const isSelected = button.classList.contains("is-shortcut-selected");

  if (isSelected) {
    button.classList.remove("is-shortcut-selected");
    button.setAttribute("aria-pressed", "false");
    updateGestureSetupUi();
    return;
  }

  const selectedInCard = card?.querySelector(".gesture-danmaku-button.is-shortcut-selected");

  if (!selectedInCard && getSelectedGestureCount() >= MAX_SELECTED_SHORTCUTS) {
    return;
  }

  card?.querySelectorAll(".gesture-danmaku-button.is-shortcut-selected").forEach((selectedButton) => {
    selectedButton.classList.remove("is-shortcut-selected");
    selectedButton.setAttribute("aria-pressed", "false");
  });

  button.classList.add("is-shortcut-selected");
  button.setAttribute("aria-pressed", "true");
  updateGestureSetupUi();
}

function confirmShortcutSetup() {
  if (shortcutConfirmButton.disabled) {
    return;
  }

  getShortcutRows().forEach((row) => {
    const hasSelectedShortcut = Boolean(row.querySelector(".shortcut-button.is-shortcut-selected"));

    if (!hasSelectedShortcut) {
      row.remove();
      return;
    }

    row.querySelectorAll(".shortcut-button").forEach((button) => {
      if (!button.classList.contains("is-shortcut-selected")) {
        button.remove();
        return;
      }

      button.classList.remove("is-shortcut-selected");
      button.removeAttribute("aria-pressed");
    });

    row.querySelector(".shortcut-add-button")?.remove();
    row.querySelector(".shortcut-card-delete-button")?.remove();
  });

  isShortcutSetupMode = false;
  updateShortcutSetupUi();
  updatePlaybackAvailability();
}

function confirmGestureSetup() {
  if (!gestureConfirmButton || gestureConfirmButton.disabled) {
    return;
  }

  selectedGestureDanmakuByGesture.clear();

  getGestureCards().forEach((card) => {
    const selectedButton = card.querySelector(".gesture-danmaku-button.is-shortcut-selected");

    if (!selectedButton) {
      card.remove();
      return;
    }

    card.querySelectorAll(".gesture-danmaku-button").forEach((button) => {
      if (button !== selectedButton) {
        button.remove();
        return;
      }

      selectedGestureDanmakuByGesture.set(card.dataset.gesture, getDanmakuButtonText(button));
      button.classList.remove("is-shortcut-selected");
      button.removeAttribute("aria-pressed");
    });

    card.querySelector(".gesture-custom-button")?.remove();
  });

  isGestureSetupMode = false;
  updateGestureSetupUi();
  updatePlaybackAvailability();
}

function getShortcutGroupClassSuffix(group) {
  return String(group || "").toLowerCase();
}

function createShortcutButton(text, group = "P", options = {}) {
  const normalizedGroup = SHORTCUT_GROUP_SEND_ICONS[group] ? group : "P";
  const button = document.createElement("button");
  button.className = `shortcut-button shortcut-button-${getShortcutGroupClassSuffix(normalizedGroup)}`;
  button.type = "button";
  button.dataset.shortcutGroup = normalizedGroup;
  button.dataset.danmakuText = text;
  button.setAttribute("aria-pressed", "false");

  if (options.isCustom) {
    button.dataset.shortcutCustom = "true";
  }

  const defaultText = document.createElement("span");
  defaultText.className = "shortcut-default-text";
  defaultText.textContent = text;

  const hoverContent = document.createElement("span");
  hoverContent.className = "shortcut-hover-content";
  hoverContent.setAttribute("aria-hidden", "true");

  const hoverText = document.createElement("span");
  hoverText.textContent = text;

  const icon = document.createElement("img");
  icon.className = "shortcut-send-icon";
  icon.src = SHORTCUT_GROUP_SEND_ICONS[normalizedGroup];
  icon.alt = "";

  hoverContent.append(hoverText, icon);
  button.append(defaultText, hoverContent);
  return button;
}

function addTemporaryShortcutButton(addButton) {
  shortcutAddButton = addButton;
  shortcutDialogTitle.textContent = getShortcutDialogTitle(addButton);
  shortcutDialogInput.value = "";
  shortcutDialogError.textContent = "";
  shortcutDialog.showModal();
  shortcutDialogInput.focus();
}

function closeShortcutDialog() {
  shortcutDialog.close();
  shortcutAddButton = null;
  shortcutDialogForm.reset();
  shortcutDialogError.textContent = "";
}

function submitShortcutDialog(event) {
  event.preventDefault();

  const trimmedText = shortcutDialogInput.value.trim();

  if (!trimmedText) {
    shortcutDialogError.textContent = getShortcutLocale().emptyError;
    shortcutDialogInput.focus();
    return;
  }

  if (shortcutAddButton) {
    const row = shortcutAddButton.closest(".shortcut-context-row");
    const gestureCard = shortcutAddButton.closest(".gesture-card");
    const container = row || gestureCard;
    const group = shortcutAddButton.dataset.shortcutGroup
      || container?.dataset.shortcutGroup
      || "P";

    container?.querySelectorAll('.shortcut-button[data-shortcut-custom="true"]').forEach((button) => {
      button.remove();
    });

    const newButton = createShortcutButton(trimmedText, group, { isCustom: true });
    if (gestureCard) {
      newButton.classList.add("gesture-danmaku-button");
    }

    shortcutAddButton.before(newButton);

    if (gestureCard && isGestureSetupMode) {
      selectGestureDanmakuButton(newButton);
    } else if (isShortcutSetupMode) {
      selectShortcutButton(newButton);
    }
  }

  closeShortcutDialog();
}

function handleShortcutButtonsClick(event) {
  const deleteCardButton = event.target.closest(".shortcut-card-delete-button");

  if (isShortcutSetupMode && deleteCardButton && shortcutsButtons.contains(deleteCardButton)) {
    deleteCardButton.closest(".shortcut-context-row")?.remove();
    updateShortcutSetupUi();
    return;
  }

  const shortcutButton = event.target.closest(".shortcut-button");

  const addButton = event.target.closest(".shortcut-add-button");

  if (addButton && shortcutsButtons.contains(addButton)) {
    addTemporaryShortcutButton(addButton);
    return;
  }

  if (shortcutButton && shortcutsButtons.contains(shortcutButton)) {
    if (isShortcutSetupMode) {
      selectShortcutButton(shortcutButton);
      return;
    }

    sendShortcutDanmaku({ currentTarget: shortcutButton });
  }
}

function initializeGestureContextIcons() {
  const contextIcons = {
    得分: "src/得分.png",
    失分: "src/失分.png",
    嘲讽: "src/嘲讽.png",
    质疑: "src/质疑.png",
    等待: "src/等待.png",
    疑惑: "src/疑惑.png",
  };

  getGestureCards().forEach((card) => {
    const contextKey = card.dataset.context || "";
    const label = card.querySelector(".gesture-context-label");
    const iconSrc = contextIcons[contextKey];

    if (!label || !iconSrc || label.querySelector(".shortcut-context-icon")) {
      return;
    }

    label.textContent = "";

    const icon = document.createElement("img");
    icon.className = "shortcut-context-icon";
    icon.src = iconSrc;
    icon.alt = "";

    label.append(icon, contextKey);
  });
}

function handleGestureContentClick(event) {
  const addButton = event.target.closest(".gesture-custom-button");

  if (addButton && gestureContent?.contains(addButton)) {
    addTemporaryShortcutButton(addButton);
    return;
  }

  const gestureButton = event.target.closest(".gesture-danmaku-button");

  if (!gestureButton || !gestureContent?.contains(gestureButton)) {
    return;
  }

  if (isGestureSetupMode) {
    selectGestureDanmakuButton(gestureButton);
    return;
  }
}

/*
  创建并显示单条弹幕。
  每条弹幕都是一个动态创建的 div。
  它会被放进 danmakuLayer，所以只会出现在视频区域内部。
  返回 true 表示成功占用轨道并开始动画；返回 false 表示当前没有可用轨道。
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

/*
  尝试展示等待中的用户弹幕。
  用户刚发送的弹幕优先即时显示；如果暂时没有轨道，会留在队列里，等动画结束后再次尝试。
*/
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
  生成指定范围内的随机数。
  弹幕的垂直位置和移动速度都需要一点随机性，
  这样多条弹幕不会完全叠在同一条线上。
*/
function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

/* 生成弹幕 id。优先使用浏览器内置 UUID；不可用时使用时间戳和随机数兜底。 */
function createDanmakuId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `danmaku-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

/*
  保存参与者发送的实验弹幕数据。
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
  根据视频文件名推导预置弹幕 JSON 文件名。
  例如：
  2012年伦敦奥运会羽毛球男单决赛 林丹VS李宗伟.mp4
  会对应：
  2012年伦敦奥运会羽毛球男单决赛 林丹VS李宗伟_danmaku.json
*/
function getDanmakuFileName(videoFileName) {
  return `${videoFileName.replace(/\.[^/.]+$/, "")}_danmaku.json`;
}

/*
  决定实验弹幕数据 POST 到哪里。
  如果页面由 Python 后端通过 http://localhost:8000 打开，就使用相对路径 /api/danmaku。
  如果你仍然用 file:// 直接打开，就尝试发到 http://localhost:8000/api/danmaku。
*/
function getDanmakuApiUrl() {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return "/api/danmaku";
  }

  return "http://localhost:8000/api/danmaku";
}

/*
  决定手势识别请求发送到哪里。
  规则和弹幕保存接口一致：HTTP 页面走相对路径，file:// 页面走本地后端固定地址。
*/
function getGestureApiUrl() {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return "/api/gesture";
  }

  return "http://localhost:8000/api/gesture";
}

/*
  按视频文件名加载预置弹幕。
  每个视频都会尝试加载自己的“视频名去掉扩展名 + _danmaku.json”文件。
  如果这个文件不存在，则说明这个视频目前没有初始弹幕文件。
*/
async function loadDanmakuForVideo(videoFileName) {
  clearDanmakuPlaybackState();
  danmakuRecords = [];

  await loadDanmakuDataFile(videoFileName);
}

/*
  加载当前视频对应的预置弹幕 JSON。
  如果 JSON 文件里写了 videoName，就必须和当前视频文件名一致才会使用。
  这可以避免重命名弹幕文件后，误把别的视频弹幕加载到当前视频上。
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
  合并弹幕数据，避免同一个 id 的弹幕重复进入列表。
  合并后按照视频时间排序，后续调度只需要顺序检查时间区间。
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
  按照视频时间显示预置弹幕。
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
  用户拖动进度条或跳转视频时，重置弹幕调度窗口。
  这样不会在跳转后把所有旧弹幕瞬间刷出来。
*/
function resetDanmakuSchedule() {
  shownDanmakuIds.clear();
  danmakuLayer.replaceChildren();
  clearDanmakuTracks();
  lastDanmakuCheckTime = videoPlayer.currentTime;
}

/* 清空当前视频的弹幕播放状态，但不改变弹幕开关按钮本身。 */
function clearDanmakuPlaybackState() {
  shownDanmakuIds.clear();
  danmakuLayer.replaceChildren();
  clearDanmakuTracks();
  pendingUserDanmaku = [];
  lastDanmakuCheckTime = 0;
}

/*
  更新弹幕开关相关 UI。
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
    danmakuLayer.classList.remove("hidden");
  } else {
    danmakuToggleIcon.src = "src/Danmaku close.png";
    danmakuSettingsIcon.src = "src/Danmaku Settings2.png";
    danmakuToggleButton.setAttribute("aria-label", "Danmaku off");
    danmakuForm.classList.add("danmaku-off");
    danmakuForm.classList.remove("danmaku-on");
    danmakuLayer.classList.add("hidden");
    danmakuLayer.replaceChildren();
    clearDanmakuTracks();
    pendingUserDanmaku = [];
    shownDanmakuIds.clear();
  }

  danmakuInput.disabled = false;
  applyPlayerLanguage();

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
  if (!isGestureTriggeredCondition()) {
    return;
  }

  if (cameraStream) {
    hideCameraStatusIfPreviewHasFrame();
    updateGestureRecognitionState();
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent = "Camera API is not supported. Try opening this page through localhost or HTTPS.";
    return;
  }

  try {
    cameraStatus.textContent = "Requesting camera...";

    cameraStatus.classList.remove("hidden");

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    if (!isGestureTriggeredCondition()) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    cameraStream = stream;
    cameraPreview.srcObject = stream;
    const playPromise = cameraPreview.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        if (hideCameraStatusIfPreviewHasFrame()) {
          return;
        }

        console.error("Camera playback error:", error);
        cameraStatus.textContent = getCameraErrorMessage(error);
      });
    }

    hideCameraStatusIfPreviewHasFrame();
    updateGestureRecognitionState();
  } catch (error) {
    console.error("Camera error:", error);
    cameraStatus.textContent = getCameraErrorMessage(error);
  }
}

function stopCameraPreview() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  cameraPreview.pause();
  cameraPreview.srcObject = null;
  cameraStatus.textContent = "Camera loading...";
  cameraStatus.classList.remove("hidden");
}

/*
  启动定时手势识别。
  前端按固定间隔从摄像头抽帧，而不是每一帧都请求后端，避免本地模型推理压力过大。
*/
function startGestureRecognition() {
  if (gestureTimer) {
    return;
  }

  gestureStatus.classList.remove("hidden");
  gestureTimer = window.setInterval(detectGestureFromCamera, 200);
}

/*
  停止手势识别并清理界面状态。
  视频暂停、结束、清空或摄像头不可用时会调用这里，避免继续向后端发送无效请求。
*/
function stopGestureRecognition() {
  if (gestureTimer) {
    window.clearInterval(gestureTimer);
    gestureTimer = null;
  }

  gestureStatus.classList.add("hidden");
  gestureResult.classList.add("hidden");
  clearGestureCardCooldowns();
  resetGestureHoldState();
  resetGestureDebugOverlay();
  clearHandLandmarks();
}

/*
  判断当前是否满足识别条件。
  必须已经选择视频、视频正在播放、摄像头有可用画面，才会启动手势识别。
*/
function shouldRecognizeGestures() {
  return isGestureTriggeredCondition()
    && !isGestureSetupMode
    && Boolean(selectedVideoFileName)
    && !videoPlayer.paused
    && !videoPlayer.ended
    && cameraPreview.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}

/*
  根据当前播放和摄像头状态自动启动或停止手势识别。
  这个函数由视频 play/pause/ended 事件，以及摄像头启动成功后共同触发。
*/
function updateGestureRecognitionState() {
  if (shouldRecognizeGestures()) {
    startGestureRecognition();
    return;
  }

  stopGestureRecognition();
}

/*
  从摄像头抽取一帧并请求后端识别。
  isGestureRequestRunning 用来避免上一帧还没返回时又发起下一次请求，防止请求堆积。
*/
async function detectGestureFromCamera() {
  if (isGestureRequestRunning || !shouldRecognizeGestures()) {
    updateGestureRecognitionState();
    return;
  }

  isGestureRequestRunning = true;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 540;

    const context = canvas.getContext("2d");
    context.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);

    const response = await fetch(GESTURE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: canvas.toDataURL("image/jpeg", 0.7),
        allowedGestures: getAllowedGestureNames(),
      }),
    });

    const result = await response.json();

    if (!shouldRecognizeGestures()) {
      stopGestureRecognition();
      return;
    }

    updateGestureDebug(result.debug || {});
    drawHandLandmarks(result.landmarks || [], result.connections || []);
    updateGestureDebugOverlay(result);
    const sendState = sendGestureDanmaku(result);
    updateGestureResult(result, sendState);
  } catch (error) {
    console.warn("Gesture recognition failed:", error);
    gestureResult.classList.add("hidden");
    resetGestureDebugOverlay();
    if (gestureDebug) {
      gestureDebug.classList.add("hidden");
    }
    clearHandLandmarks();
  } finally {
    isGestureRequestRunning = false;
  }
}

/*
  根据后端识别结果决定是否真正发送手势弹幕。
  前端负责“保持时长”和“冷却时间”两层节流：
  - holdSeconds：同一个动作需要连续保持多久；
  - cooldownSeconds：同一个动作发送后多久才能再次发送。
*/
function sendGestureDanmaku(result) {
  if (!shouldRecognizeGestures()) {
    resetGestureHoldState();
    return { sent: false, reason: "notRecognizing" };
  }

  if (!result.ok || !result.success || !result.gesture) {
    resetGestureHoldState();
    return { sent: false, reason: "noGesture" };
  }

  const gesture = result.gesture;
  const text = getSelectedGestureDanmakuText(gesture);

  if (!text) {
    resetGestureHoldState();
    return { sent: false, reason: "noText" };
  }

  const rule = result.sendRule || {};
  const now = Date.now();
  const holdMilliseconds = secondsToMilliseconds(rule.holdSeconds);
  const cooldownMilliseconds = secondsToMilliseconds(rule.cooldownSeconds);

  if (currentHeldGesture !== gesture) {
    currentHeldGesture = gesture;
    currentHeldGestureStartedAt = now;
  }

  const heldMilliseconds = now - currentHeldGestureStartedAt;

  if (heldMilliseconds < holdMilliseconds) {
    return {
      sent: false,
      reason: "holding",
      gesture,
      heldMilliseconds,
      holdMilliseconds,
    };
  }

  const lastTriggerTime = lastGestureTriggerTimes.get(gesture) || 0;
  const cooldownRemainingMilliseconds = cooldownMilliseconds - (now - lastTriggerTime);

  if (cooldownRemainingMilliseconds > 0) {
    return {
      sent: false,
      reason: "cooldown",
      gesture,
      cooldownRemainingMilliseconds,
    };
  }

  lastGestureTriggerTimes.set(gesture, now);
  sendParticipantDanmakuText(text, "gesture");
  return { sent: true, gesture, danmakuText: text, cooldownMilliseconds };
}

function getSelectedGestureDanmakuText(gesture) {
  if (selectedGestureDanmakuByGesture.has(gesture)) {
    return selectedGestureDanmakuByGesture.get(gesture) || "";
  }

  const card = getGestureCards().find((gestureCard) => gestureCard.dataset.gesture === gesture);
  const button = card?.querySelector(".gesture-danmaku-button");
  return getDanmakuButtonText(button);
}

function getAllowedGestureNames() {
  if (!isGestureSetupMode && selectedGestureDanmakuByGesture.size > 0) {
    return Array.from(selectedGestureDanmakuByGesture.keys());
  }

  return getGestureCards()
    .map((card) => card.dataset.gesture)
    .filter(Boolean);
}

function showGestureCardCooldown(gesture, milliseconds) {
  const duration = Number(milliseconds);

  if (!gesture || !Number.isFinite(duration) || duration <= 0) {
    return;
  }

  const card = getGestureCards().find((gestureCard) => gestureCard.dataset.gesture === gesture);

  if (!card) {
    return;
  }

  card.classList.add("is-gesture-cooling");

  const previousTimer = gestureCooldownTimers.get(gesture);

  if (previousTimer) {
    window.clearTimeout(previousTimer);
  }

  const timer = window.setTimeout(() => {
    card.classList.remove("is-gesture-cooling");
    gestureCooldownTimers.delete(gesture);
  }, duration);

  gestureCooldownTimers.set(gesture, timer);
}

function clearGestureCardCooldowns() {
  gestureCooldownTimers.forEach((timer) => {
    window.clearTimeout(timer);
  });
  gestureCooldownTimers.clear();

  getGestureCards().forEach((card) => {
    card.classList.remove("is-gesture-cooling");
  });
}

/*
  清空当前正在保持的手势状态。
  当没有识别到动作、动作切换、视频暂停或识别停止时，需要重新开始计时。
*/
function resetGestureHoldState() {
  currentHeldGesture = null;
  currentHeldGestureStartedAt = 0;
}

function resetGestureDebugOverlay() {
  currentDetectedGesture = null;
  currentDetectedGestureStartedAt = 0;

  if (gestureDebugOverlay) {
    gestureDebugOverlay.classList.add("hidden");
    gestureDebugOverlay.textContent = "";
  }
}

function updateGestureDebugOverlay(result) {
  if (!gestureDebugOverlay) {
    return;
  }

  if (!shouldRecognizeGestures() || !result.ok || !result.success || !result.gesture) {
    resetGestureDebugOverlay();
    return;
  }

  const now = Date.now();

  if (currentDetectedGesture !== result.gesture) {
    currentDetectedGesture = result.gesture;
    currentDetectedGestureStartedAt = now;
  }

  const detectedMilliseconds = now - currentDetectedGestureStartedAt;
  gestureDebugOverlay.textContent = `动作：${result.gesture}\n持续：${formatSeconds(detectedMilliseconds)}`;
  gestureDebugOverlay.classList.remove("hidden");
}

/* 把配置里以秒为单位的时间转换成毫秒，方便和 Date.now() 的结果比较。 */
function secondsToMilliseconds(seconds) {
  const numericSeconds = Number(seconds);
  return Number.isFinite(numericSeconds) && numericSeconds > 0 ? numericSeconds * 1000 : 0;
}

/*
  更新摄像头画面右下角的识别提示。
  根据发送状态分别显示：已发送、仍需保持、冷却中，或者仅检测到动作。
*/
function updateGestureResult(result, sendState = {}) {
  if (!result.ok || !result.success || !result.gesture) {
    gestureResult.classList.add("hidden");
    return;
  }

  if (sendState.sent) {
    gestureResult.textContent = `Sent danmaku: ${sendState.danmakuText}`;
    gestureResult.classList.remove("hidden");
    showGestureCardCooldown(sendState.gesture, sendState.cooldownMilliseconds);
    return;
  }

  if (sendState.reason === "holding") {
    gestureResult.textContent = `Hold ${result.gesture}: ${formatSeconds(sendState.heldMilliseconds)} / ${formatSeconds(sendState.holdMilliseconds)}`;
    gestureResult.classList.remove("hidden");
    return;
  }

  if (sendState.reason === "cooldown") {
    gestureResult.textContent = `${result.gesture} cooldown: ${formatSeconds(sendState.cooldownRemainingMilliseconds)}`;
    gestureResult.classList.remove("hidden");
    showGestureCardCooldown(result.gesture, sendState.cooldownRemainingMilliseconds);
    return;
  }

  gestureResult.textContent = `Detected: ${result.gesture}`;
  gestureResult.classList.remove("hidden");
}

/* 把毫秒格式化成一位小数的秒数，用于手势保持和冷却提示。 */
function formatSeconds(milliseconds) {
  return `${(Math.max(0, milliseconds) / 1000).toFixed(1)}s`;
}

/*
  更新手势调试面板。
  面板展示模型和规则判断的中间值，主要用于调试误识别、漏识别和阈值调整。
*/
function updateGestureDebug(debug) {
  if (!gestureDebug) {
    return;
  }

  const threePoint = debug.threePoint;
  const builtIn = debug.builtIn;
  const claspedHands = debug.claspedHands;
  const palmsTogether = debug.palmsTogether;
  const pose = debug.pose;

  if (!threePoint && !builtIn && !claspedHands && !palmsTogether && !pose) {
    gestureDebug.classList.add("hidden");
    gestureDebug.textContent = "";
    return;
  }

  const lines = [];

  lines.push(`hands: ${debug.handCount || 0} landmarks=${debug.handLandmarkCount || 0}`);

  if (debug.image) {
    lines.push(`image: ${debug.image.width || 0}x${debug.image.height || 0} mean=${formatDebugNumber(debug.image.meanBrightness)}`);
  }

  if (builtIn) {
    lines.push(`task: ${builtIn.category || "none"} ${formatDebugScore(builtIn.score)}`);
  }

  if (pose) {
    lines.push(`pose: ${Boolean(pose.poseDetected)} count=${pose.poseCount || 0}`);

    if (pose.coveringFace) {
      lines.push(`covering face: ${Boolean(pose.coveringFace.matched)}`);
      if (pose.coveringFace.reason) {
        lines.push(`face reason: ${pose.coveringFace.reason}`);
      } else {
        lines.push(`face L/R: ${Boolean(pose.coveringFace.leftCovering)} / ${Boolean(pose.coveringFace.rightCovering)}`);
        lines.push(`face dist L/R: ${formatDebugNumber(pose.coveringFace.left?.nearestDistance)} / ${formatDebugNumber(pose.coveringFace.right?.nearestDistance)}`);
        lines.push(`face hand dist: ${formatDebugNumber(pose.coveringFace.handLandmark?.nearestDistance)} p=${pose.coveringFace.handLandmark?.pointIndex ?? "n/a"}`);
        lines.push(`face very close L/R: ${Boolean(pose.coveringFace.left?.veryCloseRegion)} / ${Boolean(pose.coveringFace.right?.veryCloseRegion)}`);
        lines.push(`face not above L/R: ${Boolean(pose.coveringFace.left?.notClearlyAboveTarget)} / ${Boolean(pose.coveringFace.right?.notClearlyAboveTarget)}`);
        lines.push(`eye visibility min: ${formatDebugNumber(pose.coveringFace.regionVisibilityMin)}`);
      }
    }

    if (pose.coveringMouth) {
      lines.push(`covering mouth: ${Boolean(pose.coveringMouth.matched)}`);
      if (pose.coveringMouth.reason) {
        lines.push(`mouth reason: ${pose.coveringMouth.reason}`);
      } else {
        lines.push(`mouth L/R: ${Boolean(pose.coveringMouth.leftCovering)} / ${Boolean(pose.coveringMouth.rightCovering)}`);
        lines.push(`mouth dist L/R: ${formatDebugNumber(pose.coveringMouth.left?.nearestDistance)} / ${formatDebugNumber(pose.coveringMouth.right?.nearestDistance)}`);
        lines.push(`mouth hand dist: ${formatDebugNumber(pose.coveringMouth.handLandmark?.nearestDistance)} p=${pose.coveringMouth.handLandmark?.pointIndex ?? "n/a"}`);
        lines.push(`mouth very close L/R: ${Boolean(pose.coveringMouth.left?.veryCloseRegion)} / ${Boolean(pose.coveringMouth.right?.veryCloseRegion)}`);
        lines.push(`mouth not above L/R: ${Boolean(pose.coveringMouth.left?.notClearlyAboveTarget)} / ${Boolean(pose.coveringMouth.right?.notClearlyAboveTarget)}`);
        lines.push(`mouth visibility min: ${formatDebugNumber(pose.coveringMouth.regionVisibilityMin)}`);
      }
    }

    if (pose.touchingChin) {
      lines.push(`touching chin: ${Boolean(pose.touchingChin.matched)}`);
      if (pose.touchingChin.reason) {
        lines.push(`chin reason: ${pose.touchingChin.reason}`);
      } else {
        lines.push(`chin L/R: ${Boolean(pose.touchingChin.leftTouching)} / ${Boolean(pose.touchingChin.rightTouching)}`);
        lines.push(`chin dist L/R: ${formatDebugNumber(pose.touchingChin.left?.distanceToChin)} / ${formatDebugNumber(pose.touchingChin.right?.distanceToChin)}`);
        lines.push(`chin hand dist: ${formatDebugNumber(pose.touchingChin.handLandmark?.distanceToChin)} p=${pose.touchingChin.handLandmark?.pointIndex ?? "n/a"}`);
        lines.push(`chin hand below mouth: ${formatDebugNumber(pose.touchingChin.handLandmark?.belowMouthDistance)}`);
      }
    }

    if (pose.handsOnHead) {
      lines.push(`hands on head: ${Boolean(pose.handsOnHead.matched)}`);
    }

    if (pose.touchingHair) {
      lines.push(`touching hair: ${Boolean(pose.touchingHair.matched)}`);
      if (pose.touchingHair.reason) {
        lines.push(`hair reason: ${pose.touchingHair.reason}`);
      } else {
        lines.push(`hair L/R: ${Boolean(pose.touchingHair.leftTouching)} / ${Boolean(pose.touchingHair.rightTouching)}`);
        if (pose.touchingHair.headTouch) {
          lines.push(`hair dist L/R: ${formatDebugNumber(pose.touchingHair.headTouch.left?.nearestDistance)} / ${formatDebugNumber(pose.touchingHair.headTouch.right?.nearestDistance)}`);
        }
      }
    }

    if (pose.headShaking) {
      lines.push(`head shaking: ${Boolean(pose.headShaking.matched)}`);

      if (pose.headShaking.reason) {
        lines.push(`shake reason: ${pose.headShaking.reason}`);
      } else {
        lines.push(`shake yaw/base/rel: ${formatDebugNumber(pose.headShaking.yaw)} / ${formatDebugNumber(pose.headShaking.baselineYaw)} / ${formatDebugNumber(pose.headShaking.relativeYaw)}`);
        lines.push(`shake range: ${formatDebugNumber(pose.headShaking.yawRange)} >= ${formatDebugNumber(pose.headShaking.rangeThreshold)}`);
        lines.push(`shake rel min/max: ${formatDebugNumber(pose.headShaking.minRelativeYaw)} / ${formatDebugNumber(pose.headShaking.maxRelativeYaw)}`);
        lines.push(`shake changes: ${pose.headShaking.directionChanges || 0} / ${pose.headShaking.minDirectionChanges || 0} samples=${pose.headShaking.sampleCount || 0}`);
      }
    }

    if (pose.headTilt) {
      lines.push(`head tilt: ${Boolean(pose.headTilt.matched)}`);

      if (pose.headTilt.reason) {
        lines.push(`head reason: ${pose.headTilt.reason}`);
      } else {
        lines.push(`head angle: ${formatDebugNumber(pose.headTilt.absoluteAngle)} >= ${formatDebugNumber(pose.headTilt.angleThreshold)}`);
        lines.push(`head relative: ${formatDebugNumber(pose.headTilt.relativeAngle)}`);
      }
    }
  }

  if (Array.isArray(debug.hands) && debug.hands.length > 0) {
    debug.hands.forEach((hand) => {
      lines.push(
        `h${hand.index}: ${hand.handedness || "?"} ${hand.category || "none"} ${formatDebugScore(hand.score)} open=${Boolean(hand.open)} camera=${formatDebugNumber(hand.palmOrientationScore)} upDown=${formatDebugNumber(hand.palmUpDownScore)}`
      );
    });
  }

  if (claspedHands) {
    lines.push(`clasping hands: ${claspedHands.matched}`);
    if (claspedHands.reason) {
      lines.push(`clasped reason: ${claspedHands.reason} (${claspedHands.handCount || 0} hand)`);
    } else {
      lines.push(`clasped center: ${formatDebugNumber(claspedHands.centerDistance)} <= ${formatDebugNumber(claspedHands.centerDistanceThreshold)}`);
      lines.push(`clasped fingers: ${formatDebugNumber(claspedHands.fingerProximity)} <= ${formatDebugNumber(claspedHands.fingerProximityThreshold)}`);
      lines.push(`folded: ${claspedHands.foldedFingerCount || 0} >= ${claspedHands.minFoldedFingerCount || 0}`);
    }
  }

  if (palmsTogether) {
    lines.push(`palms together: ${palmsTogether.matched}`);
    if (palmsTogether.reason) {
      lines.push(`palms reason: ${palmsTogether.reason} (${palmsTogether.handCount || 0} hand)`);
    } else {
      lines.push(`palms avgMcp: ${formatDebugNumber(palmsTogether.averageMcpDistance)} <= ${formatDebugNumber(palmsTogether.distanceThreshold)}`);
      lines.push(`palms maxMcp: ${formatDebugNumber(palmsTogether.maxMcpDistance)}`);
      lines.push(`direction: ${formatDebugNumber(palmsTogether.directionSimilarity)} >= ${formatDebugNumber(palmsTogether.directionThreshold)}`);
    }
  }

  if (threePoint) {
    lines.push(`3pt matched: ${threePoint.matched}`);
    lines.push(`touch: ${threePoint.thumbIndexTouching} (${formatDebugNumber(threePoint.okTouchDistance)} < ${formatDebugNumber(threePoint.touchThreshold)})`);
    lines.push(`open: ${threePoint.otherFingersOpen}`);
    lines.push(`middle/ring/pinky: ${formatFingerChecks(threePoint.fingerChecks)}`);
    lines.push(`scale: ${formatDebugNumber(threePoint.handScale)}`);
  } else {
    lines.push("3pt: skipped - no hand landmarks");
  }

  gestureDebug.textContent = lines.join("\n");
  gestureDebug.classList.remove("hidden");
}

/* 把 Three-Point Gesture 的各手指判断结果整理成一行调试文本。 */
function formatFingerChecks(fingerChecks = {}) {
  return ["middle", "ring", "pinky"]
    .map((finger) => `${finger}=${Boolean(fingerChecks[finger])}`)
    .join(" ");
}

/* 调试数值统一保留三位小数；无效值显示 n/a。 */
function formatDebugNumber(value) {
  return Number.isFinite(value) ? value.toFixed(3) : "n/a";
}

/* 调试分数统一保留两位小数，并加括号显示。 */
function formatDebugScore(value) {
  return Number.isFinite(value) ? `(${value.toFixed(2)})` : "";
}

/*
  在摄像头预览上绘制手部关键点和骨架线。
  后端返回的是归一化坐标，前端需要按 canvas 实际尺寸换算成像素坐标。
*/
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

/* 清空摄像头预览上的手部关键点绘制结果。 */
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
conditionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setExperimentCondition(button.dataset.conditionId);
  });
});

// Toggle danmaku visibility.
danmakuToggleButton.addEventListener("click", () => {
  isDanmakuEnabled = !isDanmakuEnabled;
  updateDanmakuControls();
});

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

videoPlayer.addEventListener("play", () => {
  if (!canStartVideoPlayback()) {
    videoPlayer.pause();
  }
});

// 这些事件负责让播放按钮图标和无障碍标签保持正确。
videoPlayer.addEventListener("play", updatePlayButton);
videoPlayer.addEventListener("pause", updatePlayButton);
videoPlayer.addEventListener("ended", updatePlayButton);
videoPlayer.addEventListener("seeked", resetDanmakuSchedule);

// 这些事件让弹幕动画、用户弹幕队列和手势识别状态跟随视频播放状态。
videoPlayer.addEventListener("play", updateDanmakuAnimationState);
videoPlayer.addEventListener("play", showPendingUserDanmaku);
videoPlayer.addEventListener("pause", updateDanmakuAnimationState);
videoPlayer.addEventListener("ended", updateDanmakuAnimationState);
videoPlayer.addEventListener("play", updateGestureRecognitionState);
videoPlayer.addEventListener("pause", updateGestureRecognitionState);
videoPlayer.addEventListener("ended", updateGestureRecognitionState);

cameraPreview.addEventListener("loadeddata", hideCameraStatusIfPreviewHasFrame);
cameraPreview.addEventListener("canplay", hideCameraStatusIfPreviewHasFrame);
cameraPreview.addEventListener("playing", hideCameraStatusIfPreviewHasFrame);

// 点击 Send 按钮时，发送输入框里的弹幕。
danmakuSendButton.addEventListener("click", sendDanmaku);

shortcutsButtons.addEventListener("click", handleShortcutButtonsClick);
shortcutConfirmButton.addEventListener("click", confirmShortcutSetup);
gestureContent?.addEventListener("click", handleGestureContentClick);
gestureConfirmButton?.addEventListener("click", confirmGestureSetup);
shortcutLanguageButton.addEventListener("click", toggleShortcutLanguage);
shortcutDialogForm.addEventListener("submit", submitShortcutDialog);
shortcutDialogCancel.addEventListener("click", closeShortcutDialog);
shortcutDialog.addEventListener("cancel", () => {
  shortcutAddButton = null;
  shortcutDialogForm.reset();
  shortcutDialogError.textContent = "";
});

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
initializeGestureContextIcons();
applyShortcutLanguage();
applyExperimentCondition();
