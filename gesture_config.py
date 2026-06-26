"""动作识别配置文件。

这个文件集中保存实验过程中经常需要修改的配置：
- 哪些动作允许被识别；
- 每个动作发送什么弹幕；
- 同一个动作发送后的冷却时间；
- 每个动作需要连续维持多长时间。
"""


# 同一个动作发送弹幕后，需要等待多少秒才允许再次发送。
SAME_GESTURE_COOLDOWN_SECONDS = 10


# 动作识别总开关。
# True：允许识别并发送这个动作。
# False：禁用这个动作；即使判定条件满足，也不会返回或发送该动作。
# 关闭一个高优先级动作后，分类器会继续尝试识别后面的其他已开启动作。
GESTURE_ENABLED = {
    "Raising One Fist": True,
    "Thumbs-Up": False,
    "Thumbs-Down": True,
    "Three-Point Gesture": True,
    "Raising Both Fists": False,
    "Pressing Both Hands Downward": False,
    "Opening Both Palms Upward": True,
    "Pressing Palms Together": True,
    "Clasping Hands": True,
    "Head Tilting": False,
    "Hands On Head": True,
    "Touching Hair": False,
    "Covering Face": False,
    "Covering Mouth": True,
    "Touching Chin": True,
    "Head Shaking": True,
}


# 每个动作成功识别后发送的弹幕文字。
# key 必须和 gesture_classifier.py 返回的动作名称完全一致。
# value 是最终写入参与者弹幕文件、并在前端弹幕层显示的文本。
GESTURE_DANMAKU_TEXT = {
    "Raising One Fist": "Raising One Fist",
    "Thumbs-Up": "Thumbs-Up",
    "Thumbs-Down": "Thumbs-Down",
    "Three-Point Gesture": "Three-Point Gesture",
    "Raising Both Fists": "Raising Both Fists",
    "Pressing Both Hands Downward": "Pressing Both Hands Downward",
    "Opening Both Palms Upward": "Opening Both Palms Upward",
    "Pressing Palms Together": "Pressing Palms Together",
    "Clasping Hands": "Clasping Hands",
    "Head Tilting": "Head Tilting",
    "Hands On Head": "Hands On Head",
    "Touching Hair": "Touching Hair",
    "Covering Face": "Covering Face",
    "Covering Mouth": "Covering Mouth",
    "Touching Chin": "Touching Chin",
    "Head Shaking": "Head Shaking",
}


# 每个动作需要连续维持多少秒，才允许发送弹幕。
# 没有写在这里的动作默认不需要维持，识别到后即可发送。
# 这个配置由前端执行：后端只返回规则，前端负责计时和冷却判断。
GESTURE_HOLD_SECONDS = {
    "Raising One Fist": 0.5,
    "Thumbs-Up": 0.5,
    "Thumbs-Down": 0.5,
    "Three-Point Gesture": 0.5,
    "Raising Both Fists": 0.5,
    "Pressing Both Hands Downward": 0.05,
    "Opening Both Palms Upward": 0.05,
    "Pressing Palms Together": 0.05,
    "Clasping Hands": 0,
    "Head Tilting": 0.05,
    "Hands On Head": 0.3,
    "Touching Hair": 0.3,
    "Covering Face": 0.5,
    "Covering Mouth": 0.5,
    "Touching Chin": 0.5,
    "Head Shaking": 0,
}


def get_danmaku_text(gesture):
    """返回动作成功识别后需要发送的弹幕文字。"""
    return GESTURE_DANMAKU_TEXT.get(gesture, "")


def get_hold_seconds(gesture):
    """返回动作发送前需要连续维持的秒数。"""
    return GESTURE_HOLD_SECONDS.get(gesture, 0)


def get_gesture_send_rule(gesture):
    """返回前端发送某个动作弹幕时需要遵守的规则。"""
    return {
        "cooldownSeconds": SAME_GESTURE_COOLDOWN_SECONDS,
        "holdSeconds": get_hold_seconds(gesture),
    }


def is_gesture_enabled(gesture):
    """返回某个动作当前是否允许被识别。"""
    return GESTURE_ENABLED.get(gesture, False)
