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
}


def get_danmaku_text(gesture):
    """Return the danmaku text that should be sent for a recognized gesture."""
    return GESTURE_DANMAKU_TEXT.get(gesture, "")
