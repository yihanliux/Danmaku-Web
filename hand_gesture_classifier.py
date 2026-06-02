import base64
import os

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.python._framework_bindings import resource_util

from gesture_danmaku_map import get_danmaku_text
from gesture_recognizers import GESTURE_RECOGNIZERS, get_three_point_debug


ROOT = os.path.dirname(os.path.abspath(__file__))
GESTURE_RECOGNIZER_MODEL = os.path.join(ROOT, "src", "gesture_recognizer.task")
BUILT_IN_GESTURE_MAP = {
    "Closed_Fist": "Raising One Fist",
    "Thumb_Up": "Thumbs-Up",
    "Thumb_Down": "Thumbs-Down",
}
BUILT_IN_GESTURE_SCORE_THRESHOLD = 0.55
TWO_HAND_GESTURE_SCORE_THRESHOLD = 0.5
PALM_ORIENTATION_THRESHOLD = 0.03
FINGER_JOINTS = {
    "index": (8, 6),
    "middle": (12, 10),
    "ring": (16, 14),
    "pinky": (20, 18),
}
OPEN_FINGERS = ("index", "middle", "ring", "pinky")
WRIST = 0
INDEX_MCP = 5
PINKY_MCP = 17


class HandGestureClassifier:
    """Use MediaPipe Gesture Recognizer plus one custom gesture rule."""

    def __init__(self):
        self._set_resource_dir()
        self.connections = sorted([
            [start, end]
            for start, end in mp.solutions.hands.HAND_CONNECTIONS
        ])
        base_options = python.BaseOptions(model_asset_path=GESTURE_RECOGNIZER_MODEL)
        options = vision.GestureRecognizerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.IMAGE,
            num_hands=2,
            min_hand_detection_confidence=0.35,
            min_hand_presence_confidence=0.35,
            min_tracking_confidence=0.35,
        )
        self.recognizer = vision.GestureRecognizer.create_from_options(options)

    def _set_resource_dir(self):
        """Use an ASCII MediaPipe resource path when Windows cannot load Chinese paths."""
        resource_dir = os.environ.get("MEDIAPIPE_RESOURCE_DIR")

        if resource_dir:
            resource_util.set_resource_dir(resource_dir)

    def classify_frame(self, image_data):
        """Return the recognized gesture for one camera frame."""
        image = self._decode_image(image_data)
        image_debug = self._image_debug(image)
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb_image))
        result = self.recognizer.recognize(mp_image)

        if not result.hand_landmarks:
            return self._result(False, landmarks=[], debug=self._debug_result(result, image_debug=image_debug))

        landmarks = result.hand_landmarks[0]
        landmark_points = self._all_landmark_points(result.hand_landmarks)
        connections = self._connections_for_hand_count(len(result.hand_landmarks))
        gesture = (
            self._recognize_two_hand_gesture(result)
            or self._recognize_built_in_gesture(result)
            or self._recognize_custom_gesture(result.hand_landmarks)
        )
        debug = self._debug_result(result, landmarks, image_debug=image_debug)

        if gesture:
            return self._result(
                True,
                gesture=gesture,
                landmarks=landmark_points,
                connections=connections,
                debug=debug,
            )

        return self._result(False, landmarks=landmark_points, connections=connections, debug=debug)

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

    def _all_landmark_points(self, hand_landmarks):
        points = []

        for landmarks in hand_landmarks:
            points.extend(self._landmark_points(landmarks))

        return points

    def _connections_for_hand_count(self, hand_count):
        connections = []

        for hand_index in range(hand_count):
            offset = hand_index * 21
            connections.extend([
                [start + offset, end + offset]
                for start, end in self.connections
            ])

        return connections

    def _recognize_two_hand_gesture(self, result):
        if len(result.hand_landmarks) < 2:
            return None

        hands = self._hand_debug(result)

        if all(hand["category"] == "Closed_Fist" and hand["score"] >= TWO_HAND_GESTURE_SCORE_THRESHOLD for hand in hands):
            return "Raising Both Fists"

        if not all(hand["open"] for hand in hands):
            return None

        if all(hand["palmOrientationScore"] >= PALM_ORIENTATION_THRESHOLD for hand in hands):
            return "Pressing Both Hands Downward"

        if all(hand["palmOrientationScore"] <= -PALM_ORIENTATION_THRESHOLD for hand in hands):
            return "Opening Both Palms Upward"

        return None

    def _recognize_built_in_gesture(self, result):
        """Map MediaPipe canned gesture names to the app's gesture names."""
        if not result.gestures or not result.gestures[0]:
            return None

        category = result.gestures[0][0]
        if category.score < BUILT_IN_GESTURE_SCORE_THRESHOLD:
            return None

        return BUILT_IN_GESTURE_MAP.get(category.category_name)

    def _recognize_custom_gesture(self, hand_landmarks):
        """Return the first matched app-specific custom gesture."""
        for landmarks in hand_landmarks:
            for gesture, recognizer in GESTURE_RECOGNIZERS.items():
                if recognizer(landmarks):
                    return gesture

        return None

    def _debug_result(self, result, landmarks=None, image_debug=None):
        return {
            "handDetected": bool(result.hand_landmarks),
            "handCount": len(result.hand_landmarks),
            "handLandmarkCount": sum(len(landmarks) for landmarks in result.hand_landmarks),
            "rawGestureCount": len(result.gestures[0]) if result.gestures else 0,
            "image": image_debug or {},
            "builtIn": self._built_in_debug(result),
            "hands": self._hand_debug(result),
            "threePoint": get_three_point_debug(landmarks) if landmarks else None,
        }

    def _built_in_debug(self, result):
        if not result.gestures or not result.gestures[0]:
            return {
                "category": None,
                "score": None,
                "mappedGesture": None,
            }

        category = result.gestures[0][0]
        return {
            "category": category.category_name,
            "score": category.score,
            "mappedGesture": BUILT_IN_GESTURE_MAP.get(category.category_name),
        }

    def _image_debug(self, image):
        return {
            "width": int(image.shape[1]),
            "height": int(image.shape[0]),
            "meanBrightness": float(np.mean(image)),
            "minBrightness": int(np.min(image)),
            "maxBrightness": int(np.max(image)),
        }

    def _hand_debug(self, result):
        hands = []

        for index, landmarks in enumerate(result.hand_landmarks):
            category = self._gesture_category_at(result, index)
            handedness = self._handedness_at(result, index)

            hands.append({
                "index": index,
                "category": category.category_name if category else None,
                "score": float(category.score) if category else None,
                "handedness": handedness.category_name if handedness else None,
                "handednessScore": float(handedness.score) if handedness else None,
                "open": self._is_open_hand(landmarks),
                "palmOrientationScore": float(self._palm_orientation_score(landmarks, handedness)),
            })

        return hands

    def _gesture_category_at(self, result, index):
        if index >= len(result.gestures) or not result.gestures[index]:
            return None

        return result.gestures[index][0]

    def _handedness_at(self, result, index):
        if not result.handedness or index >= len(result.handedness) or not result.handedness[index]:
            return None

        return result.handedness[index][0]

    def _is_open_hand(self, landmarks):
        return all(self._is_finger_extended(landmarks, finger) for finger in OPEN_FINGERS)

    def _is_finger_extended(self, landmarks, finger):
        tip_index, pip_index = FINGER_JOINTS[finger]
        wrist = landmarks[WRIST]
        return self._distance(wrist, landmarks[tip_index]) > self._distance(wrist, landmarks[pip_index]) * 1.08

    def _palm_orientation_score(self, landmarks, handedness):
        wrist = landmarks[WRIST]
        index_mcp = landmarks[INDEX_MCP]
        pinky_mcp = landmarks[PINKY_MCP]
        index_vector = np.array([
            index_mcp.x - wrist.x,
            index_mcp.y - wrist.y,
            index_mcp.z - wrist.z,
        ])
        pinky_vector = np.array([
            pinky_mcp.x - wrist.x,
            pinky_mcp.y - wrist.y,
            pinky_mcp.z - wrist.z,
        ])
        normal = np.cross(index_vector, pinky_vector)
        normal_norm = np.linalg.norm(normal)

        if normal_norm == 0:
            return 0

        normalized_z = normal[2] / normal_norm
        handedness_name = handedness.category_name if handedness else ""

        if handedness_name == "Right":
            return float(-normalized_z)

        return float(normalized_z)

    def _distance(self, first, second):
        return ((first.x - second.x) ** 2 + (first.y - second.y) ** 2 + (first.z - second.z) ** 2) ** 0.5

    def _result(self, success, gesture=None, landmarks=None, connections=None, debug=None):
        """Build the JSON response shared by all gesture recognition results."""
        danmaku_text = get_danmaku_text(gesture) if gesture else ""

        return {
            "success": success,
            "gesture": gesture,
            "danmakuText": danmaku_text,
            "message": f"成功发送弹幕：{danmaku_text}" if success else "",
            "landmarks": landmarks or [],
            "connections": connections or self.connections,
            "debug": debug or {},
        }
