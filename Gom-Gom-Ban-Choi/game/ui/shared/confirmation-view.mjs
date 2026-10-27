// Shared presentation and lifecycle for choice dialogs; labels/body are trusted game HTML.
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let sequence = 0;

export function confirmationMarkup({ title, body = '', choices, icon, titleId = 'confirm-title', bodyId = 'confirm-body' }) {
  return `<header class="confirm-header"><h2 id="${escape(titleId)}">${escape(title)}</h2><button type="button" class="confirm-close" data-confirm-close aria-label="Close"></button></header>
    ${icon ? `<img class="confirm-hero" src="${escape(icon)}" alt="">` : ''}
    <div class="confirm-body" id="${escape(bodyId)}">${body}</div>
    <div class="store-choices confirm-actions">${choices.map(choice => {
      const style = choice.style ?? '', ad = style.split(/\s+/).includes('ad');
      const label = ad ? choice.label.replace(/^\s*▶\s*/, '') : choice.label;
      return `<button type="button" class="pill-button confirm-action ${escape(style)}" data-choice="${escape(choice.id)}"${choice.domId ? ` id="${escape(choice.domId)}"` : ''}${choice.disabled ? ' disabled' : ''}${choice.autofocus ? ' autofocus' : ''}>${ad ? '<img class="confirm-video-icon" src="./assets/img/idle-reward/icon-video.png" alt="">' : ''}<span class="confirm-action-label">${label}</span></button>`;
    }).join('')}</div>`;
}

export function openConfirmation(options) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog'), key = ++sequence;
    const titleId = `confirm-title-${key}`, bodyId = `confirm-body-${key}`;
    dialog.className = `level-dialog store-dialog confirm-dialog ${options.className ?? ''}`;
    dialog.setAttribute('aria-labelledby', titleId);
    if (options.body) dialog.setAttribute('aria-describedby', bodyId);
    dialog.innerHTML = confirmationMarkup({ ...options, titleId, bodyId });
    dialog.addEventListener('click', event => {
      if (event.target.closest('[data-confirm-close]')) return dialog.close();
      const choice = event.target.closest('[data-choice]');
      if (choice && !choice.disabled) dialog.close(choice.dataset.choice);
    });
    dialog.addEventListener('close', () => { const result = dialog.returnValue || null; dialog.remove(); resolve(result); }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
  });
}
