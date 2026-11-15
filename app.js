const homeView = document.querySelector('#accueil');
const creationView = document.querySelector('#creation');
const homeStep = document.querySelector('#home-step');
const professionStep = document.querySelector('#profession-step');
const professionSelect = document.querySelector('#profession-select');
const professionError = document.querySelector('#profession-error');
const professionDetail = document.querySelector('#profession-detail');
const emptyDetail = document.querySelector('#empty-detail');
const professionsById = new Map();
const characteristicsById = new Map();

function showView(view) {
  const isCreation = view === 'creation';
  homeView.hidden = isCreation;
  creationView.hidden = !isCreation;
  homeStep.classList.toggle('is-active', !isCreation);
  professionStep.classList.toggle('is-active', isCreation);
  professionStep.classList.toggle('is-locked', !isCreation);
  homeStep.toggleAttribute('aria-current', !isCreation);
  professionStep.toggleAttribute('aria-current', isCreation);
  professionStep.disabled = false;
  professionStep.removeAttribute('aria-disabled');
  professionStep.title = '';

  if (isCreation) {
    window.location.hash = 'creation';
    if (!professionSelect.disabled) professionSelect.focus();
  } else {
    window.location.hash = 'accueil';
    document.querySelector('#new-character').focus();
  }
}

function renderProfession(profession) {
  const hasProfession = Boolean(profession);
  professionDetail.hidden = !hasProfession;
  emptyDetail.hidden = hasProfession;

  if (!hasProfession) return;

  document.querySelector('#detail-name').textContent = profession.name;
  document.querySelector('#detail-realm').textContent = profession.realm.toLocaleUpperCase('fr-FR');
  document.querySelector('#detail-description').textContent = profession.description;

  const primeRequisites = document.querySelector('#prime-requisites');
  primeRequisites.replaceChildren(...profession.primeRequisites.map((characteristicId) => {
    const chip = document.createElement('span');
    chip.className = 'stat-chip';
    chip.textContent = characteristicsById.get(characteristicId).name;
    return chip;
  }));
}

async function loadProfessions() {
  try {
    const [professionsResponse, characteristicsResponse] = await Promise.all([
      fetch('./data/professions.json'),
      fetch('./data/caractéristiques.json')
    ]);
    if (!professionsResponse.ok || !characteristicsResponse.ok) throw new Error('Fichiers de configuration indisponibles');
    const [professionData, characteristicData] = await Promise.all([
      professionsResponse.json(),
      characteristicsResponse.json()
    ]);
    if (!Array.isArray(professionData.professions) || professionData.professions.length === 0) throw new Error('Aucune profession configurée');
    if (!Array.isArray(characteristicData.characteristics)) throw new Error('Liste de caractéristiques invalide');

    characteristicData.characteristics.forEach((characteristic) => {
      characteristicsById.set(characteristic.id, characteristic);
    });

    professionSelect.replaceChildren(new Option('Sélectionnez une profession', ''));
    professionData.professions.forEach((profession) => {
      const missingRequisites = profession.primeRequisites.filter((id) => !characteristicsById.has(id));
      if (missingRequisites.length > 0) throw new Error(`Caractéristiques inconnues : ${missingRequisites.join(', ')}`);
      professionsById.set(profession.id, profession);
      professionSelect.add(new Option(profession.name, profession.id));
    });
    professionSelect.disabled = false;
  } catch (error) {
    professionSelect.replaceChildren(new Option('Professions indisponibles', ''));
    professionError.hidden = false;
  }
}

document.querySelector('#new-character').addEventListener('click', () => showView('creation'));
document.querySelector('#back-home').addEventListener('click', () => showView('home'));
homeStep.addEventListener('click', () => showView('home'));
professionStep.addEventListener('click', () => showView('creation'));

professionSelect.addEventListener('change', () => {
  renderProfession(professionsById.get(professionSelect.value));
});

loadProfessions();
