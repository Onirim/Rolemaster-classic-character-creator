const homeView = document.querySelector('#accueil');
const creationView = document.querySelector('#creation');
const characteristicsView = document.querySelector('#characteristics');
const homeStep = document.querySelector('#home-step');
const professionStep = document.querySelector('#profession-step');
const characteristicsStep = document.querySelector('#characteristics-step');
const professionSelect = document.querySelector('#profession-select');
const raceSelect = document.querySelector('#race-select');
const professionError = document.querySelector('#profession-error');
const raceError = document.querySelector('#race-error');
const professionDetail = document.querySelector('#profession-detail');
const emptyDetail = document.querySelector('#empty-detail');
const continueButton = document.querySelector('#continue-characteristics');
const professionsById = new Map();
const racesById = new Map();
const characteristicsById = new Map();
const mainCharacteristicIds = new Set();
let selectedRace = null;
let characteristicsInOrder = [];
const rolls = Array(10).fill(null);
const rollAssignments = new Map();
let selectedRollIndex = null;
let potentialTable = null;
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
  const isHome = view === 'home';
  const isCreation = view === 'creation';
  const isCharacteristics = view === 'characteristics';
  if (isCreation) {
    professionStep.disabled = false;
    professionStep.removeAttribute('aria-disabled');
    professionStep.title = '';
  }
  homeView.hidden = !isHome;
  creationView.hidden = !isCreation;
  characteristicsView.hidden = !isCharacteristics;
  homeStep.classList.toggle('is-active', isHome);
  professionStep.classList.toggle('is-active', isCreation);
  characteristicsStep.classList.toggle('is-active', isCharacteristics);
  homeStep.classList.toggle('is-locked', !isHome && professionStep.disabled);
  professionStep.classList.toggle('is-locked', professionStep.disabled);
  characteristicsStep.classList.toggle('is-locked', characteristicsStep.disabled);
  homeStep.toggleAttribute('aria-current', isHome);
  professionStep.toggleAttribute('aria-current', isCreation);
  characteristicsStep.toggleAttribute('aria-current', isCharacteristics);
  document.querySelector('.nav-progress span').style.width = isHome ? '0%' : isCreation ? '50%' : '100%';

  if (isHome) {
    window.location.hash = 'accueil';
    document.querySelector('#new-character').focus();
  } else if (isCreation) {
    window.location.hash = 'creation';
    if (!professionSelect.disabled) professionSelect.focus();
  } else {
    window.location.hash = 'characteristics';
    document.querySelector('#characteristics-title').focus();
  }
}

function updateStepAvailability() {
  const canContinue = Boolean(professionSelect.value && raceSelect.value);
  continueButton.disabled = !canContinue;
  characteristicsStep.disabled = !canContinue;
  characteristicsStep.toggleAttribute('aria-disabled', !canContinue);
  characteristicsStep.title = canContinue ? '' : 'Choisissez d’abord une race et une profession';
  characteristicsStep.classList.toggle('is-locked', !canContinue);

  if (!canContinue && !characteristicsView.hidden) showView('creation');
}

function renderProfession(profession) {
  const hasProfession = Boolean(profession);
  mainCharacteristicIds.clear();
  profession?.primeRequisites.forEach((id) => mainCharacteristicIds.add(id));
  professionDetail.hidden = !hasProfession;
  emptyDetail.hidden = hasProfession;
  renderRacePresentation();
  renderAllocation();

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

function setAllocationStatus(message) {
  document.querySelector('#allocation-status').textContent = message;
}

function createRollCards() {
  const grid = document.querySelector('#roll-grid');
  grid.replaceChildren(...rolls.map((_, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'roll-card';
    card.dataset.rollIndex = String(index);
    card.setAttribute('aria-label', `Tirage ${index + 1} : cliquer pour lancer les dés`);
    card.innerHTML = `<span class="roll-invitation">Lancer les dés</span><span class="roll-values" hidden><span class="roll-metric roll-temporary"><span>Temp.</span><strong class="temporary-value"></strong></span><span class="roll-metric roll-potential"><span>Jet pot.</span><strong class="potential-roll-value"></strong></span><span class="roll-metric roll-potential-result"><span>Pot.</span><strong class="potential-stat-value"></strong></span></span><span class="roll-assignment"></span>`;
    card.addEventListener('click', () => {
      if (rolls[index] === null) {
        const temporary = 20 + Math.floor(Math.random() * 81);
        const potentialRoll = 1 + Math.floor(Math.random() * 100);
        rolls[index] = {
          temporary,
          potentialRoll,
          potentialValue: getPotentialValue(temporary, potentialRoll) ?? temporary
        };
        selectedRollIndex = index;
        setAllocationStatus(`Tirage ${index + 1} lancé : temporaire ${temporary}, jet de potentiel ${potentialRoll}, potentielle ${rolls[index].potentialValue ?? '—'}.`);
      } else {
        selectedRollIndex = selectedRollIndex === index ? null : index;
        setAllocationStatus(selectedRollIndex === null
          ? 'Sélection annulée.'
          : `Tirage ${index + 1} sélectionné. Choisissez une caractéristique pour l’affecter.`);
      }
      renderAllocation();
    });
    card.addEventListener('dragstart', (event) => {
      if (rolls[index] === null) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData('text/plain', String(index));
      event.dataTransfer.effectAllowed = 'move';
      selectedRollIndex = index;
      card.classList.add('is-dragging');
      card.classList.add('is-selected');
    });
    card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
    return card;
  }));
}

function getPotentialValue(temporary, potentialRoll) {
  const statRangeIndex = potentialTable.initialStatRanges.findIndex((range) => temporary >= range.min && temporary <= range.max);
  const rollRange = potentialTable.potentialRollRanges.find((range) => potentialRoll >= range.min && potentialRoll <= range.max);
  return statRangeIndex < 0 || !rollRange ? null : rollRange.values[statRangeIndex];
}

function createCharacteristicCards(characteristics) {
  const grid = document.querySelector('#characteristic-grid');
  grid.replaceChildren(...characteristics.map((characteristic) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'characteristic-card';
    card.dataset.characteristicId = characteristic.id;
    card.setAttribute('aria-label', `${characteristic.name} : aucune valeur attribuée`);
    card.innerHTML = `<span class="characteristic-code">${characteristic.id}</span><span class="characteristic-copy"><span class="characteristic-name"></span><span class="characteristic-assigned"><span class="characteristic-temporary">—</span><span class="score-separator">/</span><span class="characteristic-potential">—</span></span></span>`;
    card.querySelector('.characteristic-name').textContent = characteristic.name;
    card.addEventListener('click', () => {
      if (selectedRollIndex === null) return;
      assignRoll(selectedRollIndex, characteristic.id);
    });
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    card.addEventListener('dragenter', (event) => {
      event.preventDefault();
      card.classList.add('is-drop-target');
    });
    card.addEventListener('dragleave', (event) => {
      if (!card.contains(event.relatedTarget)) card.classList.remove('is-drop-target');
    });
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('is-drop-target');
      const index = Number(event.dataTransfer.getData('text/plain'));
      if (Number.isInteger(index) && rolls[index] !== null) assignRoll(index, characteristic.id);
    });
    return card;
  }));
  renderAllocation();
}

function assignRoll(rollIndex, characteristicId) {
  if (rolls[rollIndex] === null) return;
  const previousEntry = [...rollAssignments.entries()].find(([, assignedIndex]) => assignedIndex === rollIndex);
  const previousCharacteristicId = previousEntry?.[0] ?? null;
  const displacedRoll = rollAssignments.get(characteristicId) ?? null;

  if (previousCharacteristicId === characteristicId) {
    selectedRollIndex = null;
    renderAllocation();
    return;
  }

  if (previousCharacteristicId && displacedRoll !== null) {
    rollAssignments.set(previousCharacteristicId, displacedRoll);
  } else if (previousCharacteristicId) {
    rollAssignments.delete(previousCharacteristicId);
  }
  rollAssignments.set(characteristicId, rollIndex);
  selectedRollIndex = null;
  const characteristicName = characteristicsById.get(characteristicId).name;
  setAllocationStatus(`${rolls[rollIndex]} attribué à ${characteristicName}.`);
  renderAllocation();
}

function renderAllocation() {
  const assignedByRoll = new Map([...rollAssignments.entries()].map(([characteristicId, rollIndex]) => [rollIndex, characteristicId]));
  document.querySelectorAll('.roll-card').forEach((card) => {
    const index = Number(card.dataset.rollIndex);
    const result = rolls[index];
    const assignment = assignedByRoll.get(index);
    card.draggable = result !== null;
    card.classList.toggle('is-rolled', result !== null);
    card.classList.toggle('is-selected', selectedRollIndex === index);
    card.classList.toggle('is-assigned', Boolean(assignment));
    card.querySelector('.roll-invitation').hidden = result !== null;
    card.querySelector('.roll-values').hidden = result === null;
    if (result !== null) {
      card.querySelector('.temporary-value').textContent = String(result.temporary);
      card.querySelector('.potential-roll-value').textContent = String(result.potentialRoll);
      card.querySelector('.potential-stat-value').textContent = result.potentialValue ?? '—';
    }
    card.querySelector('.roll-assignment').textContent = assignment ? characteristicsById.get(assignment).id : '';
    card.setAttribute('aria-label', result === null
      ? `Tirage ${index + 1} : cliquer pour lancer les dés`
      : `Tirage ${index + 1} : temporaire ${result.temporary}, jet de potentiel ${result.potentialRoll}, potentielle ${result.potentialValue ?? 'aucune'}.${assignment ? ` Attribué à ${characteristicsById.get(assignment).name}.` : ''}`);
  });

  document.querySelectorAll('.characteristic-card').forEach((card) => {
    const characteristicId = card.dataset.characteristicId;
    const rollIndex = rollAssignments.get(characteristicId);
    const result = rollIndex === undefined ? null : rolls[rollIndex];
    card.classList.toggle('has-value', result !== null);
    card.classList.toggle('is-drop-target', false);
    card.classList.toggle('is-prime-requisite', mainCharacteristicIds.has(characteristicId));
    card.querySelector('.characteristic-temporary').textContent = result === null ? '—' : String(result.temporary);
    card.querySelector('.characteristic-potential').textContent = result === null ? '—' : String(result.potentialValue);
    card.setAttribute('aria-label', `${characteristicsById.get(characteristicId).name}${mainCharacteristicIds.has(characteristicId) ? ', caractéristique principale' : ''} : ${result === null ? 'aucune valeur attribuée' : `temporaire ${result.temporary}, potentiel ${result.potentialValue}`}`);
  });

  const rolledCount = rolls.filter((value) => value !== null).length;
  document.querySelector('#roll-progress').textContent = `${rolledCount} / 10 lancés`;
  document.querySelector('#assignment-progress').textContent = `${rollAssignments.size} / ${characteristicsInOrder.length} attribuées`;
}

async function loadRulesData() {
  try {
    const [professionsResponse, characteristicsResponse, racesResponse, potentialResponse] = await Promise.all([
      fetch('./data/professions.json'),
      fetch('./data/caractéristiques.json'),
      fetch('./data/races.json'),
      fetch('./data/potential-table.json')
    ]);
    if (!professionsResponse.ok || !characteristicsResponse.ok || !racesResponse.ok || !potentialResponse.ok) throw new Error('Fichiers de configuration indisponibles');
    const [professionData, characteristicData, raceData, potentialData] = await Promise.all([
      professionsResponse.json(),
      characteristicsResponse.json(),
      racesResponse.json(),
      potentialResponse.json()
    ]);
    if (!Array.isArray(professionData.professions) || professionData.professions.length === 0) throw new Error('Aucune profession configurée');
    if (!Array.isArray(characteristicData.characteristics)) throw new Error('Liste de caractéristiques invalide');
    if (!Array.isArray(raceData.races) || raceData.races.length === 0) throw new Error('Aucune race configurée');
    if (!Array.isArray(potentialData.initialStatRanges) || !Array.isArray(potentialData.potentialRollRanges)) throw new Error('Table des potentiels invalide');
    potentialTable = potentialData;

    characteristicData.characteristics.forEach((characteristic) => {
      characteristicsById.set(characteristic.id, characteristic);
    });
    characteristicsInOrder = characteristicData.characteristics;
    createRollCards();
    createCharacteristicCards(characteristicsInOrder);

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
    updateStepAvailability();
  } catch (error) {
    professionSelect.replaceChildren(new Option('Professions indisponibles', ''));
    professionError.hidden = false;
    raceSelect.replaceChildren(new Option('Races indisponibles', ''));
    raceError.hidden = false;
  }
}

document.querySelector('#new-character').addEventListener('click', () => showView('creation'));
document.querySelector('#back-home').addEventListener('click', () => showView('home'));
document.querySelector('#back-profession').addEventListener('click', () => showView('creation'));
continueButton.addEventListener('click', () => showView('characteristics'));
homeStep.addEventListener('click', () => showView('home'));
professionStep.addEventListener('click', () => showView('creation'));
characteristicsStep.addEventListener('click', () => showView('characteristics'));

professionSelect.addEventListener('change', () => {
  renderProfession(professionsById.get(professionSelect.value));
  updateStepAvailability();
});
raceSelect.addEventListener('change', () => {
  selectedRace = racesById.get(raceSelect.value) || null;
  renderRacePresentation();
  updateStepAvailability();
});

loadRulesData();
