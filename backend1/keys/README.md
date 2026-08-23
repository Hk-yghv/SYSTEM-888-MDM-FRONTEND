Place your Google Service Account JSON key file here and name it `service-account.json`.

Steps:
1. In Google Cloud Console create a Service Account and enable the Sheets API.
2. Create and download a JSON key for that service account.
3. Save the downloaded file at: `backend/keys/service-account.json` (relative to the repository root run from `backend`).
4. Share your Google Sheet with the service account `client_email` (found inside the JSON) and give Editor permission.
5. Start the backend server (`cd backend && npm run dev`) and trigger a report or wait for the weekly job.

If you prefer another path, edit `backend/.env` and change `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` accordingly.

Note: Do NOT commit the JSON key to source control. Keep it secret.
