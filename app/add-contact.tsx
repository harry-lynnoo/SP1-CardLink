// app/add-contact.tsx
// pull shark
import { FontAwesome } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const BRAND_BLUE = "#213BBB";

function useParamString(name: string) {
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>();
  const value = params[name];
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

export default function AddContactScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const imageUri = useParamString("imageUri");

  const [ocrLoading, setOcrLoading] = useState(false);

  const [contact, setContact] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    position: "",
    phone: "",
    email: "",
    company: "",
    website: "",
    notes: "",
    additionalPhones: [] as string[],
    cardImage: imageUri || "",
  });

  useLayoutEffect(() => {
    // @ts-ignore
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (imageUri) handleOCR(imageUri);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUri]);

  const handleOCR = async (cloudinaryUrl: string) => {
    setOcrLoading(true);
    try {
      const token = await SecureStore.getItemAsync("userToken");
      const response = await fetch("https://cardlink.onrender.com/api/ocr", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: cloudinaryUrl }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.log("❌ OCR failed:", data);
        throw new Error(data.message || "OCR processing failed");
      }

      console.log("✅ OCR result:", data);
      setContact((prev) => ({
        ...prev,
        firstName: data.firstName?.value || "",
        lastName: data.lastName?.value || "",
        nickname: data.nickname?.value || "",
        position: data.position?.value || "",
        phone: data.phone?.value || "",
        email: data.email?.value || "",
        company: data.company?.value || "",
        website: data.website?.value || "",
        notes: data.notes?.value || "",
        additionalPhones: Array.isArray(data.additionalPhones)
          ? data.additionalPhones.map((p: any) => p?.value || "")
          : [],
        cardImage: cloudinaryUrl,
      }));
    } catch (error: any) {
      console.error("❌ OCR error:", error);
      Alert.alert("Error", error.message || "OCR processing failed");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    if (ocrLoading) return;

    if (!contact.firstName.trim() && !contact.lastName.trim()) {
      Alert.alert("Missing Info", "Please enter at least a first or last name.");
      return;
    }
    if (!contact.phone.trim() && !contact.email.trim()) {
      Alert.alert("Missing Info", "Please enter a phone number or an email.");
      return;
    }

    const token = await SecureStore.getItemAsync("userToken");
    if (!token) {
      Alert.alert("Error", "No token found. Please log in again.");
      return;
    }

    const contactToSave = { ...contact, additionalPhones: contact.additionalPhones };

    try {
      const resAll = await fetch("https://cardlink.onrender.com/api/contacts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const existing = await resAll.json();
      if (!resAll.ok || !Array.isArray(existing)) {
        throw new Error("Could not load contacts for duplicate check");
      }

      const duplicate = existing.find(
        (c: any) =>
          (c.email && contactToSave.email && c.email === contactToSave.email) ||
          (c.phone && contactToSave.phone && c.phone === contactToSave.phone)
      );

      if (duplicate) {
        Alert.alert(
          "Duplicate Contact Found",
          `${contactToSave.firstName} ${contactToSave.lastName} already exists. Replace it with the latest info?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Keep Both", onPress: async () => await actuallySave(token, contactToSave) },
            { text: "Replace", onPress: async () => await replaceContact(token, duplicate._id, contactToSave) },
          ]
        );
      } else {
        await actuallySave(token, contactToSave);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not save contact");
    }
  };

  const actuallySave = async (token: string, contactToSave: any) => {
    try {
      const res = await fetch("https://cardlink.onrender.com/api/contacts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(contactToSave),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Saved", "Contact added successfully!");
        router.replace("/contact");
      } else {
        Alert.alert("Error", data.message || "Failed to save");
      }
    } catch {
      Alert.alert("Network Error", "Could not connect to server");
    }
  };

  const replaceContact = async (token: string, id: string, newData: any) => {
    try {
      const res = await fetch(`https://cardlink.onrender.com/api/contacts/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newData),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Updated", "Contact replaced with latest info!");
        router.replace("/contact");
      } else {
        Alert.alert("Error", data.message || "Failed to replace contact");
      }
    } catch {
      Alert.alert("Network Error", "Could not connect to server");
    }
  };

  const updateAdditionalPhone = (index: number, value: string) => {
    const updated = [...contact.additionalPhones];
    updated[index] = value;
    setContact({ ...contact, additionalPhones: updated });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: BRAND_BLUE,
          paddingHorizontal: 20,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome name="arrow-left" size={20} color="white" />
        </TouchableOpacity>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginLeft: 12 }}>
          Add Contact
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 })}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
          {/* Preview Card (scanned image) */}
          {imageUri ? (
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 12,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: "#E7ECFF",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Text style={{ fontWeight: "600", color: "#334155", marginBottom: 8 }}>
                Scanned Card
              </Text>

              {/* IMPORTANT: show exactly what we have (no extra crop). */}
              <Image
                source={{ uri: String(imageUri) }}
                style={{
                  width: "100%",
                  height: 190,
                  borderRadius: 12,
                  backgroundColor: "#f1f5f9",
                }}
                resizeMode="contain"
              />

              {ocrLoading && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 12 + 22,
                    left: 12,
                    right: 12,
                    bottom: 12,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.85)",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <ActivityIndicator size="large" color={BRAND_BLUE} />
                  <Text style={{ color: "#334155", fontWeight: "600" }}>Processing OCR…</Text>
                  <Text style={{ color: "#64748b", fontSize: 12 }}>
                    Extracting name, phone, email, and more
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Form Card */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: "#E7ECFF",
              opacity: ocrLoading ? 0.98 : 1,
            }}
          >
            <SectionLabel title="Identity" />
            <Row two>
              <Input
                label="First Name"
                value={contact.firstName}
                onChangeText={(v) => setContact({ ...contact, firstName: v })}
                icon="user"
                editable={!ocrLoading}
              />
              <Input
                label="Last Name"
                value={contact.lastName}
                onChangeText={(v) => setContact({ ...contact, lastName: v })}
                icon="user"
                editable={!ocrLoading}
              />
            </Row>
            <Input
              label="Nickname"
              value={contact.nickname}
              onChangeText={(v) => setContact({ ...contact, nickname: v })}
              icon="id-badge"
              editable={!ocrLoading}
            />
            <Input
              label="Position"
              value={contact.position}
              onChangeText={(v) => setContact({ ...contact, position: v })}
              icon="briefcase"
              editable={!ocrLoading}
            />

            <Divider />

            <SectionLabel title="Contact" />
            <Input
              label="Phone Number"
              keyboardType="phone-pad"
              value={contact.phone}
              onChangeText={(v) => setContact({ ...contact, phone: v })}
              icon="phone"
              editable={!ocrLoading}
            />
            {contact.additionalPhones.map((num, idx) => (
              <Input
                key={idx}
                label={`Additional Phone ${idx + 1}`}
                keyboardType="phone-pad"
                value={num}
                onChangeText={(v) => updateAdditionalPhone(idx, v)}
                icon="phone"
                editable={!ocrLoading}
              />
            ))}
            <TouchableOpacity
              disabled={ocrLoading}
              onPress={() =>
                setContact({
                  ...contact,
                  additionalPhones: [...contact.additionalPhones, ""],
                })
              }
              style={{ marginBottom: 8, opacity: ocrLoading ? 0.5 : 1 }}
            >
              <Text style={{ color: BRAND_BLUE, fontWeight: "600" }}>
                + Add another phone
              </Text>
            </TouchableOpacity>

            <Input
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={contact.email}
              onChangeText={(v) => setContact({ ...contact, email: v })}
              icon="envelope-o"
              editable={!ocrLoading}
            />

            <Divider />

            <SectionLabel title="Company" />
            <Input
              label="Company"
              value={contact.company}
              onChangeText={(v) => setContact({ ...contact, company: v })}
              icon="building-o"
              editable={!ocrLoading}
            />
            <Input
              label="Website"
              autoCapitalize="none"
              keyboardType="url"
              value={contact.website}
              onChangeText={(v) => setContact({ ...contact, website: v })}
              icon="globe"
              editable={!ocrLoading}
            />

            <Divider />

            <SectionLabel title="Notes" />
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <FontAwesome name="sticky-note-o" size={16} color="#64748b" />
              <Text style={{ color: "#64748b", marginLeft: 8, fontSize: 13 }}>
                Additional Notes
              </Text>
            </View>
            <TextInput
              placeholder="Additional Notes"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              value={contact.notes}
              onChangeText={(v) => setContact({ ...contact, notes: v })}
              editable={!ocrLoading}
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                paddingHorizontal: 12,
                paddingVertical: 12,
                minHeight: 110,
                color: "#0f172a",
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Save Bar */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom + 12,
          paddingTop: 12,
          paddingHorizontal: 16,
          backgroundColor: "rgba(255,255,255,0.9)",
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
        }}
      >
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.9}
          disabled={ocrLoading}
          style={{
            backgroundColor: BRAND_BLUE,
            borderRadius: 999,
            paddingVertical: 14,
            alignItems: "center",
            justifyContent: "center",
            opacity: ocrLoading ? 0.6 : 1,
            flexDirection: "row",
            gap: 8,
          }}
        >
          {ocrLoading ? (
            <>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                Please wait…
              </Text>
            </>
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              Save Contact
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ---------- Small UI bits ---------- */
function SectionLabel({ title }: { title: string }) {
  return (
    <Text style={{ color: "#475569", fontWeight: "700", marginBottom: 8, marginTop: 4 }}>
      {title}
    </Text>
  );
}
function Divider() {
  return <View style={{ height: 1, backgroundColor: "#eef2ff", marginVertical: 12 }} />;
}
function Row({ two, children }: { two?: boolean; children: React.ReactNode }) {
  if (!two) return <View style={{ gap: 10 }}>{children}</View>;
  const arr = Array.isArray(children) ? (children as React.ReactNode[]) : [children as React.ReactNode];
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}>{arr[0]}</View>
      <View style={{ flex: 1 }}>{arr[1]}</View>
    </View>
  );
}
function Input({
  label,
  icon,
  textarea,
  style,
  ...rest
}: {
  label: string;
  icon?: React.ComponentProps<typeof FontAwesome>["name"];
  textarea?: boolean;
  style?: any;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: "#64748b", marginBottom: 6, fontSize: 13 }}>{label}</Text>
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f8fafc",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#e5e7eb",
            paddingHorizontal: 12,
            paddingVertical: textarea ? 10 : 12,
          },
          style,
        ]}
      >
        {icon && <FontAwesome name={icon} size={16} color="#64748b" />}
        <TextInput
          placeholder={label}
          placeholderTextColor="#94a3b8"
          style={{
            flex: 1,
            marginLeft: icon ? 8 : 0,
            padding: 0,
            color: "#0f172a",
            minHeight: textarea ? 88 : undefined,
          }}
          {...rest}
        />
      </View>
    </View>
  );
}
