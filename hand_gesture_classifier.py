import base64
import os

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.python._framework_bindings import resource_util

from gesture_danmaku_map import get_danmaku_text


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
PALM_UP_DOWN_THRESHOLD = 0.25
PALMS_TOGETHER_DISTANCE_THRESHOLD = 0.85
PALMS_TOGETHER_DIRECTION_THRESHOLD = 0.55
CLASPED_HANDS_CENTER_DISTANCE_THRESHOLD = 1.35
CLASPED_HANDS_FINGER_DISTANCE_THRESHOLD = 0.75
CLASPED_HANDS_MIN_FOLDED_FINGERS = 4
FINGER_JOINTS = {
    "index": (8, 6),
    "middle": (12, 10),
    "ring": (16, 14),
    "pinky": (20, 18),
}
OPEN_FINGERS = ("index", "middle", "ring", "pinky")
THREE_POINT_EXTENDED_FINGERS = ("middle", "ring", "pinky")
FINGER_TIPS = (8, 12, 16, 20)
FINGER_PIPS = (6, 10, 14, 18)
WRIST = 0
THUMB_TIP = 4
INDEX_MCP = 5
INDEX_TIP = 8
MIDDLE_MCP = 9
MIDDLE_TIP = 12
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
            min_hand_detection_confidence=0.2,
            min_hand_presence_confidence=0.2,
            min_tracking_confidence=0.2,
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

        clasped_hands = self._clasped_hands_debug(result.hand_landmarks)

        if clasped_hands["matched"]:
            return "Clasping Hands"

        if not all(hand["open"] for hand in hands):
            return None

        palms_together = self._palms_together_debug(result.hand_landmarks)

        if palms_together["matched"]:
            return "Pressing Palms Together"

        if all(hand["palmUpDownScore"] <= -PALM_UP_DOWN_THRESHOLD for hand in hands):
            return "Pressing Both Hands Downward"

        if all(hand["palmUpDownScore"] >= PALM_UP_DOWN_THRESHOLD for hand in hands):
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
            if self._is_three_point_gesture(landmarks):
                return "Three-Point Gesture"

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
            "claspedHands": self._clasped_hands_debug(result.hand_landmarks),
            "palmsTogether": self._palms_together_debug(result.hand_landmarks),
            "threePoint": self._three_point_debug(landmarks) if landmarks else None,
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
                "palmUpDownScore": float(self._palm_up_down_score(landmarks, handedness)),
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

    def _is_three_point_gesture(self, landmarks):
        return self._three_point_debug(landmarks)["matched"]

    def _clasped_hands_debug(self, hand_landmarks):
        if len(hand_landmarks) < 2:
            return {
                "matched": False,
                "reason": "needTwoHands",
                "handCount": len(hand_landmarks),
            }

        first_hand = hand_landmarks[0]
        second_hand = hand_landmarks[1]
        first_scale = self._hand_scale(first_hand)
        second_scale = self._hand_scale(second_hand)
        average_scale = (first_scale + second_scale) / 2
        center_distance = self._distance_2d(first_hand[MIDDLE_MCP], second_hand[MIDDLE_MCP]) / (average_scale or 1)
        folded_finger_count = self._folded_finger_count(first_hand) + self._folded_finger_count(second_hand)
        finger_proximity = self._finger_proximity_score(first_hand, second_hand, average_scale)
        matched = (
            center_distance <= CLASPED_HANDS_CENTER_DISTANCE_THRESHOLD
            and finger_proximity <= CLASPED_HANDS_FINGER_DISTANCE_THRESHOLD
            and folded_finger_count >= CLASPED_HANDS_MIN_FOLDED_FINGERS
        )

        return {
            "matched": matched,
            "centerDistance": center_distance,
            "centerDistanceThreshold": CLASPED_HANDS_CENTER_DISTANCE_THRESHOLD,
            "fingerProximity": finger_proximity,
            "fingerProximityThreshold": CLASPED_HANDS_FINGER_DISTANCE_THRESHOLD,
            "foldedFingerCount": folded_finger_count,
            "minFoldedFingerCount": CLASPED_HANDS_MIN_FOLDED_FINGERS,
        }

    def _palms_together_debug(self, hand_landmarks):
        if len(hand_landmarks) < 2:
            return {
                "matched": False,
                "reason": "needTwoHands",
                "handCount": len(hand_landmarks),
            }

        first_hand = hand_landmarks[0]
        second_hand = hand_landmarks[1]
        first_scale = self._hand_scale(first_hand)
        second_scale = self._hand_scale(second_hand)
        average_scale = (first_scale + second_scale) / 2
        palm_distances = {
            "wrist": self._distance_2d(first_hand[WRIST], second_hand[WRIST]) / (average_scale or 1),
            "indexMcp": self._distance_2d(first_hand[INDEX_MCP], second_hand[INDEX_MCP]) / (average_scale or 1),
            "middleMcp": self._distance_2d(first_hand[MIDDLE_MCP], second_hand[MIDDLE_MCP]) / (average_scale or 1),
            "pinkyMcp": self._distance_2d(first_hand[PINKY_MCP], second_hand[PINKY_MCP]) / (average_scale or 1),
        }
        mcp_distances = [
            palm_distances["indexMcp"],
            palm_distances["middleMcp"],
            palm_distances["pinkyMcp"],
        ]
        average_mcp_distance = sum(mcp_distances) / len(mcp_distances)
        max_mcp_distance = max(mcp_distances)
        first_finger_direction = self._finger_direction(first_hand)
        second_finger_direction = self._finger_direction(second_hand)
        direction_similarity = self._cosine_similarity(first_finger_direction, second_finger_direction)
        matched = (
            average_mcp_distance <= PALMS_TOGETHER_DISTANCE_THRESHOLD
            and direction_similarity >= PALMS_TOGETHER_DIRECTION_THRESHOLD
        )

        return {
            "matched": matched,
            "palmDistances": palm_distances,
            "averageMcpDistance": average_mcp_distance,
            "maxMcpDistance": max_mcp_distance,
            "distanceThreshold": PALMS_TOGETHER_DISTANCE_THRESHOLD,
            "directionSimilarity": direction_similarity,
            "directionThreshold": PALMS_TOGETHER_DIRECTION_THRESHOLD,
        }

    def _three_point_debug(self, landmarks):
        ok_touch_distance = self._distance_2d(landmarks[THUMB_TIP], landmarks[INDEX_TIP])
        hand_scale = self._distance_2d(landmarks[WRIST], landmarks[MIDDLE_MCP]) or 1
        touch_threshold = hand_scale * 0.28
        extended_fingers = {
            finger: self._is_finger_visually_extended(landmarks, finger)
            for finger in THREE_POINT_EXTENDED_FINGERS
        }
        thumb_index_touching = ok_touch_distance < touch_threshold
        other_fingers_open = all(extended_fingers.values())

        return {
            "matched": thumb_index_touching and other_fingers_open,
            "thumbIndexTouching": thumb_index_touching,
            "otherFingersOpen": other_fingers_open,
            "okTouchDistance": ok_touch_distance,
            "handScale": hand_scale,
            "touchThreshold": touch_threshold,
            "fingerChecks": extended_fingers,
            "landmarks": {
                "thumbTip": self._point_debug(landmarks[THUMB_TIP]),
                "indexTip": self._point_debug(landmarks[INDEX_TIP]),
                "middleMcp": self._point_debug(landmarks[MIDDLE_MCP]),
                "wrist": self._point_debug(landmarks[WRIST]),
            },
        }

    def _is_finger_extended(self, landmarks, finger):
        tip_index, pip_index = FINGER_JOINTS[finger]
        wrist = landmarks[WRIST]
        return self._distance(wrist, landmarks[tip_index]) > self._distance(wrist, landmarks[pip_index]) * 1.08

    def _folded_finger_count(self, landmarks):
        return sum(
            not self._is_finger_extended(landmarks, finger)
            for finger in OPEN_FINGERS
        )

    def _finger_proximity_score(self, first_hand, second_hand, hand_scale):
        first_finger_points = [first_hand[index] for index in (*FINGER_TIPS, *FINGER_PIPS)]
        second_finger_points = [second_hand[index] for index in (*FINGER_TIPS, *FINGER_PIPS)]
        first_to_second = [
            min(self._distance_2d(point, other_point) for other_point in second_finger_points)
            for point in first_finger_points
        ]
        second_to_first = [
            min(self._distance_2d(point, other_point) for other_point in first_finger_points)
            for point in second_finger_points
        ]
        distances = first_to_second + second_to_first
        return (sum(distances) / len(distances)) / (hand_scale or 1)

    def _is_finger_visually_extended(self, landmarks, finger):
        tip_index, pip_index = FINGER_JOINTS[finger]
        return landmarks[tip_index].y < landmarks[pip_index].y

    def _palm_orientation_score(self, landmarks, handedness):
        return self._palm_normal_component(landmarks, handedness, 2)

    def _palm_up_down_score(self, landmarks, handedness):
        return self._palm_normal_component(landmarks, handedness, 1)

    def _palm_normal_component(self, landmarks, handedness, component_index):
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

        normalized_component = normal[component_index] / normal_norm
        handedness_name = handedness.category_name if handedness else ""

        if handedness_name == "Right":
            return float(-normalized_component)

        return float(normalized_component)

    def _hand_scale(self, landmarks):
        palm_width = self._distance_2d(landmarks[INDEX_MCP], landmarks[PINKY_MCP])
        palm_height = self._distance_2d(landmarks[WRIST], landmarks[MIDDLE_MCP])
        return max(palm_width, palm_height, 0.001)

    def _finger_direction(self, landmarks):
        return np.array([
            landmarks[MIDDLE_TIP].x - landmarks[WRIST].x,
            landmarks[MIDDLE_TIP].y - landmarks[WRIST].y,
        ])

    def _cosine_similarity(self, first, second):
        denominator = np.linalg.norm(first) * np.linalg.norm(second)

        if denominator == 0:
            return 0

        return float(np.dot(first, second) / denominator)

    def _distance(self, first, second):
        return ((first.x - second.x) ** 2 + (first.y - second.y) ** 2 + (first.z - second.z) ** 2) ** 0.5

    def _distance_2d(self, first, second):
        return ((first.x - second.x) ** 2 + (first.y - second.y) ** 2) ** 0.5

    def _point_debug(self, point):
        return {
            "x": point.x,
            "y": point.y,
            "z": point.z,
        }

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
