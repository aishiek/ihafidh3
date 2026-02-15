import { EnhancedHamburgerMenu } from '@/components/EnhancedHamburgerMenu';
import OccasionHeaderIcon from '@/components/OccasionHeaderIcon';
import { useThemeColor } from "@/utils/useThemeColor";
import { Tabs, router } from "expo-router";
import { BarChart, BookOpen, Brain, Home, RefreshCw, Settings as SettingsIcon } from "lucide-react-native";
import React from "react";
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { primary } = useThemeColor();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: primary,
          tabBarInactiveTintColor: "#888888",
          tabBarAllowFontScaling: false, // Prevent labels from growing too large
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: -4,
            marginBottom: Platform.OS === 'android' ? 6 : 4,
          },
          tabBarStyle: {
            backgroundColor: "#1a1a1a",
            borderTopColor: "#333333",
            height: Platform.OS === 'android' ? 60 + insets.bottom : 60,
            paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 12) : 8,
            paddingTop: Platform.OS === 'android' ? 8 : 0,
          },
          headerStyle: {
            backgroundColor: "#1a1a1a",
          },
          headerTintColor: "#ffffff",
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
              {/* Dynamic occasion icon placed between title and hamburger; centered vertically */}
              <OccasionHeaderIcon />
              <EnhancedHamburgerMenu inline />
            </View>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Home size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="read"
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault(); // Prevent default change

              const state = navigation.getState();
              const isFocused = state.routes[state.index].name === 'read';

              if (isFocused) {
                // If already on this tab, check if we need to reset or stay
                const currentRoute = state.routes[state.index];
                const params = currentRoute.params as any;
                const fromDuas = params?.fromDuas === 'true';

                if (fromDuas) {
                  // Special Case: If viewing a Dua, tap should reset to Surah list
                  router.replace('/(tabs)/read');
                } else {
                  // Default Preference: "Already reading -> Stay here"
                  // Do nothing (stay on verse view)
                }
              } else {
                // Not focused: Navigate to tab
                router.push('/(tabs)/read');
              }
            },
          })}
          options={{
            title: "Recite",
            tabBarIcon: ({ color, size }) => <BookOpen size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="quiz"
          options={{
            title: "Quiz",
            tabBarIcon: ({ color, size }) => <Brain size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="revision"
          options={{
            title: "Revise",
            tabBarIcon: ({ color, size }) => <RefreshCw size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: "Stats",
            tabBarIcon: ({ color, size }) => <BarChart size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Setup",
            tabBarIcon: ({ color, size }) => <SettingsIcon size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="badges"
          options={{
            title: "Badges",
            href: null, // This hides it from the tab bar
          }}
        />
        <Tabs.Screen
          name="duas"
          options={{
            title: "Quranic Duas",
            href: null, // This hides it from the tab bar
          }}
        />
      </Tabs>

      {/* Inline headerRight renders menu on all tabs; no absolute overlay needed */}
    </>
  );
}