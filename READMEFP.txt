Quick Start Guide

Note: This application requires access to your computer's webcam.
Benchmarking: If testing performance, please record CPU, GPU and RAM usage before starting and while running the application.

1. Install Software (If you don't have them)

   - Node.js: Go to https://nodejs.org/en/download and download/install it. This also installs npx.
   - Bun:
     - Windows: Open PowerShell and run: powershell -c "irm bun.sh/install.ps1 | iex"
     - Mac/Linux: Open Terminal and run: curl -fsSL https://bun.sh/install | bash
     - After installing Bun:
       1. Close and reopen your terminal/PowerShell.
       2. Check it worked by typing `bun --version` and pressing Enter.
       3. If `bun --version` fails (command not found): You need to manually add Bun to your system's PATH. Follow the instructions here: https://bun.sh/docs/installation#how-to-add-your-path

2. Terminal 1: Start the Server

   1. Open a terminal/command prompt.
   2. Go to the server folder:
      cd server
   3. Install server dependencies (first time only):
      bun install
   4. Start the server:
      bun run dev
      (Keep this terminal open. It usually runs on http://localhost:6969)

3. Terminal 2: Start the Client

   1. Open a new terminal/command prompt.
   2. Go to the client folder:
      cd client
      (If your first terminal is in the `server` folder, you might use `cd ../client`)
   3. Start the client:
      npx serve
   4. Open the web address shown in this terminal (usually http://localhost:3000) in your web browser.