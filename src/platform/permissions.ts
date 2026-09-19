export type CameraPermission = 'granted' | 'denied' | 'restricted'

interface VisionCameraSource {
  cameraPermissionStatus: 'not-determined' | 'authorized' | 'denied' | 'restricted'
  requestCameraPermission(): Promise<boolean>
}

function getVisionCamera(): VisionCameraSource {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-vision-camera').VisionCamera as VisionCameraSource
}

export async function requestCameraPermission(): Promise<CameraPermission> {
  const visionCamera = getVisionCamera()
  if (visionCamera.cameraPermissionStatus === 'restricted') return 'restricted'
  if (visionCamera.cameraPermissionStatus === 'denied') return 'denied'
  return (await visionCamera.requestCameraPermission()) ? 'granted' : 'denied'
}
