// app/_layout.tsx
//pull shark
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, Image, StatusBar, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated"; // keep FIRST for Reanimated
import { SafeAreaProvider } from "react-native-safe-area-context";
import "./globals.css"; // Tailwind (no-op on native, fine to keep)

const BRAND_BLUE = "#213BBB";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito: require("../assets/fonts/Nunito-Regular.ttf"),
    // Add more weights if needed:
    // NunitoBold: require("../assets/fonts/Nunito-Bold.ttf"),
    // NunitoSemiBold: require("../assets/fonts/Nunito-SemiBold.ttf"),
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Mount the router immediately */}
        <StatusBar barStyle="light-content" />
        <Stack
          screenOptions={{
            animation: "none",
            headerShown: false,
          }}
        />

        {/* Non-blocking branded overlay while fonts load */}
        {!fontsLoaded && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 24,
            }}
          >
            <Image
              source={require("../assets/images/icon.png")}
              style={{ width: 72, height: 72, marginBottom: 16, borderRadius: 12 }}
              resizeMode="contain"
            />
            <ActivityIndicator size="large" color={BRAND_BLUE} />
          </View>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
