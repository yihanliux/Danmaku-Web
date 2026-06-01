
def is_open_palm(landmarks):
    """Detect the first gesture: all five fingers are open."""
    finger_tips = [8, 12, 16, 20]
    finger_pips = [6, 10, 14, 18]
    extended_fingers = 0

    for tip_index, pip_index in zip(finger_tips, finger_pips):
        if landmarks[tip_index].y < landmarks[pip_index].y:
            extended_fingers += 1

    thumb_open = _distance(landmarks[4], landmarks[9]) > _distance(landmarks[3], landmarks[9])

    return extended_fingers == 4 and thumb_open


def _distance(first, second):
    return ((first.x - second.x) ** 2 + (first.y - second.y) ** 2) ** 0.5


GESTURE_RECOGNIZERS = {
    "open_palm": is_open_palm,
}
