@AGENTS.md
@STAGEHAND.md

# Syncing Automation Code

Automations are stored as JavaScript source code in the Neon database. Use the sync script to work with them as local files.

## Pull (DB → local files)

```sh
npm run automations:pull              # all automations
npm run automations:pull -- --user <userId>  # filter by user
```

This writes each automation to `automations/<slug>/` with:
- `code.js` — the automation source code
- `meta.json` — metadata (id, name, description, cron, status)

## Push (local files → DB)

```sh
npm run automations:push              # push all changed automations
npm run automations:push -- <id>      # push a specific automation by UUID
```

Only automations with changed `code.js` or `schedule_cron` (in `meta.json`) are updated. If the cron schedule changed, the Trigger.dev schedule is also updated.

## Workflow

1. `npm run automations:pull` to get the latest from the database
2. Edit `code.js` or `schedule_cron` in `meta.json`
3. `npm run automations:push` to sync changes back

The `automations/` directory is gitignored since files may contain secrets.
