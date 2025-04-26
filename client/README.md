# Client (Browser Application)

This directory contains the frontend application for the Face Attention Checker. It runs directly in your web browser.

## Prerequisites

1.  **Node.js and npx:** While the application itself runs in the browser, you need `npx` (which comes with Node.js) to easily serve the files locally.
    -   If you don't have Node.js installed, download and install it from: [https://nodejs.org/en/download](https://nodejs.org/en/download)
    -   `npx` should be available automatically after installing Node.js.

## Running the Client

**Important:** Ensure the [server](../server/README.md) is running before starting the client.

1.  Open your terminal or command prompt.
2.  Navigate to this `client` directory.
3.  Start the local development server using `npx`:
    ```bash
    npx serve
    ```
4.  The command will output a URL, typically `http://localhost:3000` or similar. Open this URL in your web browser to use the application.