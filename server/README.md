# Elysia with Bun runtime

## Install Bun
This application require Bun to run
- For Windows, run this on PowerShell/cmd.exe
```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```
- For macOS/Linux
```bash
curl -fsSL https://bun.sh/install | bash
```
Full installation instruction can be found here <br>
https://bun.sh/docs/installation

You might want to check the link because install command doesn't automatically add it to <b>PATH</b>
<br>
To check that Bun was installed successfully, open a new terminal window and run:
```powershell
bun --version
```

## Getting Started
To get started with this application, run this:
```bash
bun install
```

## Development
To start the development server run:
```bash
bun run dev
```

Open http://localhost:6969/ with your browser to see the result.