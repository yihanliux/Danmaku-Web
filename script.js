

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
const participantDialog = document.getElementById("participantDialog");
const participantDialogForm = document.getElementById("participantDialogForm");
const participantDialogInput = document.getElementById("participantDialogInput");
const participantDialogVideo = document.getElementById("participantDialogVideo");
const participantDialogError = document.getElementById("participantDialogError");

const DANMAKU_API_URL = getDanmakuApiUrl();
const GESTURE_API_URL = getGestureApiUrl();
const CAMERA_RECORDING_API_URL = getCameraRecordingApiUrl();
const MANUAL_GESTURE_API_URL = getManualGestureApiUrl();
const MANUAL_GESTURE_CONTROL_ENABLED = true;

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
const MAX_SELECTED_GESTURES = 6;
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
  太棒了: "Let's go!",
  可惜了: "So close!",
  稳住: "You've got this!",
  问题不大: "It's okay",
  差一点: "Unlucky",
  "就这？": "Bruh...",
  拉完了: "Booooo!",
  幽默: "Is that it?",
  "啊？": "Huh?",
  裁判拉完了: "No way!!!",
  离谱: "Rigged!",
  紧张: "I'm so nervous",
  窒息了: "I can't breathe",
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
    gestureSetupHint: "请选择最多 6 个手势，并为每个手势选择或自定义一条弹幕。确认后即可用手势发送。",
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
    gestureSetupHint: "Select up to 6 gestures and choose or create one danmaku comment for each gesture. Confirm to enable gesture sending.",
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

let currentVideoUrl = null;
let selectedVideoFileName = "";
let currentVideoIsTest = false;
let currentVideoGroup = "";
let participantId = "";
let participantSessionName = "";
let hasVideoStartedPlayback = false;
let isDanmakuEnabled = true;
let danmakuRecords = [];
let shownDanmakuIds = new Set();
let lastDanmakuCheckTime = 0;
let danmakuTracks = [];
let pendingUserDanmaku = [];
let currentConditionIndex = 0;
let currentCondition = EXPERIMENT_CONDITIONS[currentConditionIndex].id;
let cameraStream = null;
let cameraRecorder = null;
let cameraRecordingChunks = [];
let cameraRecordingMimeType = "";
let cameraRecordingSessionName = "";
let cameraRecordingHasAudio = false;
let cameraRecordingMetadata = null;
let gestureTimer = null;
let shortcutAddButton = null;
let isShortcutSetupMode = true;
let isGestureSetupMode = true;
let currentShortcutLanguage = "zh";
let isGestureRequestRunning = false;
let currentHeldGesture = null;
let currentHeldGestureStartedAt = 0;
let gestureDetectionHistory = [];
const selectedGestureDanmakuByGesture = new Map();
const lastShortcutTriggerTimes = new Map();
const shortcutCooldownTimers = new Map();
const lastGestureTriggerTimes = new Map();
const gestureCooldownTimers = new Map();
const gestureCooldownMillisecondsByGesture = new Map();
const GESTURE_HOLD_MATCH_RATIO = 0.8;
const GESTURE_DETECTION_INTERVAL_MS = 100;
const GESTURE_CAPTURE_WIDTH = 640;
const GESTURE_CAPTURE_HEIGHT = 360;
const SHORT_GESTURE_HOLD_THRESHOLD_MS = 350;
const SHORT_GESTURE_MIN_SAMPLES = 2;
const SHORT_GESTURE_SAMPLE_WINDOW = 3;
const DEFAULT_GESTURE_COOLDOWN_SECONDS = 10;

function hideCameraStatusIfPreviewHasFrame() {
  if (!cameraPreview.srcObject || cameraPreview.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return false;
  }

  cameraStatus.classList.add("hidden");
  updateGestureRecognitionState();
  updateCameraRecordingState();
  return true;
}


function setVideoTitle(text) {
  videoTitle.textContent = text;
}

function getVideoStem(videoFileName) {
  return String(videoFileName || "").replace(/\.[^/.]+$/, "");
}

function isTestVideoFileName(videoFileName) {
  return /_test$/i.test(getVideoStem(videoFileName).trim());
}

function getVideoGroupLabel(videoFileName) {
  const match = getVideoStem(videoFileName).match(/[\uFF08(]\s*([abc])\s*[)\uFF09]/i);
  return match ? match[1].toLowerCase() : "";
}

function getConditionCode(conditionId = currentCondition) {
  if (conditionId === "baseline") {
    return "B";
  }
  if (conditionId === "on-device") {
    return "C";
  }
  if (conditionId === "gesture-triggered") {
    return "G";
  }
  return "";
}

function getParticipantSessionName() {
  if (!participantId || !currentVideoGroup) {
    return "";
  }

  return `${participantId}-${currentVideoGroup}-${getConditionCode()}`;
}

function updateParticipantSessionName() {
  participantSessionName = getParticipantSessionName();
}

function resetParticipantSession() {
  currentVideoIsTest = false;
  currentVideoGroup = "";
  participantId = "";
  participantSessionName = "";
  hasVideoStartedPlayback = false;
  if (participantDialog.open) {
    participantDialog.close();
  }
  participantDialogInput.value = "";
  participantDialogError.textContent = "";
  participantDialogVideo.textContent = "";
}

function configureParticipantSessionForVideo(videoFileName) {
  currentVideoIsTest = isTestVideoFileName(videoFileName);
  currentVideoGroup = getVideoGroupLabel(videoFileName);
  participantId = "";
  participantSessionName = "";
  participantDialogInput.value = "";
  participantDialogError.textContent = "";

  if (currentVideoIsTest) {
    if (participantDialog.open) {
      participantDialog.close();
    }
    return;
  }

  showParticipantDialog();
}

function requiresParticipantSession() {
  return Boolean(selectedVideoFileName) && !currentVideoIsTest;
}

function hasParticipantSession() {
  return !requiresParticipantSession() || Boolean(participantSessionName);
}

function showParticipantDialog() {
  if (!requiresParticipantSession()) {
    return;
  }

  participantDialogVideo.textContent = "";

  if (!currentVideoGroup) {
    participantDialogError.textContent = "正式视频文件名必须包含 (a)、(b) 或 (c)。请询问研究人员。";
  } else {
    participantDialogError.textContent = "";
  }

  if (!participantDialog.open) {
    participantDialog.showModal();
  }

  participantDialogInput.focus();
}

function submitParticipantDialog(event) {
  event.preventDefault();

  const trimmedId = participantDialogInput.value.trim();

  if (!currentVideoGroup) {
    participantDialogError.textContent = "正式视频文件名必须包含 (a)、(b) 或 (c)。请询问研究人员。";
    return;
  }

  if (!trimmedId) {
    participantDialogError.textContent = "请输入您的 ID。如果不清楚，请询问研究人员。";
    participantDialogInput.focus();
    return;
  }

  participantId = trimmedId;
  updateParticipantSessionName();
  participantDialog.close();
  updatePlaybackAvailability();
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

  const shouldRestartVideo = hasVideoStartedPlayback && hasSelectedVideo();
  currentConditionIndex = nextIndex;
  applyExperimentCondition();
  updateParticipantSessionName();

  if (shouldRestartVideo) {
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
    resetDanmakuSchedule();
    hasVideoStartedPlayback = false;
  }
}


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
  resetParticipantSession();
  clearDanmakuPlaybackState();
  stopGestureRecognition();
  resetControls();
}


function isVideoFile(file) {
  return file && file.type.startsWith("video/");
}


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
    && hasParticipantSession()
    && (!isOnDeviceShortcutCondition() || !isShortcutSetupMode)
    && (!isGestureTriggeredCondition() || !isGestureSetupMode);
}

function updatePlaybackAvailability() {
  const canUsePlaybackControls = canStartVideoPlayback();
  playButton.disabled = !canUsePlaybackControls;
  progressBar.disabled = !canUsePlaybackControls;
}


function enableControls() {
  updatePlaybackAvailability();
  updateProgress();
}


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


videoInput.addEventListener("change", () => {
  const selectedFile = videoInput.files[0];

  
  if (!selectedFile) {
    clearVideo();
    setVideoTitle("Select Video");
    return;
  }

  
  if (!isVideoFile(selectedFile)) {
    clearVideo();
    setVideoTitle("Please select a video file");
    videoInput.value = "";
    return;
  }

  clearVideo();

  
  currentVideoUrl = URL.createObjectURL(selectedFile);
  selectedVideoFileName = selectedFile.name;
  configureParticipantSessionForVideo(selectedFile.name);
  videoPlayer.src = currentVideoUrl;
  videoPlayer.classList.add("has-video");
  placeholder.classList.add("hidden");
  const videoName = selectedFile.name.replace(/\.[^/.]+$/, "");
  setVideoTitle(videoName);
  loadDanmakuForVideo(selectedFile.name);

  videoPlayer.load();
});


playButton.addEventListener("click", () => {
  if (!canStartVideoPlayback()) {
    if (!hasParticipantSession()) {
      showParticipantDialog();
    }
    return;
  }

  if (videoPlayer.paused) {
    videoPlayer.play();
  } else {
    videoPlayer.pause();
  }
});


progressBar.addEventListener("input", () => {
  if (!Number.isFinite(videoPlayer.duration) || videoPlayer.duration <= 0) {
    return;
  }

  const progressPercent = Number(progressBar.value);
  progressBar.style.setProperty("--progress-percent", `${progressPercent}%`);
  videoPlayer.currentTime = (progressPercent / 100) * videoPlayer.duration;
});


volumeBar.addEventListener("input", () => {
  videoPlayer.volume = Number(volumeBar.value);
  updateVolumeDisplay();
});


fullscreenButton.addEventListener("click", () => {
  const player = document.querySelector(".player");

  if (!document.fullscreenElement) {
    player.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});


volumeWrapper.addEventListener("mouseenter", () => {
  volumePanel.classList.remove("hidden");
});


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
  danmakuSendButton.disabled = danmakuInput.value.trim() === "";
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


function sendDanmaku() {
  const text = danmakuInput.value.trim();

  if (!text) {
    return;
  }

  sendParticipantDanmakuText(text, "type");
  danmakuInput.value = "";
  updateDanmakuSendButton();
}


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

  const wasSent = sendParticipantDanmakuText(text, "click");

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
  shortcutDialog.querySelector(".shortcut-dialog-confirm").textContent = locale.dialogSubmit;

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
    gestureSetupHint.textContent = isGestureSetupMode ? locale.gestureSetupHint : locale.sendHint;
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
  const isComplete = cards.length > 0 && selectedCount > 0 && selectedCount <= MAX_SELECTED_GESTURES;
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

  if (!selectedInCard && getSelectedGestureCount() >= MAX_SELECTED_GESTURES) {
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
  publishManualGestureConfig();
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
  };getGestureCards().forEach((card) => {
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


function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}


function createDanmakuId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `danmaku-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}


async function saveParticipantDanmaku(record) {
  updateParticipantSessionName();

  if (!selectedVideoFileName || currentVideoIsTest || !participantSessionName) {
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
        sessionName: participantSessionName,
        participantId,
        videoGroup: currentVideoGroup,
        condition: currentCondition,
        conditionCode: getConditionCode(),
        isTestVideo: currentVideoIsTest,
        item: record,
      }),
    });
  } catch (error) {
    console.warn("Failed to save participant danmaku:", error);
  }
}

function getCameraRecordingSessionName() {
  if (currentVideoIsTest || !participantId || !currentVideoGroup) {
    return "";
  }

  return `${participantId}-${currentVideoGroup}`;
}

function getSupportedCameraRecordingMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  return [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
  ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
}

function shouldRecordCamera() {
  return isGestureTriggeredCondition()
    && !currentVideoIsTest
    && hasParticipantSession()
    && Boolean(getCameraRecordingSessionName())
    && Boolean(cameraStream)
    && !videoPlayer.paused
    && !videoPlayer.ended;
}

async function uploadCameraRecording(blob, sessionName, hasAudio, metadata = null) {
  if (!blob || !blob.size || !sessionName) {
    return;
  }

  try {
    await fetch(CAMERA_RECORDING_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": blob.type || "video/mp4",
        "X-Recording-Name": sessionName,
        "X-Recording-Has-Audio": hasAudio ? "1" : "0",
        "X-Recording-Metadata": encodeURIComponent(JSON.stringify(metadata || {})),
      },
      body: blob,
    });
  } catch (error) {
    console.warn("Failed to save camera recording:", error);
  }
}

function startCameraRecording() {
  if (cameraRecorder || !shouldRecordCamera()) {
    return;
  }

  if (typeof MediaRecorder === "undefined") {
    console.warn("MediaRecorder is not supported by this browser.");
    return;
  }

  const mimeType = getSupportedCameraRecordingMimeType();

  if (!mimeType) {
    console.warn("This browser does not support MP4 recording through MediaRecorder.");
    return;
  }

  cameraRecordingChunks = [];
  cameraRecordingMimeType = mimeType;
  cameraRecordingSessionName = getCameraRecordingSessionName();
  cameraRecordingHasAudio = cameraStream.getAudioTracks().some((track) => track.readyState === "live");
  const startRequestedPerformanceMs = performance.now();
  cameraRecordingMetadata = {
    schemaVersion: 1,
    participantId,
    videoGroup: currentVideoGroup,
    condition: currentCondition,
    conditionCode: getConditionCode(),
    sourceVideoName: selectedVideoFileName,
    recordingSessionName: cameraRecordingSessionName,
    mimeType,
    hasAudio: cameraRecordingHasAudio,
    timeOriginEpochMs: performance.timeOrigin,
    startRequestedPerformanceMs,
    startRequestedEpochMs: performance.timeOrigin + startRequestedPerformanceMs,
    startRequestedVideoTimeSeconds: videoPlayer.currentTime,
    playbackRate: videoPlayer.playbackRate,
  };

  try {
    cameraRecorder = new MediaRecorder(cameraStream, { mimeType });
  } catch (error) {
    console.warn("Could not start camera recording:", error);
    cameraRecorder = null;
    cameraRecordingMetadata = null;
    return;
  }

  cameraRecorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      cameraRecordingChunks.push(event.data);
    }
  });

  cameraRecorder.addEventListener("start", () => {
    if (!cameraRecordingMetadata) {
      return;
    }

    const startedPerformanceMs = performance.now();
    cameraRecordingMetadata.startedPerformanceMs = startedPerformanceMs;
    cameraRecordingMetadata.startedEpochMs = performance.timeOrigin + startedPerformanceMs;
    cameraRecordingMetadata.startedVideoTimeSeconds = videoPlayer.currentTime;
  });

  cameraRecorder.addEventListener("stop", () => {
    const chunks = cameraRecordingChunks;
    const mimeTypeOnStop = cameraRecordingMimeType || "video/mp4";
    const sessionName = cameraRecordingSessionName;
    const hasAudio = cameraRecordingHasAudio;
    const metadata = cameraRecordingMetadata || {};
    const stoppedPerformanceMs = performance.now();
    metadata.stoppedPerformanceMs = stoppedPerformanceMs;
    metadata.stoppedEpochMs = performance.timeOrigin + stoppedPerformanceMs;
    metadata.stoppedVideoTimeSeconds = videoPlayer.currentTime;

    cameraRecordingChunks = [];
    cameraRecordingMimeType = "";
    cameraRecordingSessionName = "";
    cameraRecordingHasAudio = false;
    cameraRecordingMetadata = null;
    cameraRecorder = null;

    if (!chunks.length || !sessionName) {
      return;
    }

    const blob = new Blob(chunks, { type: mimeTypeOnStop });
    uploadCameraRecording(blob, sessionName, hasAudio, metadata);
  });

  try {
    cameraRecorder.start();
  } catch (error) {
    console.warn("Camera recording could not be started:", error);
    cameraRecorder = null;
    cameraRecordingChunks = [];
    cameraRecordingMimeType = "";
    cameraRecordingSessionName = "";
    cameraRecordingHasAudio = false;
    cameraRecordingMetadata = null;
  }
}

function stopCameraRecording() {
  if (!cameraRecorder) {
    return;
  }

  if (cameraRecorder.state !== "inactive") {
    if (cameraRecordingMetadata && cameraRecordingMetadata.stopRequestedPerformanceMs === undefined) {
      const stopRequestedPerformanceMs = performance.now();
      cameraRecordingMetadata.stopRequestedPerformanceMs = stopRequestedPerformanceMs;
      cameraRecordingMetadata.stopRequestedEpochMs = performance.timeOrigin + stopRequestedPerformanceMs;
      cameraRecordingMetadata.stopRequestedVideoTimeSeconds = videoPlayer.currentTime;
      cameraRecordingMetadata.stopReason = videoPlayer.ended ? "ended" : (videoPlayer.paused ? "paused" : "state-change");
    }

    cameraRecorder.stop();
  } else {
    cameraRecorder = null;
  }
}

function updateCameraRecordingState() {
  if (shouldRecordCamera()) {
    startCameraRecording();
    return;
  }

  stopCameraRecording();
}


function getDanmakuFileName(videoFileName) {
  return `${videoFileName.replace(/\.[^/.]+$/, "")}_danmaku.json`;
}


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

function getCameraRecordingApiUrl() {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return "/api/camera-recording";
  }

  return "http://localhost:8000/api/camera-recording";
}

function getManualGestureApiUrl() {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return "/api/manual-gesture";
  }
  return "http://localhost:8000/api/manual-gesture";
}

let manualGestureEventCursor = 0;
let manualGesturePollTimer = null;
let manualGesturePollRunning = false;

async function publishManualGestureConfig() {
  if (!MANUAL_GESTURE_CONTROL_ENABLED) {
    return;
  }
  const gestures = getGestureCards().map((card) => ({
    gesture: card.dataset.gesture,
    label: card.querySelector(".gesture-action-label")?.textContent.trim() || card.dataset.gesture,
    danmaku: selectedGestureDanmakuByGesture.get(card.dataset.gesture) || "",
    imageUrl: card.querySelector(".gesture-action-image")?.getAttribute("src") || "",
  }));

  try {
    const response = await fetch(`${MANUAL_GESTURE_API_URL}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gestures }),
    });
    const result = await response.json();
    manualGestureEventCursor = Number(result.eventCursor) || 0;
    startManualGesturePolling();
    updateGestureRecognitionState();
  } catch (error) {
    console.warn("Could not publish tablet gesture configuration:", error);
  }
}

async function publishGestureCooldownState() {
  const cooldowns = {};
  lastGestureTriggerTimes.forEach((triggeredAt, gesture) => {
    const duration = gestureCooldownMillisecondsByGesture.get(gesture)
      ?? secondsToMilliseconds(DEFAULT_GESTURE_COOLDOWN_SECONDS);
    cooldowns[gesture] = triggeredAt + duration;
  });
  try {
    await fetch(`${MANUAL_GESTURE_API_URL}/cooldowns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cooldowns }),
    });
  } catch (error) {
    console.warn("Could not publish gesture cooldown state:", error);
  }
}

function sendManualGestureDanmaku(gesture) {
  const text = selectedGestureDanmakuByGesture.get(gesture) || "";
  if (!text) {
    return false;
  }
  const now = Date.now();
  const cooldownMilliseconds = gestureCooldownMillisecondsByGesture.get(gesture)
    ?? secondsToMilliseconds(DEFAULT_GESTURE_COOLDOWN_SECONDS);
  const lastTriggerTime = lastGestureTriggerTimes.get(gesture) || 0;
  const remaining = cooldownMilliseconds - (now - lastTriggerTime);
  if (remaining > 0) {
    showGestureCardCooldown(gesture, remaining);
    publishGestureCooldownState();
    return false;
  }
  lastGestureTriggerTimes.set(gesture, now);
  sendParticipantDanmakuText(text, "manual-gesture");
  showGestureCardCooldown(gesture, cooldownMilliseconds);
  publishGestureCooldownState();
  return true;
}

function startManualGesturePolling() {
  if (manualGesturePollTimer) {
    return;
  }
  manualGesturePollTimer = window.setInterval(pollManualGestureEvents, 250);
}

async function pollManualGestureEvents() {
  if (!MANUAL_GESTURE_CONTROL_ENABLED || isGestureSetupMode || manualGesturePollRunning) {
    return;
  }
  manualGesturePollRunning = true;
  try {
    const response = await fetch(`${MANUAL_GESTURE_API_URL}/events?after=${manualGestureEventCursor}`, {
      cache: "no-store",
    });
    const result = await response.json();
    (result.events || []).forEach((event) => {
      manualGestureEventCursor = Math.max(manualGestureEventCursor, Number(event.id) || 0);
      sendManualGestureDanmaku(event.gesture);
    });
  } catch (error) {
    console.warn("Tablet gesture polling failed:", error);
  } finally {
    manualGesturePollRunning = false;
  }
}


async function loadDanmakuForVideo(videoFileName) {
  clearDanmakuPlaybackState();
  danmakuRecords = [];

  await loadDanmakuDataFile(videoFileName);
}


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


function mergeDanmakuRecords(records) {
  const existingIds = new Set(danmakuRecords.map((record) => record.id));

  records.forEach((record) => {
    const normalizedRecord = normalizeDanmakuRecord(record);

    if (!normalizedRecord || existingIds.has(normalizedRecord.id)) {
      return;
    }

    danmakuRecords.push(normalizedRecord);
    existingIds.add(normalizedRecord.id);
  });

  danmakuRecords.sort((first, second) => first.time - second.time);
}


function normalizeDanmakuRecord(record) {
  const time = Number(record?.time);
  const text = typeof record?.text === "string" ? record.text : "";

  if (!record?.id || !text || !Number.isFinite(time)) {
    return null;
  }

  return {
    id: String(record.id),
    text,
    time,
    style: typeof record.style === "string" ? record.style : "default",
  };
}


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


function resetDanmakuSchedule() {
  shownDanmakuIds.clear();
  danmakuLayer.replaceChildren();
  clearDanmakuTracks();
  lastDanmakuCheckTime = videoPlayer.currentTime;
}


function clearDanmakuPlaybackState() {
  shownDanmakuIds.clear();
  danmakuLayer.replaceChildren();
  clearDanmakuTracks();
  pendingUserDanmaku = [];
  lastDanmakuCheckTime = 0;
}


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

async function requestCameraStream() {
  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: true,
    });
  } catch (error) {
    console.warn("Camera with microphone failed, retrying camera only:", error);
    return navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });
  }
}


async function startCameraPreview() {
  if (!isGestureTriggeredCondition()) {
    return;
  }

  if (cameraStream) {
    hideCameraStatusIfPreviewHasFrame();
    updateGestureRecognitionState();
    updateCameraRecordingState();
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraStatus.textContent = "Camera API is not supported. Try opening this page through localhost or HTTPS.";
    return;
  }

  try {
    cameraStatus.textContent = "Requesting camera...";

    cameraStatus.classList.remove("hidden");

    const stream = await requestCameraStream();

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
    updateCameraRecordingState();
  } catch (error) {
    console.error("Camera error:", error);
    cameraStatus.textContent = getCameraErrorMessage(error);
  }
}

function stopCameraPreview() {
  stopCameraRecording();

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  cameraPreview.pause();
  cameraPreview.srcObject = null;
  cameraStatus.textContent = "Camera loading...";
  cameraStatus.classList.remove("hidden");
}


function startGestureRecognition() {
  if (gestureTimer) {
    return;
  }

  gestureStatus.classList.remove("hidden");
  gestureTimer = window.setInterval(detectGestureFromCamera, GESTURE_DETECTION_INTERVAL_MS);
}


function stopGestureRecognition() {
  if (gestureTimer) {
    window.clearInterval(gestureTimer);
    gestureTimer = null;
  }

  gestureStatus.classList.add("hidden");
  gestureResult.classList.add("hidden");
  clearGestureCardCooldowns();
  resetGestureHoldState();
  clearHandLandmarks();
}


function shouldRecognizeGestures() {
  return isGestureTriggeredCondition()
    && !isGestureSetupMode
    && Boolean(selectedVideoFileName)
    && !videoPlayer.paused
    && !videoPlayer.ended
    && cameraPreview.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}


function updateGestureRecognitionState() {
  updateCameraRecordingState();

  if (shouldRecognizeGestures()) {
    startGestureRecognition();
    return;
  }

  stopGestureRecognition();
}


async function detectGestureFromCamera() {
  if (isGestureRequestRunning) {
    updateGestureRecognitionState();
    return;
  }

  if (!shouldRecognizeGestures()) {
    updateGestureRecognitionState();
    return;
  }

  isGestureRequestRunning = true;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = GESTURE_CAPTURE_WIDTH;
    canvas.height = GESTURE_CAPTURE_HEIGHT;

    const context = canvas.getContext("2d");
    context.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.7);

    const response = await fetch(GESTURE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imageDataUrl,
        allowedGestures: getAllowedGestureNames(),
      }),
    });

    const result = await response.json();

    if (!shouldRecognizeGestures()) {
      stopGestureRecognition();
      return;
    }

    drawHandLandmarks(result.landmarks || [], result.connections || []);
    const sendState = sendGestureDanmaku(result);
    updateGestureResult(result, sendState);
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
    resetGestureHoldState();
    return { sent: false, reason: "notRecognizing" };
  }

  const now = Date.now();
  recordGestureDetection(result, now);

  if (!result.ok || !result.success || !result.gesture) {
    return { sent: false, reason: "noGesture" };
  }

  const gesture = result.gesture;
  const text = getSelectedGestureDanmakuText(gesture);

  if (!text) {
    resetGestureHoldState();
    return { sent: false, reason: "noText" };
  }

  const rule = result.sendRule || {};
  const holdMilliseconds = secondsToMilliseconds(rule.holdSeconds);
  const minFrames = Number(rule.minFrames);
  const windowFrames = Number(rule.windowFrames);
  const cooldownMilliseconds = secondsToMilliseconds(rule.cooldownSeconds);
  gestureCooldownMillisecondsByGesture.set(gesture, cooldownMilliseconds);
  const holdState = getGestureHoldState(gesture, {
    holdMilliseconds,
    minFrames,
    windowFrames,
  }, now);

  if (!holdState.ready) {
    return {
      sent: false,
      reason: "holding",
      gesture,
      heldMilliseconds: holdState.windowMilliseconds,
      holdMilliseconds,
      matchRatio: holdState.matchRatio,
      matchingFrames: holdState.matchingFrames,
      minFrames: holdState.minFrames,
      windowFrames: holdState.windowFrames,
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
  publishGestureCooldownState();
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
  const now = Date.now();
  const isNotCoolingDown = (gesture) => !isGestureInCooldown(gesture, now);

  if (!isGestureSetupMode && selectedGestureDanmakuByGesture.size > 0) {
    return Array.from(selectedGestureDanmakuByGesture.keys()).filter(isNotCoolingDown);
  }

  return getGestureCards()
    .map((card) => card.dataset.gesture)
    .filter(Boolean)
    .filter(isNotCoolingDown);
}

function isGestureInCooldown(gesture, now = Date.now()) {
  const lastTriggerTime = lastGestureTriggerTimes.get(gesture) || 0;

  if (!lastTriggerTime) {
    return false;
  }

  const cooldownMilliseconds = gestureCooldownMillisecondsByGesture.get(gesture)
    ?? secondsToMilliseconds(DEFAULT_GESTURE_COOLDOWN_SECONDS);
  return cooldownMilliseconds > 0 && now - lastTriggerTime < cooldownMilliseconds;
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


function resetGestureHoldState() {
  currentHeldGesture = null;
  currentHeldGestureStartedAt = 0;
  gestureDetectionHistory = [];
}

function recordGestureDetection(result, now = Date.now()) {
  const gesture = result.ok && result.success && result.gesture ? result.gesture : null;
  gestureDetectionHistory.push({ time: now, gesture });

  const maxWindowMilliseconds = 3000;
  gestureDetectionHistory = gestureDetectionHistory.filter((sample) => now - sample.time <= maxWindowMilliseconds);
}

function getGestureHoldState(gesture, rule = {}, now = Date.now()) {
  const minFrames = Number(rule.minFrames);
  const windowFrames = Number(rule.windowFrames);

  if (Number.isFinite(minFrames) && minFrames > 0 && Number.isFinite(windowFrames) && windowFrames >= minFrames) {
    return getGestureFrameHoldState(gesture, minFrames, windowFrames, now);
  }

  const holdMilliseconds = Number(rule.holdMilliseconds) || 0;

  if (holdMilliseconds <= 0) {
    return {
      ready: true,
      matchRatio: 1,
      windowMilliseconds: 0,
    };
  }

  if (holdMilliseconds <= SHORT_GESTURE_HOLD_THRESHOLD_MS) {
    const recentSamples = gestureDetectionHistory.slice(-SHORT_GESTURE_SAMPLE_WINDOW);
    const matchingSamples = recentSamples.filter((sample) => sample.gesture === gesture).length;
    const firstSampleTime = recentSamples.length ? recentSamples[0].time : now;
    const matchRatio = recentSamples.length ? matchingSamples / recentSamples.length : 0;
    const ready = matchingSamples >= SHORT_GESTURE_MIN_SAMPLES;

    if (ready && currentHeldGesture !== gesture) {
      currentHeldGesture = gesture;
      currentHeldGestureStartedAt = firstSampleTime;
    }

    return {
      ready,
      matchRatio,
      windowMilliseconds: now - firstSampleTime,
      matchingSamples,
      sampleCount: recentSamples.length,
    };
  }

  const windowStart = now - holdMilliseconds;
  const samples = gestureDetectionHistory.filter((sample) => sample.time >= windowStart);
  const firstSampleTime = samples.length ? samples[0].time : now;
  const windowMilliseconds = now - firstSampleTime;
  const matchingSamples = samples.filter((sample) => sample.gesture === gesture).length;
  const matchRatio = samples.length ? matchingSamples / samples.length : 0;
  const hasCoveredWindow = windowMilliseconds >= holdMilliseconds * GESTURE_HOLD_MATCH_RATIO;
  const ready = hasCoveredWindow && matchRatio >= GESTURE_HOLD_MATCH_RATIO;

  if (ready && currentHeldGesture !== gesture) {
    currentHeldGesture = gesture;
    currentHeldGestureStartedAt = firstSampleTime;
  }

  return {
    ready,
    matchRatio,
    windowMilliseconds,
  };
}

function getGestureFrameHoldState(gesture, minFrames, windowFrames, now = Date.now()) {
  const recentSamples = gestureDetectionHistory.slice(-windowFrames);
  const matchingFrames = recentSamples.filter((sample) => sample.gesture === gesture).length;
  const firstSampleTime = recentSamples.length ? recentSamples[0].time : now;
  const matchRatio = recentSamples.length ? matchingFrames / recentSamples.length : 0;
  const ready = matchingFrames >= minFrames;

  if (ready && currentHeldGesture !== gesture) {
    currentHeldGesture = gesture;
    currentHeldGestureStartedAt = firstSampleTime;
  }

  return {
    ready,
    matchRatio,
    windowMilliseconds: now - firstSampleTime,
    matchingFrames,
    minFrames,
    windowFrames,
  };
}

function secondsToMilliseconds(seconds) {
  const numericSeconds = Number(seconds);
  return Number.isFinite(numericSeconds) && numericSeconds > 0 ? numericSeconds * 1000 : 0;
}


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
    const matchPercent = Number.isFinite(sendState.matchRatio)
      ? `, ${Math.round(sendState.matchRatio * 100)}%`
      : "";
    if (Number.isFinite(sendState.minFrames) && Number.isFinite(sendState.matchingFrames)) {
      gestureResult.textContent = `Hold ${result.gesture}: ${sendState.matchingFrames} / ${sendState.minFrames} frames${matchPercent}`;
    } else {
      gestureResult.textContent = `Hold ${result.gesture}: ${formatSeconds(sendState.heldMilliseconds)} / ${formatSeconds(sendState.holdMilliseconds)}${matchPercent}`;
    }
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


function formatSeconds(milliseconds) {
  return `${(Math.max(0, milliseconds) / 1000).toFixed(1)}s`;
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


videoPlayer.addEventListener("loadedmetadata", enableControls);


videoPlayer.addEventListener("timeupdate", updateProgress);

videoPlayer.addEventListener("play", () => {
  if (!canStartVideoPlayback()) {
    videoPlayer.pause();
    if (!hasParticipantSession()) {
      showParticipantDialog();
    }
    return;
  }

  hasVideoStartedPlayback = true;
});


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

cameraPreview.addEventListener("loadeddata", hideCameraStatusIfPreviewHasFrame);
cameraPreview.addEventListener("canplay", hideCameraStatusIfPreviewHasFrame);
cameraPreview.addEventListener("playing", hideCameraStatusIfPreviewHasFrame);


danmakuSendButton.addEventListener("click", sendDanmaku);

shortcutsButtons.addEventListener("click", handleShortcutButtonsClick);
shortcutConfirmButton.addEventListener("click", confirmShortcutSetup);
gestureContent?.addEventListener("click", handleGestureContentClick);
gestureConfirmButton?.addEventListener("click", confirmGestureSetup);
shortcutLanguageButton.addEventListener("click", toggleShortcutLanguage);
participantDialogForm.addEventListener("submit", submitParticipantDialog);
participantDialog.addEventListener("cancel", (event) => {
  if (!hasParticipantSession()) {
    event.preventDefault();
    participantDialogError.textContent = "请输入您的 ID。如果不清楚，请询问研究人员。";
    participantDialogInput.focus();
  }
});
shortcutDialogForm.addEventListener("submit", submitShortcutDialog);
shortcutDialogCancel.addEventListener("click", closeShortcutDialog);
shortcutDialog.addEventListener("cancel", () => {
  shortcutAddButton = null;
  shortcutDialogForm.reset();
  shortcutDialogError.textContent = "";
});


videoPlayer.addEventListener("error", () => {
  clearVideo();
  setVideoTitle("Video cannot be loaded");
});


resetControls();
updateDanmakuControls();
initializeDanmakuSettingsFromCss();
updateDanmakuAnimationState();
initializeGestureContextIcons();
applyShortcutLanguage();
applyExperimentCondition();
