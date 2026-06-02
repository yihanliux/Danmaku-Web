GESTURE_DANMAKU_TEXT = {
    "Raising One Fist": "Raising One Fist",
    "Thumbs-Up": "Thumbs-Up",
    "Thumbs-Down": "Thumbs-Down",
    "Three-Point Gesture": "Three-Point Gesture",
}


def get_danmaku_text(gesture):
    """Return the danmaku text that should be sent for a recognized gesture."""
    return GESTURE_DANMAKU_TEXT.get(gesture, "")
