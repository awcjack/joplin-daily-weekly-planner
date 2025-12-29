
async function init() {
	const projectsList = document.getElementById('projects-list');
	const plannerView = document.getElementById('planner-view');
	const refreshBtn = document.getElementById('refresh-btn');
	const currentDateDisplay = document.getElementById('current-date-display');
	const prevDateBtn = document.getElementById('prev-date-btn');
	const nextDateBtn = document.getElementById('next-date-btn');

	let currentDate = new Date();
	let currentView = 'daily';
	let plannerData = {};
	let lastFocusedSlot = null;
	let saveTimeout = null;

	// Helper to format date as YYYY-MM-DD
	function formatDate(date) {
		return date.toISOString().split('T')[0];
	}

	function getStartOfWeek(date) {
		const d = new Date(date);
		const day = d.getDay();
		const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust so Monday is first
		return new Date(d.setDate(diff));
	}

	async function loadProjects() {
		projectsList.innerHTML = '<li>Loading...</li>';
		const projects = await webviewApi.postMessage({ type: 'getProjects' });
		
		if (!projects || projects.length === 0) {
			projectsList.innerHTML = '<li>No projects found with tag "project"</li>';
			return;
		}

		projectsList.innerHTML = projects.map(p => `
			<li class="project-item" draggable="true" data-id="${p.id}" data-title="${p.title}">
				<span class="project-title">${p.title}</span>
				<span class="add-btn" title="Add to selected slot">+</span>
			</li>
		`).join('');

		// Add drag listeners to new items
		document.querySelectorAll('.project-item').forEach(item => {
			item.addEventListener('dragstart', (e) => {
				e.dataTransfer.setData('text/plain', item.dataset.title);
				e.dataTransfer.effectAllowed = 'copy';
			});
		});
		
		// Add click listener for "+" button
		document.querySelectorAll('.add-btn').forEach(btn => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation(); // Prevent opening the note
				const title = e.target.parentElement.dataset.title;
				if (lastFocusedSlot) {
					const currentText = lastFocusedSlot.innerText.trim();
					lastFocusedSlot.innerText = currentText ? currentText + '\n' + title : title;
					// Trigger input event to save
					lastFocusedSlot.dispatchEvent(new Event('input', { bubbles: true }));
				} else {
					alert('Please select a time slot first.');
				}
			});
		});
	}

	async function saveData() {
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(async () => {
			await webviewApi.postMessage({ type: 'saveData', data: plannerData });
		}, 1000);
	}

	async function loadData() {
		const data = await webviewApi.postMessage({ type: 'loadData' });
		if (data) {
			plannerData = data;
			renderCurrentView();
		}
	}

	function updateHeader() {
		const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
		if (currentView === 'daily') {
			currentDateDisplay.textContent = currentDate.toLocaleDateString(undefined, options);
		} else {
			const start = getStartOfWeek(currentDate);
			const end = new Date(start);
			end.setDate(end.getDate() + 6);
			currentDateDisplay.textContent = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
		}
	}

	function handleInput(e) {
		const target = e.target;
		if (target.classList.contains('time-content') || target.classList.contains('week-slot')) {
			const dateKey = target.dataset.date;
			const timeKey = target.dataset.time; // "08:00"
			const content = target.innerText.trim();

			if (!plannerData[dateKey]) plannerData[dateKey] = {};
			
			if (content) {
				plannerData[dateKey][timeKey] = content;
			} else {
				delete plannerData[dateKey][timeKey];
				if (Object.keys(plannerData[dateKey]).length === 0) {
					delete plannerData[dateKey];
				}
			}
			
			saveData();
		}
	}

	function renderDailyView() {
		updateHeader();
		const dateKey = formatDate(currentDate);
		const dayData = plannerData[dateKey] || {};

		let html = '<div class="time-grid">';
		for (let hour = 8; hour <= 20; hour++) {
			const timeLabel = `${hour.toString().padStart(2, '0')}:00`;
			const content = dayData[timeLabel] || '';
			html += `
				<div class="time-slot">
					<div class="time-label">${timeLabel}</div>
					<div class="time-content" contenteditable="true" data-placeholder="Add task..." data-date="${dateKey}" data-time="${timeLabel}">${content}</div>
				</div>
			`;
		}
		html += '</div>';
		plannerView.innerHTML = html;
		
		// Attach Drag & Drop listeners
		        plannerView.querySelectorAll('.time-content').forEach(slot => {
		            slot.addEventListener('dragover', (e) => {
		                e.preventDefault();
		                slot.classList.add('drag-over');
		            });
		            slot.addEventListener('dragleave', () => {
		                slot.classList.remove('drag-over');
		            });
		            slot.addEventListener('drop', (e) => {
		                e.preventDefault();
		                slot.classList.remove('drag-over');
		                const text = e.dataTransfer.getData('text/plain');
		                if (text) {
		                    const currentText = slot.innerText.trim();
		                    slot.innerText = currentText ? currentText + '\n' + text : text;
		                    // Trigger input for auto-save
		                    slot.dispatchEvent(new Event('input', { bubbles: true }));
		                }
		            });
		            // Track focus
		            slot.addEventListener('focus', () => {
		                lastFocusedSlot = slot;
		            });
		        });	}

	function renderWeeklyView() {
		updateHeader();
		const startOfWeek = getStartOfWeek(currentDate);
		const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
		
		// Generate dates for the week headers
		const weekDates = [];
		for (let i = 0; i < 7; i++) {
			const d = new Date(startOfWeek);
			d.setDate(d.getDate() + i);
			weekDates.push(d);
		}

		let html = '<div class="weekly-grid">';
		html += '<div class="week-header"><div>Time</div>' + 
			days.map((d, i) => `<div>${d}<br><small>${weekDates[i].getDate()}</small></div>`).join('') + 
			'</div>';
		
		for (let hour = 8; hour <= 20; hour += 2) { // Changed to every 2 hours to save space, or maybe every hour? Let's stick to 2 for compactness
			const timeLabel = `${hour.toString().padStart(2, '0')}:00`;
			html += `<div class="week-row"><div class="time-label">${timeLabel}</div>`;
			
			for (let i = 0; i < 7; i++) {
				const dateKey = formatDate(weekDates[i]);
				const dayData = plannerData[dateKey] || {};
				const content = dayData[timeLabel] || '';
				
				html += `<div class="week-slot" contenteditable="true" data-date="${dateKey}" data-time="${timeLabel}">${content}</div>`;
			}
			html += '</div>';
		}
		html += '</div>';
		plannerView.innerHTML = html;

		// Attach Drag & Drop listeners for Weekly View
		plannerView.querySelectorAll('.week-slot').forEach(slot => {
			slot.addEventListener('dragover', (e) => {
				e.preventDefault();
				slot.classList.add('drag-over');
			});
			slot.addEventListener('dragleave', () => {
				slot.classList.remove('drag-over');
			});
			slot.addEventListener('drop', (e) => {
				e.preventDefault();
				slot.classList.remove('drag-over');
				const text = e.dataTransfer.getData('text/plain');
				if (text) {
					const currentText = slot.innerText.trim();
					slot.innerText = currentText ? currentText + '\n' + text : text;
					// Trigger input for auto-save
					slot.dispatchEvent(new Event('input', { bubbles: true }));
				}
			});
			// Track focus
			slot.addEventListener('focus', () => {
				lastFocusedSlot = slot;
			});
		});
	}

	function renderCurrentView() {
		if (currentView === 'daily') {
			renderDailyView();
		} else {
			renderWeeklyView();
		}
	}

	plannerView.addEventListener('input', handleInput);

	refreshBtn.addEventListener('click', () => {
		loadProjects();
		loadData();
	});
	
	document.getElementById('save-btn').addEventListener('click', saveData);
	
	document.getElementById('close-btn').addEventListener('click', async () => {
		await webviewApi.postMessage({ type: 'closePanel' });
	});

	prevDateBtn.addEventListener('click', () => {
		if (currentView === 'daily') {
			currentDate.setDate(currentDate.getDate() - 1);
		} else {
			currentDate.setDate(currentDate.getDate() - 7);
		}
		renderCurrentView();
	});

	nextDateBtn.addEventListener('click', () => {
		if (currentView === 'daily') {
			currentDate.setDate(currentDate.getDate() + 1);
		} else {
			currentDate.setDate(currentDate.getDate() + 7);
		}
		renderCurrentView();
	});

	document.querySelectorAll('.tab-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
			currentView = btn.dataset.tab;
			renderCurrentView();
		});
	});

	// Open notes when clicked
	document.addEventListener('click', async (event) => {
		const target = event.target;
		if (target.classList.contains('project-item') || target.classList.contains('note-item')) {
			const noteId = target.dataset.id;
			await webviewApi.postMessage({ type: 'openNote', noteId: noteId });
		}
	});

	// Initial load
	loadProjects();
	loadData();

	// Resizer Logic
	const resizer = document.getElementById('dragMe');
	const sidebar = document.getElementById('sidebar');
	const container = document.querySelector('.planner-content');
	
	let x = 0;
	let w = 0;

	const mouseDownHandler = function(e) {
		x = e.clientX;
		const sbWidth = window.getComputedStyle(sidebar).width;
		w = parseInt(sbWidth, 10);

		document.addEventListener('mousemove', mouseMoveHandler);
		document.addEventListener('mouseup', mouseUpHandler);
		resizer.classList.add('resizing');
	};

	const mouseMoveHandler = function(e) {
		const dx = e.clientX - x;
		const newWidth = w + dx;
		// Min width check
		if (newWidth > 150 && newWidth < container.getBoundingClientRect().width - 300) {
			sidebar.style.width = `${newWidth}px`;
		}
	};

	const mouseUpHandler = function() {
		document.removeEventListener('mousemove', mouseMoveHandler);
		document.removeEventListener('mouseup', mouseUpHandler);
		resizer.classList.remove('resizing');
	};

	resizer.addEventListener('mousedown', mouseDownHandler);
}

init();
