from pathlib import Path
import json
import re


class DanmakuStorage:
    """负责保存实验参与者发送的弹幕数据。"""

    def __init__(self, data_dir):
        # data_dir 是实验数据文件夹，例如：experiment_data
        self.data_dir = Path(data_dir)

    def save_participant_danmaku(self, data):
        """把一条参与者弹幕追加保存到对应视频的 jsonl 文件中。"""
        video_name = data.get("videoName") or "unknown_video"
        item = data.get("item") or {}
        time_seconds = item.get("time", 0)

        # 如果 experiment_data 文件夹不存在，就自动创建。
        self.data_dir.mkdir(exist_ok=True)

        # 每个视频拥有自己的实验弹幕文件：
        # 原视频名_participant_danmaku.jsonl
        output_path = self.data_dir / f"{safe_file_stem(video_name)}_participant_danmaku.jsonl"

        record = {
            "id": self._next_id(output_path),
            "text": item.get("text", ""),
            "sendMethod": normalize_send_method(item.get("sendMethod")),
            "time": format_video_time(time_seconds),
            "timeSeconds": time_seconds,
        }

        # JSONL 的意思是“一行一条 JSON 数据”，方便后续实验分析逐行读取。
        with output_path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record, ensure_ascii=False) + "\n")

        return output_path

    def _next_id(self, output_path):
        """根据文件里已有的数据条数，生成下一条弹幕的 id。"""
        if not output_path.exists():
            return 1

        with output_path.open("r", encoding="utf-8") as file:
            return sum(1 for line in file if line.strip()) + 1


def safe_file_stem(name):
    """把视频文件名转换成可以安全保存到磁盘的文件名。"""
    stem = Path(name).stem

    # Windows 文件名不能包含这些特殊字符，所以统一替换成下划线。
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", stem)
    stem = stem.strip(" .")

    return stem or "unknown_video"


def format_video_time(seconds):
    """把秒数格式化成 MM:SS.xx 或 HH:MM:SS.xx，方便直接阅读。"""
    try:
        total_seconds = max(0, float(seconds))
    except (TypeError, ValueError):
        total_seconds = 0

    whole_seconds = int(total_seconds)
    centiseconds = int(round((total_seconds - whole_seconds) * 100))

    if centiseconds == 100:
        whole_seconds += 1
        centiseconds = 0

    hours = whole_seconds // 3600
    minutes = (whole_seconds % 3600) // 60
    remaining_seconds = whole_seconds % 60

    if hours:
        return f"{hours:02d}:{minutes:02d}:{remaining_seconds:02d}.{centiseconds:02d}"

    return f"{minutes:02d}:{remaining_seconds:02d}.{centiseconds:02d}"


def normalize_send_method(send_method):
    """保存弹幕发送方式：手动输入 type，手势触发 gesture。"""
    if send_method in {"type", "gesture"}:
        return send_method

    return "type"
