
FINGER_JOINTS = {
    "index": (8, 6),
    "middle": (12, 10),
    "ring": (16, 14),
    "pinky": (20, 18),
}

OK_EXTENDED_FINGERS = ("middle", "ring", "pinky")
THUMB_TIP = 4
INDEX_TIP = 8
INDEX_PIP = 6
WRIST = 0
MIDDLE_MCP = 9

def is_three_point_gesture(landmarks):
    debug = get_three_point_debug(landmarks)
    return debug["matched"]


def get_three_point_debug(landmarks):
    ok_touch_distance = _distance(landmarks[THUMB_TIP], landmarks[INDEX_TIP])
    hand_scale = _distance(landmarks[WRIST], landmarks[MIDDLE_MCP]) or 1
    touch_threshold = hand_scale * 0.28
    extended_fingers = _extended_fingers(landmarks)
    finger_checks = {
        finger: extended_fingers[finger]
        for finger in OK_EXTENDED_FINGERS
    }

    thumb_index_touching = ok_touch_distance < touch_threshold
    other_fingers_open = all(finger_checks.values())

    return {
        "matched": thumb_index_touching and other_fingers_open,
        "thumbIndexTouching": thumb_index_touching,
        "otherFingersOpen": other_fingers_open,
        "okTouchDistance": ok_touch_distance,
        "handScale": hand_scale,
        "touchThreshold": touch_threshold,
        "fingerChecks": finger_checks,
        "landmarks": {
            "thumbTip": _point_debug(landmarks[THUMB_TIP]),
            "indexTip": _point_debug(landmarks[INDEX_TIP]),
            "middleMcp": _point_debug(landmarks[MIDDLE_MCP]),
            "wrist": _point_debug(landmarks[WRIST]),
        },
    }


def _extended_fingers(landmarks):
    return {
        finger: landmarks[tip_index].y < landmarks[pip_index].y
        for finger, (tip_index, pip_index) in FINGER_JOINTS.items()
    }


def _are_fingers_extended(landmarks, fingers):
    extended_fingers = _extended_fingers(landmarks)
    return all(extended_fingers[finger] for finger in fingers)


def _distance(first, second):
    return ((first.x - second.x) ** 2 + (first.y - second.y) ** 2) ** 0.5


def _point_debug(point):
    return {
        "x": point.x,
        "y": point.y,
        "z": point.z,
    }


GESTURE_RECOGNIZERS = {
    "Three-Point Gesture": is_three_point_gesture,
}
