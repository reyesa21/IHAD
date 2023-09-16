import React, { Component, useEffect, useState} from 'react';
import { render } from 'react-dom';
import { styled, keyframes, css } from 'styled-components';
import { loadFull } from 'tsparticles';

const TIME_TO_GRADUATION: number = 120096000000;
const GRADUATION_DATE: string = '2027-05-07';
const START_DATE: string = '2023-07-17';

const BORDER_COLOR: string = '#4C956C';

const shakeAnimation = keyframes`
  0% { transform: rotate(2deg); }
  100% { transform: rotate(-2deg); }
  `


const Doctor = styled.h1<{shakeDuration: string}>`
  user-select: none;
  font-size: 10vw;
  text-align: center;
  color: #E5989B;
  align-self: center;
  align-items: center;
  width: 100%;
  border-radius: 100px;
  padding: 20px;
  margin: 20px;
  background-color: #6D6875;
  box-shadow: 5px 5px 100px #6D6875;
  &:hover {
    background-color: #E5989B;
    color: #6D6875;
    box-shadow: 5px 5px 100px #E5989B;
    cursor: pointer;
  }
  animation: ${props => css`linear ${props.shakeDuration} infinite alternate ${shakeAnimation}`};

`

const Wrapper = styled.section`
  background: #F9F9ED;
  height: 100vh;
  display: flex;
  width: 100%;
`

function calculateShakeDuration(currentDate: number, startDate: number): string {
  const timeToCurrent: number = currentDate - startDate;

  const shakeDuration: number = Math.max(0.0000001, (TIME_TO_GRADUATION - timeToCurrent) / TIME_TO_GRADUATION);
  return shakeDuration.toString() + 's';
}




function App() {
  const [currentDate, setCurrentDate] = useState(Number(new Date()));
  const [startDate, setStartDate] = useState(Number(new Date(START_DATE)));
  const [shakeDuration, setShakeDuration] = useState(calculateShakeDuration(currentDate, startDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(Number(new Date()));
      setShakeDuration(calculateShakeDuration(currentDate, startDate));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (

      <Wrapper>
    <Doctor
      shakeDuration={shakeDuration}
    >{currentDate - startDate >= TIME_TO_GRADUATION ? 'Dr.' : ''} Hayley is {((currentDate - startDate) / TIME_TO_GRADUATION * 100).toFixed(2)}% Doctor!</Doctor>
    </Wrapper>
    );
    }

export default App;