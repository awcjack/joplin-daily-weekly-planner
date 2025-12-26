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
		});

		// Find or create the data note
		let dataNoteId = await joplin.settings.value('plannerNoteId');
		if (!dataNoteId) {
			console.info('No data note ID found in settings. Searching by title...');
			const search = await joplin.data.get(['search'], { query: 'title:"Joplin Planner Data"' });
			if (search.items.length > 0) {
				dataNoteId = search.items[0].id;
				console.info('Found existing data note:', dataNoteId);
			} else {
				console.info('Creating new data note...');
				const newNote = await joplin.data.post(['notes'], null, { title: 'Joplin Planner Data', body: '' });
				dataNoteId = newNote.id;
			}
			await joplin.settings.setValue('plannerNoteId', dataNoteId);
		}

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
			} else if (message.type === 'loadData') {
				const note = await joplin.data.get(['notes', dataNoteId], { fields: ['body'] });
				const body = note.body || '';
				const match = body.match(/```json\n([\s\S]*?)\n```/);
				if (match && match[1]) {
					try {
						const data = JSON.parse(match[1]);
						// Filter to last 1 month (30 days) to prevent memory issues
						const filteredData = {};
						const now = new Date();
						const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
						
						for (const dateKey in data) {
							const date = new Date(dateKey);
							if (date >= thirtyDaysAgo) {
								filteredData[dateKey] = data[dateKey];
							}
						}
						return filteredData;
					} catch (e) {
						console.error('Error parsing planner data:', e);
						return {};
					}
				}
				return {};
			}
		});
	},
});
