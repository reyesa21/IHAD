import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import * as dateFns from 'date-fns';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';

const STEP_2_DATE = new Date('2027-05-08');

// Secret knock pattern: tap 5 times within 2 seconds
const SECRET_TAP_COUNT = 5;
const SECRET_TAP_WINDOW = 2000;

interface StudyData {
  [date: string]: number;
}

// Celebration messages for each hour level
const CELEBRATIONS: { [key: number]: string[] } = {
  0: ['Reset!', 'Starting fresh!', 'New day!'],
  1: ['Nice start!', 'One hour!', 'Getting going!'],
  2: ['Keep it up!', 'Two hours!', 'Warming up!'],
  3: ['Awesome!', 'Three hours!', 'On a roll!'],
  4: ['Amazing!', 'Four hours!', 'Crushing it!'],
  5: ['Incredible!', 'Five hours!', 'Halfway to hero!'],
  6: ['WOW!', 'Six hours!', 'Study machine!'],
  7: ['Fantastic!', 'Seven hours!', 'Unstoppable!'],
  8: ['LEGENDARY!', 'Eight hours!', 'Full day warrior!'],
  9: ['SUPERHERO!', 'Nine hours!', 'Maximum power!'],
};

// Fun colors for celebrations
const CELEBRATION_COLORS = [
  '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff',
  '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24'
];

const popIn = keyframes`
  0% { transform: scale(0) rotate(-10deg); opacity: 0; }
  50% { transform: scale(1.3) rotate(5deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
`;

const floatUp = keyframes`
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-60px) scale(1.5); opacity: 0; }
`;

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const HeatmapContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 12px;
  padding: 15px;
  z-index: 1000;
  max-width: 90vw;
  backdrop-filter: blur(10px);
  user-select: none;
  -webkit-user-select: none;
`;

const HeatmapTitle = styled.div<{ taps: number }>`
  color: #fff;
  font-size: 12px;
  margin-bottom: 10px;
  text-align: center;
  cursor: pointer;
  padding: 5px;
  border-radius: 5px;
  transition: background 0.2s;

  &:active {
    background: rgba(255, 255, 255, 0.1);
  }

  &::after {
    content: '${props => props.taps > 0 && props.taps < SECRET_TAP_COUNT ? ' ' + '.'.repeat(props.taps) : ''}';
    color: #39d353;
  }
`;

const HeatmapGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(26, 10px);
  grid-template-rows: repeat(7, 10px);
  gap: 2px;
  grid-auto-flow: column;
  overflow-x: auto;
  max-width: 100%;
`;

const DayCell = styled.div<{ intensity: number; isfuture: string; isselected: string }>`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background-color: ${props => {
    if (props.isfuture === 'true') return '#1a1a1a';
    if (props.intensity === 0) return '#2d2d2d';
    if (props.intensity <= 2) return '#0e4429';
    if (props.intensity <= 4) return '#006d32';
    if (props.intensity <= 6) return '#26a641';
    return '#39d353';
  }};
  cursor: pointer;
  border: ${props => props.isselected === 'true' ? '1px solid #fff' : 'none'};
  box-sizing: border-box;

  &:active {
    opacity: 0.7;
  }
`;

const SecretPanel = styled.div<{ show: string }>`
  display: ${props => props.show === 'true' ? 'block' : 'none'};
  margin-top: 15px;
  padding: 15px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  text-align: center;
  position: relative;
  overflow: hidden;
`;

const Question = styled.div`
  color: #fff;
  font-size: 14px;
  margin-bottom: 12px;
`;

const DateDisplay = styled.div`
  color: #888;
  font-size: 11px;
  margin-bottom: 8px;
`;

const HourButton = styled.button<{ hourcolor: string }>`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px solid ${props => props.hourcolor};
  background: linear-gradient(135deg, ${props => props.hourcolor}33, ${props => props.hourcolor}11);
  color: #fff;
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 0 20px ${props => props.hourcolor}66;
  }

  &:active {
    transform: scale(0.95);
  }
`;

const HourLabel = styled.div`
  color: #888;
  font-size: 10px;
  margin-top: 8px;
`;

const CelebrationText = styled.div<{ color: string; show: string }>`
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 16px;
  font-weight: bold;
  color: ${props => props.color};
  opacity: ${props => props.show === 'true' ? 1 : 0};
  animation: ${props => props.show === 'true' ? css`${floatUp} 1s ease-out forwards` : 'none'};
  text-shadow: 0 0 10px ${props => props.color};
  pointer-events: none;
  white-space: nowrap;
`;

const Sparkle = styled.div<{ x: number; y: number; color: string; delay: number }>`
  position: absolute;
  width: 8px;
  height: 8px;
  background: ${props => props.color};
  border-radius: 50%;
  left: ${props => props.x}%;
  top: ${props => props.y}%;
  animation: ${floatUp} 0.8s ease-out forwards;
  animation-delay: ${props => props.delay}ms;
  opacity: 0;
  pointer-events: none;
`;

const Legend = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  margin-top: 8px;
  font-size: 9px;
  color: #666;
`;

const LegendCell = styled.div<{ color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background-color: ${props => props.color};
`;

const TotalHours = styled.div`
  color: #888;
  font-size: 11px;
  margin-top: 5px;
  text-align: center;
`;

const StudyHeatmap: React.FC = () => {
  const [studyData, setStudyData] = useState<StudyData>({});
  const [showSecret, setShowSecret] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(dateFns.format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [tapCount, setTapCount] = useState(0);
  const [celebration, setCelebration] = useState({ show: false, text: '', color: '' });
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number; color: string; delay: number }>>([]);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sparkleIdRef = useRef(0);

  const generateDateRange = useCallback(() => {
    const today = new Date();
    const dates: Date[] = [];
    const startDate = dateFns.startOfWeek(dateFns.subMonths(today, 3));
    let currentDate = startDate;
    const endDate = dateFns.min([STEP_2_DATE, dateFns.addMonths(today, 3)]);

    while (currentDate <= endDate) {
      dates.push(currentDate);
      currentDate = dateFns.addDays(currentDate, 1);
    }
    return dates;
  }, []);

  useEffect(() => {
    const studyRef = ref(database, 'studyHours');
    const unsubscribe = onValue(studyRef, (snapshot) => {
      const data = snapshot.val();
      setStudyData(data || {});
      setLoading(false);
    }, (error) => {
      console.error('Firebase read error:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleTitleTap = () => {
    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => setTapCount(0), SECRET_TAP_WINDOW);

    if (newTapCount >= SECRET_TAP_COUNT) {
      setShowSecret(!showSecret);
      setTapCount(0);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    }
  };

  const triggerCelebration = (hours: number) => {
    const messages = CELEBRATIONS[hours] || ['Nice!'];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const color = CELEBRATION_COLORS[hours];

    setCelebration({ show: true, text: message, color });

    // Create sparkles
    const newSparkles = Array.from({ length: 8 }, (_, i) => ({
      id: sparkleIdRef.current++,
      x: 20 + Math.random() * 60,
      y: 30 + Math.random() * 40,
      color: CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
      delay: i * 50
    }));
    setSparkles(newSparkles);

    // Clear celebration after animation
    setTimeout(() => {
      setCelebration({ show: false, text: '', color: '' });
      setSparkles([]);
    }, 1000);
  };

  const handleHourClick = async () => {
    const currentHours = studyData[selectedDate] || 0;
    const newHours = (currentHours + 1) % 10; // Cycle 0-9

    const newData = {
      ...studyData,
      [selectedDate]: newHours
    };

    triggerCelebration(newHours);

    try {
      await set(ref(database, 'studyHours'), newData);
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const handleCellClick = (date: Date) => {
    setSelectedDate(dateFns.format(date, 'yyyy-MM-dd'));
  };

  const dates = generateDateRange();
  const totalHours = Object.values(studyData).reduce((sum, hours) => sum + hours, 0);
  const currentHours = studyData[selectedDate] || 0;
  const currentColor = CELEBRATION_COLORS[currentHours];

  if (loading) {
    return (
      <HeatmapContainer>
        <HeatmapTitle taps={0}>Loading...</HeatmapTitle>
      </HeatmapContainer>
    );
  }

  return (
    <HeatmapContainer>
      <HeatmapTitle onClick={handleTitleTap} taps={tapCount}>
        Study Tracker
      </HeatmapTitle>

      <HeatmapGrid>
        {dates.map((date, i) => {
          const dateStr = dateFns.format(date, 'yyyy-MM-dd');
          const hours = studyData[dateStr] || 0;
          const isFuture = dateFns.isFuture(dateFns.startOfDay(date)) && !dateFns.isToday(date);

          return (
            <DayCell
              key={i}
              intensity={hours}
              isfuture={isFuture.toString()}
              isselected={(dateStr === selectedDate && showSecret).toString()}
              onClick={() => handleCellClick(date)}
              title={`${dateFns.format(date, 'MMM d')}: ${hours}h`}
            />
          );
        })}
      </HeatmapGrid>

      <Legend>
        <span>Less</span>
        <LegendCell color="#2d2d2d" />
        <LegendCell color="#0e4429" />
        <LegendCell color="#006d32" />
        <LegendCell color="#26a641" />
        <LegendCell color="#39d353" />
        <span>More</span>
      </Legend>

      <TotalHours>
        Total: {totalHours} hours studied
      </TotalHours>

      <SecretPanel show={showSecret.toString()}>
        <CelebrationText show={celebration.show.toString()} color={celebration.color}>
          {celebration.text}
        </CelebrationText>

        {sparkles.map(sparkle => (
          <Sparkle
            key={sparkle.id}
            x={sparkle.x}
            y={sparkle.y}
            color={sparkle.color}
            delay={sparkle.delay}
          />
        ))}

        <Question>Did you study today?</Question>
        <DateDisplay>{dateFns.format(new Date(selectedDate), 'EEEE, MMMM d')}</DateDisplay>

        <HourButton hourcolor={currentColor} onClick={handleHourClick}>
          {currentHours}
        </HourButton>

        <HourLabel>tap to add hours</HourLabel>
      </SecretPanel>
    </HeatmapContainer>
  );
};

export default StudyHeatmap;
