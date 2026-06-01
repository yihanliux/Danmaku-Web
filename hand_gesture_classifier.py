import base64

import cv2
import mediapipe as mp
import numpy as np

from gesture_danmaku_map import get_danmaku_text
from gesture_recognizers import GESTURE_RECOGNIZERS


class HandGestureClassifier:
    """Use MediaPipe hand landmarks to classify simple hand gestures."""

    def __init__(self):
        self.connections = sorted([
            [start, end]
            for start, end in mp.solutions.hands.HAND_CONNECTIONS
        ])
        self.hands = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            model_complexity=0,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.6,
        )

    def classify_frame(self, image_data):
        """Return the recognized gesture for one camera frame."""
        image = self._decode_image(image_data)
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        result = self.hands.process(rgb_image)

        if not result.multi_hand_landmarks:
            return self._result(False, landmarks=[])

        landmarks = result.multi_hand_landmarks[0].landmark
        landmark_points = self._landmark_points(landmarks)
        gesture = self._recognize_gesture(landmarks)

        if gesture:
            return self._result(True, gesture=gesture, landmarks=landmark_points)

        return self._result(False, landmarks=landmark_points)

    def _decode_image(self, image_data):
        """Convert a browser data URL into an OpenCV image."""
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        image_bytes = base64.b64decode(image_data)
        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Invalid camera frame")

        return image

    def _landmark_points(self, landmarks):
        """Convert MediaPipe landmarks into plain JSON-friendly points."""
        return [
            {
                "x": landmark.x,
                "y": landmark.y,
                "z": landmark.z,
            }
            for landmark in landmarks
        ]

    def _recognize_gesture(self, landmarks):
        """Return the first matched gesture name from the gesture registry."""
        for gesture, recognizer in GESTURE_RECOGNIZERS.items():
            if recognizer(landmarks):
                return gesture

        return None

    def _result(self, success, gesture=None, landmarks=None):
        """Build the JSON response shared by all gesture recognition results."""
        danmaku_text = get_danmaku_text(gesture) if gesture else ""

        return {
            "success": success,
            "gesture": gesture,
            "danmakuText": danmaku_text,
            "message": f"成功发送弹幕：{danmaku_text}" if success else "",
            "landmarks": landmarks or [],
            "connections": self.connections,
        }
