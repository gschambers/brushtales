import { VisionCamera } from 'react-native-vision-camera'

export type CameraPermission = 'granted' | 'denied' | 'restricted'

export async function requestCameraPermission(): Promise<CameraPermission> {
  if (VisionCamera.cameraPermissionStatus === 'restricted') return 'restricted'
  if (VisionCamera.cameraPermissionStatus === 'denied') return 'denied'
  return (await VisionCamera.requestCameraPermission()) ? 'granted' : 'denied'
}
