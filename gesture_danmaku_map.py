GESTURE_DANMAKU_TEXT = {
    "open_palm": "厉害",
}


def get_danmaku_text(gesture):
    """Return the danmaku text that should be sent for a recognized gesture."""
    return GESTURE_DANMAKU_TEXT.get(gesture, "")
