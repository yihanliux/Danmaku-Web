from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json

from danmaku_storage import DanmakuStorage
from hand_gesture_classifier import HandGestureClassifier


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "experiment_data"
HOST = "127.0.0.1"
PORT = 8000

storage = DanmakuStorage(DATA_DIR)
gesture_classifier = HandGestureClassifier()


class ExperimentHandler(SimpleHTTPRequestHandler):
    """网页服务器入口：负责静态页面、实验弹幕接口和手势识别接口。"""

    def end_headers(self):
        # 允许前端用 fetch 请求这个本地服务器。
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def do_OPTIONS(self):
        # 浏览器发送正式 POST 前，可能会先发送 OPTIONS 预检请求。
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/danmaku":
            self.handle_danmaku_request()
            return

        if self.path == "/api/gesture":
            self.handle_gesture_request()
            return

        self.send_error(404, "Unknown API endpoint")

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        payload = self.rfile.read(length).decode("utf-8")
        return json.loads(payload)

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def handle_danmaku_request(self):
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
        try:
            data = self.read_json_body()
            result = gesture_classifier.classify_frame(data.get("image", ""))
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


def run_server():
    """启动本地网页服务器。"""
    server = ThreadingHTTPServer((HOST, PORT), ExperimentHandler)
    print(f"Serving at http://{HOST}:{PORT}")
    print(f"Participant danmaku data will be saved in: {DATA_DIR}")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
