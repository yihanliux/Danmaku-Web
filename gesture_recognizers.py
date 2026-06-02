
FINGER_JOINTS = {
    "index": (8, 6),
    "middle": (12, 10),
    "ring": (16, 14),
    "pinky": (20, 18),
}

FOLDED_FINGERS = ("index", "middle", "ring", "pinky")
OK_EXTENDED_FINGERS = ("middle", "ring", "pinky")
THUMB_TIP = 4
THUMB_IP = 3
THUMB_MCP = 2
INDEX_TIP = 8
INDEX_PIP = 6
WRIST = 0


def is_raising_one_fist(landmarks):
    """Detect a closed fist."""
    fingers = _extended_fingers(landmarks)
    return not any(fingers.values()) and not _is_thumb_open(landmarks)


def is_thumbs_up(landmarks):
    """Detect four folded fingers with the thumb extended upward."""
    return _are_fingers_folded(landmarks, FOLDED_FINGERS) and _is_thumb_up(landmarks)


def is_thumbs_down(landmarks):
    """Detect four folded fingers with the thumb extended downward."""
    return _are_fingers_folded(landmarks, FOLDED_FINGERS) and _is_thumb_down(landmarks)


def is_three_point_gesture(landmarks):
    """Detect an OK gesture: thumb and index touch, other three fingers open."""
    ok_touch_distance = _distance(landmarks[THUMB_TIP], landmarks[INDEX_TIP])
    hand_scale = _distance(landmarks[WRIST], landmarks[INDEX_PIP]) or 1

    return (
        ok_touch_distance < hand_scale * 0.28
        and _are_fingers_extended(landmarks, OK_EXTENDED_FINGERS)
    )


def _extended_fingers(landmarks):
    return {
        finger: landmarks[tip_index].y < landmarks[pip_index].y
        for finger, (tip_index, pip_index) in FINGER_JOINTS.items()
    }


def _are_fingers_extended(landmarks, fingers):
    extended_fingers = _extended_fingers(landmarks)
    return all(extended_fingers[finger] for finger in fingers)


def _are_fingers_folded(landmarks, fingers):
    extended_fingers = _extended_fingers(landmarks)
    return all(not extended_fingers[finger] for finger in fingers)


def _is_thumb_open(landmarks):
    return _distance(landmarks[4], landmarks[9]) > _distance(landmarks[3], landmarks[9])


def _is_thumb_up(landmarks):
    return (
        _is_thumb_open(landmarks)
        and landmarks[THUMB_TIP].y < landmarks[THUMB_IP].y
        and landmarks[THUMB_TIP].y < landmarks[THUMB_MCP].y
    )


def _is_thumb_down(landmarks):
    return (
        _is_thumb_open(landmarks)
        and landmarks[THUMB_TIP].y > landmarks[THUMB_IP].y
        and landmarks[THUMB_TIP].y > landmarks[THUMB_MCP].y
    )


def _distance(first, second):
    return ((first.x - second.x) ** 2 + (first.y - second.y) ** 2) ** 0.5


GESTURE_RECOGNIZERS = {
    "Raising One Fist": is_raising_one_fist,
    "Thumbs-Up": is_thumbs_up,
    "Thumbs-Down": is_thumbs_down,
    "Three-Point Gesture": is_three_point_gesture,
}
