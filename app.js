const homeView = document.querySelector('#accueil');
const creationView = document.querySelector('#creation');
const homeStep = document.querySelector('#home-step');
const professionStep = document.querySelector('#profession-step');
const professionSelect = document.querySelector('#profession-select');
const raceSelect = document.querySelector('#race-select');
const professionError = document.querySelector('#profession-error');
const raceError = document.querySelector('#race-error');
const professionDetail = document.querySelector('#profession-detail');
const emptyDetail = document.querySelector('#empty-detail');
const professionsById = new Map();
const racesById = new Map();
const characteristicsById = new Map();
let selectedRace = null;
const themeSelect = document.querySelector('#theme-select');

function applyTheme(theme) {
  const selectedTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = selectedTheme;
  themeSelect.value = selectedTheme;
  document.querySelector('meta[name="theme-color"]').content = selectedTheme === 'dark' ? '#111916' : '#f5f7f6';
  try {
    localStorage.setItem('rolemaster-theme', selectedTheme);
  } catch (error) {
    // The selected theme still applies for this session when storage is unavailable.
  }
}

let savedTheme = 'dark';
try {
  savedTheme = localStorage.getItem('rolemaster-theme') || 'dark';
} catch (error) {
  // Keep the default theme when storage is unavailable.
}
applyTheme(savedTheme);
themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

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
  renderRacePresentation();

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

function renderRacePresentation() {
  const raceFlavor = document.querySelector('#race-flavor');
  const shouldShow = Boolean(selectedRace && professionSelect.value);
  raceFlavor.hidden = !shouldShow;
  if (!shouldShow) return;

  document.querySelector('#race-detail-name').textContent = selectedRace.name;
  document.querySelector('#race-detail-description').textContent = selectedRace.description;
}

async function loadRulesData() {
  try {
    const [professionsResponse, characteristicsResponse, racesResponse] = await Promise.all([
      fetch('./data/professions.json'),
      fetch('./data/caractéristiques.json'),
      fetch('./data/races.json')
    ]);
    if (!professionsResponse.ok || !characteristicsResponse.ok || !racesResponse.ok) throw new Error('Fichiers de configuration indisponibles');
    const [professionData, characteristicData, raceData] = await Promise.all([
      professionsResponse.json(),
      characteristicsResponse.json(),
      racesResponse.json()
    ]);
    if (!Array.isArray(professionData.professions) || professionData.professions.length === 0) throw new Error('Aucune profession configurée');
    if (!Array.isArray(characteristicData.characteristics)) throw new Error('Liste de caractéristiques invalide');
    if (!Array.isArray(raceData.races) || raceData.races.length === 0) throw new Error('Aucune race configurée');

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

    raceSelect.replaceChildren(new Option('Sélectionnez une race', ''));
    raceData.races.forEach((race) => {
      const missingModifiers = Object.keys(race.characteristicModifiers).filter((id) => !characteristicsById.has(id));
      if (missingModifiers.length > 0) throw new Error(`Caractéristiques inconnues pour ${race.name} : ${missingModifiers.join(', ')}`);
      racesById.set(race.id, race);
      raceSelect.add(new Option(race.name, race.id));
    });
    professionSelect.disabled = false;
    raceSelect.disabled = false;
  } catch (error) {
    professionSelect.replaceChildren(new Option('Professions indisponibles', ''));
    professionError.hidden = false;
    raceSelect.replaceChildren(new Option('Races indisponibles', ''));
    raceError.hidden = false;
  }
}

document.querySelector('#new-character').addEventListener('click', () => showView('creation'));
document.querySelector('#back-home').addEventListener('click', () => showView('home'));
homeStep.addEventListener('click', () => showView('home'));
professionStep.addEventListener('click', () => showView('creation'));

professionSelect.addEventListener('change', () => {
  renderProfession(professionsById.get(professionSelect.value));
});
raceSelect.addEventListener('change', () => {
  selectedRace = racesById.get(raceSelect.value) || null;
  renderRacePresentation();
});

loadRulesData();
