import assert from "node:assert/strict";
import { test } from "node:test";
import { projectMapBanPool } from "./mapban-map-pool.ts";

const teams=[{tricode:"ALP"},{tricode:"BRV"}];
const build=(format,scores=[],options={})=>{
  const length={bo1:1,bo3:3,bo5:5}[format];
  const maps=Array.from({length},(_,i)=>({
    name:"Map"+(i+1), ...(i===length-1?{sidePickedBy:0}:{pickedBy:i%2}),
    score:scores[i]??[null,null],
  }));
  return {format,teams:options.teams||teams,selectedMaps:[
    {name:"Banned",bannedBy:1,score:[null,null]},...maps,
  ]};
};
const project=(format,scores,options)=>projectMapBanPool(build(format,scores,options),"ALP","BRV");
test("BO1 only fills left with current map; blank right and center",()=>{
  const r=project("bo1");
  assert.deepEqual([r.left.type,r.center.type,r.right.type],["Present","Disabled","Disabled"]);
  assert.equal(r.left.picker,"decider");
  assert.equal(r.currentMapNumber,1);
});
test("BO1 displays scored map as history with no spurious current map",()=>{
  const r=project("bo1",[[13,9]]);
  assert.equal(r.left.type,"Past");
  assert.deepEqual([r.left.leftScore,r.left.rightScore],[13,9]);
  assert.equal(r.currentMapNumber,null);
});
test("BO3 starts at left, moves to center, and decider is right",()=>{
  const r0=project("bo3");
  assert.deepEqual([r0.left.type,r0.center.type,r0.right.type],["Present","Future","Future"]);
  const r1=project("bo3",[[13,9]]);
  assert.deepEqual([r1.left.type,r1.center.type,r1.right.type],["Past","Present","Future"]);
  assert.equal(r1.currentMapNumber,2);
  const r2=project("bo3",[[13,9],[11,13]]);
  assert.deepEqual([r2.left.type,r2.center.type,r2.right.type],["Past","Past","Present"]);
  assert.equal(r2.right.picker,"decider");
  assert.equal(r2.currentMapNumber,3);
});
test("BO5 slides last completed map to left before the decider",()=>{
  const zero=project("bo5");
  assert.equal(zero.currentMapNumber,1);
  assert.deepEqual([zero.left.type,zero.center.type,zero.right.type],["Present","Future","Future"]);
  const second=project("bo5",[[13,8]]);
  assert.deepEqual([second.left.type,second.center.type,second.right.type],["Past","Present","Future"]);
  const third=project("bo5",[[13,8],[10,13]]);
  assert.equal(third.left.map,"Map2");
  assert.equal(third.center.type,"Present");
  assert.equal(third.right.map,"Map4");
  const fourth=project("bo5",[[13,8],[10,13],[13,11]]);
  assert.equal(fourth.left.map,"Map3");
  assert.equal(fourth.center.type,"Present");
  const decider=project("bo5",[[13,8],[10,13],[13,11],[9,13]]);
  assert.deepEqual([decider.left.map,decider.center.map,decider.right.type],
    ["Map3","Map4","Present"]);
  assert.equal(decider.right.picker,"decider");
  assert.equal(decider.currentMapNumber,5);
});
test("BO5 completed series keeps three most recent results",()=>{
  const r=project("bo5",Array.from({length:5},()=>[13,9]));
  assert.deepEqual([r.left.map,r.center.map,r.right.map],["Map3","Map4","Map5"]);
  assert.equal(r.currentMapNumber,null);
});
test("scores and map picker follow tricodes not MapBan team slots",()=>{
  const original=build("bo3",[[13,9]]);
  original.teams=[{tricode:"BRV"},{tricode:"ALP"}];
  // Spectra left ALP is slot 1, right BRV is slot 0.
  original.selectedMaps[1].pickedBy=1;
  original.selectedMaps[2].pickedBy=0;
  const r=projectMapBanPool(original,"ALP","BRV");
  assert.deepEqual([r.left.leftScore,r.left.rightScore],[9,13]);
  assert.equal(r.center.picker,"right");
});
test("partial or invalid session never produces fabricated maps",()=>{
  const waiting=build("bo3");
  waiting.selectedMaps=waiting.selectedMaps.slice(0,2);
  assert.throws(()=>projectMapBanPool(waiting,"ALP","BRV"),/veto not ready/);
  assert.throws(()=>projectMapBanPool(build("bo3"),"OTHER","BRV"),/tricodes/);
});
test("out-of-order scores warn instead of skipping an unplayed map",()=>{
  const r=project("bo3",[[null,null],[13,9]]);
  assert.equal(r.currentMapNumber,1);
  assert.equal(r.left.type,"Present");
  assert.ok(r.warning.includes("Later map scores"));
});
