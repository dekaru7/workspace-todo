let tasks = [];
try {
    tasks = JSON.parse(localStorage.getItem('cal_todos')) || [];
} catch (e) {
    tasks = [];
}

let currentFilter = 'all';
let searchQuery = '';
let selectedDate = new Date().toISOString().split('T')[0];

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
    themeBtn: document.getElementById('theme-btn'),
    calendarInput: document.getElementById('calendar-date-input'),
    loginPage: document.getElementById('login-page'),
    mainDashboard: document.getElementById('main-dashboard'),
    loginBtn: document.getElementById('login-btn')
};

DOM.loginBtn.addEventListener('click', () => {
    DOM.loginPage.style.display = 'none';
    DOM.mainDashboard.style.display = 'block';
});

let currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
DOM.themeBtn.textContent = currentTheme === 'dark' ? 'Terang' : 'Gelap';

DOM.themeBtn.addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    DOM.themeBtn.textContent = currentTheme === 'dark' ? 'Terang' : 'Gelap';
    localStorage.setItem('theme', currentTheme);
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
    renderTasks();
}

DOM.calendarInput.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    renderTasks();
});

document.getElementById('prev-day-btn').addEventListener('click', () => changeDate(-1));
document.getElementById('next-day-btn').addEventListener('click', () => changeDate(1));
document.getElementById('today-btn').addEventListener('click', () => {
    selectedDate = formatDateString(new Date());
    DOM.calendarInput.value = selectedDate;
    renderTasks();
});

function saveAndRender() {
    localStorage.setItem('cal_todos', JSON.stringify(tasks));
    renderTasks();
}

function renderTasks() {
    DOM.taskList.innerHTML = '';
    
    const labelOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    DOM.progressDateLabel.textContent = new Date(selectedDate).toLocaleDateString('id-ID', labelOptions);

    const dayTasks = tasks.filter(task => task.date === selectedDate);
    const total = dayTasks.length;
    const completedCount = dayTasks.reduce((acc, t) => t.completed ? acc + 1 : acc, 0);
    
    const percentage = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    DOM.progressFill.style.width = `${percentage}%`;
    DOM.progressText.textContent = `${percentage}%`;

    const timeWeight = { pagi: 1, siang: 2, sore: 3, malam: 4 };
    const lowerQuery = searchQuery.toLowerCase();
    
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
            return (timeWeight[a.timeExecution] || 1) - (timeWeight[b.timeExecution] || 1);
        });

    if (filteredTasks.length === 0) {
        DOM.emptyView.style.display = 'block';
        return;
    }

    DOM.emptyView.style.display = 'none';
    const fragment = document.createDocumentFragment();

    filteredTasks.forEach(({ id, title, completed, tag, timeExecution }) => {
        const li = document.createElement('li');
        li.className = `todo-item ${completed ? 'completed' : ''}`;
        li.dataset.id = id;
        
        const timeLabel = (timeExecution || 'pagi').toUpperCase();

        li.innerHTML = `
            <div class="todo-left" data-action="toggle">
                <div class="custom-check"></div>
                <div class="todo-details">
                    <span class="todo-title">${escapeHTML(title)}</span>
                    <div class="todo-meta">
                        <span class="badge tag">${escapeHTML(tag)}</span>
                        <span class="badge time-${timeExecution || 'pagi'}">${timeLabel}</span>
                    </div>
                </div>
            </div>
            <button class="btn-action-delete" data-action="delete" aria-label="Hapus agenda">&times;</button>
        `;
        fragment.appendChild(li);
    });
    
    DOM.taskList.appendChild(fragment);
}

function addTask() {
    const title = DOM.taskInput.value.trim();
    if (!title) return;

    tasks.push({
        id: Date.now(),
        title,
        tag: DOM.tagInput.value,
        timeExecution: DOM.timeInput.value,
        date: selectedDate,
        completed: false
    });

    DOM.taskInput.value = '';
    saveAndRender();
}

DOM.taskList.addEventListener('click', (e) => {
    const item = e.target.closest('.todo-item');
    if (!item) return;
    
    const id = parseInt(item.dataset.id, 10);
    if (e.target.closest('[data-action="toggle"]')) {
        tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        saveAndRender();
    } else if (e.target.closest('[data-action="delete"]')) {
        tasks = tasks.filter(t => t.id !== id);
        saveAndRender();
    }
});

document.getElementById('filter-nav').addEventListener('click', (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderTasks();
});

document.getElementById('clear-completed-btn').addEventListener('click', () => {
    tasks = tasks.filter(t => !(t.date === selectedDate && t.completed));
    saveAndRender();
});

DOM.searchInput.addEventListener('input', (e) => { 
    searchQuery = e.target.value; 
    renderTasks(); 
});

document.getElementById('add-task-btn').addEventListener('click', addTask);
DOM.taskInput.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') addTask(); 
});

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, t => ({ 
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' 
    }[t] || t));
}

renderTasks();