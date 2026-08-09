# Setting up the booking app on your personal Mac

This is your Kenshō appointment-booking app. Follow these steps once on your
personal Mac and you'll have it running exactly as it was on the other machine.
No prior coding knowledge needed — just follow along.

---

## 1. Install Node.js (the engine that runs the app)

1. Open a web browser and go to **https://nodejs.org**
2. Click the big **"LTS"** download button (LTS = the stable version).
   It downloads a file ending in `.pkg`.
3. Double-click that `.pkg` file and click **Continue / Agree / Install**
   through the wizard. It may ask for your Mac password — that's normal, it's
   just installing Node.
4. Done. You won't see an app icon; it works behind the scenes.

## 2. Put the project folder somewhere easy

If you unzipped `booking-app.zip`, you now have a **`booking-app`** folder.
Drag it to your **home folder** or **Desktop** so it's easy to find.

## 3. Open Terminal

- Press **Cmd + Space**, type **Terminal**, press **Enter**.
- A window with a text prompt opens. This is where you type the 3 commands below.

## 4. Point Terminal at the project

- Type `cd` and then a **space** (don't press Enter yet):

  ```
  cd 
  ```
- Now **drag the `booking-app` folder** from Finder onto the Terminal window.
  It will paste the folder's location automatically.
- Press **Enter**. Terminal is now "inside" the project.

## 5. Run these three commands (one at a time)

Type each line, press **Enter**, and wait for it to finish before the next.

```bash
npm install
```
(Downloads the app's building blocks. Takes 1–3 minutes. Some yellow "warn"
messages are normal.)

```bash
npx prisma generate
```
(Prepares the database code.)

```bash
npm run dev
```
(Starts the app. When it prints **"Ready"**, it's running.)

## 6. Open the app

In your browser, go to **http://localhost:3000**

You should see your booking page with the example services. That's it — you're
running on your own Mac. 🎉

To **stop** the app later: click the Terminal window and press **Ctrl + C**.
To **start** it again another day: open Terminal, do step 4 (cd into the
folder), then run `npm run dev`.

---

## Notes

- The `.env` file in this folder holds your **Stripe test key**. Keep this
  folder private (don't email the zip around). It's a *test* key, so no real
  money is involved, but treat it like a password anyway.
- Payments work immediately in **test mode**. Use Stripe's test card
  `4242 4242 4242 4242`, any future expiry, any CVC.
- To keep building (Google Calendar sync, emails, admin panel), install
  **Claude Code** on this Mac, open it in this `booking-app` folder, and say
  "continue with Step 4". The project notes carry over.
