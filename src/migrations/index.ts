import * as migration_20260618_134215_baseline from './20260618_134215_baseline';
import * as migration_20260702_081938_add_tasks from './20260702_081938_add_tasks';
import * as migration_20260717_000000_add_new_collections from './20260717_000000_add_new_collections';
import * as migration_20260719_000000_add_billing_fields from './20260719_000000_add_billing_fields';

export const migrations = [
  {
    up: migration_20260618_134215_baseline.up,
    down: migration_20260618_134215_baseline.down,
    name: '20260618_134215_baseline',
  },
  {
    up: migration_20260702_081938_add_tasks.up,
    down: migration_20260702_081938_add_tasks.down,
    name: '20260702_081938_add_tasks',
  },
  {
    up: migration_20260717_000000_add_new_collections.up,
    down: migration_20260717_000000_add_new_collections.down,
    name: '20260717_000000_add_new_collections',
  },
  {
    up: migration_20260719_000000_add_billing_fields.up,
    down: migration_20260719_000000_add_billing_fields.down,
    name: '20260719_000000_add_billing_fields',
  },
];
