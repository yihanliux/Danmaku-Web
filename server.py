from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
import time
from collections import deque
from urllib.parse import unquote
from urllib.parse import parse_qs, urlparse

from danmaku_storage import DanmakuStorage, safe_file_stem
from gesture_classifier import GestureClassifier


# 项目根目录、实验数据目录和本地服务监听地址统一放在这里。
# 前端通过 http://127.0.0.1:8000 打开时，会同时获得静态文件服务和两个实验接口。
ROOT = Path(__file__).resolve().parent
DANMAKU_DATA_DIR = ROOT / "Danmaku_data"
VIDEO_DATA_DIR = ROOT / "video_data"
HOST = "0.0.0.0"
PORT = 8001


class GestureInferenceMetrics:
    """Tracks completed gesture inferences as a rolling three-second average."""

    WINDOW_SECONDS = 3.0

    def __init__(self):
        self._lock = threading.Lock()
        self._completed_at = deque()

    def record_completion(self):
        now = time.monotonic()
        with self._lock:
            self._completed_at.append(now)
            self._prune(now)

    def get_fps(self):
        now = time.monotonic()
        with self._lock:
            self._prune(now)
            return round(len(self._completed_at) / self.WINDOW_SECONDS, 1)

    def _prune(self, now):
        cutoff = now - self.WINDOW_SECONDS
        while self._completed_at and self._completed_at[0] < cutoff:
            self._completed_at.popleft()


class ManualGestureChannel:
    """In-memory bridge between the laptop page and the Android tablet."""

    def __init__(self):
        self._lock = threading.Lock()
        self._config = {"revision": 0, "gestures": []}
        self._events = []
        self._next_event_id = 1
        self._cooldowns = {}

    def set_config(self, gestures):
        if not isinstance(gestures, list):
            raise ValueError("gestures must be a list")
        cleaned = []
        for item in gestures[:6]:
            if not isinstance(item, dict):
                continue
            gesture = str(item.get("gesture", "")).strip()
            if not gesture:
                continue
            cleaned.append({
                "gesture": gesture,
                "label": str(item.get("label", gesture)).strip() or gesture,
                "danmaku": str(item.get("danmaku", "")).strip(),
                "imageUrl": str(item.get("imageUrl", "")).strip(),
            })
        with self._lock:
            self._events.clear()
            self._cooldowns.clear()
            self._config = {
                "revision": self._config["revision"] + 1,
                "eventCursor": self._next_event_id - 1,
                "gestures": cleaned,
            }
            return dict(self._config)

    def get_config(self):
        with self._lock:
            return {
                **self._config,
                "gestures": list(self._config["gestures"]),
                "cooldowns": dict(self._cooldowns),
                "serverTime": int(time.time() * 1000),
            }

    def set_cooldowns(self, cooldowns):
        if not isinstance(cooldowns, dict):
            raise ValueError("cooldowns must be an object")
        with self._lock:
            allowed = {item["gesture"] for item in self._config["gestures"]}
            self._cooldowns = {
                str(gesture): int(until)
                for gesture, until in cooldowns.items()
                if str(gesture) in allowed and isinstance(until, (int, float))
            }
            return dict(self._cooldowns)

    def add_event(self, gesture):
        gesture = str(gesture or "").strip()
        if not gesture:
            raise ValueError("gesture is required")
        with self._lock:
            allowed = {item["gesture"] for item in self._config["gestures"]}
            if gesture not in allowed:
                raise ValueError("gesture is not in the active tablet configuration")
            event = {"id": self._next_event_id, "gesture": gesture, "createdAt": int(time.time() * 1000)}
            self._next_event_id += 1
            self._events.append(event)
            self._events = self._events[-100:]
            return event

    def events_after(self, event_id):
        with self._lock:
            return [dict(event) for event in self._events if event["id"] > event_id]

# DanmakuStorage 只负责落盘参与者弹幕；GestureClassifier 只负责识别单帧摄像头画面。
# 这里提前创建实例，避免每个请求都重复初始化模型或目录对象。
storage = DanmakuStorage(DANMAKU_DATA_DIR)
gesture_classifier = GestureClassifier()
manual_gesture_channel = ManualGestureChannel()
gesture_inference_metrics = GestureInferenceMetrics()


class ExperimentHandler(SimpleHTTPRequestHandler):
    """网页服务器入口：负责静态页面、实验弹幕接口和手势识别接口。"""

    def end_headers(self):
        # 允许前端用 fetch 请求这个本地服务器。
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Recording-Name, X-Recording-Has-Audio, X-Recording-Metadata")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def do_OPTIONS(self):
        # 浏览器发送正式 POST 前，可能会先发送 OPTIONS 预检请求。
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/manual-gesture/config":
            self.send_json(200, {
                "ok": True,
                **manual_gesture_channel.get_config(),
                "inferenceFps": gesture_inference_metrics.get_fps(),
            })
            return
        if parsed.path == "/api/manual-gesture/events":
            try:
                after = int(parse_qs(parsed.query).get("after", ["0"])[0])
            except ValueError:
                after = 0
            self.send_json(200, {"ok": True, "events": manual_gesture_channel.events_after(after)})
            return
        super().do_GET()

    def do_POST(self):
        # /api/danmaku 保存参与者弹幕，/api/gesture 识别摄像头单帧图像。
        # 其他 POST 路径都不是本实验接口，直接返回 404。
        if self.path == "/api/danmaku":
            self.handle_danmaku_request()
            return

        if self.path == "/api/gesture":
            self.handle_gesture_request()
            return

        if self.path == "/api/camera-recording":
            self.handle_camera_recording_request()
            return

        if self.path == "/api/manual-gesture/config":
            try:
                config = manual_gesture_channel.set_config(self.read_json_body().get("gestures", []))
                self.send_json(200, {"ok": True, **config})
            except Exception as error:
                self.send_json(400, {"ok": False, "error": str(error)})
            return

        if self.path == "/api/manual-gesture/trigger":
            try:
                event = manual_gesture_channel.add_event(self.read_json_body().get("gesture"))
                self.send_json(200, {"ok": True, "event": event})
            except Exception as error:
                self.send_json(400, {"ok": False, "error": str(error)})
            return

        if self.path == "/api/manual-gesture/cooldowns":
            try:
                cooldowns = manual_gesture_channel.set_cooldowns(self.read_json_body().get("cooldowns", {}))
                self.send_json(200, {"ok": True, "cooldowns": cooldowns})
            except Exception as error:
                self.send_json(400, {"ok": False, "error": str(error)})
            return

        self.send_error(404, "Unknown API endpoint")

    def read_json_body(self):
        """读取并解析请求体中的 JSON 数据。"""
        length = int(self.headers.get("Content-Length", "0"))
        payload = self.rfile.read(length).decode("utf-8")
        return json.loads(payload)

    def send_json(self, status_code, data):
        """按 UTF-8 JSON 格式返回响应，保留中文内容不转义。"""
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def handle_danmaku_request(self):
        """处理参与者弹幕保存请求，并返回实际写入的文件名。"""
        try:
            data = self.read_json_body()
            saved_path = storage.save_participant_danmaku(data)
        except Exception as error:
            self.send_json(400, {
                "ok": False,
                "error": str(error),
            })
            return

        self.send_json(200, {
            "ok": True,
            "file": saved_path.name,
        })

    def handle_gesture_request(self):
        """处理手势识别请求：读取前端传来的摄像头帧，返回动作识别结果。"""
        try:
            data = self.read_json_body()
            result = gesture_classifier.classify_frame(
                data.get("image", ""),
                allowed_gestures=data.get("allowedGestures"),
            )
            gesture_inference_metrics.record_completion()
        except Exception as error:
            self.send_json(400, {
                "ok": False,
                "error": str(error),
            })
            return

        self.send_json(200, {
            "ok": True,
            **result,
        })

    def handle_camera_recording_request(self):
        """保存 Gesture 条件下的视频播放期间摄像头录制 MP4。"""
        recording_name = (self.headers.get("X-Recording-Name") or "").strip()

        if not recording_name:
            self.send_json(400, {
                "ok": False,
                "error": "Missing recording name",
            })
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0

        payload = self.rfile.read(length)

        if not payload:
            self.send_json(400, {
                "ok": False,
                "error": "Empty recording payload",
            })
            return

        VIDEO_DATA_DIR.mkdir(exist_ok=True)
        output_path = self.get_available_recording_path(recording_name)

        with output_path.open("wb") as file:
            file.write(payload)

        metadata_path = self.save_recording_metadata(output_path)

        self.send_json(200, {
            "ok": True,
            "file": output_path.name,
            "bytes": len(payload),
            "hasAudio": self.headers.get("X-Recording-Has-Audio") == "1",
            "metadataFile": metadata_path.name if metadata_path else None,
        })

    def save_recording_metadata(self, output_path):
        """Save clock synchronization metadata next to its exact MP4 segment."""
        encoded_metadata = self.headers.get("X-Recording-Metadata")

        if not encoded_metadata:
            return None

        try:
            metadata = json.loads(unquote(encoded_metadata))
        except (json.JSONDecodeError, TypeError, ValueError):
            return None

        if not isinstance(metadata, dict):
            return None

        metadata.update({
            "recordingFile": output_path.name,
            "metadataFile": f"{output_path.stem}.metadata.json",
        })
        metadata_path = output_path.with_name(metadata["metadataFile"])

        with metadata_path.open("w", encoding="utf-8") as file:
            json.dump(metadata, file, ensure_ascii=False, indent=2)
            file.write("\n")

        return metadata_path

    def get_available_recording_path(self, recording_name):
        """返回不会覆盖已有数据的摄像头录制文件路径。"""
        stem = safe_file_stem(recording_name)
        output_path = VIDEO_DATA_DIR / f"{stem}.mp4"

        if not output_path.exists():
            return output_path

        suffix = 2

        while True:
            candidate = VIDEO_DATA_DIR / f"{stem}_{suffix}.mp4"

            if not candidate.exists():
                return candidate

            suffix += 1

def run_server():
    """启动本地网页服务器。"""
    server = ThreadingHTTPServer((HOST, PORT), ExperimentHandler)
    print(f"Serving at http://127.0.0.1:{PORT} (LAN access enabled)")
    print(f"Participant danmaku data will be saved in: {DANMAKU_DATA_DIR}")
    print(f"Camera recordings will be saved in: {VIDEO_DATA_DIR}")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
