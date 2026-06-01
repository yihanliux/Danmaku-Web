from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import re
from datetime import datetime, timezone


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "experiment_data"
HOST = "127.0.0.1"
PORT = 8000


def safe_file_stem(name):
    """把视频文件名转换成适合保存到磁盘的数据文件名。"""
    stem = Path(name).stem
    stem = re.sub(r'[<>:"/\\\\|?*\\x00-\\x1f]', "_", stem)
    stem = stem.strip(" .")
    return stem or "unknown_video"


class ExperimentHandler(SimpleHTTPRequestHandler):
    """同时负责静态网页访问和实验弹幕数据保存。"""

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        if self.path != "/api/danmaku":
            self.send_error(404, "Unknown API endpoint")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = self.rfile.read(length).decode("utf-8")
            data = json.loads(payload)
            saved_path = self.save_danmaku(data)
        except Exception as error:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({
                "ok": False,
                "error": str(error),
            }, ensure_ascii=False).encode("utf-8"))
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps({
            "ok": True,
            "file": saved_path.name,
        }, ensure_ascii=False).encode("utf-8"))

    def save_danmaku(self, data):
        """把参与者发送的弹幕追加保存为 JSONL，一行就是一条实验数据。"""
        video_name = data.get("videoName") or "unknown_video"
        item = data.get("item") or {}

        record = {
            "version": data.get("version", 1),
            "sessionId": data.get("sessionId"),
            "videoName": video_name,
            "item": item,
            "receivedAt": datetime.now(timezone.utc).isoformat(),
            "userAgent": self.headers.get("User-Agent", ""),
        }

        DATA_DIR.mkdir(exist_ok=True)
        output_path = DATA_DIR / f"{safe_file_stem(video_name)}_participant_danmaku.jsonl"

        with output_path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record, ensure_ascii=False) + "\n")

        return output_path


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), ExperimentHandler)
    print(f"Serving at http://{HOST}:{PORT}")
    print(f"Participant danmaku data will be saved in: {DATA_DIR}")
    server.serve_forever()
