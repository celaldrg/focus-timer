/**
 * A small yes/no dialog for actions that throw work away, such as switching the session type while a
 * session is under way. Cancel, Escape and a click on the backdrop close it without doing anything.
 * Cancel comes first in the markup, so it is the button that has focus when the dialog opens.
 */
import { setText } from './dom.js';

/**
 * @typedef {object} Question
 * @property {string} title
 * @property {string} body
 * @property {string} confirm  label of the button that goes ahead
 */

/**
 * Connects the confirmation dialog.
 * @param {HTMLDialogElement} dialog  contains #confirm-title, #confirm-body and a form with Cancel and confirm buttons
 * @returns {{ ask(question: Question, onConfirm: () => void): void }}
 */
export function createConfirmDialog(dialog) {
  const form = dialog.querySelector('form');
  const parts = {
    title: dialog.querySelector('#confirm-title'),
    body: dialog.querySelector('#confirm-body'),
    confirm: form.querySelector('[data-role="confirm"]'),
  };
  let pending = null;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const action = pending;
    pending = null;
    dialog.close();
    action?.();
  });
  form.querySelector('[data-role="cancel"]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  // The close event comes a moment after closing; by then a new question may have reopened the dialog.
  dialog.addEventListener('close', () => {
    if (!dialog.open) pending = null;
  });

  return {
    ask(question, onConfirm) {
      setText(parts.title, question.title);
      setText(parts.body, question.body);
      setText(parts.confirm, question.confirm);
      pending = onConfirm;
      if (!dialog.open) dialog.showModal();
    },
  };
}
