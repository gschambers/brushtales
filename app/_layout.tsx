import { Stack } from 'expo-router'
import { Text, View } from 'react-native'

import { AppProviders } from '../src/providers/AppProviders'

export default function RootLayout() {
  return (
    <AppProviders>
      <View>
        <Text>BrushTales</Text>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </AppProviders>
  )
}
