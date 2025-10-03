import React from "react";
import { Tabs } from "expo-router";
import { Home, BookOpen, Brain, RefreshCw, BarChart, Settings as SettingsIcon } from "lucide-react-native";
import { useThemeColor } from "@/utils/useThemeColor";
import { EnhancedHamburgerMenu } from '@/components/EnhancedHamburgerMenu';

export default function TabLayout() {
  const { primary } = useThemeColor();
  
  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: primary,
          tabBarInactiveTintColor: "#888888",
          tabBarStyle: {
            backgroundColor: "#1a1a1a",
            borderTopColor: "#333333",
          },
          headerStyle: {
            backgroundColor: "#1a1a1a",
          },
          headerTintColor: "#ffffff",
          headerRight: () => <EnhancedHamburgerMenu inline />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="read"
          options={{
            title: "Recite",
            tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="quiz"
          options={{
            title: "Quiz",
            tabBarIcon: ({ color, size }) => <Brain size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="revision"
          options={{
            title: "Revision",
            tabBarIcon: ({ color, size }) => <RefreshCw size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: "Stats",
            tabBarIcon: ({ color, size }) => <BarChart size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => <SettingsIcon size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="badges"
          options={{
            title: "Badges",
            href: null, // This hides it from the tab bar
          }}
        />
      </Tabs>

      {/* Inline headerRight renders menu on all tabs; no absolute overlay needed */}
    </>
  );
}