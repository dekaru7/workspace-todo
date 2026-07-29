let tasks = [];
try {
    tasks = JSON.parse(localStorage.getItem('cal_todos')) || [];
} catch (e) {
    tasks = [];
}
// migrate: ensure every task has an "order" value for manual drag sorting
let orderSeed = Date.now();
tasks.forEach(t => { if (typeof t.order !== 'number') t.order = orderSeed++; });

let currentFilter = localStorage.getItem('cal_filter') || 'all';
let searchQuery = '';
let selectedDate = new Date().toISOString().split('T')[0];
let editingId = null;
let lastDeleted = null;
let lastDeletedTimer = null;

const DOM = {
    taskList: document.getElementById('todo-list'),
    taskInput: document.getElementById('task-title'),
    tagInput: document.getElementById('task-tag'),
    timeInput: document.getElementById('task-time'),
    searchInput: document.getElementById('search-input'),
    progressFill: document.getElementById('progress-fill'),
    progressText: document.getElementById('progress-text'),
    progressDateLabel: document.getElementById('progress-date-label'),
    emptyView: document.getElementById('empty-view'),
    emptyViewText: document.getElementById('empty-view-text'),
    calendarInput: document.getElementById('calendar-date-input'),
    loginPage: document.getElementById('login-page'),
    mainDashboard: document.getElementById('main-dashboard'),
    loginBtn: document.getElementById('login-btn'),
    toastContainer: document.getElementById('toast-container'),
    countAll: document.getElementById('count-all'),
    countActive: document.getElementById('count-active'),
    countCompleted: document.getElementById('count-completed')
};

DOM.loginBtn.addEventListener('click', () => {
    DOM.loginPage.style.display = 'none';
    DOM.mainDashboard.style.display = 'block';
});

DOM.calendarInput.value = selectedDate;

function formatDateString(dateObj) {
    const offset = dateObj.getTimezoneOffset();
    const localDate = new Date(dateObj.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
}

function changeDate(daysOffset) {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + daysOffset);
    selectedDate = formatDateString(current);
    DOM.calendarInput.value = selectedDate;
    cancelEdit();
    renderTasks();
}

DOM.calendarInput.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    cancelEdit();
    renderTasks();
});

document.getElementById('prev-day-btn').addEventListener('click', () => changeDate(-1));
document.getElementById('next-day-btn').addEventListener('click', () => changeDate(1));
document.getElementById('today-btn').addEventListener('click', () => {
    selectedDate = formatDateString(new Date());
    DOM.calendarInput.value = selectedDate;
    cancelEdit();
    renderTasks();
});

function saveAndRender(opts) {
    localStorage.setItem('cal_todos', JSON.stringify(tasks));
    renderTasks(opts);
}

/* ---------------- Toasts ---------------- */
function showToast(message, actionLabel, actionCallback, duration) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    if (actionLabel && actionCallback) {
        const btn = document.createElement('button');
        btn.className = 'toast-action';
        btn.textContent = actionLabel;
        btn.addEventListener('click', () => {
            actionCallback();
            dismissToast(toast);
        });
        toast.appendChild(btn);
    }

    DOM.toastContainer.appendChild(toast);
    const timer = setTimeout(() => dismissToast(toast), duration || 4000);
    toast._timer = timer;
}

function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    clearTimeout(toast._timer);
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 250);
}

/* ---------------- Confetti ---------------- */
function celebrate() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['var(--time-pagi)', 'var(--time-siang)', 'var(--time-sore)', 'var(--time-malam)'];
    for (let i = 0; i < 26; i++) {
        const piece = document.createElement('span');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.background = colors[i % colors.length];
        piece.style.animationDuration = (1.6 + Math.random() * 1.1) + 's';
        piece.style.opacity = String(0.7 + Math.random() * 0.3);
        document.body.appendChild(piece);
        setTimeout(() => piece.remove(), 3000);
    }
}

/* ---------------- Rendering ---------------- */
let wasComplete = {};

function renderTasks(opts) {
    opts = opts || {};
    DOM.taskList.innerHTML = '';

    const labelOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    DOM.progressDateLabel.textContent = new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', labelOptions);

    const dayTasks = tasks.filter(task => task.date === selectedDate);
    const total = dayTasks.length;
    const completedCount = dayTasks.reduce((acc, t) => t.completed ? acc + 1 : acc, 0);

    const percentage = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    DOM.progressFill.style.width = `${percentage}%`;
    DOM.progressText.textContent = `${percentage}%`;

    if (opts.checkCelebrate && total > 0 && percentage === 100 && wasComplete[selectedDate] !== true) {
        celebrate();
    }
    wasComplete[selectedDate] = total > 0 && percentage === 100;

    DOM.countAll.textContent = total;
    DOM.countActive.textContent = total - completedCount;
    DOM.countCompleted.textContent = completedCount;

    const lowerQuery = searchQuery.toLowerCase();
    const dragEnabled = currentFilter === 'all' && !searchQuery;

    const filteredTasks = dayTasks
        .filter(task => {
            const matchesSearch = task.title.toLowerCase().includes(lowerQuery);
            const matchesFilter = currentFilter === 'all' ||
                (currentFilter === 'active' && !task.completed) ||
                (currentFilter === 'completed' && task.completed);
            return matchesSearch && matchesFilter;
        })
        .sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return (a.order || 0) - (b.order || 0);
        });

    if (filteredTasks.length === 0) {
        DOM.emptyView.style.display = 'flex';
        DOM.emptyViewText.textContent = total === 0
            ? 'Tidak ada rencana kegiatan pada tanggal ini.'
            : 'Tidak ada agenda yang cocok dengan pencarian/filter ini.';
        return;
    }

    DOM.emptyView.style.display = 'none';
    const fragment = document.createDocumentFragment();

    filteredTasks.forEach(({ id, title, completed, tag, timeExecution }, idx) => {
        const li = document.createElement('li');
        li.className = `todo-item ${completed ? 'completed' : ''}`;
        li.dataset.id = id;
        li.style.animationDelay = Math.min(idx * 30, 300) + 'ms';
        li.draggable = dragEnabled && !completed;

        const timeLabel = (timeExecution || 'pagi').toUpperCase();
        const isEditing = editingId === id;

        li.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <div class="todo-left" data-action="toggle">
                <div class="custom-check"></div>
                <div class="todo-details">
                    ${isEditing
                        ? `<input type="text" class="todo-title-input" data-action="edit-input" value="${escapeAttr(title)}">`
                        : `<span class="todo-title" data-action="edit">${escapeHTML(title)}</span>`
                    }
                    <div class="todo-meta">
                        <span class="badge tag">${escapeHTML(tag)}</span>
                        <span class="badge time-${timeExecution || 'pagi'}">${timeLabel}</span>
                    </div>
                </div>
            </div>
            <div class="todo-actions">
                <button class="btn-icon-action" data-action="edit-btn" aria-label="Ubah agenda">✎</button>
                <button class="btn-icon-action btn-delete" data-action="delete" aria-label="Hapus agenda">✕</button>
            </div>
        `;
        fragment.appendChild(li);
    });

    DOM.taskList.appendChild(fragment);

    if (editingId !== null) {
        const input = DOM.taskList.querySelector('[data-action="edit-input"]');
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    attachDragHandlers();
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, t => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[t] || t));
}
function escapeAttr(str) { return escapeHTML(str); }

/* ---------------- Add task ---------------- */
function addTask() {
    const title = DOM.taskInput.value.trim();
    if (!title) return;

    tasks.push({
        id: Date.now(),
        title,
        tag: DOM.tagInput.value,
        timeExecution: DOM.timeInput.value,
        date: selectedDate,
        completed: false,
        order: Date.now()
    });

    DOM.taskInput.value = '';
    DOM.taskInput.focus();
    saveAndRender();
}

document.getElementById('add-task-btn').addEventListener('click', addTask);
DOM.taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
});

/* ---------------- Edit task ---------------- */
function startEdit(id) {
    editingId = id;
    renderTasks();
}

function cancelEdit() {
    if (editingId !== null) {
        editingId = null;
    }
}

function commitEdit(id, input) {
    const value = input.value.trim();
    editingId = null;
    if (!value) { renderTasks(); return; }
    tasks = tasks.map(t => t.id === id ? { ...t, title: value } : t);
    saveAndRender();
}

/* ---------------- List interactions ---------------- */
DOM.taskList.addEventListener('click', (e) => {
    const item = e.target.closest('.todo-item');
    if (!item) return;
    const id = parseInt(item.dataset.id, 10);

    if (e.target.closest('[data-action="toggle"]')) {
        if (editingId === id) return;
        tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        saveAndRender({ checkCelebrate: true });
    } else if (e.target.closest('[data-action="edit-btn"]') || e.target.closest('[data-action="edit"]')) {
        startEdit(id);
    } else if (e.target.closest('[data-action="delete"]')) {
        deleteTask(id);
    }
});

DOM.taskList.addEventListener('keydown', (e) => {
    if (!e.target.matches('[data-action="edit-input"]')) return;
    const item = e.target.closest('.todo-item');
    const id = parseInt(item.dataset.id, 10);
    if (e.key === 'Enter') commitEdit(id, e.target);
    if (e.key === 'Escape') { editingId = null; renderTasks(); }
});

DOM.taskList.addEventListener('focusout', (e) => {
    if (!e.target.matches('[data-action="edit-input"]')) return;
    const item = e.target.closest('.todo-item');
    if (!item) return;
    const id = parseInt(item.dataset.id, 10);
    if (editingId === id) commitEdit(id, e.target);
});

function deleteTask(id) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    lastDeleted = { task: tasks[idx], index: idx };
    tasks = tasks.filter(t => t.id !== id);
    saveAndRender();

    clearTimeout(lastDeletedTimer);
    showToast('Agenda dihapus', 'Urungkan', () => {
        if (!lastDeleted) return;
        const restore = lastDeleted.task;
        const insertAt = Math.min(lastDeleted.index, tasks.length);
        tasks.splice(insertAt, 0, restore);
        lastDeleted = null;
        saveAndRender();
    }, 5000);
}

/* ---------------- Drag & drop reorder ---------------- */
let dragSourceId = null;

function attachDragHandlers() {
    const items = DOM.taskList.querySelectorAll('.todo-item[draggable="true"]');
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            dragSourceId = parseInt(item.dataset.id, 10);
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            DOM.taskList.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (parseInt(item.dataset.id, 10) === dragSourceId) return;
            item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            const targetId = parseInt(item.dataset.id, 10);
            if (dragSourceId === null || targetId === dragSourceId) return;
            reorderTasks(dragSourceId, targetId);
        });
    });
}

function reorderTasks(sourceId, targetId) {
    const dayActive = tasks
        .filter(t => t.date === selectedDate && !t.completed)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    const fromIdx = dayActive.findIndex(t => t.id === sourceId);
    const toIdx = dayActive.findIndex(t => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = dayActive.splice(fromIdx, 1);
    dayActive.splice(toIdx, 0, moved);

    dayActive.forEach((t, i) => { t.order = i; });
    tasks = tasks.map(t => {
        const updated = dayActive.find(d => d.id === t.id);
        return updated ? updated : t;
    });

    dragSourceId = null;
    saveAndRender();
}

/* ---------------- Filters / search / clear ---------------- */
document.getElementById('filter-nav').addEventListener('click', (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;

    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    localStorage.setItem('cal_filter', currentFilter);
    cancelEdit();
    renderTasks();
});

document.querySelectorAll('.filter-tab').forEach(tab => {
    if (tab.dataset.filter === currentFilter) {
        document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
        tab.classList.add('active');
    }
});

document.getElementById('clear-completed-btn').addEventListener('click', () => {
    const countRemoved = tasks.filter(t => t.date === selectedDate && t.completed).length;
    if (countRemoved === 0) return;
    tasks = tasks.filter(t => !(t.date === selectedDate && t.completed));
    saveAndRender();
    showToast(`${countRemoved} agenda selesai dibersihkan`);
});

DOM.searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTasks();
});

/* ---------------- Live clock ---------------- */
const liveClockEl = document.getElementById('live-clock');
function updateLiveClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    liveClockEl.textContent = `${hh}:${mm}`;
}
updateLiveClock();
setInterval(updateLiveClock, 1000);

renderTasks();
