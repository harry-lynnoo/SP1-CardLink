// app/crop.tsx
//pull shark
import { FontAwesome } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  GestureHandlerRootView,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PinchGestureHandler,
  PinchGestureHandlerGestureEvent,
} from "react-native-gesture-handler";

import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";

// ===== Theme (visual only) =====
const BRAND_BLUE = "#213BBB";
const BG_LIGHT = "#EAF3FF";
const TEXT_PRIMARY = "#1B2B41";
const TEXT_MUTED = "rgba(27,43,65,0.7)";
const BORDER = "rgba(33,59,187,0.12)";

const CLOUD_NAME = "dwmav1imw";
const UPLOAD_PRESET = "ml_default";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const frameWidth = screenWidth * 0.9;
const frameHeight = frameWidth * 0.6;

export default function CropScreen() {
  const { imageUri } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const [processing, setProcessing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, []);

  // ===== Gestures (unchanged) =====
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pinchRef = useRef(null);
  const panRef = useRef(null);

  const pinchHandler = useAnimatedGestureHandler<
    PinchGestureHandlerGestureEvent,
    { startScale: number }
  >({
    onStart: (_, ctx) => {
      ctx.startScale = scale.value;
    },
    onActive: (event, ctx) => {
      if (event.numberOfPointers >= 2) {
        scale.value = ctx.startScale * event.scale;
      }
    },
  });

  const panHandler = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    { startX: number; startY: number }
  >({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
      ctx.startY = translateY.value;
    },
    onActive: (event, ctx) => {
      translateX.value = ctx.startX + event.translationX;
      translateY.value = ctx.startY + event.translationY;
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  // ===== Upload helper (unchanged) =====
  const uploadToCloudinary = async (uri: string) => {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const data = new FormData();
    data.append("file", `data:image/jpeg;base64,${base64}`);
    data.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: data }
    );
    const json = await res.json();
    if (json.secure_url) return json.secure_url;
    throw new Error("Cloudinary upload failed: " + JSON.stringify(json));
  };

  // ===== Confirm (unchanged) =====
  const handleConfirm = async () => {
    if (!imageUri) return;
    try {
      setProcessing(true);

      const imgInfo = await ImageManipulator.manipulateAsync(imageUri as string, []);
      const imgWidth = imgInfo.width;
      const imgHeight = imgInfo.height;

      const frameX = (screenWidth - frameWidth) / 2;
      const frameY = screenHeight / 2 - frameHeight / 2;

      const scaleX = imgWidth / screenWidth;
      const scaleY = imgHeight / screenHeight;

      const currentScale = scale.value;
      const offsetX = translateX.value * scaleX;
      const offsetY = translateY.value * scaleY;

      const cropRegion = {
        originX: Math.max(0, frameX * scaleX - offsetX),
        originY: Math.max(0, frameY * scaleY - offsetY),
        width: Math.min(imgWidth, (frameWidth * scaleX) / currentScale),
        height: Math.min(imgHeight, (frameHeight * scaleY) / currentScale),
      };

      const cropped = await ImageManipulator.manipulateAsync(
        imageUri as string,
        [{ crop: cropRegion }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );

      const cloudUrl = await uploadToCloudinary(cropped.uri);

      router.replace({
        pathname: "/add-contact",
        params: { imageUri: cloudUrl },
      });
    } catch (err) {
      console.error("❌ Crop/upload failed:", err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Header (rounded bottom, no separate banner) */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
            <FontAwesome name="arrow-left" size={18} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crop Business Card</Text>
          <View style={{ width: 36, height: 36, opacity: 0 }} />
        </View>

        {/* Optional soft strip to echo Home but integrated */}
        <View style={styles.headerUnderlay} />

        {/* Workspace */}
        <View style={styles.canvasWrap}>
          {imageUri ? (
            <PinchGestureHandler
              ref={pinchRef}
              onGestureEvent={pinchHandler}
              simultaneousHandlers={panRef}
            >
              <Animated.View style={{ flex: 1 }}>
                <PanGestureHandler
                  ref={panRef}
                  onGestureEvent={panHandler}
                  simultaneousHandlers={pinchRef}
                >
                  <Animated.View style={[animatedStyle]}>
                    <Image
                      source={{ uri: imageUri as string }}
                      style={styles.preview}
                    />
                  </Animated.View>
                </PanGestureHandler>
              </Animated.View>
            </PinchGestureHandler>
          ) : (
            <Text style={styles.emptyText}>No image loaded</Text>
          )}

          {/* Blue card frame */}
          <View style={styles.cardFrame} pointerEvents="none" />

          {/* Hint */}
          <View style={styles.hint}>
            <Text style={styles.hintText}>Pinch to zoom · Drag to position</Text>
          </View>
        </View>

        {/* Bottom actions */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.secondaryBtn, processing && { opacity: 0.6 }]}
            onPress={() => router.back()}
            disabled={processing}
          >
            <FontAwesome name="close" size={16} color={BRAND_BLUE} />
            <Text style={styles.secondaryText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, processing && { opacity: 0.7 }]}
            onPress={handleConfirm}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome name="check" size={18} color="#fff" />
                <Text style={styles.primaryText}>Use Photo</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ===== Styles (visual only) =====
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  // Blue header with rounded bottom edges
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BRAND_BLUE,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 16,
    fontFamily: "Nunito",
    letterSpacing: 0.2,
  },

  // A tiny underlay to create a smooth visual transition under the rounded header
  headerUnderlay: {
    height: 18,
    backgroundColor: BG_LIGHT,
    marginTop: -8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },

  canvasWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  preview: {
    width: screenWidth,
    height: screenHeight * 0.68,
    resizeMode: "contain",
  },

  cardFrame: {
    position: "absolute",
    width: frameWidth,
    height: frameHeight,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: BRAND_BLUE,
    ...shadow(8),
  },

  hint: {
    position: "absolute",
    bottom: 18,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  hintText: {
    color: TEXT_MUTED,
    fontFamily: "Nunito",
    fontSize: 12.5,
    letterSpacing: 0.3,
  },

  emptyText: {
    color: TEXT_PRIMARY,
    fontFamily: "Nunito",
  },

  bottomBar: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: "#FFF",
  },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
  },
  secondaryText: {
    color: BRAND_BLUE,
    fontFamily: "Nunito",
    fontSize: 14,
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: BRAND_BLUE,
    ...shadow(10),
  },
  primaryText: {
    color: "#FFFFFF",
    fontFamily: "Nunito",
    fontSize: 14,
  },
});

// subtle cross-platform shadow similar to your cards
function shadow(radius: number) {
  if (Platform.OS === "android") {
    return { elevation: Math.min(12, Math.max(2, Math.round(radius))) };
  }
  return {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: radius,
    shadowOffset: { width: 0, height: 2 },
  };
}
