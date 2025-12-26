# Joplin Daily/Weekly Planner Plugin

A comprehensive daily and weekly planner plugin for Joplin, designed to help you timeblock your day and manage your projects effectively directly within your note-taking app.

## Features

- **📅 Daily & Weekly Views**: Switch seamlessly between a detailed Daily view (hourly) and a broad Weekly view (2-hour blocks) to plan your time.
- **⏱️ Timeblocking**: Dedicated time slots from 08:00 to 20:00 to structure your day.
- **📂 Project Integration**: Automatically fetches and lists all notes tagged with `project` in the sidebar for quick access.
- **🖱️ Drag & Drop**: Drag project names directly from the sidebar into any time slot to schedule them.
- **➕ Quick Add**: Select a time slot and click the `+` button next to a project to instantly add it to your schedule.
- **💾 Auto-Save**: All planner data is automatically saved to a dedicated note titled **"Joplin Planner Data"** in JSON format.
- **🔗 Note Navigation**: Click on any project name in the sidebar to immediately open the corresponding note in Joplin.
- **🌗 Theme Support**: Automatically adapts to your Joplin theme (Light/Dark).

## Installation

1.  Download the latest `.jpl` file from the [Releases](https://github.com/awcjack/joplin-daily-weekly-planner/releases) page.
2.  Open Joplin.
3.  Go to **Tools > Options > Plugins** (Windows/Linux) or **Joplin > Settings > Plugins** (macOS).
4.  Click the **Gear Icon** ⚙️ and select **Install from file**.
5.  Select the downloaded `.jpl` file.
6.  Restart Joplin.

## Usage

### Getting Started
1.  **Tag Your Projects**: Tag any note in Joplin with the tag `project`. These notes will automatically appear in the "Projects" sidebar of the planner.
2.  **Open the Planner**: Use the **Toggle Planner** command from the Tools menu or command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`), or look for the planner icon in the toolbar.

### Scheduling
- **Manual Entry**: Click into any time slot and start typing to add a task.
- **Drag and Drop**: Click and drag a project from the sidebar list and drop it into a time slot.
- **Quick Add**:
    1.  Click a time slot to select it (it will highlight).
    2.  Click the small **`+`** button next to a project name in the sidebar.
    3.  The project title will be appended to the selected slot.

### Navigation
- Use the **Tabs** (Daily/Weekly) to switch views.
- Use the **<** and **>** buttons to navigate between days or weeks.
- Click the **Refresh** button to reload the project list if you've added new tags.

## Development

### Prerequisites
- Node.js (v18+)
- npm

### Build
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build the plugin:
    ```bash
    npm run dist
    ```
    The generated `.jpl` file will be in the `publish/` directory.

## License

MIT
