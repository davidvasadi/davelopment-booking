import * as migration_20260618_134215_baseline from './20260618_134215_baseline';
import * as migration_20260702_081938_add_tasks from './20260702_081938_add_tasks';

export const migrations = [
  {
    up: migration_20260618_134215_baseline.up,
    down: migration_20260618_134215_baseline.down,
    name: '20260618_134215_baseline',
  },
  {
    up: migration_20260702_081938_add_tasks.up,
    down: migration_20260702_081938_add_tasks.down,
    name: '20260702_081938_add_tasks'
  },
];
