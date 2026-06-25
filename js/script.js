let tasks = JSON.parse(localStorage.getItem('cal_todos')) || [];
let currentFilter = 'all';
let searchQuery = '';
let selectedDate = new Date().toISOString().split('T')[0];

const taskList = document.getElementById('todo-list');
const taskInput = document.getElementById('task-title');
const tagInput = document.getElementById('task-tag');
const timeInput = document.getElementById('task-time');
const searchInput = document.getElementById('search-input');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const progressDateLabel = document.getElementById('progress-date-label');
const emptyView = document.getElementById('empty-view');
const themeBtn = document.getElementById('theme-btn');
const calendarDateInput = document.getElementById('calendar-date-input');

calendarDateInput.value = selectedDate;

let currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
themeBtn.textContent = currentTheme === 'dark' ? 'Terang' : 'Gelap';

themeBtn.addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeBtn.textContent = currentTheme === 'dark' ? 'Terang' : 'Gelap';
    localStorage.setItem('theme', currentTheme);
});

function formatDateString(dateObj) {
    const offset = dateObj.getTimezoneOffset();
    const localDate = new Date(dateObj.getTime() - (offset*60*1000));
    return localDate.toISOString().split('T')[0];
}

function changeDate(daysOffset) {
    let current = new Date(selectedDate);
    current.setDate(current.getDate() + daysOffset);
    selectedDate = formatDateString(current);
    calendarDateInput.value = selectedDate;
    renderTasks();
}

calendarDateInput.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    renderTasks();
});

document.getElementById('prev-day-btn').addEventListener('click', () => changeDate(-1));
document.getElementById('next-day-btn').addEventListener('click', () => changeDate(1));
document.getElementById('today-btn').addEventListener('click', () => {
    selectedDate = formatDateString(new Date());
    calendarDateInput.value = selectedDate;
    renderTasks();
});

function saveAndRender() {
    localStorage.setItem('cal_todos', JSON.stringify(tasks));
    renderTasks();
}

function renderTasks() {
    taskList.innerHTML = '';
    
    const labelOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const formattedLabel = new Date(selectedDate).toLocaleDateString('id-ID', labelOptions);
    progressDateLabel.textContent = formattedLabel;

    const dayTasks = tasks.filter(task => task.date === selectedDate);

    const timeWeight = { pagi: 1, siang: 2, sore: 3, malam: 4 };
    let sortedTasks = dayTasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return timeWeight[a.timeExecution || 'pagi'] - timeWeight[b.timeExecution || 'pagi'];
    });

    let filteredTasks = sortedTasks.filter(task => 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (currentFilter === 'all' || (currentFilter === 'active' && !task.completed) || (currentFilter === 'completed' && task.completed))
    );

    const total = dayTasks.length;
    const completed = dayTasks.filter(t => t.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}%`;

    if (filteredTasks.length === 0) {
        emptyView.style.display = 'block';
    } else {
        emptyView.style.display = 'none';
        const fragment = document.createDocumentFragment();

        filteredTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `todo-item ${task.completed ? 'completed' : ''}`;
            li.dataset.id = task.id;
            
            const timeLabel = task.timeExecution ? task.timeExecution.toUpperCase() : 'PAGI';

            li.innerHTML = `
                <div class="todo-left" data-action="toggle">
                    <div class="custom-check"></div>
                    <div class="todo-details">
                        <span class="todo-title">${escapeHTML(task.title)}</span>
                        <div class="todo-meta">
                            <span class="badge tag">${task.tag}</span>
                            <span class="badge time-${task.timeExecution || 'pagi'}">${timeLabel}</span>
                        </div>
                    </div>
                </div>
                <button class="btn-action-delete" data-action="delete">&times;</button>
            `;
            fragment.appendChild(li);
        });
        taskList.appendChild(fragment);
    }
}

function addTask() {
    const title = taskInput.value.trim();
    if (!title) return;

    tasks.push({
        id: Date.now(),
        title: title,
        tag: tagInput.value,
        timeExecution: timeInput.value,
        date: selectedDate,
        completed: false
    });

    taskInput.value = '';
    saveAndRender();
}

taskList.addEventListener('click', (e) => {
    const target = e.target;
    const item = target.closest('.todo-item');
    if (!item) return;
    
    const id = parseInt(item.dataset.id);
    if (target.closest('[data-action="toggle"]')) {
        tasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        saveAndRender();
    } else if (target.closest('[data-action="delete"]')) {
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

searchInput.addEventListener('input', (e) => { searchQuery = e.target.value; renderTasks(); });
document.getElementById('add-task-btn').addEventListener('click', addTask);
taskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));
}

renderTasks();