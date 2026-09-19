import { Stack } from 'expo-router'
import { Text, View } from 'react-native'

import { AppProviders } from '../src/app/AppProviders'

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
