import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ESTIMATE, MAX_TITLE_LENGTH, addTask, createTaskList, creditActiveTask, deleteTask, editTask,
  restoreTaskList, selectTask, setTaskDone,
} from '../src/tasks.js';

function listOf(...titles) {
  return titles.reduce((list, title) => addTask(list, title, 2), createTaskList());
}

test('adding tasks: titles are cleaned, ids count up, the first open task becomes active', () => {
  let list = addTask(createTaskList(), '  Write   the report \n', 3);
  list = addTask(list, 'Second', '2');
  assert.deepEqual(list.items, [
    { id: 1, title: 'Write the report', estimate: 3, spent: 0, done: false },
    { id: 2, title: 'Second', estimate: 2, spent: 0, done: false },
  ]);
  assert.equal(list.activeId, 1);
  assert.equal(list.nextId, 3);
});

test('empty titles are ignored, long titles cut, estimates clamped', () => {
  const empty = createTaskList();
  assert.equal(addTask(empty, '   '), empty);
  assert.equal(addTask(empty, undefined), empty);

  const list = addTask(addTask(empty, 'x'.repeat(500), 0), 'Big', 99);
  assert.equal(list.items[0].title.length, MAX_TITLE_LENGTH);
  assert.equal(list.items[0].estimate, 1);
  assert.equal(list.items[1].estimate, MAX_ESTIMATE);
  assert.equal(addTask(empty, 'No estimate').items[0].estimate, 1);
});

test('editing changes title and estimate, keeping old values for invalid fields', () => {
  const list = listOf('Old title');
  assert.deepEqual(editTask(list, 1, { title: ' New title ', estimate: 5 }).items[0],
    { id: 1, title: 'New title', estimate: 5, spent: 0, done: false });
  assert.deepEqual(editTask(list, 1, { title: '  ', estimate: 'many' }).items[0], list.items[0]);
  assert.equal(editTask(list, 1, { estimate: 4 }).items[0].title, 'Old title');
  assert.equal(editTask(list, 99, { title: 'Nope' }), list);
});

test('finishing the active task hands the focus to the first open task', () => {
  let list = listOf('A', 'B', 'C');
  list = setTaskDone(list, 1, true);
  assert.equal(list.items[0].done, true);
  assert.equal(list.activeId, 2);

  list = setTaskDone(setTaskDone(list, 2, true), 3, true);
  assert.equal(list.activeId, null);

  list = setTaskDone(list, 2, false);
  assert.equal(list.activeId, 2);
});

test('deleting a task removes it and repairs the active task', () => {
  let list = listOf('A', 'B');
  list = deleteTask(list, 1);
  assert.deepEqual(list.items.map((task) => task.title), ['B']);
  assert.equal(list.activeId, 2);
  assert.equal(deleteTask(list, 42), list);
  assert.equal(deleteTask(list, 2).activeId, null);
});

test('only open tasks can be selected', () => {
  const list = setTaskDone(listOf('A', 'B', 'C'), 3, true);
  assert.equal(selectTask(list, 2).activeId, 2);
  assert.equal(selectTask(list, 3), list);
  assert.equal(selectTask(list, 99), list);
});

test('a completed focus session is credited to the active task only', () => {
  let list = selectTask(listOf('A', 'B'), 2);
  list = creditActiveTask(creditActiveTask(list));
  assert.deepEqual(list.items.map((task) => task.spent), [0, 2]);
  const empty = createTaskList();
  assert.equal(creditActiveTask(empty), empty);
});

test('updates return new lists and never mutate the old one', () => {
  const list = listOf('A', 'B');
  const snapshot = structuredClone(list);
  addTask(list, 'C');
  editTask(list, 1, { title: 'Z' });
  setTaskDone(list, 1, true);
  deleteTask(list, 2);
  selectTask(list, 2);
  creditActiveTask(list);
  assert.deepEqual(list, snapshot);
});

test('restoring keeps valid tasks and repairs everything else', () => {
  const saved = JSON.parse(JSON.stringify(creditActiveTask(listOf('A', 'B'))));
  assert.deepEqual(restoreTaskList(saved), saved);

  const restored = restoreTaskList({
    items: [
      { id: 4, title: 'Keep', estimate: 50, spent: 2, done: false },
      { id: 4, title: 'Duplicate id', estimate: 1, spent: 0, done: false },
      { id: 'x', title: 'Bad id', estimate: 1, spent: 0, done: false },
      { id: 7, title: '   ', estimate: 1, spent: 0, done: false },
      { id: 9, title: 'Odd fields', estimate: 'two', spent: -3, done: 'yes' },
      null,
    ],
    activeId: 123,
    nextId: 2,
  });
  assert.deepEqual(restored, {
    items: [
      { id: 4, title: 'Keep', estimate: MAX_ESTIMATE, spent: 2, done: false },
      { id: 9, title: 'Odd fields', estimate: 1, spent: 0, done: false },
    ],
    activeId: 4,
    nextId: 10,
  });

  for (const input of [undefined, null, 'tasks', { items: 'none' }]) {
    assert.deepEqual(restoreTaskList(input), createTaskList());
  }
});
