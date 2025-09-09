
 
//pull shark
import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { usePathname, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { SafeAreaView } from "react-native-safe-area-context";
 
/* ---------- Theme ---------- */
const BRAND_BLUE = "#213BBB";
const LIGHT_BG = "#F6F7FB";
const CARD_BORDER = "#bfdbfe";
const ICON_BLUE = "#1996fc";
const STAR_YELLOW = "#F4C430";
 
/* ---------- Types ---------- */
type Contact = {
  cardImage: string;
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  website?: string;
  notes?: string;
  isFavorite: boolean;
  nickname?: string;
  position?: string;
  additionalPhones?: string[];
  createdAt?: string;
};
 
export default function Contacts() {
  const navigation = useNavigation();
  const router = useRouter();
 
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
 
  // filter/search UI state
  const [filterOpen, setFilterOpen] = useState(false);
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [company, setCompany] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "az" | "company">("newest");
  const [query, setQuery] = useState("");
 
  useLayoutEffect(() => {
    // @ts-ignore
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);
 
  useEffect(() => {
    const fetchContacts = async () => {
      const token = await SecureStore.getItemAsync("userToken");
      try {
        const res = await fetch("https://cardlink.onrender.com/api/contacts", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setContacts(data);
      } catch (err) {
        console.error("Error loading contacts:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, []);
 
  // companies for filter
  const companies = useMemo(() => {
    const set = new Set(
      contacts
        .map((c) => c.company?.trim())
        .filter((v): v is string => !!v)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contacts]);
 
  const norm = (s?: string) => (s || "").toLowerCase().trim();
 
  // filtered + searched list
  const displayed = useMemo(() => {
    let base = [...contacts];
    const q = norm(query);
    if (q) {
      base = base.filter((c) => {
        const hay = [
          c.firstName,
          c.lastName,
          `${c.firstName} ${c.lastName}`,
          c.company,
          c.email,
          c.phone,
          c.nickname,
          c.position,
          ...(c.additionalPhones || []),
        ]
          .map(norm)
          .join(" ");
        return hay.includes(q);
      });
    }
    if (showFavOnly) base = base.filter((c) => c.isFavorite);
    if (hasPhone) base = base.filter((c) => !!c.phone?.trim());
    if (hasEmail) base = base.filter((c) => !!c.email?.trim());
    if (company) base = base.filter((c) => c.company?.trim() === company);
 
    if (sortBy === "az") {
      base.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(
          `${b.firstName} ${b.lastName}`
        )
      );
    } else if (sortBy === "company") {
      base.sort((a, b) => (a.company || "").localeCompare(b.company || ""));
    } else {
      base.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );
    }
    return base;
  }, [contacts, showFavOnly, hasPhone, hasEmail, company, sortBy, query]);
 
  /* ---------- Favorite toggle ---------- */
  const toggleFavorite = async (contact: Contact) => {
    setContacts((prev) =>
      prev.map((c) =>
        c._id === contact._id ? { ...c, isFavorite: !c.isFavorite } : c
      )
    );
    try {
      const token = await SecureStore.getItemAsync("userToken");
      await fetch(`https://cardlink.onrender.com/api/contacts/${contact._id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isFavorite: !contact.isFavorite }),
      });
    } catch {
      // revert on failure
      setContacts((prev) =>
        prev.map((c) =>
          c._id === contact._id
            ? { ...c, isFavorite: contact.isFavorite }
            : c
        )
      );
      Alert.alert("Error", "Could not update favorite.");
    }
  };
 
  /* ---------- Delete ---------- */
  const confirmDelete = (contactId: string) => {
    Alert.alert("Delete Contact", "Are you sure you want to delete this contact?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => handleDelete(contactId) },
    ]);
  };
  const handleDelete = async (contactId: string) => {
    const token = await SecureStore.getItemAsync("userToken");
    try {
      const res = await fetch(`https://cardlink.onrender.com/api/contacts/${contactId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setContacts((prev) => prev.filter((c) => c._id !== contactId));
      else Alert.alert("Error", "Failed to delete contact.");
    } catch {
      Alert.alert("Error", "Something went wrong.");
    }
  };
 
  /* ---------- Call ---------- */
  const normalizePhone = (n: string) => n.replace(/[()\-\s]/g, "");
  const getAllNumbers = (c: Contact) =>
    Array.from(
      new Set(
        [c.phone, ...(c.additionalPhones || [])]
          .map((n) => (n || "").trim())
          .filter(Boolean)
      )
    );
 
  const openDialer = (raw?: string) => {
    if (!raw) {
      Alert.alert("No phone", "This contact has no phone number.");
      return;
    }
    const url = `tel:${normalizePhone(raw)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Could not open dialer.")
    );
  };
 
  const chooseAndCall = (c: Contact) => {
    const nums = getAllNumbers(c);
    if (nums.length === 0) {
      Alert.alert("No phone", "This contact has no phone number.");
      return;
    }
    if (nums.length === 1) {
      openDialer(nums[0]);
      return;
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Call ${`${c.firstName} ${c.lastName}`.trim()}`,
          options: [...nums, "Cancel"],
          cancelButtonIndex: nums.length,
        },
        (idx) => {
          if (idx !== undefined && idx >= 0 && idx < nums.length)
            openDialer(nums[idx]);
        }
      );
    } else {
      Alert.alert(
        "Call number",
        "Choose a number",
        [
          ...nums.map((n) => ({ text: n, onPress: () => openDialer(n) })),
          { text: "Cancel", style: "cancel" },
        ],
        { cancelable: true }
      );
    }
  };
 
  /* ---------- Swipe actions ---------- */
  const renderLeftActions = (_p: any, _x: any, onCall: () => void, hasAny: boolean) => (
    <TouchableOpacity
      onPress={onCall}
      disabled={!hasAny}
      style={{
        backgroundColor: hasAny ? "#10b981" : "#9ca3af",
        justifyContent: "center",
        alignItems: "center",
        width: 88,
        marginVertical: 14,
        borderRadius: 12,
        transform: [{ translateY: -8 }],
      }}
    >
      <FontAwesome name="phone" size={20} color="white" />
      <Text style={{ color: "white", marginTop: 4 }}>
        {hasAny ? "Call" : "No phone"}
      </Text>
    </TouchableOpacity>
  );
  const renderRightActions = (_p: any, _x: any, onDelete: () => void) => (
    <TouchableOpacity
      onPress={onDelete}
      style={{
        backgroundColor: "#ff5047",
        justifyContent: "center",
        alignItems: "center",
        width: 88,
        marginVertical: 14,
        borderRadius: 12,
        transform: [{ translateY: -8 }],
      }}
    >
      <FontAwesome name="trash" size={20} color="white" />
      <Text style={{ color: "white", marginTop: 4 }}>Delete</Text>
    </TouchableOpacity>
  );
 
  /* ---------- List Item (Home-style name) ---------- */
  const renderItem = useCallback(
    ({ item: c }: { item: Contact }) => (
      <Swipeable
        renderLeftActions={(p, x) =>
          renderLeftActions(p, x, () => chooseAndCall(c), getAllNumbers(c).length > 0)
        }
        renderRightActions={(p, x) =>
          renderRightActions(p, x, () => confirmDelete(c._id))
        }
      >
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/contact-detail",
              params: {
                _id: c._id,
                firstName: c.firstName,
                lastName: c.lastName,
                phone: c.phone,
                email: c.email,
                company: c.company,
                website: c.website || "",
                notes: c.notes || "",
                nickname: c.nickname || "",
                position: c.position || "",
                additionalPhones: JSON.stringify(c.additionalPhones || []),
                createdAt: c.createdAt || "",
                cardImage: c.cardImage || "",
                isFavorite: String(c.isFavorite),
              },
            })
          }
        >
          <View style={styles.card}>
            {/* avatar + name row */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.avatar}>
                <Text style={{ color: "#fff", fontWeight: "800" }}>
                  {(c.firstName?.[0] || "").toUpperCase()}
                  {(c.lastName?.[0] || "").toUpperCase()}
                </Text>
              </View>
 
              <View style={{ marginLeft: 12, flex: 1 }}>
                {/* ✅ EXACTLY like Home: 18 / 700 / blue-900 */}
                <Text style={styles.nameHomeLike}>
                  {c.firstName} {c.lastName}
                </Text>
                {!!c.nickname && (
                  <Text style={styles.subtitleHomeLike}>{c.nickname}</Text>
                )}
              </View>
 
              {/* Favorite pill */}
              <TouchableOpacity
                onPress={() => toggleFavorite(c)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.starPill}
              >
                <FontAwesome
                  name={c.isFavorite ? "star" : "star-o"}
                  size={16}
                  color={c.isFavorite ? STAR_YELLOW : "#c9d2f6"}
                />
              </TouchableOpacity>
            </View>
 
            {/* details */}
            <View style={{ marginTop: 10 }}>
              <View style={styles.row}>
                <FontAwesome name="phone" size={14} color={ICON_BLUE} />
                <Text style={styles.rowText}>
                  {getAllNumbers(c)[0] || "—"}
                </Text>
              </View>
              <View style={styles.row}>
                <MaterialIcons name="email" size={14} color={ICON_BLUE} />
                <Text style={styles.rowText}>{c.email?.trim() || "—"}</Text>
              </View>
              <View style={styles.row}>
                <FontAwesome name="briefcase" size={14} color={ICON_BLUE} />
                <Text style={styles.rowText}>{c.company?.trim() || "—"}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    ),
    [router]
  );
 
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: LIGHT_BG }}>
      {/* Header */}
      <View style={{ backgroundColor: BRAND_BLUE }} className="px-4 py-6">
        <Text className="text-white text-2xl font-nunito font-bold">
          Contacts
        </Text>
      </View>
 
      {/* Search + filter */}
      <View style={{ backgroundColor: LIGHT_BG, paddingBottom: 8 }}>
        <View className="px-4 mt-3">
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#fff",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: "#e5e7eb",
            }}
          >
            <FontAwesome name="search" size={16} color="#64748b" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, company, phone, email…"
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={{
                flex: 1,
                marginLeft: 8,
                padding: 0,
                color: "#0f172a",
              }}
            />
            <TouchableOpacity onPress={() => setFilterOpen(true)}>
              <FontAwesome name="filter" size={16} color={BRAND_BLUE} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
 
      {/* List */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 96,
        }}
      >
        {loading ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator size="large" color={BRAND_BLUE} />
          </View>
        ) : displayed.length === 0 ? (
          <Text className="text-center text-gray-600 font-nunito">
            No contacts found.
          </Text>
        ) : (
          <FlatList
            data={displayed}
            keyExtractor={(c) => c._id}
            renderItem={renderItem}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 4 }}
          />
        )}
      </View>
 
      {/* Filter sheet */}
      {filterOpen && (
        <Pressable
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.25)",
            justifyContent: "flex-end",
            zIndex: 999,
          }}
          onPress={() => setFilterOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-base font-nunito mb-3">Filters</Text>
 
            <ToggleRow
              label="Favorites only"
              checked={showFavOnly}
              onPress={() => setShowFavOnly((v) => !v)}
            />
            <ToggleRow
              label="Has phone"
              checked={hasPhone}
              onPress={() => setHasPhone((v) => !v)}
            />
            <ToggleRow
              label="Has email"
              checked={hasEmail}
              onPress={() => setHasEmail((v) => !v)}
            />
 
            {companies.length > 0 && (
              <>
                <Divider />
                <Text className="text-base font-nunito mb-2">Company</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <CompanyChip
                    label="All"
                    active={company === null}
                    onPress={() => setCompany(null)}
                  />
                  {companies.map((co) => (
                    <CompanyChip
                      key={co}
                      label={co}
                      active={company === co}
                      onPress={() => setCompany(co)}
                    />
                  ))}
                </View>
              </>
            )}
 
            <Divider />
            <Text className="text-base font-nunito mb-2">Sort by</Text>
            <View style={{ flexDirection: "row", columnGap: 10, flexWrap: "wrap" }}>
              <Chip
                label="Newest"
                active={sortBy === "newest"}
                onPress={() => setSortBy("newest")}
              />
              <Chip
                label="A–Z (Name)"
                active={sortBy === "az"}
                onPress={() => setSortBy("az")}
              />
              <Chip
                label="Company (A–Z)"
                active={sortBy === "company"}
                onPress={() => setSortBy("company")}
              />
            </View>
 
            <View
              style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 14 }}
            >
              <TouchableOpacity onPress={() => setFilterOpen(false)} style={{ padding: 10 }}>
                <Text style={{ color: BRAND_BLUE, fontWeight: "600" }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      )}
 
      {/* Bottom nav embedded (Option 1) */}
      <BottomNav />
    </SafeAreaView>
  );
}
 
/* ---------- Styles (match Home card) ---------- */
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    minHeight: 108,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#bfdbfe",
  },
  // ✅ Same as Home card
  nameHomeLike: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  subtitleHomeLike: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  rowText: { color: "#111827", fontSize: 14, marginLeft: 8 },
  starPill: {
    backgroundColor: "#f4f6ff",
    borderWidth: 1,
    borderColor: "#e3e8ff",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
 
/* ---------- Helpers ---------- */
function Divider() {
  return (
    <View style={{ height: 1, backgroundColor: "#eef2ff", marginVertical: 12 }} />
  );
}
function ToggleRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ paddingVertical: 12, flexDirection: "row", alignItems: "center" }}
    >
      <FontAwesome name={checked ? "check-square-o" : "square-o"} size={18} color="#111" />
      <Text style={{ marginLeft: 10 }}>{label}</Text>
    </TouchableOpacity>
  );
}
function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: active ? BRAND_BLUE : "#f1f5f9",
        marginBottom: 8,
      }}
    >
      <Text style={{ color: active ? "#fff" : "#111" }}>{label}</Text>
    </TouchableOpacity>
  );
}
function CompanyChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: active ? BRAND_BLUE : "#f1f5f9",
      }}
    >
      <Text style={{ color: active ? "#fff" : "#111" }}>{label}</Text>
    </TouchableOpacity>
  );
}
 
/* ---------- BottomNav (embedded here) ---------- */
function BottomNav({ hidden }: { hidden?: boolean }) {
  if (hidden) return null;
  const pathname = usePathname();
  const router = useRouter();
 
  const active: "home" | "contacts" | "calendar" | "profile" =
    pathname.startsWith("/profile")
      ? "profile"
      : pathname.startsWith("/calendar")
      ? "calendar"
      : pathname.startsWith("/contact")
      ? "contacts"
      : "home";
 
  const Item = ({
    isActive,
    onPress,
    icon,
  }: {
    isActive?: boolean;
    onPress: () => void;
    icon: React.ComponentProps<typeof FontAwesome>["name"];
  }) =>
    isActive ? (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.85)",
        }}
      >
        <FontAwesome name={icon} size={20} color={BRAND_BLUE} />
      </TouchableOpacity>
    ) : (
      <TouchableOpacity
        onPress={onPress}
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <FontAwesome name={icon} size={20} color="#FFFFFF" />
      </TouchableOpacity>
    );
 
  return (
    <View
      style={{ position: "absolute", left: 20, right: 20, bottom: 24, alignItems: "center" }}
      pointerEvents="box-none"
    >
      <View
        style={{
          backgroundColor: BRAND_BLUE,
          borderRadius: 999,
          paddingVertical: 12,
          paddingHorizontal: 18,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        }}
      >
        <Item icon="home" isActive={active === "home"} onPress={() => router.replace("/home")} />
        <Item icon="address-book-o" isActive={active === "contacts"} onPress={() => router.replace("/contact")} />
        <Item icon="calendar-o" isActive={active === "calendar"} onPress={() => router.replace("/calendar")} />
        <Item icon="user-o" isActive={active === "profile"} onPress={() => router.replace("/profile")} />
      </View>
    </View>
  );
}
 
 