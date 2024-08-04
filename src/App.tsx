import React, { Component, useEffect, useState, useCallback} from 'react';
import Particles from 'react-particles';
import { render } from 'react-dom';
import { styled, keyframes, css } from 'styled-components';
import { loadFull } from 'tsparticles';
import { tsParticles } from "tsparticles-engine";
import configs from "tsparticles-demo-configs";
import * as dateFns from 'date-fns';


import type { RefObject } from 'react';
import type { Container, Engine } from "tsparticles-engine";

const TEST_DATE: string = '';

const GRAD_TIME: number = Number(new Date('2027-05-07'));
const START_TIME = Number(new Date('2023-07-17'));
const TIME_TO_GRADUATION = GRAD_TIME - START_TIME;

const EXAMS: {[index: string]: Date} = {
  'Hemetology/Oncology Exam':new Date('2024-08-19 12:00:00'),
  'AIM 3 Final Exam':new Date('2024-09-13 12:00:00'),
  'MSS Exam':new Date('2024-09-23 12:00:00'),
  'Neuro Midterm':new Date('2024-10-14 12:00:00'),
  'Neuro Final Exam':new Date('2024-11-08 12:00:00'),
  'Psych Final':new Date('2024-12-11 12:00:00'),
  'M2 Fall Semester Final Exam':new Date('2024-12-16 12:00:00'),
}

const EASTER_EGGS: string[] = 
[
  'You\'re a wizard, Hayley!',
  'I love you.',
  'Don\'t worry about the little things. Bees, Trees.'
]
  
let ColorScheme = require('color-scheme');
let scheme = new ColorScheme;

scheme.from_hue(Math.random() * 360)
    .scheme('triade')
    .distance(0.5)
    .variation('pastel');

let colors = scheme.colors();



const getRandomColor = (index: number) => {
  return `#${colors[index]}`;
}

const idx = Math.floor(Math.random() * (colors.length - 2));
const DOCTOR_BACKGROUND_COLOR: string = getRandomColor(idx);
const DOCTOR_TEXT_COLOR: string = getRandomColor(idx + 1);
const PAGE_BACKGROUND_COLOR: string = getRandomColor(idx + 2);

const shakeAnimation = keyframes`
  0% { transform: rotate(2deg); }
  100% { transform: rotate(-2deg); }
  `


const Doctor = styled.h1<{shakeduration: string, showdetails: string}>`
  user-select: none;
  font-size: 8vw;
  text-align: center;
  align-self: center;
  align-items: center;
  width: 100%;
  border-radius: 100px;
  padding: 10px;
  margin: 50px;
  background-color: ${props => props.showdetails === 'false' ? DOCTOR_BACKGROUND_COLOR: DOCTOR_TEXT_COLOR};
  color: ${props => props.showdetails === 'false' ? DOCTOR_TEXT_COLOR : DOCTOR_BACKGROUND_COLOR};
  box-shadow: ${props => css`5px 5px 100px ${props.showdetails === 'false' ? DOCTOR_BACKGROUND_COLOR : DOCTOR_TEXT_COLOR}`};
  animation: ${props => css`linear ${props.shakeduration} infinite alternate ${shakeAnimation}`};
  text-shadow: -1px 1px 0 #2d2c2c,
                1px 1px 0 #2d2c2c,
                1px -1px 0 #2d2c2c,
               -1px -1px 0 #2d2c2c;
  overflow: hidden;
  &:hover {
    cursor: pointer;
  }
`

const Wrapper = styled.section`
  background: ${PAGE_BACKGROUND_COLOR};
  height: 100vh;
  display: flex;
  width: 100vw;
  overflow: hidden;
`

const PARTICLE_PRESETS: string[] = Object.keys(configs);

const PERCENT_POINT: number = Math.floor(TEST_DATE ? getPercentDoctor(Number(new Date(TEST_DATE))) : getPercentDoctor(Number(new Date())));

const PARTICLE_MAP: {[key: number]: string} = {
  ...PARTICLE_PRESETS,
  4: 'bubble',
  5: 'amongUs',
  6: 'hyperspace',
  7: 'shapeHeart',
  8: 'snow',
  9: 'virus',
  32: 'trailImage',
  38: 'zIndex',
  98: 'spin',
  99: 'style',
  100: 'fireworks',
}


const random_preset: string = PARTICLE_MAP[PERCENT_POINT];

const options = configs[random_preset as keyof typeof configs];

function calculateShakeDuration(currentDate: number): string {
  const timeToCurrent: number = currentDate - START_TIME;

  const shakeDuration: number = Math.max(0.0000001, (TIME_TO_GRADUATION - timeToCurrent) / TIME_TO_GRADUATION);
  return shakeDuration.toString() + 's';
}

function getPercentDoctor(currentDate: number): number {
  return Math.min(100, (currentDate - START_TIME) / TIME_TO_GRADUATION * 100);
}

function renderDoctorText(currentDate: number): string {
  return `${currentDate - START_TIME >= TIME_TO_GRADUATION ? 'Dr.' : ''} Hayley is ${getPercentDoctor(currentDate).toFixed(2)}% Doctor!`
}

function renderDetails(currentDate: number): string {
  const randomNum: number = Math.floor(Math.random() * 3000);

  if(EASTER_EGGS[randomNum]) {
    return EASTER_EGGS[randomNum];
  }

  let closestExam: string = '';
  let closestExamDate: Date = new Date('3000-01-01');

  for(const exam in EXAMS) {
    if((dateFns.isAfter(dateFns.startOfDay(EXAMS[exam]), dateFns.startOfDay(currentDate)) || dateFns.isEqual(dateFns.startOfDay(EXAMS[exam]), dateFns.startOfDay(currentDate)) ) && dateFns.isBefore(dateFns.startOfDay(EXAMS[exam]), dateFns.startOfDay(closestExamDate))) {
      closestExam = exam;
      closestExamDate = EXAMS[exam];
    }
  }
  const daysUntilExam: number = dateFns.differenceInDays(dateFns.startOfDay(closestExamDate), dateFns.startOfDay(currentDate));

  if(daysUntilExam === 1) {
    return `Good luck on your ${closestExam} tomorrow!`;
  }

  if(daysUntilExam < 1) {
    return `Good luck on your ${closestExam} today!`;
  }

  if(daysUntilExam === Infinity || daysUntilExam > 30) {
    return `No exams anytime soon, congratulations!`;
  }
  
  return `${closestExam} in ${Math.floor(daysUntilExam)} days!`;
}

function renderText(currentDate: number, showDetails: boolean): string {
  return showDetails ? renderDetails(currentDate) : renderDoctorText(currentDate)
}

function App() {
    // Here we initialize the tsParticle engine
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadFull(engine);
  }, []);
  // and we use this to handle the load state
  const particlesLoaded = useCallback(async (container: Container | undefined) => {
  }, []);

  const [currentDate, setCurrentDate] = useState(Number(TEST_DATE ? new Date(TEST_DATE) : new Date()));
  const [shakeDuration, setShakeDuration] = useState(calculateShakeDuration(currentDate));
  const [showDetails, setShowDetails] = useState(false);


  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(Number(TEST_DATE ? new Date(TEST_DATE) : new Date()));
      setShakeDuration(calculateShakeDuration(currentDate));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (

  <Wrapper>
    <Particles
    init={particlesInit}
    loaded={particlesLoaded}
    options={{
      ...options,
      background: {
        color: PAGE_BACKGROUND_COLOR,
      },
    }}
    />

    <Doctor
      shakeduration={shakeDuration} showdetails={showDetails.toString()} onClick={() => setShowDetails(!showDetails)}
    >{renderText(currentDate, showDetails)}</Doctor>
  </Wrapper>
    );
    }

export default App;