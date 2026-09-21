import { Image, StyleSheet, View } from 'react-native'

import { sessionTheme } from './sessionTheme'

export interface ZoneAtlasProps {
  zoneIndex: number
  width?: number
  reducedMotion?: boolean
}

type Arch = 'upper' | 'lower'
type Surface = 'front' | 'chewing' | 'inside'

const groupNames = ['left', 'center', 'right'] as const
const zoneCount = 18

function normalizeZoneIndex(zoneIndex: number): number {
  return ((Math.trunc(zoneIndex) % zoneCount) + zoneCount) % zoneCount
}

function groupForPosition(positionIndex: number): number {
  if (positionIndex >= 7) return 2
  if (positionIndex >= 3) return 1
  return 0
}

function activeToothCount(group: number): number {
  return group === 1 ? 4 : 3
}

function ToothRow({
  arch,
  activeArch,
  activeGroup,
  surface,
  width,
}: {
  arch: Arch
  activeArch: Arch
  activeGroup: number
  surface: Surface
  width: number
}) {
  const isActiveRow = arch === activeArch
  const rowGroupName = groupNames[activeGroup]
  const brushPosition = arch === 'lower' ? 2 - activeGroup : activeGroup
  const brushBoxWidth = 132
  const brushLeft = Math.max(0, Math.min(width - brushBoxWidth, (width * [0.167, 0.5, 0.833][brushPosition]) - brushBoxWidth / 2))

  return (
    <View style={[styles.row, arch === 'lower' && styles.lowerRow]}>
      {Array.from({ length: 10 }, (_, index) => {
        const positionIndex = arch === 'lower' ? 9 - index : index
        const active = isActiveRow && groupForPosition(positionIndex) === activeGroup
        return (
          <View
            key={`${arch}-${index}`}
            testID="tooth"
            style={[styles.tooth, surface === 'front' && styles.frontTooth, surface !== 'front' && styles.openTooth, active && styles.activeTooth]}
          >
            {active && <View pointerEvents="none" testID="active-tooth" style={styles.activeToothMarker} />}
          </View>
        )
      })}
      {isActiveRow && (
        <View
          testID={`active-group-${rowGroupName}${arch === 'lower' ? '-lower' : ''}`}
          style={[styles.groupMarker, { left: brushLeft }]}
        >
          <Image
            accessibilityElementsHidden
            accessible={false}
            resizeMode="contain"
            source={require('../../../assets/openmoji-toothbrush.png')}
            style={styles.toothbrush}
            testID="toothbrush"
          />
        </View>
      )}
    </View>
  )
}

export function ZoneAtlas({ zoneIndex, width = 240 }: ZoneAtlasProps) {
  const normalized = normalizeZoneIndex(zoneIndex)
  const activeArch: Arch = normalized < 9 ? 'upper' : 'lower'
  const activeGroup = normalized % 3
  const surface: Surface = normalized % 3 === 0 ? 'front' : normalized % 3 === 1 ? 'chewing' : 'inside'

  return (
    <View style={[styles.atlas, { width }]}>
      <ToothRow arch="upper" activeArch={activeArch} activeGroup={activeGroup} surface={surface} width={width} />
      <ToothRow arch="lower" activeArch={activeArch} activeGroup={activeGroup} surface={surface} width={width} />
    </View>
  )
}

const styles = StyleSheet.create({
  atlas: {
    minHeight: 126,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingVertical: 8,
  },
  row: {
    position: 'relative',
    height: 52,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 2,
    overflow: 'visible',
  },
  lowerRow: { transform: [{ rotate: '180deg' }] },
  tooth: {
    width: 18,
    height: 34,
    borderWidth: 2,
    borderColor: 'rgba(48,54,92,0.2)',
    borderRadius: 12,
    backgroundColor: sessionTheme.colors.white,
  },
  frontTooth: { transform: [{ translateY: 4 }] },
  openTooth: { height: 27, borderRadius: 10 },
  activeTooth: {
    borderColor: sessionTheme.colors.white,
    backgroundColor: sessionTheme.colors.accent,
    shadowColor: sessionTheme.colors.deep,
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  activeToothMarker: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  groupMarker: {
    position: 'absolute',
    top: -16,
    width: 132,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toothbrush: { width: 92, height: 92, transform: [{ rotate: '39deg' }] },
})

export { activeToothCount, groupForPosition }
