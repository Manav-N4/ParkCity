
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  height?: number;
};

// Line-art Bengaluru skyline drawn in brand colours. Purely decorative.
export default function CitySkyline({ height = 132 }: Props) {
  const { colors } = useTheme();

  const line = colors.gold;
  const soft = colors.champagne;
  const fill = colors.champagneSoft;
  const accent = colors.primary;

  return (
    <Svg
      width="100%"
      height={height}
      viewBox="0 0 360 150"
      preserveAspectRatio="xMidYMax meet"
      accessible={false}
    >
      {/* Sun */}
      <Circle cx={316} cy={30} r={13} fill={fill} stroke={soft} strokeWidth={1.2} />

      {/* Back towers (faded) */}
      <G stroke={soft} strokeWidth={1.2} fill="none" opacity={0.9}>
        <Rect x={6} y={72} width={22} height={60} rx={2} />
        <Rect x={238} y={52} width={20} height={56} rx={2} />
        <Rect x={330} y={62} width={22} height={46} rx={2} />
      </G>

      {/* Left towers */}
      <G stroke={line} strokeWidth={1.4} fill={fill} strokeLinejoin="round">
        <Rect x={24} y={56} width={26} height={76} rx={2} />
        <Rect x={54} y={38} width={24} height={94} rx={2} />
        <Rect x={82} y={70} width={18} height={62} rx={2} />
      </G>
      <Line x1={66} y1={38} x2={66} y2={26} stroke={line} strokeWidth={1.4} strokeLinecap="round" />
      <G stroke={line} strokeWidth={1} strokeLinecap="round" opacity={0.75}>
        {[66, 78, 90, 102, 114].map((y) => (
          <Line key={`a${y}`} x1={30} y1={y} x2={44} y2={y} />
        ))}
        {[48, 60, 72, 84, 96, 108, 120].map((y) => (
          <Line key={`b${y}`} x1={60} y1={y} x2={72} y2={y} />
        ))}
      </G>

      {/* Tree */}
      <Circle cx={112} cy={110} r={9} fill={fill} stroke={line} strokeWidth={1.4} />
      <Line x1={112} y1={119} x2={112} y2={132} stroke={line} strokeWidth={1.4} strokeLinecap="round" />

      {/* Vidhana Soudha */}
      <G stroke={line} strokeWidth={1.4} fill={fill} strokeLinejoin="round">
        <Rect x={128} y={98} width={104} height={34} rx={1.5} />
        <Rect x={162} y={74} width={36} height={24} rx={1.5} />
        <Path d="M162 74 Q180 40 198 74 Z" />
        <Path d="M132 98 Q140 84 148 98 Z" />
        <Path d="M212 98 Q220 84 228 98 Z" />
      </G>
      <G stroke={line} strokeWidth={1} strokeLinecap="round" opacity={0.8}>
        {[138, 148, 158, 168, 178, 188, 198, 208, 218].map((x) => (
          <Line key={`c${x}`} x1={x} y1={106} x2={x} y2={132} />
        ))}
      </G>
      <Line x1={180} y1={52} x2={180} y2={40} stroke={line} strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={180} cy={38} r={2.2} fill={line} />

      {/* Metro line */}
      <G stroke={line} strokeWidth={1.4} strokeLinecap="round">
        <Line x1={236} y1={108} x2={360} y2={108} />
        {[258, 300, 342].map((x) => (
          <Line key={`p${x}`} x1={x} y1={108} x2={x} y2={132} />
        ))}
      </G>
      <Rect x={262} y={92} width={66} height={15} rx={6} fill={fill} stroke={line} strokeWidth={1.4} />
      <G stroke={line} strokeWidth={1} opacity={0.8}>
        {[272, 286, 300, 314].map((x) => (
          <Rect key={`w${x}`} x={x} y={96} width={8} height={5} rx={1} fill="none" />
        ))}
      </G>

      {/* Parking sign */}
      <Line x1={244} y1={132} x2={244} y2={116} stroke={line} strokeWidth={1.4} strokeLinecap="round" />
      <Rect x={234} y={100} width={20} height={18} rx={4} fill={accent} />
      <SvgText
        x={244}
        y={114}
        fontSize={12}
        fontWeight="bold"
        fill={colors.white}
        textAnchor="middle"
      >
        P
      </SvgText>

      {/* Ground and road */}
      <Line x1={0} y1={132} x2={360} y2={132} stroke={line} strokeWidth={1.4} strokeLinecap="round" />
      <G stroke={soft} strokeWidth={1.6} strokeLinecap="round">
        {[12, 52, 92, 132, 172, 212, 252, 292, 332].map((x) => (
          <Line key={`r${x}`} x1={x} y1={142} x2={x + 20} y2={142} />
        ))}
      </G>

      {/* Car on the road, in front of the left towers */}
      <G transform="translate(-78 9)">
        <G stroke={line} strokeWidth={1.4} fill={colors.surface} strokeLinejoin="round">
          <Path d="M98 130 L102 122 Q104 118 108 118 L126 118 Q130 118 133 122 L138 126 L144 127 Q148 128 148 131 L148 131 L98 131 Z" />
        </G>
        <Circle cx={110} cy={132} r={3.6} fill={colors.surface} stroke={line} strokeWidth={1.4} />
        <Circle cx={138} cy={132} r={3.6} fill={colors.surface} stroke={line} strokeWidth={1.4} />
      </G>
    </Svg>
  );
}
