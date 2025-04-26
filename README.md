Shorter version is at [READMEFP.md](READMEFP.md)<br>
Shorter text version is at [READMEFP.txt](READMEFP.txt)


# Face Attention Checker

This tool watches a person through their webcam to see if they are paying attention, mainly by checking where they are looking. It uses the computer's camera and some smart analysis (MediaPipe) right in the web browser. If it thinks the person isn't paying attention for too long, it can send a picture to a central computer (the server) as proof.

## What's Inside

-   **`/client`**: This is the part you see and interact with in your web browser. It handles showing the camera, watching the face, and talking to the server.
-   **`/server`**: This is the background part that runs separately. It waits to receive pictures (either for checking identity or as proof of not paying attention) from the browser part.

## Before You Start (Software Needed)

1.  **Node.js**: This is a background helper needed to easily run the web browser part. You can get it from [https://nodejs.org/](https://nodejs.org/).
2.  **Bun**: This is another background helper needed to run the server part. You can find instructions to install it at [https://bun.sh/docs/installation](https://bun.sh/docs/installation). After installing, open your computer's command prompt or terminal and type `bun --version` then press Enter to make sure it worked.

## Getting Ready (One-Time Setup)

1.  **Set up the Server:**
    -   Open your computer's command prompt or terminal.
    -   Go into the `server` folder by typing: `cd server` and pressing Enter.
    -   Tell Bun to get the necessary files by typing: `bun install` and pressing Enter.

2.  **Set up the Client (Browser Part):**
    -   This part uses tools directly from the internet, so you don't need to install anything extra here.

## How to Run the Checker

You need to start *both* the server and the client parts for it to work. They run in separate command windows.

1.  **Start the Server:**
    -   Make sure your command prompt is still in the `server` folder (if not, use `cd server` again).
    -   Start the server by typing: `bun run dev` and pressing Enter.
    -   It will show a message, usually saying it's running on `http://localhost:6969`. Keep this window open.

2.  **Start the Client (Browser Part):**
    -   Open a **new** command prompt or terminal window.
    -   Go into the `client` folder. If your first window was in the `server` folder, you can type: `cd ../client` and press Enter.
    -   Start the client by typing: `npx serve` and pressing Enter.
    -   It will show a message with a web address, usually `http://localhost:3000` or similar.
    -   Copy this web address and paste it into your web browser (like Chrome, Firefox, or Edge) to open the application.

## How It Works (Simplified)

1.  **Check Who You Are:** First, you'll see a screen asking you to look at the camera and click "Verify Identity". A picture is taken and sent to the server to check (this demo version just pretends to check).
2.  **Start Watching:** If the check passes, the attention monitoring starts. Your web browser continuously watches your face using the webcam.
3.  **Are You Paying Attention?:** The tool checks if:
    -   Your head is turned too far away.
    -   Your eyes are looking too far to the side.
    -   More than one face is seen.
4.  **Sending Proof:** If you seem to be looking away for more than a few seconds (and after a short break since the last time), the browser takes a picture of the video feed and sends it to the server as proof.
5.  **Settings:** You can change how sensitive the detection is (like how far you can look away) by editing the settings file at [`client/config.js`](client/config.js).