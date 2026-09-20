import { StyleSheet } from 'react-native'
import { Camera, useCameraDevice } from 'react-native-vision-camera'

import type { CameraPreviewProps } from './CameraPreview'

export function CameraPreview({ isActive, style }: CameraPreviewProps) {
  const device = useCameraDevice('front')
  if (!device) return null

  return <Camera device={device} isActive={isActive} style={[styles.camera, style]} />
}

const styles = StyleSheet.create({
  camera: { borderRadius: 16, height: 180, width: '100%' },
})
