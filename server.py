from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json

from danmaku_storage import DanmakuStorage
from gesture_classifier import GestureClassifier


# 项目根目录、实验数据目录和本地服务监听地址统一放在这里。
# 前端通过 http://127.0.0.1:8000 打开时，会同时获得静态文件服务和两个实验接口。
ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "experiment_data"
HOST = "127.0.0.1"
PORT = 8000

# DanmakuStorage 只负责落盘参与者弹幕；GestureClassifier 只负责识别单帧摄像头画面。
# 这里提前创建实例，避免每个请求都重复初始化模型或目录对象。
storage = DanmakuStorage(DATA_DIR)
gesture_classifier = GestureClassifier()


class ExperimentHandler(SimpleHTTPRequestHandler):
    """网页服务器入口：负责静态页面、实验弹幕接口和手势识别接口。"""

    def end_headers(self):
        # 允许前端用 fetch 请求这个本地服务器。
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def do_OPTIONS(self):
        # 浏览器发送正式 POST 前，可能会先发送 OPTIONS 预检请求。
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        # /api/danmaku 保存参与者弹幕，/api/gesture 识别摄像头单帧图像。
        # 其他 POST 路径都不是本实验接口，直接返回 404。
        if self.path == "/api/danmaku":
            self.handle_danmaku_request()
            return

        if self.path == "/api/gesture":
            self.handle_gesture_request()
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
