import React, { Component, useEffect, useState, useCallback} from 'react';
import Particles from 'react-particles';
import { render } from 'react-dom';
import { styled, keyframes, css } from 'styled-components';
import { loadFull } from 'tsparticles';
import { tsParticles } from "tsparticles-engine";
import configs from "tsparticles-demo-configs";



import type { RefObject } from 'react';
import type { Container, Engine } from "tsparticles-engine";

const GRAD_TIME: number = Number(new Date('2027-05-07'));
const START_TIME = Number(new Date('2023-07-17'));
const TIME_TO_GRADUATION = GRAD_TIME - START_TIME;

let ColorScheme = require('color-scheme');
let scheme = new ColorScheme;

scheme.from_hue(Math.random() * 360)
    .scheme('triade')
    .distance(0.5)
    .variation('light');

let colors = scheme.colors();



const getRandomColor = () => {
  return `#${colors[Math.floor(Math.random() * colors.length)]}`;
}

const DOCTOR_BACKGROUND_COLOR: string = getRandomColor();
const DOCTOR_TEXT_COLOR: string = getRandomColor();
const PAGE_BACKGROUND_COLOR: string = getRandomColor();

const shakeAnimation = keyframes`
  0% { transform: rotate(2deg); }
  100% { transform: rotate(-2deg); }
  `


const Doctor = styled.h1<{shakeduration: string}>`
  user-select: none;
  font-size: 8vw;
  text-align: center;
  color: ${DOCTOR_TEXT_COLOR};
  align-self: center;
  align-items: center;
  width: 100%;
  border-radius: 100px;
  padding: 10px;
  margin: 50px;
  background-color: ${DOCTOR_BACKGROUND_COLOR};
  box-shadow: 5px 5px 100px ${DOCTOR_BACKGROUND_COLOR};
  animation: ${props => css`linear ${props.shakeduration} infinite alternate ${shakeAnimation}`};
  text-shadow: -1px 1px 0 #2d2c2c,
                1px 1px 0 #2d2c2c,
                1px -1px 0 #2d2c2c,
               -1px -1px 0 #2d2c2c;
  overflow: hidden;
`

const Wrapper = styled.section`
  background: ${PAGE_BACKGROUND_COLOR};
  height: 100vh;
  display: flex;
  width: 100vw;
  overflow: hidden;
`

const PARTICLE_PRESETS: string[] = Object.keys(configs);

const PERCENT_POINT: number = Math.floor(getPercentDoctor(Number(new Date())));

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

console.log('hey', PERCENT_POINT);
console.log(PARTICLE_PRESETS)

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

function App() {
    // Here we initialize the tsParticle engine
  const particlesInit = useCallback(async (engine: Engine) => {
    await loadFull(engine);
  }, []);
  // and we use this to handle the load state
  const particlesLoaded = useCallback(async (container: Container | undefined) => {
  }, []);

  const [currentDate, setCurrentDate] = useState(Number(new Date()));
  const [shakeDuration, setShakeDuration] = useState(calculateShakeDuration(currentDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(Number(new Date()));
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
      shakeduration={shakeDuration}
    >{currentDate - START_TIME >= TIME_TO_GRADUATION ? 'Dr.' : ''} Hayley is {getPercentDoctor(currentDate).toFixed(2)}% Doctor!</Doctor>
  </Wrapper>
    );
    }

export default App;