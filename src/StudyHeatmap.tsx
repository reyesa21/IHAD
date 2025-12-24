import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import * as dateFns from 'date-fns';
import { database } from './firebase';
import { ref, onValue, set } from 'firebase/database';

const STEP_2_DATE = new Date('2027-05-08');

// Secret knock pattern: tap 5 times within 2 seconds
const SECRET_TAP_COUNT = 5;
const SECRET_TAP_WINDOW = 2000; // 2 seconds

interface StudyData {
  [date: string]: number; // date string -> hours studied
}

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

  /* Subtle hint that shows tap progress */
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

const SecretInput = styled.div<{ show: string }>`
  display: ${props => props.show === 'true' ? 'block' : 'none'};
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
`;

const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Input = styled.input`
  width: 70px;
  padding: 8px;
  border: none;
  border-radius: 5px;
  background: #333;
  color: #fff;
  font-size: 14px;

  &:focus {
    outline: 2px solid #26a641;
  }
`;

const Button = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: 5px;
  background: #26a641;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;

  &:hover, &:active {
    background: #39d353;
  }
`;

const DateLabel = styled.span`
  color: #ccc;
  font-size: 12px;
`;

const SecretIndicator = styled.div`
  color: #ff69b4;
  font-size: 10px;
  text-align: center;
  margin-top: 8px;
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
  const [hoursInput, setHoursInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate dates - show 6 months back and 6 months forward for a nice view
  const generateDateRange = useCallback(() => {
    const today = new Date();
    const dates: Date[] = [];

    // Start from 3 months ago
    const startDate = dateFns.startOfWeek(dateFns.subMonths(today, 3));
    let currentDate = startDate;

    // End at 3 months from now or Step 2, whichever is sooner
    const endDate = dateFns.min([STEP_2_DATE, dateFns.addMonths(today, 3)]);

    while (currentDate <= endDate) {
      dates.push(currentDate);
      currentDate = dateFns.addDays(currentDate, 1);
    }

    return dates;
  }, []);

  // Subscribe to Firebase data
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

  // Secret knock: tap the title 5 times within 2 seconds
  const handleTitleTap = () => {
    const newTapCount = tapCount + 1;
    setTapCount(newTapCount);

    // Reset tap count after 2 seconds of no tapping
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    tapTimeoutRef.current = setTimeout(() => {
      setTapCount(0);
    }, SECRET_TAP_WINDOW);

    // Check if secret is unlocked
    if (newTapCount >= SECRET_TAP_COUNT) {
      setShowSecret(!showSecret);
      setTapCount(0);
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    }
  };

  const handleAddHours = async () => {
    const hours = parseFloat(hoursInput);
    if (isNaN(hours) || hours < 0 || hours > 24) return;

    const newData = {
      ...studyData,
      [selectedDate]: (studyData[selectedDate] || 0) + hours
    };

    try {
      await set(ref(database, 'studyHours'), newData);
      setHoursInput('');
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const handleSetHours = async () => {
    const hours = parseFloat(hoursInput);
    if (isNaN(hours) || hours < 0 || hours > 24) return;

    const newData = {
      ...studyData,
      [selectedDate]: hours
    };

    try {
      await set(ref(database, 'studyHours'), newData);
      setHoursInput('');
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const handleCellClick = (date: Date) => {
    setSelectedDate(dateFns.format(date, 'yyyy-MM-dd'));
  };

  const dates = generateDateRange();

  // Calculate total hours
  const totalHours = Object.values(studyData).reduce((sum, hours) => sum + hours, 0);

  if (loading) {
    return (
      <HeatmapContainer>
        <HeatmapTitle taps={0}>Loading...</HeatmapTitle>
      </HeatmapContainer>
    );
  }

  return (
    <HeatmapContainer>
      <HeatmapTitle
        onClick={handleTitleTap}
        taps={tapCount}
      >
        Study Tracker
      </HeatmapTitle>

      <HeatmapGrid>
        {dates.map((date, i) => {
          const dateStr = dateFns.format(date, 'yyyy-MM-dd');
          const hours = studyData[dateStr] || 0;
          const isFuture = dateFns.isFuture(dateFns.startOfDay(date)) &&
                          !dateFns.isToday(date);

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
        Total: {totalHours.toFixed(1)} hours studied
      </TotalHours>

      <SecretInput show={showSecret.toString()}>
        <InputRow>
          <DateLabel>{dateFns.format(new Date(selectedDate), 'MMM d, yyyy')}</DateLabel>
          <Input
            type="number"
            min="0"
            max="24"
            step="0.5"
            value={hoursInput}
            onChange={(e) => setHoursInput(e.target.value)}
            placeholder="hours"
          />
          <Button onClick={handleAddHours}>+Add</Button>
          <Button onClick={handleSetHours} style={{background: '#666'}}>Set</Button>
        </InputRow>
        <SecretIndicator>secret mode</SecretIndicator>
      </SecretInput>
    </HeatmapContainer>
  );
};

export default StudyHeatmap;
