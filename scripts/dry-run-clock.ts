import { assertClock, runClock } from '../src/lib/arena-clock';

const run = runClock();
assertClock(run);

console.log('Arena clock dry-run passed.');
console.log(`Phases: ${run.phases.join(' → ')}`);
console.log(`Champion: ${run.champion.project}  #01  +${run.champion.ratingChange} rating`);
for (const row of run.results) {
  console.log(
    `  #${String(row.rank).padStart(2, '0')}  ${row.project.padEnd(12)}  ${row.score} pts  ${row.ratingChange >= 0 ? '+' : ''}${row.ratingChange}`,
  );
}
