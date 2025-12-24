import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled, { keyframes, css, createGlobalStyle } from 'styled-components';
import * as dateFns from 'date-fns';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';

// Import elegant font
const FontStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
`;

const STEP_2_DATE = new Date('2027-05-08');

// "Shave and a haircut" knock pattern - simplified detection
// Pattern: tap tap-tap-tap tap [pause] tap tap (7 taps total)
// We detect: 5 quick taps, then a pause, then 2 quick taps
const QUICK_TAP_MAX = 400; // Max time between quick taps
const PAUSE_MIN = 300; // Min pause before last 2 taps
const PAUSE_MAX = 1500; // Max pause before last 2 taps
const KNOCK_RESET_TIME = 3000; // Reset if no knock for 3 seconds

interface StudyData {
  [date: string]: number;
}

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

const CELEBRATION_COLORS = [
  '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff',
  '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24'
];

const floatUp = keyframes`
  0% { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-100px) scale(2); opacity: 0; }
`;

const HeatmapContainerSmall = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 16px;
  padding: 20px;
  z-index: 1000;
  max-width: 420px;
  backdrop-filter: blur(10px);
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;

  &:hover {
    transform: scale(1.02);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  &:active {
    transform: scale(0.98);
  }
`;

const HeatmapContainerExpanded = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 24px;
  padding: 30px;
  z-index: 1000;
  width: calc(100vw - 32px);
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  backdrop-filter: blur(20px);
  user-select: none;
  -webkit-user-select: none;
  box-shadow: 0 0 100px rgba(0, 0, 0, 0.8);
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
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

const HeatmapTitleSmall = styled.div`
  color: #c9d1d9;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 14px;
  text-align: left;
  letter-spacing: 0.3px;
`;

const HeatmapTitleExpanded = styled.div`
  color: #f0f6fc;
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 30px;
  text-align: center;
  cursor: default;
  user-select: none;
  letter-spacing: -0.5px;
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

const HeatmapGridSmall = styled.div<{ weeks: number }>`
  display: grid;
  grid-template-columns: repeat(${props => props.weeks}, 14px);
  grid-template-rows: repeat(7, 14px);
  gap: 4px;
  grid-auto-flow: column;
  overflow-x: auto;
`;

const HeatmapGridExpanded = styled.div<{ weeks: number }>`
  display: grid;
  grid-template-columns: repeat(${props => props.weeks}, 1fr);
  grid-template-rows: repeat(7, 1fr);
  gap: 4px;
  grid-auto-flow: column;
  width: 100%;
  aspect-ratio: ${props => props.weeks / 7};
  max-height: 60vh;
`;

const DayCellSmall = styled.div<{ intensity: number; isfuture: string }>`
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background-color: ${props => {
    if (props.isfuture === 'true') return '#161b22';
    if (props.intensity === 0) return '#21262d';
    if (props.intensity <= 2) return '#0a3069';
    if (props.intensity <= 4) return '#0550ae';
    if (props.intensity <= 6) return '#1f6feb';
    return '#58a6ff';
  }};
`;

const DayCellExpanded = styled.div<{ intensity: number; isfuture: string; istoday: string }>`
  width: 100%;
  height: 100%;
  border-radius: 4px;
  min-width: 8px;
  min-height: 8px;
  background-color: ${props => {
    if (props.isfuture === 'true') return '#161b22';
    if (props.intensity === 0) return '#21262d';
    if (props.intensity <= 2) return '#0a3069';
    if (props.intensity <= 4) return '#0550ae';
    if (props.intensity <= 6) return '#1f6feb';
    return '#58a6ff';
  }};
  border: ${props => props.istoday === 'true' ? '2px solid #fff' : 'none'};
  box-sizing: border-box;
`;

const SecretPanel = styled.div`
  margin-top: 40px;
  padding: 40px;
  background: rgba(33, 38, 45, 0.8);
  border: 1px solid #30363d;
  border-radius: 16px;
  text-align: center;
  position: relative;
  overflow: hidden;
`;

const Question = styled.div`
  color: #f0f6fc;
  font-size: 26px;
  font-weight: 500;
  margin-bottom: 15px;
  letter-spacing: -0.3px;
`;

const DateDisplay = styled.div`
  color: #8b949e;
  font-size: 18px;
  font-weight: 400;
  margin-bottom: 30px;
  letter-spacing: 0.2px;
`;

const HourButton = styled.button<{ hourcolor: string }>`
  width: 160px;
  height: 160px;
  border-radius: 50%;
  border: 4px solid ${props => props.hourcolor};
  background: linear-gradient(135deg, ${props => props.hourcolor}33, ${props => props.hourcolor}11);
  color: #f0f6fc;
  font-size: 64px;
  font-weight: 600;
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  box-shadow: 0 0 40px ${props => props.hourcolor}44;

  &:hover {
    transform: scale(1.08);
    box-shadow: 0 0 60px ${props => props.hourcolor}77;
  }

  &:active {
    transform: scale(0.95);
  }
`;

const HourLabel = styled.div`
  color: #8b949e;
  font-size: 16px;
  font-weight: 400;
  margin-top: 25px;
  letter-spacing: 0.3px;
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
  gap: 4px;
  margin-top: 12px;
  font-size: 11px;
  color: #8b949e;
`;

const LegendExpanded = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 25px;
  font-size: 11px;
  color: #8b949e;
`;

const LegendCellSmall = styled.div<{ color: string }>`
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background-color: ${props => props.color};
`;

const LegendCellExpanded = styled.div<{ color: string }>`
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background-color: ${props => props.color};
`;

const TotalHoursSmall = styled.div`
  color: #8b949e;
  font-size: 12px;
  font-weight: 400;
  margin-top: 10px;
  text-align: left;
`;

const TotalHoursExpanded = styled.div`
  color: #c9d1d9;
  font-size: 20px;
  margin-top: 25px;
  text-align: center;
  font-weight: 500;
  letter-spacing: -0.2px;
`;

const StudyHeatmap: React.FC = () => {
  const [studyData, setStudyData] = useState<StudyData>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [knockTimes, setKnockTimes] = useState<number[]>([]);
  const [celebration, setCelebration] = useState({ show: false, text: '', color: '' });
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number; color: string; delay: number; size: number }>>([]);
  const knockResetRef = useRef<NodeJS.Timeout | null>(null);
  const sparkleIdRef = useRef(0);

  const today = dateFns.format(new Date(), 'yyyy-MM-dd');

  const generateDateRange = useCallback(() => {
    const todayDate = new Date();
    const dates: Date[] = [];
    const startDate = dateFns.startOfWeek(todayDate);
    let currentDate = startDate;

    while (currentDate <= STEP_2_DATE) {
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

  // Check if knock pattern matches "shave and a haircut"
  // Pattern: 5 quick taps, pause, 2 quick taps (7 total)
  const checkKnockPattern = (times: number[]): boolean => {
    if (times.length !== 7) return false;

    // Calculate gaps between taps
    const gaps = [];
    for (let i = 1; i < times.length; i++) {
      gaps.push(times[i] - times[i - 1]);
    }

    // First 4 gaps should be quick (taps 1-2, 2-3, 3-4, 4-5)
    const firstFourQuick = gaps[0] < QUICK_TAP_MAX &&
                           gaps[1] < QUICK_TAP_MAX &&
                           gaps[2] < QUICK_TAP_MAX &&
                           gaps[3] < QUICK_TAP_MAX;

    // Gap 5 (between tap 5 and 6) should be a pause
    const hasPause = gaps[4] >= PAUSE_MIN && gaps[4] <= PAUSE_MAX;

    // Last gap should be quick (taps 6-7)
    const lastQuick = gaps[5] < QUICK_TAP_MAX;

    return firstFourQuick && hasPause && lastQuick;
  };

  const handleTitleKnock = () => {
    const now = Date.now();
    const newKnockTimes = [...knockTimes, now];

    // Reset timeout
    if (knockResetRef.current) clearTimeout(knockResetRef.current);
    knockResetRef.current = setTimeout(() => {
      setKnockTimes([]);
    }, KNOCK_RESET_TIME);

    // Check if we have 7 knocks
    if (newKnockTimes.length === 7) {
      if (checkKnockPattern(newKnockTimes)) {
        setIsUnlocked(true);
        setKnockTimes([]);
      } else {
        // Wrong pattern, reset
        setKnockTimes([]);
      }
    } else if (newKnockTimes.length > 7) {
      // Too many knocks, start fresh
      setKnockTimes([now]);
    } else {
      setKnockTimes(newKnockTimes);
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
    if (!isUnlocked) return;

    const currentHours = studyData[today] || 0;
    const newHours = (currentHours + 1) % 10;

    const newData = {
      ...studyData,
      [today]: newHours
    };

    triggerCelebration(newHours);

    try {
      await set(ref(database, 'studyHours'), newData);
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const handleClose = () => {
    setIsExpanded(false);
    setIsUnlocked(false);
    setKnockTimes([]);
  };

  const dates = generateDateRange();
  const numWeeks = Math.ceil(dates.length / 7);
  const totalHours = Object.values(studyData).reduce((sum, hours) => sum + hours, 0);
  const todayHours = studyData[today] || 0;
  const currentColor = CELEBRATION_COLORS[todayHours];
  const daysUntilStep2 = dateFns.differenceInDays(STEP_2_DATE, new Date());

  if (loading) {
    return (
      <>
        <FontStyle />
        <HeatmapContainerSmall>
          <HeatmapTitleSmall>Loading...</HeatmapTitleSmall>
        </HeatmapContainerSmall>
      </>
    );
  }

  // Expanded view (read-only unless unlocked)
  if (isExpanded) {
    return (
      <>
        <FontStyle />
        <Overlay onClick={handleClose} />
        <HeatmapContainerExpanded>
          <CloseButton onClick={handleClose}>&times;</CloseButton>

          <HeatmapTitleExpanded onClick={handleTitleKnock}>
            Study Tracker
          </HeatmapTitleExpanded>

          <HeatmapGridExpanded weeks={numWeeks}>
            {dates.map((date, i) => {
              const dateStr = dateFns.format(date, 'yyyy-MM-dd');
              const hours = studyData[dateStr] || 0;
              const isFuture = dateFns.isFuture(dateFns.startOfDay(date)) && !dateFns.isToday(date);
              const isToday = dateFns.isToday(date);

              return (
                <DayCellExpanded
                  key={i}
                  intensity={hours}
                  isfuture={isFuture.toString()}
                  istoday={isToday.toString()}
                  title={`${dateFns.format(date, 'MMM d')}: ${hours}h`}
                />
              );
            })}
          </HeatmapGridExpanded>

          <LegendExpanded>
            <span>Less</span>
            <LegendCellExpanded color="#21262d" />
            <LegendCellExpanded color="#0a3069" />
            <LegendCellExpanded color="#0550ae" />
            <LegendCellExpanded color="#1f6feb" />
            <LegendCellExpanded color="#58a6ff" />
            <span>More</span>
          </LegendExpanded>

          <TotalHoursExpanded>
            {totalHours} hours studied | {daysUntilStep2} days until Step 2
          </TotalHoursExpanded>

          {isUnlocked && (
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
              <DateDisplay>{dateFns.format(new Date(), 'EEEE, MMMM d')}</DateDisplay>

              <HourButton hourcolor={currentColor} onClick={handleHourClick}>
                {todayHours}
              </HourButton>

              <HourLabel>tap to add hours</HourLabel>
            </SecretPanel>
          )}
        </HeatmapContainerExpanded>
      </>
    );
  }

  // Small corner view - click to expand
  return (
    <>
      <FontStyle />
      <HeatmapContainerSmall onClick={() => setIsExpanded(true)}>
        <HeatmapTitleSmall>Study Tracker</HeatmapTitleSmall>

        <HeatmapGridSmall weeks={numWeeks}>
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
          <LegendCellSmall color="#21262d" />
          <LegendCellSmall color="#0a3069" />
          <LegendCellSmall color="#0550ae" />
          <LegendCellSmall color="#1f6feb" />
          <LegendCellSmall color="#58a6ff" />
          <span>More</span>
        </LegendSmall>

        <TotalHoursSmall>
          {totalHours} hours studied
        </TotalHoursSmall>
      </HeatmapContainerSmall>
    </>
  );
};

export default StudyHeatmap;
