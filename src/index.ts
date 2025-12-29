import joplin from 'api';
import { ViewHandle } from 'api/types';

joplin.plugins.register({
	onStart: async function() {
		await joplin.settings.registerSection('plannerSection', {
			label: 'Planner',
			iconName: 'fas fa-calendar-alt',
		});

		await joplin.settings.registerSettings({
			'plannerNoteId': {
				value: '',
				type: 2, // SettingItemType.String
				section: 'plannerSection',
				public: false,
				label: 'Planner Note ID',
			},
			'plannerAlarmNoteId': {
				value: '',
				type: 2,
				section: 'plannerSection',
				public: false,
				label: 'Planner Alarm Note ID',
			},
			'plannerFolderId': {
				value: '',
				type: 2,
				section: 'plannerSection',
				public: false,
				label: 'Planner Folder ID',
			},
		});

		async function ensureFolderExists(settingKey: string, title: string) {
			let folderId = await joplin.settings.value(settingKey);
			if (folderId) {
				try {
					await joplin.data.get(['folders', folderId], { fields: ['id'] });
					return folderId;
				} catch (e) {
					console.warn(`Folder ${folderId} not found, recreating...`);
				}
			}

			const search = await joplin.data.get(['search'], { query: `notebook:"${title}" type:folder` });
			if (search.items.length > 0) {
				folderId = search.items[0].id;
			} else {
				const newFolder = await joplin.data.post(['folders'], null, { title: title });
				folderId = newFolder.id;
			}
			await joplin.settings.setValue(settingKey, folderId);
			return folderId;
		}

		async function ensureNoteExists(settingKey: string, title: string, parentId: string, isTodo = 0, initialBody = '') {
			let noteId = await joplin.settings.value(settingKey);
			if (noteId) {
				try {
					await joplin.data.get(['notes', noteId], { fields: ['id'] });
					return noteId;
				} catch (e) {
					console.warn(`Note ${noteId} not found, recreating...`);
				}
			}

			const search = await joplin.data.get(['search'], { query: `title:"${title}"` });
			if (search.items.length > 0) {
				noteId = search.items[0].id;
			} else {
				const newNote = await joplin.data.post(['notes'], null, { 
					title: title, 
					body: initialBody,
					parent_id: parentId,
					is_todo: isTodo
				});
				noteId = newNote.id;
			}
			await joplin.settings.setValue(settingKey, noteId);
			return noteId;
		}

		// Ensure resources exist
		const folderId = await ensureFolderExists('plannerFolderId', 'Planner');
		const dataNoteId = await ensureNoteExists('plannerNoteId', 'Joplin Planner Data', folderId, 0, '');
		const alarmNoteId = await ensureNoteExists('plannerAlarmNoteId', 'Planner Reminders', folderId, 1, 'This note is used by the Planner plugin to trigger alarms.');

		let cachedPlannerData: any = {};
		let lastNotifiedKey = '';

		async function loadPlannerData() {
			const note = await joplin.data.get(['notes', dataNoteId], { fields: ['body'] });
			const body = note.body || '';
			const match = body.match(/```json\n([\s\S]*?)\n```/);
			if (match && match[1]) {
				try {
					const data = JSON.parse(match[1]);
					// Filter to last 1 month
					const filteredData: any = {};
					const now = new Date();
					const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
					
					for (const dateKey in data) {
						const date = new Date(dateKey);
						if (date >= thirtyDaysAgo) {
							filteredData[dateKey] = data[dateKey];
						}
					}
					cachedPlannerData = filteredData;
					return filteredData;
				} catch (e) {
					console.error('Error parsing planner data:', e);
					return {};
				}
			}
			return {};
		}

		// Initial load
		await loadPlannerData();

		const showNotification = async (title: string, message: string) => {
			// Trigger Joplin Alarm
			try {
				await joplin.data.put(['notes', alarmNoteId], null, {
					title: `Planner: ${message.split('\n')[0]}`,
					body: message, // Update content with task details
					todo_due: Date.now() + 5000, // Trigger alarm in 5 seconds
					todo_completed: 0,
				});
			} catch (e) {
				console.error('Failed to set Joplin alarm:', e);
			}

			// Show Toast
			await joplin.views.dialogs.showToast({ message: `${title}: ${message}` });
		};

		// Check for reminders every minute
		setInterval(async () => {
			const now = new Date();
			const dateKey = now.toISOString().split('T')[0];
			const hour = now.getHours();
			const timeKey = `${hour.toString().padStart(2, '0')}:00`;
			
			const checkKey = `${dateKey}_${timeKey}`;

			if (cachedPlannerData[dateKey] && cachedPlannerData[dateKey][timeKey]) {
				const task = cachedPlannerData[dateKey][timeKey];
				// Notify if not already notified for this slot
				if (lastNotifiedKey !== checkKey) {
					// Check if task is not empty
					if (task && task.trim().length > 0) {
						await showNotification('Planner Reminder', task.split('\n')[0]);
						lastNotifiedKey = checkKey;
					}
				}
			} else {
				// Reset if we moved to a new slot that is empty
				if (lastNotifiedKey !== checkKey) {
					// Optional reset logic
				}
			}
		}, 60 * 1000);

		const panel = await joplin.views.panels.create('planner_panel');

		await joplin.commands.register({
			name: 'togglePlanner',
			label: 'Toggle Planner',
			iconName: 'fas fa-calendar-alt',
			execute: async () => {
				const isVisible = await joplin.views.panels.visible(panel);
				await joplin.views.panels.show(panel, !isVisible);
			},
		});

		await joplin.views.panels.addScript(panel, './webview.js');
		await joplin.views.panels.addScript(panel, './webview.css');

		async function updatePanel() {
			await joplin.views.panels.setHtml(panel, `
				<div class="planner-container">
					<div class="planner-header">
						<h2>Daily & Weekly Planner</h2>
						<div class="controls">
							<button id="refresh-btn" title="Refresh"><i class="fas fa-sync"></i></button>
							<button id="save-btn" title="Save"><i class="fas fa-save"></i></button>
							<button id="close-btn" title="Close Panel"><i class="fas fa-times"></i></button>
						</div>
					</div>
					<div class="planner-content">
						<div class="projects-section">
							<h3>Projects</h3>
							<ul id="projects-list">Loading...</ul>
						</div>
						<div class="timeblocks-section">
							<div class="tabs">
								<button class="tab-btn active" data-tab="daily">Daily</button>
								<button class="tab-btn" data-tab="weekly">Weekly</button>
							</div>
							<div class="date-controls">
								<button id="prev-date-btn">&lt;</button>
								<span id="current-date-display">Today</span>
								<button id="next-date-btn">&gt;</button>
							</div>
							<div id="planner-view" class="daily-view">
								<!-- Timeblocks will be rendered here -->
							</div>
						</div>
					</div>
				</div>
			`);
		}

		await updatePanel();

		// Handle messages from the webview
		await joplin.views.panels.onMessage(panel, async (message: any) => {
			if (message.type === 'getProjects') {
				// Search for notes with tag 'project'
				const tags = await joplin.data.get(['tags']);
				const projectTag = tags.items.find((t: any) => t.title.toLowerCase() === 'project');
				if (projectTag) {
					const notes = await joplin.data.get(['tags', projectTag.id, 'notes'], { fields: ['id', 'title'] });
					return notes.items;
				}
				return [];
			} else if (message.type === 'closePanel') {
				await joplin.views.panels.show(panel, false);
			} else if (message.type === 'openNote') {
				await joplin.commands.execute('openNote', message.noteId);
			} else if (message.type === 'saveData') {
				// Save to note body
				const newBody = '```json\n' + JSON.stringify(message.data, null, 2) + '\n```';
				await joplin.data.put(['notes', dataNoteId], null, { body: newBody });
				// Update cache
				cachedPlannerData = message.data;
			} else if (message.type === 'loadData') {
				// Return cached data or load fresh
				return await loadPlannerData();
			}
		});
	},
});
