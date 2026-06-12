import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import { initDatabase } from './src/database/db';
import TodayScreen from './src/screens/TodayScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ExportScreen from './src/screens/ExportScreen';

const Tab = createBottomTabNavigator();

const HEADER = {
  headerStyle: { backgroundColor: '#1a1a2e' },
  headerTintColor: '#e0e0e0',
  headerTitleStyle: { fontWeight: '700' },
  tabBarStyle: { backgroundColor: '#1a1a2e', borderTopColor: '#2d2d4e' },
  tabBarActiveTintColor: '#4cc9f0',
  tabBarInactiveTintColor: '#555',
};

export default function App() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#1a1a2e" />
        <NavigationContainer>
          <Tab.Navigator screenOptions={HEADER}>
            <Tab.Screen
              name="Today"
              component={TodayScreen}
              options={{
                tabBarIcon: ({ color }) => (
                  <Text style={{ fontSize: 20, color }}>📅</Text>
                ),
              }}
            />
            <Tab.Screen
              name="History"
              component={HistoryScreen}
              options={{
                tabBarIcon: ({ color }) => (
                  <Text style={{ fontSize: 20, color }}>📋</Text>
                ),
              }}
            />
            <Tab.Screen
              name="Export"
              component={ExportScreen}
              options={{
                tabBarIcon: ({ color }) => (
                  <Text style={{ fontSize: 20, color }}>📤</Text>
                ),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
