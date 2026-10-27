/**
 * The task panel: the add form and the list, where a task can be ticked off, made active, edited or
 * deleted. Rows are rebuilt when the tasks change; keyboard focus and an unsaved edit survive the rebuild.
 */
import { el, setText } from './dom.js';
import { icon } from './icons.js';
import { MAX_ESTIMATE, MAX_TITLE_LENGTH } from './tasks.js';

/** @typedef {import('./app.js').View} View */
/** @typedef {import('./tasks.js').Task} Task */
/** @typedef {import('./i18n.js').Translate} Translate */

/**
 * Each action updates the app and redraws it.
 * @typedef {object} TaskActions
 * @property {(title: string, estimate: string) => void} addTask
 * @property {(id: number, changes: { title: string, estimate: string }) => void} editTask
 * @property {(id: number, done: boolean) => void} setTaskDone
 * @property {(id: number) => void} deleteTask
 * @property {(id: number) => void} selectTask
 */

/**
 * Connects the task panel's markup to the actions and returns its renderer.
 * @param {ParentNode} root  the document, or any node that contains the task panel
 * @param {TaskActions} actions
 * @returns {{ render(view: View, t: Translate): void }}
 */
export function createTasksView(root, actions) {
  const form = root.querySelector('#task-form');
  const ui = {
    form,
    titleInput: form.elements.namedItem('title'),
    list: root.querySelector('#task-list'),
    empty: root.querySelector('#tasks-empty'),
    count: root.querySelector('#tasks-count'),
  };
  let shown = { tasks: null, activeId: null, t: null };
  let current = null;
  /** The row in edit mode and its unsaved values: { id, title, estimate }. */
  let editing = null;
  /** The control to focus once the rows are rebuilt: { id, role, selection? }. */
  let focusAfterDraw = null;

  function render(view, t) {
    if (view.tasks === shown.tasks && view.activeTaskId === shown.activeId && t === shown.t) return;
    shown = { tasks: view.tasks, activeId: view.activeTaskId, t };
    current = { view, t };
    draw();
  }

  function draw() {
    const { view, t } = current;
    rememberDraftAndFocus();
    if (editing && !view.tasks.some((task) => task.id === editing.id)) editing = null;
    ui.list.replaceChildren(...view.tasks.map((task) => (task.id === editing?.id
      ? editRow(editing, t)
      : taskRow(task, task.id === view.activeTaskId, t))));
    ui.empty.hidden = view.tasks.length > 0;
    setText(ui.count, t('openCount', { count: view.tasks.filter((task) => !task.done).length }));
    restoreFocus();
  }

  function rememberDraftAndFocus() {
    const editForm = ui.list.querySelector('.task-edit');
    // The open form may belong to another row when the visitor has just pressed Edit on a second task.
    if (editing && editForm && rowId(editForm) === editing.id) {
      editing = { id: editing.id, title: editForm.elements.title.value, estimate: editForm.elements.estimate.value };
    }
    const active = document.activeElement;
    if (focusAfterDraw || !active?.dataset?.role || !ui.list.contains(active)) return;
    const selection = active.type === 'text' ? [active.selectionStart, active.selectionEnd] : null;
    focusAfterDraw = { id: rowId(active), role: active.dataset.role, selection };
  }

  function restoreFocus() {
    if (!focusAfterDraw) return;
    const { id, role, selection } = focusAfterDraw;
    focusAfterDraw = null;
    const row = [...ui.list.children].find((item) => item.dataset.id === String(id));
    const target = row?.querySelector(`[data-role="${role}"]:not(:disabled)`) ?? row?.querySelector('[data-role="done"]');
    if (!target) return;
    target.focus();
    if (role === 'edit-title') {
      if (selection) target.setSelectionRange(...selection);
      else target.select();
    }
  }

  function startEditing(id) {
    const task = current.view.tasks.find((item) => item.id === id);
    editing = { id, title: task.title, estimate: String(task.estimate) };
    focusAfterDraw = { id, role: 'edit-title', selection: null };
    draw();
  }

  function stopEditing(id) {
    editing = null;
    focusAfterDraw = { id, role: 'edit', selection: null };
    draw();
  }

  function saveEdit(editForm) {
    const id = rowId(editForm);
    const { title, estimate } = editForm.elements;
    editing = null;
    focusAfterDraw = { id, role: 'edit', selection: null };
    shown = { ...shown, tasks: null };
    actions.editTask(id, { title: title.value, estimate: estimate.value });
  }

  function remove(id) {
    const { tasks } = current.view;
    const index = tasks.findIndex((task) => task.id === id);
    const neighbour = tasks[index + 1] ?? tasks[index - 1];
    focusAfterDraw = neighbour ? { id: neighbour.id, role: 'delete', selection: null } : null;
    actions.deleteTask(id);
    if (!neighbour) ui.titleInput.focus();
  }

  ui.form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (ui.titleInput.value.trim() !== '') {
      actions.addTask(ui.titleInput.value, ui.form.elements.namedItem('estimate').value);
      ui.form.reset();
    }
    ui.titleInput.focus();
  });

  ui.list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-role]');
    if (!button) return;
    const id = rowId(button);
    const { role } = button.dataset;
    if (role === 'select') actions.selectTask(id);
    else if (role === 'edit') startEditing(id);
    else if (role === 'delete') remove(id);
    else if (role === 'cancel') stopEditing(id);
  });

  ui.list.addEventListener('change', (event) => {
    if (event.target.dataset.role !== 'done') return;
    const id = rowId(event.target);
    focusAfterDraw = { id, role: 'done', selection: null };
    actions.setTaskDone(id, event.target.checked);
  });

  ui.list.addEventListener('submit', (event) => {
    event.preventDefault();
    saveEdit(event.target);
  });

  ui.list.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !event.target.closest('.task-edit')) return;
    event.preventDefault();
    stopEditing(rowId(event.target));
  });

  return { render };
}

function rowId(node) {
  return Number(node.closest('li[data-id]').dataset.id);
}

/** @param {Task} task @param {boolean} isActive @param {Translate} t */
function taskRow(task, isActive, t) {
  const check = el('input', {
    className: 'task-check',
    attrs: { type: 'checkbox', 'aria-label': t('doneLabel', { title: task.title }) },
    dataset: { role: 'done' },
  });
  check.checked = task.done;
  const classes = ['task', isActive ? 'is-active' : '', task.done ? 'is-done' : ''].filter(Boolean).join(' ');
  return el('li', { className: classes, dataset: { id: String(task.id) } }, [
    el('label', { className: 'task-check-hit' }, [check]),
    selectButton(task, isActive, t),
    iconButton('edit', 'edit', t('editTask', { title: task.title })),
    iconButton('delete', 'trash', t('deleteTask', { title: task.title })),
  ]);
}

/** The task's title and its sessions so far; pressing it makes the task the active one. */
function selectButton(task, isActive, t) {
  const fill = el('span');
  fill.style.width = `${Math.round(Math.min(1, task.spent / task.estimate) * 100)}%`;
  const countClass = task.spent > task.estimate ? 'task-count is-over' : 'task-count';
  return el('button', {
    className: 'task-main',
    attrs: {
      type: 'button',
      'aria-pressed': String(isActive),
      disabled: task.done,
      title: t(isActive ? 'activeTask' : 'selectTask'),
    },
    dataset: { role: 'select' },
  }, [
    el('span', { className: 'task-title', text: task.title }),
    el('span', { className: 'task-meta' }, [
      el('span', { className: 'task-bar', attrs: { 'aria-hidden': 'true' } }, [fill]),
      el('span', { className: countClass, text: `${task.spent}/${task.estimate}`, attrs: { 'aria-hidden': 'true' } }),
      el('span', { className: 'visually-hidden', text: t('sessionsProgress', { spent: task.spent, estimate: task.estimate }) }),
    ]),
  ]);
}

function iconButton(role, iconName, label) {
  return el('button', {
    className: 'icon-button',
    attrs: { type: 'button', 'aria-label': label, title: label },
    dataset: { role },
  }, [icon(iconName)]);
}

/** A row in edit mode: title, estimate, Cancel and Save. Enter saves, Escape cancels. */
function editRow(draft, t) {
  const title = el('input', {
    className: 'input',
    attrs: { type: 'text', name: 'title', maxlength: MAX_TITLE_LENGTH, autocomplete: 'off', 'aria-label': t('taskTitleLabel') },
    dataset: { role: 'edit-title' },
  });
  title.value = draft.title;
  const estimate = el('input', {
    attrs: { type: 'number', name: 'estimate', min: 1, max: MAX_ESTIMATE, step: 1, inputmode: 'numeric' },
    dataset: { role: 'edit-estimate' },
  });
  estimate.value = draft.estimate;
  return el('li', { className: 'task is-editing', dataset: { id: String(draft.id) } }, [
    el('form', { className: 'task-edit', attrs: { novalidate: true } }, [
      title,
      el('label', { className: 'estimate', attrs: { title: t('estimateTitle') } }, [
        el('span', { text: t('estimateShort') }),
        estimate,
      ]),
      el('div', { className: 'task-edit-actions' }, [
        el('button', { className: 'btn btn-ghost', text: t('cancel'), attrs: { type: 'button' }, dataset: { role: 'cancel' } }),
        el('button', { className: 'btn btn-accent', text: t('save'), attrs: { type: 'submit' }, dataset: { role: 'save' } }),
      ]),
    ]),
  ]);
}
