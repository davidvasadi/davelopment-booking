import * as migration_20260618_134215_baseline from './20260618_134215_baseline';

export const migrations = [
  {
    up: migration_20260618_134215_baseline.up,
    down: migration_20260618_134215_baseline.down,
    name: '20260618_134215_baseline'
  },
];
