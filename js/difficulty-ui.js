// difficulty-ui.js
// The difficulty choice at the start of a new trip (trip-rules.js): easy,
// intermediate or hard, chosen once. Each return to an area is then one level
// harder by itself. Resolves with the level picked.

const CHOICES = [
  ['easy',         'Easy',         'Life meters run slow at first; collect half of what an area holds. Good for younger players.'],
  ['intermediate', 'Intermediate', 'The game as it was made to be played; collect 70%.'],
  ['hard',         'Hard',         'Meters run faster; collect 90%. For croc wranglers.'],
];

export function chooseDifficulty() {
  return new Promise(resolve => {
    const box = document.createElement('section');
    box.className = 'overlay difficulty'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Choose how hard');
    box.innerHTML = '<div class="card"><h2>How hard?</h2><p class="fine">Chosen once for this trip. Every time Wally goes back to a place, it gets one level harder by itself.</p><div class="difficulty-list"></div></div>';
    const list = box.querySelector('.difficulty-list');
    for (const [id, name, about] of CHOICES) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'difficulty-choice' + (id === 'intermediate' ? ' suggested' : '');
      b.innerHTML = '<b></b><small></small>';
      b.querySelector('b').textContent = name; b.querySelector('small').textContent = about;
      b.onclick = () => { box.remove(); resolve(id); };
      list.append(b);
    }
    document.body.append(box);
    list.querySelector('.suggested').focus();
  });
}
