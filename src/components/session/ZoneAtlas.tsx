import { Animated, StyleSheet, View } from 'react-native'
import Svg, { Defs, Ellipse, G, Line, LinearGradient, Path, Stop } from 'react-native-svg'
import { useEffect, useState } from 'react'

import { sessionTheme } from './sessionTheme'

export interface ZoneAtlasProps {
  zoneIndex: number
  width?: number
  viewportWidth?: number
  reducedMotion?: boolean
  paused?: boolean
  tone?: { accent: string; deep: string; light?: string; main?: string }
}

type Arch = 'upper' | 'lower'
type Surface = 'front' | 'chewing' | 'inside'

const groupNames = ['left', 'center', 'right'] as const
const zoneCount = 18
const brushWidth = 150
const brushImageSize = 112
const AnimatedView = Animated.createAnimatedComponent(View)

const frontDrops = [4, 3, 2, 1, 0, 0, 1, 2, 3, 4]
const frontTilts = [-8, -6, -4, -2, 0, 0, 2, 4, 6, 8]
const openDrops = [26, 14, 5, 0, -1, -1, 0, 5, 14, 26]
const openTilts = [-26, -15, -7, -3, -1, 1, 3, 7, 15, 26]

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

function toothPath(width: number, height: number, surface: Surface): string {
  const [topLeftX, topRightX, bottomRightX, bottomLeftX] = surface === 'front'
    ? [0.45, 0.45, 0.32, 0.32]
    : [0.36, 0.36, 0.38, 0.38]
  const [topLeftY, topRightY, bottomRightY, bottomLeftY] = surface === 'front'
    ? [0.28, 0.28, 0.72, 0.72]
    : [0.34, 0.34, 0.62, 0.62]
  const tlx = width * topLeftX
  const trx = width * topRightX
  const brx = width * bottomRightX
  const blx = width * bottomLeftX
  const tly = height * topLeftY
  const tryY = height * topRightY
  const bry = height * bottomRightY
  const bly = height * bottomLeftY
  return [
    `M ${tlx} 0`,
    `H ${width - trx}`,
    `A ${trx} ${tryY} 0 0 1 ${width} ${tryY}`,
    `V ${height - bry}`,
    `A ${brx} ${bry} 0 0 1 ${width - brx} ${height}`,
    `H ${blx}`,
    `A ${blx} ${bly} 0 0 1 0 ${height - bly}`,
    `V ${tly}`,
    `A ${tlx} ${tly} 0 0 1 ${tlx} 0`,
    'Z',
  ].join(' ')
}

function rowGeometry(surface: Surface) {
  if (surface === 'front') return { height: 60, rowY: [0, 30], toothHeight: 27, drops: frontDrops, tilts: frontTilts }
  return { height: 112, rowY: [0, 56], toothHeight: 25, drops: openDrops, tilts: openTilts }
}

function Toothbrush({
  arch,
  group,
  surface,
  width,
  paused,
  reducedMotion,
  label,
}: {
  arch: Arch
  group: number
  surface: Surface
  width: number
  paused: boolean
  reducedMotion: boolean
  label: string
}) {
  const [sweep] = useState(() => new Animated.Value(0))
  const shouldAnimate = !paused && !reducedMotion
  const brushPosition = arch === 'lower' ? 2 - group : group
  const rowHeight = surface === 'front' ? 30 : 56
  const sourceLeft = Math.max(arch === 'lower' ? 0 : -75, Math.min(width - brushWidth, (width * [0.167, 0.5, 0.833][brushPosition]) - 75))
  const brushLeft = arch === 'lower' ? width - sourceLeft - brushWidth : sourceLeft
  const brushTop = arch === 'lower' ? (rowHeight * 2) - 2 - 56 : 2

  useEffect(() => {
    if (!shouldAnimate) {
      sweep.stopAnimation()
      sweep.setValue(0)
      return
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(sweep, { toValue: -1, duration: 450, useNativeDriver: true }),
      Animated.timing(sweep, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]))
    animation.start()
    return () => animation.stop()
  }, [shouldAnimate, sweep])

  return (
    <AnimatedView
      pointerEvents="none"
      testID={shouldAnimate ? 'toothbrush-sweep-running' : 'toothbrush-sweep-static'}
      style={[
        styles.brushFrame,
        { left: brushLeft, top: brushTop },
        { transform: [{ translateX: sweep.interpolate({ inputRange: [-1, 0, 1], outputRange: [-8, 0, 8] }) }, { rotate: sweep.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-1.5deg', '0deg', '1.5deg'] }) }] },
      ]}
    >
      <View
        accessibilityElementsHidden
        accessible={false}
        accessibilityLabel={label}
        style={[styles.toothbrush, { transform: [{ rotate: arch === 'lower' ? '219deg' : '39deg' }] }]}
        testID="toothbrush"
      >
        <Svg testID="prototype-toothbrush-vector" width={brushImageSize} height={brushImageSize} viewBox="0 0 72 72">
          <G>
            <Path fill="#92d3f5" d="M17.7061,53.5176a2.6421,2.6421,0,0,1-1.875-.7744l-.043-.042a2.666,2.666,0,0,1-.0117-3.7686L33.4092,32.3584l8.33-5.0088L51.7774,17.2881A2.6926,2.6926,0,0,1,55.59,21.0908L44.794,31.8779l-8.1836,5.14L19.56,52.7637a2.61,2.61,0,0,1-1.85.7529Z" />
            <Path fill="#fff" d="M42.7,28.6167a1,1,0,0,1-.7031-.2891L37.0205,23.35a.9883.9883,0,0,1-.18-.2412,2.9024,2.9024,0,0,1-.12-2.6718,2.398,2.398,0,0,1,2.2491-1.04,1.2056,1.2056,0,0,0,.8779-.2373.8234.8234,0,0,0,.0879-.5869,2.9549,2.9549,0,0,1,.5859-2.3809,2.8473,2.8473,0,0,1,2.4239-.8486c.7861.0352,1.0175-.34,1.082-.6943a2.8273,2.8273,0,0,1,.9023-2.3028,2.4079,2.4079,0,0,1,2.4268-.1865,1.0052,1.0052,0,0,1,.3584.2276l4.9767,4.9778a1,1,0,0,1,.0137,1.4082l-9.2881,9.541a1.0015,1.0015,0,0,1-.707.3028Z" />
          </G>
          <G fill="none" stroke="#000" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={2}>
            <Path testID="prototype-toothbrush-linework" d="M22.2733,48.8968,18.8813,52.03a1.66,1.66,0,0,1-2.3473.0029l-.0464-.0463a1.66,1.66,0,0,1-.0029-2.3473l17.44-16.4231,8.4353-5.0721,10.125-10.15a1.66,1.66,0,0,1,2.3473-.0029l.0464.0464a1.66,1.66,0,0,1,.0029,2.3472L44.2614,31.0312,36,36.2194,25.2054,46.256" />
            <Line testID="prototype-toothbrush-linework" x1="42.9935" x2="44.0706" y1="21.4042" y2="22.4813" />
            <Line testID="prototype-toothbrush-linework" x1="45.631" x2="46.7081" y1="18.7667" y2="19.8438" />
            <Path testID="prototype-toothbrush-linework" d="M40.919,25.8338l-3.1877-3.1877s-1.1923-2.2415,1.2458-2.2415,1.9419-2.0462,1.9419-2.0462a1.6659,1.6659,0,0,1,1.9763-2.01,1.8756,1.8756,0,0,0,2.144-1.65s-.2173-2.3987,1.98-1.5939l3.1877,3.1877" />
          </G>
        </Svg>
      </View>
    </AnimatedView>
  )
}

function ToothRow({
  arch,
  activeArch,
  activeGroup,
  surface,
  width,
  viewportWidth,
  tone,
}: {
  arch: Arch
  activeArch: Arch
  activeGroup: number
  surface: Surface
  width: number
  viewportWidth: number
  tone: { accent: string; deep: string; light?: string; main?: string }
}) {
  const activeRow = arch === activeArch
  const geometry = rowGeometry(surface)
  const toothWidth = Math.max(13, Math.min(19, viewportWidth * 0.045))
  const gap = 1
  const rowWidth = (toothWidth * 10) + (gap * 9)
  const rowStart = (width - rowWidth) / 2
  const rowY = geometry.rowY[arch === 'upper' ? 0 : 1]
  return (
    <G testID={`atlas-${arch}-row`}>
      {Array.from({ length: 10 }, (_, index) => {
        const positionIndex = arch === 'lower' ? 9 - index : index
        const active = activeRow && groupForPosition(positionIndex) === activeGroup
        const toothX = rowStart + (arch === 'lower' ? positionIndex : index) * (toothWidth + gap)
        const toothY = arch === 'lower'
          ? rowY + (surface === 'front' ? 30 : 56) - geometry.drops[index] - geometry.toothHeight
          : rowY + geometry.drops[index]
        const orientation = surface === 'front' ? (arch === 'upper' ? 180 : 0) : (arch === 'lower' ? 180 : 0)
        const transform = `translate(${toothX} ${toothY}) rotate(${geometry.tilts[index] + orientation} ${toothWidth / 2} ${geometry.toothHeight / 2})`
        const isOuter = index < 2 || index > 7
        const fill = active && surface !== 'inside' ? tone.accent : '#fff'
        const light = tone.light ?? sessionTheme.colors.light
        const toothVector = toothPath(toothWidth, geometry.toothHeight, surface)

        return (
          <G key={`${arch}-${index}`} transform={transform}>
            {active && surface !== 'inside' ? <Path testID="active-tooth-outline" d={toothVector} fill="none" stroke={light} strokeWidth={8} /> : null}
            <Path testID="prototype-tooth" d={toothVector} fill={fill} stroke={active && surface !== 'inside' ? '#fff' : 'rgba(48,54,92,.2)'} strokeWidth={2} />
            <Path d={toothVector} fill="url(#tooth-inset-shadow)" />
            {surface === 'front' || !isOuter ? (
              <Ellipse testID="tooth-highlight-reflection" cx={toothWidth / 2} cy={geometry.toothHeight - 8} rx={2} ry={4} fill="rgba(255,250,242,.48)" />
            ) : null}
            {active ? <Path testID="active-tooth" d={toothVector} fill="transparent" /> : null}
            {surface !== 'front' && isOuter ? (
              <G testID="chewing-groove" stroke="rgba(48,54,92,.3)" strokeWidth={1}>
                <Line x1={toothWidth * 0.28} y1={geometry.toothHeight * 0.48} x2={toothWidth * 0.72} y2={geometry.toothHeight * 0.48} />
                <Line x1={toothWidth / 2} y1={geometry.toothHeight * 0.3} x2={toothWidth / 2} y2={geometry.toothHeight * 0.7} />
              </G>
            ) : null}
            {surface === 'inside' && active ? <Ellipse testID="inside-gum-highlight" cx={toothWidth / 2} cy={geometry.toothHeight - 1} rx={toothWidth * 0.42} ry={4} fill={tone.accent} stroke={light} strokeWidth={4} /> : null}
          </G>
        )
      })}
      {activeRow ? <G testID={`active-group-${groupNames[activeGroup]}${arch === 'lower' ? '-lower' : ''}`} /> : null}
    </G>
  )
}

export function ZoneAtlas({
  zoneIndex,
  width = 240,
  viewportWidth = width,
  reducedMotion = false,
  paused = false,
  tone = { accent: sessionTheme.colors.accent, deep: sessionTheme.colors.deep, light: sessionTheme.colors.light },
}: ZoneAtlasProps) {
  const normalized = normalizeZoneIndex(zoneIndex)
  const band = Math.floor(normalized / 3)
  const activeArch: Arch = band < 3 ? 'upper' : 'lower'
  const activeGroup = normalized % 3
  const surface: Surface = band % 3 === 0 ? 'front' : band % 3 === 1 ? 'chewing' : 'inside'
  const height = rowGeometry(surface).height
  const label = `${activeArch === 'upper' ? 'Top' : 'Bottom'} teeth · ${surface === 'front' ? 'front' : surface === 'chewing' ? 'chewing surfaces' : 'inside'} · ${activeGroup === 1 ? 'center' : `${groupNames[activeGroup]} side`}`

  return (
    <View testID="zone-atlas" accessibilityRole="image" accessibilityLabel={`${label} highlighted`} style={[styles.atlas, { width, height }]}>
      <Svg testID="prototype-mouth-atlas" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="tooth-inset-shadow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.82" stopColor="rgba(48,54,92,0)" />
            <Stop offset="1" stopColor="rgba(48,54,92,.08)" />
          </LinearGradient>
        </Defs>
        <G testID={surface === 'front' ? 'mouth-state-closed' : 'mouth-state-open'} />
        <ToothRow arch="upper" activeArch={activeArch} activeGroup={activeGroup} surface={surface} width={width} viewportWidth={viewportWidth} tone={tone} />
        <ToothRow arch="lower" activeArch={activeArch} activeGroup={activeGroup} surface={surface} width={width} viewportWidth={viewportWidth} tone={tone} />
      </Svg>
      <Toothbrush arch={activeArch} group={activeGroup} surface={surface} width={width} paused={paused} reducedMotion={reducedMotion} label={label} />
    </View>
  )
}

const styles = StyleSheet.create({
  atlas: { position: 'relative', overflow: 'visible' },
  brushFrame: { position: 'absolute', zIndex: 3, width: brushWidth, height: 56 },
  toothbrush: { position: 'absolute', top: -28, left: 20, width: brushImageSize, height: brushImageSize, transform: [{ rotate: '39deg' }] },
})

export { activeToothCount, groupForPosition }
