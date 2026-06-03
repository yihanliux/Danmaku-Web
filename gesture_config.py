"""Gesture recognition configuration.

Keep experiment settings here so they are easy to adjust later:
- what danmaku text each recognized action sends
- how long the same action must cool down before it can send again
- which actions must be held before sending
"""


# The same recognized action can send at most once within this many seconds.
SAME_GESTURE_COOLDOWN_SECONDS = 10


# Danmaku text sent by each recognized action.
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
}


# Actions listed here must be continuously recognized for the configured
# number of seconds before the front end sends their danmaku.
# Actions not listed here are sent immediately after recognition and cooldown.
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
}


def get_danmaku_text(gesture):
    """Return the danmaku text that should be sent for a recognized action."""
    return GESTURE_DANMAKU_TEXT.get(gesture, "")


def get_hold_seconds(gesture):
    """Return how long this action must be held before sending."""
    return GESTURE_HOLD_SECONDS.get(gesture, 0)


def get_gesture_send_rule(gesture):
    """Return all front-end sending rules for a recognized action."""
    return {
        "cooldownSeconds": SAME_GESTURE_COOLDOWN_SECONDS,
        "holdSeconds": get_hold_seconds(gesture),
    }
