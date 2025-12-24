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

const floatUp = keyframes`
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-100px) scale(2); opacity: 0; }
`;

// Small corner version
const HeatmapContainerSmall = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 12px;
  padding: 15px;
  z-index: 1000;
  max-width: 320px;
  backdrop-filter: blur(10px);
  user-select: none;
  -webkit-user-select: none;
`;

// Full screen expanded version
const HeatmapContainerExpanded = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.95);
  border-radius: 24px;
  padding: 40px;
  z-index: 1000;
  width: 90vw;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  backdrop-filter: blur(20px);
  user-select: none;
  -webkit-user-select: none;
  box-shadow: 0 0 100px rgba(0, 0, 0, 0.8);
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 999;
`;

const HeatmapTitleSmall = styled.div<{ taps: number }>`
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

const HeatmapTitleExpanded = styled.div`
  color: #fff;
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 30px;
  text-align: center;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #fff;
  font-size: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const HeatmapGridSmall = styled.div`
  display: grid;
  grid-template-columns: repeat(26, 10px);
  grid-template-rows: repeat(7, 10px);
  gap: 2px;
  grid-auto-flow: column;
  overflow-x: auto;
`;

const HeatmapGridExpanded = styled.div`
  display: grid;
  grid-template-columns: repeat(26, 1fr);
  grid-template-rows: repeat(7, 1fr);
  gap: 6px;
  grid-auto-flow: column;
  width: 100%;
  margin: 0 auto;
`;

const DayCellSmall = styled.div<{ intensity: number; isfuture: string }>`
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
`;

const DayCellExpanded = styled.div<{ intensity: number; isfuture: string; isselected: string }>`
  aspect-ratio: 1;
  border-radius: 6px;
  background-color: ${props => {
    if (props.isfuture === 'true') return '#1a1a1a';
    if (props.intensity === 0) return '#2d2d2d';
    if (props.intensity <= 2) return '#0e4429';
    if (props.intensity <= 4) return '#006d32';
    if (props.intensity <= 6) return '#26a641';
    return '#39d353';
  }};
  cursor: pointer;
  border: ${props => props.isselected === 'true' ? '3px solid #fff' : 'none'};
  box-sizing: border-box;
  transition: transform 0.1s;

  &:hover {
    transform: scale(1.15);
  }

  &:active {
    opacity: 0.7;
  }
`;

const SecretPanel = styled.div`
  margin-top: 40px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  text-align: center;
  position: relative;
  overflow: hidden;
`;

const Question = styled.div`
  color: #fff;
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 15px;
`;

const DateDisplay = styled.div`
  color: #aaa;
  font-size: 20px;
  margin-bottom: 30px;
`;

const HourButton = styled.button<{ hourcolor: string }>`
  width: 180px;
  height: 180px;
  border-radius: 50%;
  border: 6px solid ${props => props.hourcolor};
  background: linear-gradient(135deg, ${props => props.hourcolor}44, ${props => props.hourcolor}11);
  color: #fff;
  font-size: 72px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  box-shadow: 0 0 50px ${props => props.hourcolor}55;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 0 80px ${props => props.hourcolor}99;
  }

  &:active {
    transform: scale(0.95);
  }
`;

const HourLabel = styled.div`
  color: #888;
  font-size: 18px;
  margin-top: 25px;
`;

const CelebrationText = styled.div<{ color: string; show: string }>`
  position: absolute;
  top: 30px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 40px;
  font-weight: bold;
  color: ${props => props.color};
  opacity: ${props => props.show === 'true' ? 1 : 0};
  animation: ${props => props.show === 'true' ? css`${floatUp} 1.2s ease-out forwards` : 'none'};
  text-shadow: 0 0 30px ${props => props.color};
  pointer-events: none;
  white-space: nowrap;
`;

const Sparkle = styled.div<{ x: number; y: number; color: string; delay: number; size: number }>`
  position: absolute;
  width: ${props => props.size}px;
  height: ${props => props.size}px;
  background: ${props => props.color};
  border-radius: 50%;
  left: ${props => props.x}%;
  top: ${props => props.y}%;
  animation: ${floatUp} 1s ease-out forwards;
  animation-delay: ${props => props.delay}ms;
  opacity: 0;
  pointer-events: none;
  box-shadow: 0 0 15px ${props => props.color};
`;

const LegendSmall = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  margin-top: 8px;
  font-size: 9px;
  color: #666;
`;

const LegendExpanded = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 25px;
  font-size: 16px;
  color: #888;
`;

const LegendCellSmall = styled.div<{ color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background-color: ${props => props.color};
`;

const LegendCellExpanded = styled.div<{ color: string }>`
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background-color: ${props => props.color};
`;

const TotalHoursSmall = styled.div`
  color: #888;
  font-size: 11px;
  margin-top: 5px;
  text-align: center;
`;

const TotalHoursExpanded = styled.div`
  color: #fff;
  font-size: 24px;
  margin-top: 25px;
  text-align: center;
  font-weight: bold;
`;

const StudyHeatmap: React.FC = () => {
  const [studyData, setStudyData] = useState<StudyData>({});
  const [showSecret, setShowSecret] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(dateFns.format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [tapCount, setTapCount] = useState(0);
  const [celebration, setCelebration] = useState({ show: false, text: '', color: '' });
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number; color: string; delay: number; size: number }>>([]);
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
      setShowSecret(true);
      setTapCount(0);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    }
  };

  const triggerCelebration = (hours: number) => {
    const messages = CELEBRATIONS[hours] || ['Nice!'];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const color = CELEBRATION_COLORS[hours];

    setCelebration({ show: true, text: message, color });

    const newSparkles = Array.from({ length: 15 }, (_, i) => ({
      id: sparkleIdRef.current++,
      x: 10 + Math.random() * 80,
      y: 15 + Math.random() * 60,
      color: CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)],
      delay: i * 30,
      size: 12 + Math.random() * 20
    }));
    setSparkles(newSparkles);

    setTimeout(() => {
      setCelebration({ show: false, text: '', color: '' });
      setSparkles([]);
    }, 1200);
  };

  const handleHourClick = async () => {
    const currentHours = studyData[selectedDate] || 0;
    const newHours = (currentHours + 1) % 10;

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
      <HeatmapContainerSmall>
        <HeatmapTitleSmall taps={0}>Loading...</HeatmapTitleSmall>
      </HeatmapContainerSmall>
    );
  }

  // Expanded full-screen view
  if (showSecret) {
    return (
      <>
        <Overlay onClick={() => setShowSecret(false)} />
        <HeatmapContainerExpanded>
          <CloseButton onClick={() => setShowSecret(false)}>&times;</CloseButton>

          <HeatmapTitleExpanded>Study Tracker</HeatmapTitleExpanded>

          <HeatmapGridExpanded>
            {dates.map((date, i) => {
              const dateStr = dateFns.format(date, 'yyyy-MM-dd');
              const hours = studyData[dateStr] || 0;
              const isFuture = dateFns.isFuture(dateFns.startOfDay(date)) && !dateFns.isToday(date);

              return (
                <DayCellExpanded
                  key={i}
                  intensity={hours}
                  isfuture={isFuture.toString()}
                  isselected={(dateStr === selectedDate).toString()}
                  onClick={() => handleCellClick(date)}
                  title={`${dateFns.format(date, 'MMM d')}: ${hours}h`}
                />
              );
            })}
          </HeatmapGridExpanded>

          <LegendExpanded>
            <span>Less</span>
            <LegendCellExpanded color="#2d2d2d" />
            <LegendCellExpanded color="#0e4429" />
            <LegendCellExpanded color="#006d32" />
            <LegendCellExpanded color="#26a641" />
            <LegendCellExpanded color="#39d353" />
            <span>More</span>
          </LegendExpanded>

          <TotalHoursExpanded>
            Total: {totalHours} hours studied
          </TotalHoursExpanded>

          <SecretPanel>
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
                size={sparkle.size}
              />
            ))}

            <Question>Did you study today?</Question>
            <DateDisplay>{dateFns.format(new Date(selectedDate), 'EEEE, MMMM d')}</DateDisplay>

            <HourButton hourcolor={currentColor} onClick={handleHourClick}>
              {currentHours}
            </HourButton>

            <HourLabel>tap to add hours</HourLabel>
          </SecretPanel>
        </HeatmapContainerExpanded>
      </>
    );
  }

  // Small corner view
  return (
    <HeatmapContainerSmall>
      <HeatmapTitleSmall onClick={handleTitleTap} taps={tapCount}>
        Study Tracker
      </HeatmapTitleSmall>

      <HeatmapGridSmall>
        {dates.map((date, i) => {
          const dateStr = dateFns.format(date, 'yyyy-MM-dd');
          const hours = studyData[dateStr] || 0;
          const isFuture = dateFns.isFuture(dateFns.startOfDay(date)) && !dateFns.isToday(date);

          return (
            <DayCellSmall
              key={i}
              intensity={hours}
              isfuture={isFuture.toString()}
              title={`${dateFns.format(date, 'MMM d')}: ${hours}h`}
            />
          );
        })}
      </HeatmapGridSmall>

      <LegendSmall>
        <span>Less</span>
        <LegendCellSmall color="#2d2d2d" />
        <LegendCellSmall color="#0e4429" />
        <LegendCellSmall color="#006d32" />
        <LegendCellSmall color="#26a641" />
        <LegendCellSmall color="#39d353" />
        <span>More</span>
      </LegendSmall>

      <TotalHoursSmall>
        Total: {totalHours} hours studied
      </TotalHoursSmall>
    </HeatmapContainerSmall>
  );
};

export default StudyHeatmap;
