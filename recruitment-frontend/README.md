# Recruitment frontend (test app)

A simple website for testing the recruitment backend. It covers everything a student does:
OTP login, sign up, the application form, the status page, booking an interview slot, and the profile.
It works on phones, tablets and laptops.

This is **not** the real student site (that's the Next.js app in the repo root). It talks to the
same backend, so it's the quickest way to check the backend works.

## What you need

- [Node.js](https://nodejs.org) 20 or newer
- The backend's settings: ask Ankita for the values (sent privately, never in git or a group chat)

## 1. Set up the backend (once)

In a terminal, from the repo root:

```bash
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env` and fill it in. For testing:

- **`DATABASE_URL`**: use the **test database**. Take the normal connection string and change the
  database name from `/recruitment?` to `/recruitment_test?`. That way testing never touches real data.
- **`ENABLE_TEST_TOOLS="true"`**: turns on the test tools (see below). Never set this on the live server.
- **`EMAIL_USER` / `EMAIL_APP_PASSWORD`**: optional. Without them, login codes are printed in the
  backend terminal instead of emailed.

Then create the collections and sample data (questions, interview slots, a deadline 7 days away):

```bash
npm run db:push
npm run db:seed
```

## 2. Start the backend

```bash
cd backend
npm run dev
```

It runs on http://localhost:5000. Leave this terminal open: login codes appear here when email isn't set up.

## 3. Start the test app

In a second terminal, from the repo root:

```bash
cd recruitment-frontend
npm install
npm run dev
```

Open http://localhost:5173.

**On a phone or tablet:** connect it to the same Wi-Fi as the laptop, then open
`http://<laptop's IP address>:5173` (the terminal prints it as "Network"). Windows may ask to allow Node through
the firewall: allow it on private networks.

## How to test

1. **Sign up:** open the Sign up tab, enter an `@vitstudent.ac.in` email, press Send code, and enter the 6-digit
   code (from your inbox, or from the backend terminal). Fill in your details and pick some domains.
   Any other email (e.g. `@gmail.com` or `@vit.ac.in`) is refused.
2. **Form:** answer the questions, press Save under each one, then Submit. Submitting with blank required
   answers lists the missing questions. After submitting, that domain's answers are locked.
3. **Shortlist yourself:** on the Status page, scroll to **Test tools** and set a domain to "Shortlisted".
   (In the real system an admin does this in the admin backend.)
4. **Book a slot:** open Slots, pick a day with free slots, and press Book. The status changes to Interview.
   Try Cancel too (allowed up to 12 hours before the slot).
5. **Results:** use Test tools to set "Selected" or "Rejected" and see how the Status page shows it.
6. **Profile:** change your details, or add and remove domains. A submitted domain can't be removed.
7. **Log out and log in again** with the Log in tab.

Every rule the backend enforces shows up as a readable message (wrong code, deadline passed, slot full, and so on).

## Notes

- Login is by email code (OTP) only, and only `@vitstudent.ac.in` emails are accepted. The backend enforces both.
- A code works for 10 minutes. Each email can request 3 codes and make 6 attempts per 10 minutes.
- All times are shown in India time.
- To start over, run `npm run db:reset -- --yes` then `npm run db:push` and `npm run db:seed` in `backend`.
  **Only do this with the test database** (`/recruitment_test`): it deletes everything in whatever database
  `DATABASE_URL` points to.
- To point the app at a backend somewhere else, start it with `BACKEND_URL=https://... npm run dev`.
