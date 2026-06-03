"""摄像头动作识别模块。

这个文件负责把浏览器传来的单帧摄像头画面转换成 MediaPipe 输入，
然后同时运行两个模型：

1. GestureRecognizer：识别手部动作，包括 MediaPipe 内置手势和我们自定义的双手规则。
2. PoseLandmarker：识别身体姿势，目前用于判断 Head Tilting，后面可以继续扩展更多 pose 动作。

外部只需要调用 GestureClassifier.classify_frame(image_data)，它会返回：
- 是否识别成功
- 识别到的动作名称
- 需要发送的弹幕文字
- 前端绘制手部关键点所需的数据
- 调试信息
"""

import base64
import os
from types import SimpleNamespace

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.python._framework_bindings import resource_util

from gesture_config import get_danmaku_text, get_gesture_send_rule


ROOT = os.path.dirname(os.path.abspath(__file__))
GESTURE_RECOGNIZER_MODEL = os.path.join(ROOT, "src", "gesture_recognizer.task")
POSE_LANDMARKER_MODEL = os.path.join(ROOT, "src", "pose_landmarker_full.task")

# MediaPipe GestureRecognizer 内置手势名称和本项目动作名称的映射。
# 这三个动作直接交给 gesture_recognizer.task 判断，比单纯手写 landmark 规则稳定。
BUILT_IN_GESTURE_MAP = {
    "Closed_Fist": "Raising One Fist",
    "Thumb_Up": "Thumbs-Up",
    "Thumb_Down": "Thumbs-Down",
}

# 各类识别阈值集中放在文件顶部，方便后面根据真实测试继续微调。
BUILT_IN_GESTURE_SCORE_THRESHOLD = 0.55
TWO_HAND_GESTURE_SCORE_THRESHOLD = 0.5
PALM_ORIENTATION_THRESHOLD = 0.03
PALM_UP_DOWN_THRESHOLD = 0.25
PALMS_TOGETHER_DISTANCE_THRESHOLD = 0.85
PALMS_TOGETHER_DIRECTION_THRESHOLD = 0.55
CLASPED_HANDS_CENTER_DISTANCE_THRESHOLD = 1.35
CLASPED_HANDS_FINGER_DISTANCE_THRESHOLD = 0.75
CLASPED_HANDS_MIN_FOLDED_FINGERS = 4

# MediaPipe 手部 landmark 编号。这里保留 hand/finger 命名，
# 因为这些常量确实只描述手部关键点，不是通用 pose 关键点。
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
FACE_COVER_HAND_POINTS = (0, 4, 5, 8, 9, 12, 13, 16, 17, 20)
WRIST = 0
THUMB_TIP = 4
INDEX_MCP = 5
INDEX_TIP = 8
MIDDLE_MCP = 9
MIDDLE_TIP = 12
PINKY_MCP = 17

# MediaPipe PoseLandmarker 的身体关键点编号。
# 目前 Head Tilting 只需要耳朵和肩膀；NOSE 暂时保留，方便后续扩展面部朝向类动作。
NOSE = 0
LEFT_EYE_INNER = 1
LEFT_EYE = 2
LEFT_EYE_OUTER = 3
RIGHT_EYE_INNER = 4
RIGHT_EYE = 5
RIGHT_EYE_OUTER = 6
LEFT_EAR = 7
RIGHT_EAR = 8
MOUTH_LEFT = 9
MOUTH_RIGHT = 10
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12
LEFT_WRIST_POSE = 15
RIGHT_WRIST_POSE = 16
HEAD_TILT_ANGLE_THRESHOLD = 20

# Covering Face / Covering Mouth 使用的距离都不是像素距离，而是归一化距离。
# 归一化使用的尺度是 face_scale：
#   face_scale = max(双耳距离, 肩宽 * 0.28, 0.08)
# 这样可以减少“人离摄像头远近不同”带来的影响。
#
# Covering Face / Covering Mouth 的候选手部点包括：
# - pose 模型里的左/右手腕点；
# - hand 模型里的部分手部关键点，例如手腕、指尖、掌指关节点。
#
# 当前最终判定规则是：
#   手部候选点靠近眼睛/嘴巴目标区域
#   AND 手部候选点没有明显高于目标区域
#   AND 手部候选点没有明显低于目标区域
#   AND (目标区域 visibility 下降 OR 手部候选点离目标区域非常近)

# “手部候选点靠近眼睛/嘴巴”的最大归一化距离。
# 值越小：判定越严格，误触会减少，但真实捂眼/捂嘴也更容易漏掉。
# 值越大：更容易触发，但也更容易把嘴、眼睛、头发区域混在一起。
FACE_COVER_DISTANCE_THRESHOLD = 0.5

# “手部候选点非常靠近眼睛/嘴巴”的归一化距离。
# 如果手部候选点近到这个程度，即使 MediaPipe 仍然认为眼睛/嘴巴 visibility 不低，
# 也可以认为遮挡成立。
# 注意：这个值通常应该 <= FACE_COVER_DISTANCE_THRESHOLD。
# 如果它比 FACE_COVER_DISTANCE_THRESHOLD 更大，最终结果仍然会先被
# FACE_COVER_DISTANCE_THRESHOLD 限制住。
FACE_COVER_VERY_CLOSE_THRESHOLD = 0.5

# 眼睛/嘴巴目标中心的横向容许范围，用于 debug 里的 insideFaceZone。
# 它可以帮助判断手部候选点是否大致落在脸部横向区域内。
# 当前最终遮挡判定主要依赖 nearestDistance 和上下方向阈值，
# 这个值更多是辅助观察和后续调参用。
FACE_COVER_HORIZONTAL_THRESHOLD = 1.25

# 眼睛/嘴巴目标中心的纵向容许范围，用于 debug 里的 insideFaceZone。
# 这里使用的是绝对纵向距离，不区分“在目标上方”还是“在目标下方”。
# 当前最终遮挡判定使用下面的 signed vertical 阈值做更严格的上下限制。
FACE_COVER_VERTICAL_THRESHOLD = 1.05

# “手部候选点没有明显高于目标区域”的阈值。
# MediaPipe 图像坐标里 y 越大越靠下：
#   signed_vertical_distance < 0 表示手部候选点在眼睛/嘴巴上方；
#   signed_vertical_distance > 0 表示手部候选点在眼睛/嘴巴下方。
# 当前值 -0.3 表示：允许手部候选点略微高于眼睛/嘴巴，
# 但如果高太多，就不认为是在遮挡眼睛/嘴巴。
# 值越小/越负：允许手放得更高。
# 值越接近 0：越严格，更能避免摸头发/摸额头被误判成 Covering Face。
FACE_COVER_ABOVE_TARGET_THRESHOLD = -0.3

# “手部候选点没有明显低于目标区域”的阈值。
# 当前值 0.3 表示：允许手部候选点略微低于眼睛/嘴巴，
# 但如果低太多，就不认为是在遮挡该目标区域。
# 值越小：越严格，更能避免“捂嘴”被眼睛区域抢成 Covering Face。
# 值越大：越宽松，如果真实捂眼/捂嘴时手指或手腕经常偏低，可以适当调大。
FACE_COVER_BELOW_TARGET_THRESHOLD = 0.3

# “眼睛/嘴巴可能被遮挡”的 visibility 阈值。
# 如果目标区域 landmarks 的最小 visibility <= 这个值，
# 就认为该区域的可见性明显下降。
# 但 visibility 下降本身不会单独触发动作；
# 手部候选点仍然必须靠近目标区域，并且满足上下方向限制。
FACE_COVER_VISIBILITY_THRESHOLD = 0.25

# Touching Hair / Hands On Head 使用下面这组头部接触阈值。
# 它们也会用类似 face_scale 的头部尺度做归一化。
# 这类动作的判定范围故意比 Covering Face / Covering Mouth 更宽，
# 因为摸头发、双手放头上可能发生在额头、头顶、头部左右两侧。

# 手腕被认为“靠近/接触头部”的最大归一化距离。
# 值越大：Touching Hair / Hands On Head 越容易触发，但误触也会增加。
# 值越小：判定越严格，但真实摸头发/双手放头上也更容易漏掉。
HEAD_TOUCH_DISTANCE_THRESHOLD = 1

# 从估计头部中心到手腕的最大横向归一化距离。
# 这个值允许手出现在头部左右两侧，而不是必须贴在鼻子/耳朵附近。
HEAD_TOUCH_HORIZONTAL_THRESHOLD = 1

# 从估计头部中心到手腕的最大纵向归一化距离。
# 当前代码使用 wrist.y - head_center.y：
#   负数表示手腕在头部中心上方；
#   正数表示手腕在头部中心下方。
# 这个正阈值允许手腕略低于头部中心时，仍然算作接触头部区域。
HEAD_TOUCH_VERTICAL_THRESHOLD = 0.85

# 当耳朵/肩膀 landmark 缺失或不可靠时使用的最小备用尺度。
# 如果没有这个值，尺度可能接近 0，导致归一化距离被放得非常大，
# 从而让 Touching Hair / Hands On Head 很容易全部判定失败。
HEAD_TOUCH_FALLBACK_SCALE = 0.08

# pose landmark 被认为“可靠可用”的最低 visibility。
# 值越高：关键点质量要求越严格，噪声会少一些，但更容易 missingLandmarks。
# 值越低：对遮挡更宽容，但也更容易使用到不稳定的关键点。
POSE_VISIBILITY_THRESHOLD = 0.45


class GestureClassifier:
    """统一的动作识别器：同时管理手部手势识别和身体姿势识别。"""

    def __init__(self):
        self._set_resource_dir()

        # 前端只画手部关键点，所以这里保存 hand landmark 的连接关系。
        # 如果以后也想在前端画身体骨架，可以再增加 pose connections。
        self.connections = sorted([
            [start, end]
            for start, end in mp.solutions.hands.HAND_CONNECTIONS
        ])

        # 手势模型：识别 MediaPipe 官方支持的手势，并输出每只手的 21 个关键点。
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

        # 姿势模型：识别人体 pose landmarks。当前用于 Head Tilting；
        # 之后新增身体姿势时，也建议优先复用这个 pose_result。
        pose_base_options = python.BaseOptions(model_asset_path=POSE_LANDMARKER_MODEL)
        pose_options = vision.PoseLandmarkerOptions(
            base_options=pose_base_options,
            running_mode=vision.RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=0.35,
            min_pose_presence_confidence=0.35,
            min_tracking_confidence=0.35,
        )
        self.pose_landmarker = vision.PoseLandmarker.create_from_options(pose_options)

    def _set_resource_dir(self):
        """设置 MediaPipe 资源目录，解决部分 Windows 中文路径加载资源失败的问题。"""
        resource_dir = os.environ.get("MEDIAPIPE_RESOURCE_DIR")

        if resource_dir:
            resource_util.set_resource_dir(resource_dir)

    def classify_frame(self, image_data):
        """识别一帧摄像头画面，并返回前端需要的 JSON 友好数据。

        识别顺序是有意安排的：
        1. 双手组合动作优先，因为它们需要同时看两只手。
        2. MediaPipe 内置单手手势其次，比如点赞、握拳。
        3. 自定义单手规则再次，比如 Three-Point Gesture。
        4. pose 姿势最后，比如 Head Tilting。

        这样做的结果是：如果同一帧同时满足手势和 pose，优先返回手势。
        """
        image = self._decode_image(image_data)
        image_debug = self._image_debug(image)

        # OpenCV 解码得到的是 BGR，MediaPipe 需要 SRGB/RGB。
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb_image))

        # 同一帧图像同时送入手势模型和姿势模型。
        # 注意：这里不再因为“没有检测到手”就提前返回，因为 pose 动作可能完全不需要手。
        hand_result = self.recognizer.recognize(mp_image)
        pose_result = self.pose_landmarker.detect(mp_image)

        landmarks = hand_result.hand_landmarks[0] if hand_result.hand_landmarks else None
        landmark_points = self._all_landmark_points(hand_result.hand_landmarks)
        connections = self._connections_for_hand_count(len(hand_result.hand_landmarks))
        gesture = (
            self._recognize_face_cover_gesture(pose_result, hand_result.hand_landmarks)
            or self._recognize_two_hand_gesture(hand_result)
            or self._recognize_built_in_gesture(hand_result)
            or self._recognize_custom_gesture(hand_result.hand_landmarks)
            or self._recognize_pose_gesture(pose_result, hand_result.hand_landmarks)
        )
        debug = self._debug_result(hand_result, pose_result, landmarks, image_debug=image_debug)

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
        """把浏览器传来的 base64 data URL 转成 OpenCV 图像。"""
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        image_bytes = base64.b64decode(image_data)
        image_array = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Invalid camera frame")

        return image

    def _landmark_points(self, landmarks):
        """把 MediaPipe landmark 对象转成普通 dict，方便 JSON 返回给前端。"""
        return [
            {
                "x": landmark.x,
                "y": landmark.y,
                "z": landmark.z,
            }
            for landmark in landmarks
        ]

    def _all_landmark_points(self, hand_landmarks):
        """把多只手的 landmarks 展平成一个列表，供前端 canvas 一次性绘制。"""
        points = []

        for landmarks in hand_landmarks:
            points.extend(self._landmark_points(landmarks))

        return points

    def _connections_for_hand_count(self, hand_count):
        """根据检测到的手数量，生成前端绘制骨架线需要的连接索引。"""
        connections = []

        for hand_index in range(hand_count):
            offset = hand_index * 21
            connections.extend([
                [start + offset, end + offset]
                for start, end in self.connections
            ])

        return connections

    def _recognize_two_hand_gesture(self, result):
        """识别所有需要两只手共同参与的动作。

        这里的顺序很重要：
        - Raising Both Fists 直接使用 MediaPipe 的 Closed_Fist 分类结果。
        - Clasping Hands 是十指紧握，手指通常会弯曲，所以要放在“必须张开双手”之前。
        - Pressing Palms Together、Pressing/Opening Both Hands 需要手掌基本张开。
        """
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
        """识别 MediaPipe task 自带的单手手势，并映射成本项目动作名称。"""
        if not result.gestures or not result.gestures[0]:
            return None

        category = result.gestures[0][0]
        if category.score < BUILT_IN_GESTURE_SCORE_THRESHOLD:
            return None

        return BUILT_IN_GESTURE_MAP.get(category.category_name)

    def _recognize_custom_gesture(self, hand_landmarks):
        """识别本项目自己写规则的单手动作，目前是 Three-Point Gesture。"""
        for landmarks in hand_landmarks:
            if self._is_three_point_gesture(landmarks):
                return "Three-Point Gesture"

        return None

    def _recognize_face_cover_gesture(self, pose_result, hand_landmarks):
        covering_face = self._covering_face_debug(pose_result, hand_landmarks)

        if covering_face["matched"]:
            return "Covering Face"

        covering_mouth = self._covering_mouth_debug(pose_result, hand_landmarks)

        if covering_mouth["matched"]:
            return "Covering Mouth"

        return None

    def _recognize_pose_gesture(self, pose_result, hand_landmarks=None):
        """识别依赖身体 pose landmarks 的动作。

        后续新增身体姿势时，可以继续在这里按优先级追加：
        return self._recognize_xxx(pose_result) or self._recognize_yyy(pose_result)
        """
        covering_face = self._covering_face_debug(pose_result, hand_landmarks)

        if covering_face["matched"]:
            return "Covering Face"

        covering_mouth = self._covering_mouth_debug(pose_result, hand_landmarks)

        if covering_mouth["matched"]:
            return "Covering Mouth"

        hands_on_head = self._hands_on_head_debug(pose_result)

        if hands_on_head["matched"]:
            return "Hands On Head"

        touching_hair = self._touching_hair_debug(pose_result)

        if touching_hair["matched"]:
            return "Touching Hair"

        head_tilt = self._head_tilt_debug(pose_result)

        if head_tilt["matched"]:
            return "Head Tilting"

        return None

    def _debug_result(self, result, pose_result, landmarks=None, image_debug=None):
        """汇总调试信息，前端会把这些内容显示在摄像头画面下方。

        这里故意返回较多中间值，因为动作识别很依赖摄像头角度、距离和光照。
        真实测试时看到误触或识别不到，可以直接根据 debug 数值调整阈值。
        """
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
            "pose": self._pose_debug(pose_result, result.hand_landmarks),
            "threePoint": self._three_point_debug(landmarks) if landmarks else None,
        }

    def _built_in_debug(self, result):
        """返回 GestureRecognizer 原始分类结果，方便确认 task 是否识别到内置手势。"""
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
        """返回图像基础信息，用于排查摄像头是否黑屏、过暗或尺寸异常。"""
        return {
            "width": int(image.shape[1]),
            "height": int(image.shape[0]),
            "meanBrightness": float(np.mean(image)),
            "minBrightness": int(np.min(image)),
            "maxBrightness": int(np.max(image)),
        }

    def _pose_debug(self, pose_result, hand_landmarks=None):
        """返回 pose 相关调试信息。"""
        return {
            "poseDetected": bool(pose_result.pose_landmarks),
            "poseCount": len(pose_result.pose_landmarks),
            "coveringFace": self._covering_face_debug(pose_result, hand_landmarks),
            "coveringMouth": self._covering_mouth_debug(pose_result, hand_landmarks),
            "handsOnHead": self._hands_on_head_debug(pose_result),
            "touchingHair": self._touching_hair_debug(pose_result),
            "headTilt": self._head_tilt_debug(pose_result),
        }

    def _covering_face_debug(self, pose_result, hand_landmarks=None):
        """判断 Covering Face：任意一只手腕靠近眼睛区域，或遮挡眼睛且手在脸部附近。"""
        return self._face_region_cover_debug(
            pose_result,
            hand_landmarks,
            region_name="eyes",
            region_indices=(
                LEFT_EYE_INNER,
                LEFT_EYE,
                LEFT_EYE_OUTER,
                RIGHT_EYE_INNER,
                RIGHT_EYE,
                RIGHT_EYE_OUTER,
            ),
        )

    def _covering_mouth_debug(self, pose_result, hand_landmarks=None):
        """判断 Covering Mouth：任意一只手腕靠近嘴部区域，或遮挡嘴部且手在脸部附近。"""
        palms_together = self._palms_together_debug(hand_landmarks or [])

        if palms_together["matched"]:
            return {
                "matched": False,
                "reason": "blockedByPalmsTogether",
                "palmsTogether": palms_together,
            }

        return self._face_region_cover_debug(
            pose_result,
            hand_landmarks,
            region_name="mouth",
            region_indices=(MOUTH_LEFT, MOUTH_RIGHT),
        )

    def _face_region_cover_debug(self, pose_result, hand_landmarks, region_name, region_indices):
        if not pose_result.pose_landmarks:
            return {
                "matched": False,
                "reason": "noPose",
            }

        landmarks = pose_result.pose_landmarks[0]
        visible_region_points = [
            landmarks[index]
            for index in region_indices
            if self._pose_landmark_visible(landmarks[index])
        ]
        fallback_face_points = [
            landmarks[index]
            for index in (NOSE, LEFT_EAR, RIGHT_EAR)
            if self._pose_landmark_visible(landmarks[index])
        ]

        if not visible_region_points and not fallback_face_points:
            return {
                "matched": False,
                "reason": "missingFaceLandmarks",
                "region": region_name,
                "visibility": self._face_visibility_debug(landmarks),
            }

        target_points = visible_region_points or fallback_face_points
        target_center = self._average_point(target_points)
        face_scale = self._face_scale(landmarks)
        left_debug = self._wrist_face_region_debug(landmarks[LEFT_WRIST_POSE], target_points, target_center, face_scale)
        right_debug = self._wrist_face_region_debug(landmarks[RIGHT_WRIST_POSE], target_points, target_center, face_scale)
        hand_landmark_debug = self._hand_landmark_face_region_debug(hand_landmarks, target_points, target_center, face_scale)
        region_visibility = [
            self._pose_visibility(landmarks[index])
            for index in region_indices
        ]
        has_low_region_visibility = (
            bool(region_visibility)
            and min(region_visibility) <= FACE_COVER_VISIBILITY_THRESHOLD
        )
        left_debug["covering"] = self._is_face_region_covered_by_wrist(left_debug, has_low_region_visibility)
        right_debug["covering"] = self._is_face_region_covered_by_wrist(right_debug, has_low_region_visibility)
        hand_landmark_debug["covering"] = self._is_face_region_covered_by_wrist(hand_landmark_debug, has_low_region_visibility)
        matched = left_debug["covering"] or right_debug["covering"] or hand_landmark_debug["covering"]

        return {
            "matched": matched,
            "reason": None,
            "region": region_name,
            "leftCovering": left_debug["covering"],
            "rightCovering": right_debug["covering"],
            "handLandmarkCovering": hand_landmark_debug["covering"],
            "handNearRegion": left_debug["nearRegion"] or right_debug["nearRegion"] or hand_landmark_debug["nearRegion"],
            "handInFaceZone": left_debug["insideFaceZone"] or right_debug["insideFaceZone"] or hand_landmark_debug["insideFaceZone"],
            "lowRegionVisibility": has_low_region_visibility,
            "regionVisibilityMin": min(region_visibility) if region_visibility else None,
            "regionVisibility": region_visibility,
            "left": left_debug,
            "right": right_debug,
            "handLandmark": hand_landmark_debug,
            "faceScale": face_scale,
        }

    def _is_face_region_covered_by_wrist(self, wrist_debug, has_low_region_visibility):
        if wrist_debug.get("reason"):
            return False

        return (
            wrist_debug["nearRegion"]
            and wrist_debug["notClearlyAboveTarget"]
            and wrist_debug["notClearlyBelowTarget"]
            and (
                has_low_region_visibility
                or wrist_debug["veryCloseRegion"]
            )
        )

    def _wrist_face_region_debug(self, wrist, target_points, target_center, face_scale):
        if not self._pose_landmark_visible(wrist):
            return {
                "covering": False,
                "nearRegion": False,
                "insideFaceZone": False,
                "reason": "missingWrist",
                "visibility": self._pose_visibility(wrist),
            }

        nearest_distance = min(
            [self._distance_2d(wrist, point) for point in (*target_points, target_center)]
        ) / (face_scale or 1)
        horizontal_distance = abs(wrist.x - target_center.x) / (face_scale or 1)
        signed_vertical_distance = (wrist.y - target_center.y) / (face_scale or 1)
        vertical_distance = abs(signed_vertical_distance)
        near_region = nearest_distance <= FACE_COVER_DISTANCE_THRESHOLD
        very_close_region = nearest_distance <= FACE_COVER_VERY_CLOSE_THRESHOLD
        not_clearly_above_target = signed_vertical_distance >= FACE_COVER_ABOVE_TARGET_THRESHOLD
        not_clearly_below_target = signed_vertical_distance <= FACE_COVER_BELOW_TARGET_THRESHOLD
        inside_face_zone = (
            horizontal_distance <= FACE_COVER_HORIZONTAL_THRESHOLD
            and vertical_distance <= FACE_COVER_VERTICAL_THRESHOLD
        )

        return {
            "covering": near_region,
            "nearRegion": near_region,
            "veryCloseRegion": very_close_region,
            "notClearlyAboveTarget": not_clearly_above_target,
            "notClearlyBelowTarget": not_clearly_below_target,
            "insideFaceZone": inside_face_zone,
            "nearestDistance": nearest_distance,
            "nearestDistanceThreshold": FACE_COVER_DISTANCE_THRESHOLD,
            "veryCloseThreshold": FACE_COVER_VERY_CLOSE_THRESHOLD,
            "horizontalDistance": horizontal_distance,
            "horizontalThreshold": FACE_COVER_HORIZONTAL_THRESHOLD,
            "verticalDistance": vertical_distance,
            "signedVerticalDistance": signed_vertical_distance,
            "aboveTargetThreshold": FACE_COVER_ABOVE_TARGET_THRESHOLD,
            "belowTargetThreshold": FACE_COVER_BELOW_TARGET_THRESHOLD,
            "verticalThreshold": FACE_COVER_VERTICAL_THRESHOLD,
        }

    def _hand_landmark_face_region_debug(self, hand_landmarks, target_points, target_center, face_scale):
        candidates = []

        for hand_index, landmarks in enumerate(hand_landmarks or []):
            for point_index in FACE_COVER_HAND_POINTS:
                if point_index < len(landmarks):
                    candidate = self._face_region_point_debug(
                        landmarks[point_index],
                        target_points,
                        target_center,
                        face_scale,
                    )
                    candidate["handIndex"] = hand_index
                    candidate["pointIndex"] = point_index
                    candidates.append(candidate)

        if not candidates:
            return {
                "covering": False,
                "nearRegion": False,
                "veryCloseRegion": False,
                "notClearlyAboveTarget": False,
                "insideFaceZone": False,
                "reason": "noHandLandmarks",
            }

        return min(candidates, key=lambda candidate: candidate["nearestDistance"])

    def _face_region_point_debug(self, point, target_points, target_center, face_scale):
        nearest_distance = min(
            [self._distance_2d(point, target_point) for target_point in (*target_points, target_center)]
        ) / (face_scale or 1)
        horizontal_distance = abs(point.x - target_center.x) / (face_scale or 1)
        signed_vertical_distance = (point.y - target_center.y) / (face_scale or 1)
        vertical_distance = abs(signed_vertical_distance)
        near_region = nearest_distance <= FACE_COVER_DISTANCE_THRESHOLD
        very_close_region = nearest_distance <= FACE_COVER_VERY_CLOSE_THRESHOLD
        not_clearly_above_target = signed_vertical_distance >= FACE_COVER_ABOVE_TARGET_THRESHOLD
        not_clearly_below_target = signed_vertical_distance <= FACE_COVER_BELOW_TARGET_THRESHOLD
        inside_face_zone = (
            horizontal_distance <= FACE_COVER_HORIZONTAL_THRESHOLD
            and vertical_distance <= FACE_COVER_VERTICAL_THRESHOLD
        )

        return {
            "covering": near_region,
            "nearRegion": near_region,
            "veryCloseRegion": very_close_region,
            "notClearlyAboveTarget": not_clearly_above_target,
            "notClearlyBelowTarget": not_clearly_below_target,
            "insideFaceZone": inside_face_zone,
            "nearestDistance": nearest_distance,
            "nearestDistanceThreshold": FACE_COVER_DISTANCE_THRESHOLD,
            "veryCloseThreshold": FACE_COVER_VERY_CLOSE_THRESHOLD,
            "horizontalDistance": horizontal_distance,
            "horizontalThreshold": FACE_COVER_HORIZONTAL_THRESHOLD,
            "verticalDistance": vertical_distance,
            "signedVerticalDistance": signed_vertical_distance,
            "aboveTargetThreshold": FACE_COVER_ABOVE_TARGET_THRESHOLD,
            "belowTargetThreshold": FACE_COVER_BELOW_TARGET_THRESHOLD,
            "verticalThreshold": FACE_COVER_VERTICAL_THRESHOLD,
        }

    def _face_scale(self, landmarks):
        left_ear = landmarks[LEFT_EAR]
        right_ear = landmarks[RIGHT_EAR]
        left_shoulder = landmarks[LEFT_SHOULDER]
        right_shoulder = landmarks[RIGHT_SHOULDER]
        both_ears_visible = self._pose_landmark_visible(left_ear) and self._pose_landmark_visible(right_ear)
        both_shoulders_visible = self._pose_landmark_visible(left_shoulder) and self._pose_landmark_visible(right_shoulder)
        head_width = self._distance_2d(left_ear, right_ear) if both_ears_visible else 0
        shoulder_width = self._distance_2d(left_shoulder, right_shoulder) if both_shoulders_visible else 0
        return max(head_width, shoulder_width * 0.28, HEAD_TOUCH_FALLBACK_SCALE)

    def _face_visibility_debug(self, landmarks):
        return {
            "nose": self._pose_visibility(landmarks[NOSE]),
            "leftEyeInner": self._pose_visibility(landmarks[LEFT_EYE_INNER]),
            "leftEye": self._pose_visibility(landmarks[LEFT_EYE]),
            "leftEyeOuter": self._pose_visibility(landmarks[LEFT_EYE_OUTER]),
            "rightEyeInner": self._pose_visibility(landmarks[RIGHT_EYE_INNER]),
            "rightEye": self._pose_visibility(landmarks[RIGHT_EYE]),
            "rightEyeOuter": self._pose_visibility(landmarks[RIGHT_EYE_OUTER]),
            "mouthLeft": self._pose_visibility(landmarks[MOUTH_LEFT]),
            "mouthRight": self._pose_visibility(landmarks[MOUTH_RIGHT]),
            "leftWrist": self._pose_visibility(landmarks[LEFT_WRIST_POSE]),
            "rightWrist": self._pose_visibility(landmarks[RIGHT_WRIST_POSE]),
        }

    def _hands_on_head_debug(self, pose_result):
        """判断 Hands On Head：左右两只手都靠近头部区域。"""
        head_touch = self._head_touch_debug(pose_result)

        if head_touch["reason"]:
            return {
                "matched": False,
                "reason": head_touch["reason"],
                "headTouch": head_touch,
            }

        matched = head_touch["leftTouching"] and head_touch["rightTouching"]

        return {
            "matched": matched,
            "leftTouching": head_touch["leftTouching"],
            "rightTouching": head_touch["rightTouching"],
            "headTouch": head_touch,
        }

    def _touching_hair_debug(self, pose_result):
        """判断 Touching Hair：任意一只手靠近头部区域。"""
        head_touch = self._head_touch_debug(pose_result)

        if head_touch["reason"]:
            return {
                "matched": False,
                "reason": head_touch["reason"],
                "headTouch": head_touch,
            }

        matched = head_touch["leftTouching"] or head_touch["rightTouching"]

        return {
            "matched": matched,
            "leftTouching": head_touch["leftTouching"],
            "rightTouching": head_touch["rightTouching"],
            "headTouch": head_touch,
        }

    def _head_touch_debug(self, pose_result):
        """判断左右手腕是否进入头部区域。

        PoseLandmarker 不能直接知道手指有没有摸到头发，所以这里使用手腕位置近似：
        - 用鼻子、双耳估计头部中心和头部宽度。
        - 用肩宽作为全身尺度，减少人离摄像头远近造成的影响。
        - 手腕只要离鼻子/耳朵/头部中心足够近，或落在头部上方/侧方区域，就认为在触碰头部。
        """
        if not pose_result.pose_landmarks:
            return {
                "reason": "noPose",
            }

        landmarks = pose_result.pose_landmarks[0]
        nose = landmarks[NOSE]
        left_ear = landmarks[LEFT_EAR]
        right_ear = landmarks[RIGHT_EAR]
        left_shoulder = landmarks[LEFT_SHOULDER]
        right_shoulder = landmarks[RIGHT_SHOULDER]
        left_wrist = landmarks[LEFT_WRIST_POSE]
        right_wrist = landmarks[RIGHT_WRIST_POSE]
        visible_head_points = [
            point
            for point in (nose, left_ear, right_ear)
            if self._pose_landmark_visible(point)
        ]
        left_shoulder_visible = self._pose_landmark_visible(left_shoulder)
        right_shoulder_visible = self._pose_landmark_visible(right_shoulder)
        both_shoulders_visible = left_shoulder_visible and right_shoulder_visible
        both_ears_visible = self._pose_landmark_visible(left_ear) and self._pose_landmark_visible(right_ear)

        if not visible_head_points:
            return {
                "reason": "missingLandmarks",
                "visibility": {
                    "nose": self._pose_visibility(landmarks[NOSE]),
                    "leftEar": self._pose_visibility(landmarks[LEFT_EAR]),
                    "rightEar": self._pose_visibility(landmarks[RIGHT_EAR]),
                    "leftShoulder": self._pose_visibility(landmarks[LEFT_SHOULDER]),
                    "rightShoulder": self._pose_visibility(landmarks[RIGHT_SHOULDER]),
                    "leftWrist": self._pose_visibility(landmarks[LEFT_WRIST_POSE]),
                    "rightWrist": self._pose_visibility(landmarks[RIGHT_WRIST_POSE]),
                },
            }

        head_center = self._average_point(visible_head_points)
        shoulder_width = self._distance_2d(left_shoulder, right_shoulder) if both_shoulders_visible else 0
        head_width = self._distance_2d(left_ear, right_ear) if both_ears_visible else 0
        head_scale = max(head_width, shoulder_width * 0.28, HEAD_TOUCH_FALLBACK_SCALE)
        left_debug = self._wrist_head_touch_debug(left_wrist, visible_head_points, head_center, head_scale)
        right_debug = self._wrist_head_touch_debug(right_wrist, visible_head_points, head_center, head_scale)

        return {
            "reason": None,
            "leftTouching": left_debug["touching"],
            "rightTouching": right_debug["touching"],
            "left": left_debug,
            "right": right_debug,
            "headScale": head_scale,
            "headWidth": head_width,
            "shoulderWidth": shoulder_width,
            "visibility": {
                "nose": self._pose_visibility(nose),
                "leftEar": self._pose_visibility(left_ear),
                "rightEar": self._pose_visibility(right_ear),
                "leftShoulder": self._pose_visibility(left_shoulder),
                "rightShoulder": self._pose_visibility(right_shoulder),
                "leftWrist": self._pose_visibility(left_wrist),
                "rightWrist": self._pose_visibility(right_wrist),
            },
        }

    def _wrist_head_touch_debug(self, wrist, head_points, head_center, head_scale):
        if not self._pose_landmark_visible(wrist):
            return {
                "touching": False,
                "reason": "missingWrist",
                "visibility": self._pose_visibility(wrist),
            }

        nearest_distance = min(
            [self._distance_2d(wrist, point) for point in (*head_points, head_center)]
        ) / (head_scale or 1)
        horizontal_distance = abs(wrist.x - head_center.x) / (head_scale or 1)
        vertical_distance = (wrist.y - head_center.y) / (head_scale or 1)
        near_head_point = nearest_distance <= HEAD_TOUCH_DISTANCE_THRESHOLD
        inside_head_zone = (
            horizontal_distance <= HEAD_TOUCH_HORIZONTAL_THRESHOLD
            and vertical_distance <= HEAD_TOUCH_VERTICAL_THRESHOLD
        )

        return {
            "touching": near_head_point or inside_head_zone,
            "nearestDistance": nearest_distance,
            "nearestDistanceThreshold": HEAD_TOUCH_DISTANCE_THRESHOLD,
            "horizontalDistance": horizontal_distance,
            "horizontalThreshold": HEAD_TOUCH_HORIZONTAL_THRESHOLD,
            "verticalDistance": vertical_distance,
            "verticalThreshold": HEAD_TOUCH_VERTICAL_THRESHOLD,
            "nearHeadPoint": near_head_point,
            "insideHeadZone": inside_head_zone,
        }

    def _head_tilt_debug(self, pose_result):
        """判断是否歪头。

        判断方法：
        1. 取左耳到右耳的连线角度，表示头部倾斜方向。
        2. 取左肩到右肩的连线角度，作为身体本身是否歪斜的参考基线。
        3. 用“头部角度 - 肩膀角度”得到相对倾斜角。
        4. 只要相对倾斜角的绝对值超过阈值，就认为是 Head Tilting。

        这样比直接看耳朵连线更稳，因为用户或摄像头可能本来就有一点倾斜。
        """
        if not pose_result.pose_landmarks:
            return {
                "matched": False,
                "reason": "noPose",
            }

        landmarks = pose_result.pose_landmarks[0]
        required_indices = (LEFT_EAR, RIGHT_EAR, LEFT_SHOULDER, RIGHT_SHOULDER)

        if not all(self._pose_landmark_visible(landmarks[index]) for index in required_indices):
            return {
                "matched": False,
                "reason": "missingLandmarks",
                "visibility": {
                    "leftEar": self._pose_visibility(landmarks[LEFT_EAR]),
                    "rightEar": self._pose_visibility(landmarks[RIGHT_EAR]),
                    "leftShoulder": self._pose_visibility(landmarks[LEFT_SHOULDER]),
                    "rightShoulder": self._pose_visibility(landmarks[RIGHT_SHOULDER]),
                },
            }

        head_angle = self._line_angle_degrees(landmarks[LEFT_EAR], landmarks[RIGHT_EAR])
        shoulder_angle = self._line_angle_degrees(landmarks[LEFT_SHOULDER], landmarks[RIGHT_SHOULDER])
        relative_angle = self._normalize_angle(head_angle - shoulder_angle)
        matched = abs(relative_angle) >= HEAD_TILT_ANGLE_THRESHOLD

        return {
            "matched": matched,
            "headAngle": head_angle,
            "shoulderAngle": shoulder_angle,
            "relativeAngle": relative_angle,
            "absoluteAngle": abs(relative_angle),
            "angleThreshold": HEAD_TILT_ANGLE_THRESHOLD,
        }

    def _hand_debug(self, result):
        """把每只手的关键判断值整理出来，供双手规则和前端 debug 共同使用。"""
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
        """安全读取第 index 只手的 GestureRecognizer 分类结果。"""
        if index >= len(result.gestures) or not result.gestures[index]:
            return None

        return result.gestures[index][0]

    def _handedness_at(self, result, index):
        """安全读取第 index 只手的左右手信息。"""
        if not result.handedness or index >= len(result.handedness) or not result.handedness[index]:
            return None

        return result.handedness[index][0]

    def _is_open_hand(self, landmarks):
        """判断一只手是否基本张开：四个非拇指手指都需要伸展。"""
        return all(self._is_finger_extended(landmarks, finger) for finger in OPEN_FINGERS)

    def _is_three_point_gesture(self, landmarks):
        """Three-Point Gesture 的布尔入口，实际细节在 _three_point_debug。"""
        return self._three_point_debug(landmarks)["matched"]

    def _clasped_hands_debug(self, hand_landmarks):
        """判断 Clasping Hands，也就是双手十指紧握。

        当前规则不是判断“掌心贴合”，而是判断两只手是否整体靠近、手指是否互相靠近、
        以及多数手指是否弯曲。这个动作和 Pressing Palms Together 很像，
        但 Clasping Hands 的手指通常不是伸直的。
        """
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
        """判断 Pressing Palms Together，也就是双手伸展、掌心贴在一起。

        主要看两点：
        - 两只手掌的 MCP 关节是否靠近。
        - 两只手的手指方向是否基本一致。

        它不强制 wrist 很近，是为了允许用户掌根稍微分开，但手掌区域仍然贴近。
        """
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
        """判断 Three-Point Gesture，也就是 OK 手势。

        当前规则：
        - 拇指指尖和食指指尖足够接近，形成 OK 圈。
        - 中指、无名指、小指视觉上伸直。

        这里使用 debug 返回所有中间值，方便继续根据实际摄像头效果调阈值。
        """
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
        """用“指尖到手腕距离”是否明显大于“中间关节到手腕距离”判断手指伸展。"""
        tip_index, pip_index = FINGER_JOINTS[finger]
        wrist = landmarks[WRIST]
        return self._distance(wrist, landmarks[tip_index]) > self._distance(wrist, landmarks[pip_index]) * 1.08

    def _folded_finger_count(self, landmarks):
        """统计一只手里有多少个非拇指手指处于弯曲状态。"""
        return sum(
            not self._is_finger_extended(landmarks, finger)
            for finger in OPEN_FINGERS
        )

    def _finger_proximity_score(self, first_hand, second_hand, hand_scale):
        """计算两只手的手指互相靠近程度。

        分数越小，说明两只手的指尖和指关节越接近。
        这个分数主要服务于 Clasping Hands，因为十指紧握时两只手的手指会交错靠近。
        """
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
        """从画面二维方向判断手指是否伸直，主要用于 OK 手势。

        摄像头坐标中 y 越小越靠上；当指尖在 PIP 关节上方时，认为该手指视觉上伸展。
        这个规则比较适合“手指朝上”的 OK 手势。
        """
        tip_index, pip_index = FINGER_JOINTS[finger]
        return landmarks[tip_index].y < landmarks[pip_index].y

    def _palm_orientation_score(self, landmarks, handedness):
        """返回手掌法向量在 z 轴方向的分量，用于判断手心/手背朝向摄像头。"""
        return self._palm_normal_component(landmarks, handedness, 2)

    def _palm_up_down_score(self, landmarks, handedness):
        """返回手掌法向量在 y 轴方向的分量，用于区分掌心向上或向下。"""
        return self._palm_normal_component(landmarks, handedness, 1)

    def _palm_normal_component(self, landmarks, handedness, component_index):
        """计算手掌平面的法向量，并取其中一个轴向分量。

        手掌平面由 wrist、index_mcp、pinky_mcp 三个点近似确定。
        左右手的 landmark 顺序会导致法向量方向相反，所以右手需要翻转符号，
        让左右手的 palmUpDownScore 可以用同一套阈值判断。
        """
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
        """估算手的尺寸，用来把距离阈值归一化，减少远近变化带来的影响。"""
        palm_width = self._distance_2d(landmarks[INDEX_MCP], landmarks[PINKY_MCP])
        palm_height = self._distance_2d(landmarks[WRIST], landmarks[MIDDLE_MCP])
        return max(palm_width, palm_height, 0.001)

    def _finger_direction(self, landmarks):
        """用 wrist -> middle_tip 表示手指整体方向。"""
        return np.array([
            landmarks[MIDDLE_TIP].x - landmarks[WRIST].x,
            landmarks[MIDDLE_TIP].y - landmarks[WRIST].y,
        ])

    def _cosine_similarity(self, first, second):
        """计算两个二维方向向量的相似度，1 表示方向完全一致。"""
        denominator = np.linalg.norm(first) * np.linalg.norm(second)

        if denominator == 0:
            return 0

        return float(np.dot(first, second) / denominator)

    def _pose_landmark_visible(self, landmark):
        """判断 pose 关键点是否足够可信。"""
        return self._pose_visibility(landmark) >= POSE_VISIBILITY_THRESHOLD

    def _pose_visibility(self, landmark):
        """安全读取 pose landmark 的 visibility 字段。"""
        return float(getattr(landmark, "visibility", 1) or 0)

    def _line_angle_degrees(self, first, second):
        """计算两个 landmark 连线相对水平线的角度，单位是度。"""
        return float(np.degrees(np.arctan2(second.y - first.y, second.x - first.x)))

    def _normalize_angle(self, angle):
        """把角度折叠到 -90 到 90 度之间，便于判断左右倾斜幅度。"""
        while angle > 90:
            angle -= 180

        while angle < -90:
            angle += 180

        return float(angle)

    def _midpoint(self, first, second):
        """返回两个 landmark 的二维中点。"""
        return SimpleNamespace(
            x=(first.x + second.x) / 2,
            y=(first.y + second.y) / 2,
            z=(getattr(first, "z", 0) + getattr(second, "z", 0)) / 2,
        )

    def _average_point(self, points):
        """返回多个 landmark 的平均位置。"""
        count = len(points) or 1
        return SimpleNamespace(
            x=sum(point.x for point in points) / count,
            y=sum(point.y for point in points) / count,
            z=sum(getattr(point, "z", 0) for point in points) / count,
        )

    def _distance(self, first, second):
        """三维 landmark 距离。"""
        return ((first.x - second.x) ** 2 + (first.y - second.y) ** 2 + (first.z - second.z) ** 2) ** 0.5

    def _distance_2d(self, first, second):
        """二维画面距离，只使用 x/y 坐标。"""
        return ((first.x - second.x) ** 2 + (first.y - second.y) ** 2) ** 0.5

    def _point_debug(self, point):
        """把单个 landmark 转成 debug 用的普通 dict。"""
        return {
            "x": point.x,
            "y": point.y,
            "z": point.z,
        }

    def _result(self, success, gesture=None, landmarks=None, connections=None, debug=None):
        """构造统一返回结果，供 /api/gesture 直接转成 JSON。"""
        danmaku_text = get_danmaku_text(gesture) if gesture else ""
        send_rule = get_gesture_send_rule(gesture) if gesture else {}

        return {
            "success": success,
            "gesture": gesture,
            "danmakuText": danmaku_text,
            "sendRule": send_rule,
            "message": f"成功发送弹幕：{danmaku_text}" if success else "",
            "landmarks": landmarks or [],
            "connections": connections or self.connections,
            "debug": debug or {},
        }
