# Push Job Scheduler

## Vercel Hobby

Vercel Hobby does not support per-minute cron jobs. For this project, the push notification job must be triggered by an external scheduler.

The job endpoint is:

`GET https://YOUR_DOMAIN/api/jobs/push-notifications`

or

`POST https://YOUR_DOMAIN/api/jobs/push-notifications`

Both require the header:

`Authorization: Bearer <CRON_SECRET>`

## Required Environment Variables

Set these in Vercel:

- `CRON_SECRET`
- `NOTIFICATIONS_JOB_SECRET`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

You can use the same value for `CRON_SECRET` and `NOTIFICATIONS_JOB_SECRET`.

## Recommended Scheduler Frequency

- Every 1 minute for best reminder fidelity
- Every 2 minutes if your scheduler plan is limited

## Manual Test

PowerShell:

```powershell
$headers = @{ Authorization = "Bearer YOUR_CRON_SECRET" }
Invoke-RestMethod -Method Get -Uri "https://YOUR_DOMAIN/api/jobs/push-notifications" -Headers $headers
```

## cron-job.org Example

- Method: `GET`
- URL: `https://YOUR_DOMAIN/api/jobs/push-notifications`
- Schedule: every 1 minute
- Header:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

## GitHub Actions Example

Create `.github/workflows/push-notifications-cron.yml` if you prefer GitHub as scheduler:

```yaml
name: Push Notifications Cron

on:
  schedule:
    - cron: "* * * * *"
  workflow_dispatch:

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Call push job
        run: |
          curl -X GET \
            -H "Authorization: Bearer $CRON_SECRET" \
            "$JOB_URL"
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
          JOB_URL: ${{ secrets.PUSH_JOB_URL }}
```

Recommended GitHub secrets:

- `CRON_SECRET`
- `PUSH_JOB_URL`

Example `PUSH_JOB_URL`:

`https://YOUR_DOMAIN/api/jobs/push-notifications`
