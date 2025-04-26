# Server (Elysia with Bun Runtime)

This directory contains the backend server for the Face Attention Checker application, built using the ElysiaJS framework and running on the Bun runtime.

## 1. Install Bun

This application requires the Bun JavaScript runtime.

**Windows:**

Open PowerShell (it's recommended to run as Administrator if you encounter permission issues) and execute:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

**macOS / Linux:**

Open your terminal and run:

```bash
curl -fsSL https://bun.sh/install | bash
```

**Verify Installation:**

After installation, **close and reopen** your terminal/PowerShell window. Then, run the following command to confirm Bun is installed and accessible:

```bash
bun --version
```

**Important:** The installer might not automatically add Bun to your system's `PATH` environment variable. If the `bun --version` command doesn't work in a new terminal, please refer to the official Bun installation guide for instructions on adding it to your PATH manually:
[https://bun.sh/docs/installation#how-to-add-your-path](https://bun.sh/docs/installation#how-to-add-your-path)

## 2. Install Dependencies

Once Bun is installed, navigate to this `server` directory in your terminal and install the necessary project dependencies:

```bash
bun install
```

## 3. Run the Development Server

To start the server for development, run:

```bash
bun run dev
```

This will typically start the server on `http://localhost:6969`. Check the terminal output for the exact address. You can open this address in your browser, but the primary interaction will be through the client application.