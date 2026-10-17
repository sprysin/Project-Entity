import React from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import {createGame} from '../src/game/engine';
import {useGameAnimationEffects} from '../src/hooks/useGameAnimationEffects';
import {useAnimations} from '../src/hooks/useAnimations';
import {playSound} from '../src/audio';
import {GameState,Phase} from '../src/types';
vi.mock('../src/audio',()=>({playSound:vi.fn()}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
it('synchronizes opening sounds and starts turn audio once after the coin closes',()=>{
 vi.useFakeTimers();
 const nextPhase=vi.fn(),setGameState=vi.fn();
 function Harness({state}:{state:GameState|null}){
  useGameAnimationEffects(state,setGameState,useAnimations(),nextPhase);
  return null;
 }
 const initial=createGame([{id:'p1',name:'Player',deck:[]},{id:'p2',name:'AI',deck:[]}],1);
 let root:ReturnType<typeof create>;
 const render=(state:GameState|null)=>act(()=>root.update(<React.StrictMode><Harness state={state}/></React.StrictMode>));
 const heard=(name:string)=>vi.mocked(playSound).mock.calls.filter(call=>call[0]===name).length;
 try{
  act(()=>{root=create(<React.StrictMode><Harness state={initial}/></React.StrictMode>);});
  act(()=>vi.advanceTimersByTime(0));
  expect(heard('draw-tick')).toBe(1);
  expect(heard('turn-change')).toBe(0);
  const choosing={...initial,openingCoin:{winnerIndex:1 as const,stage:'choosing' as const}};
  render(choosing);
  act(()=>vi.advanceTimersByTime(0));
  expect(heard('toggle')).toBe(0);
  const decided={...choosing,openingCoin:{...choosing.openingCoin,aiOrder:'second' as const}};
  render(decided);
  let elapsed=0;
  for(const [index,time] of [0,224,504,840,1316,1960,2800].entries()){
   act(()=>vi.advanceTimersByTime(time-elapsed));elapsed=time;
   expect(heard('toggle')).toBe(index+1);
  }
  const started={...initial,openingCoin:undefined};
  render(started);
  expect(heard('turn-change')).toBe(1);
  render({...started,currentPhase:Phase.STANDBY});
  render(started);
  expect(heard('turn-change')).toBe(1);
  render({...started,turnNumber:2,activePlayerIndex:1});
  expect(heard('turn-change')).toBe(2);
  render(null);
  render(decided);
  act(()=>vi.advanceTimersByTime(0));
  const before=heard('toggle');
  act(()=>root.unmount());
  act(()=>vi.advanceTimersByTime(4000));
  expect(heard('toggle')).toBe(before);
  vi.stubGlobal('window',{matchMedia:()=>({matches:true})});
  vi.mocked(playSound).mockClear();
  act(()=>{root=create(<React.StrictMode><Harness state={decided}/></React.StrictMode>);});
  act(()=>vi.advanceTimersByTime(3000));
  expect(heard('toggle')).toBe(1);
  expect(heard('turn-change')).toBe(0);
 }finally{act(()=>root!.unmount());vi.useRealTimers();vi.unstubAllGlobals();}
});
